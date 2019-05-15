import { BehaviorSubject, combineLatest, from } from 'rxjs'
import { filter, switchMap } from 'rxjs/operators'
import * as sourcegraph from 'sourcegraph'
import { createDecoration, findEmptyConfigs, getParamsFromUriPath, matchSentryProject } from './handler'
import { resolveSettings, SentryProject, Settings } from './settings'

/**
 * Params derived from the document's URI.
 */
interface Params {
    repo: string | null
    file: string | null
}

/**
 * Common error log patterns to use in case no line matching regexes
 * are set in the sentry extension settings.
 */
const COMMON_ERRORLOG_PATTERNS = [
    // typescript/javascript
    /throw new Error+\(['"]([^'"]+)['"]\)/gi,
    /console\.(error|info|warn)\(['"`]([^'"`]+)['"`]\)/gi,
    // go
    /log\.(Printf|Print|Println)\(['"]([^'"]+)['"]\)/gi,
    /fmt\.Errorf\(['"]([^'"]+)['"]\)/gi,
    /errors\.New\(['"]([^'"]+)['"]\)/gi,
    /err\.message\(['"`]([^'"`$]+)['"`]\)/gi,
    /panic\(['"]([^'"]+)['"]\)/gi,
    // python
    /raise (TypeError|ValueError)\(['"`]([^'"`]+)['"`]\)/gi,
    // java
    /logger\.(debug|error)\(['"`]([^'"`]+)['"`]\);/gi,
]
const DECORATION_TYPE = sourcegraph.app.createDecorationType()

export function activate(context: sourcegraph.ExtensionContext): void {
    // TODO: Change this when https://github.com/sourcegraph/sourcegraph/issues/3557 is resolved
    const configurationChanges = new BehaviorSubject<void>(undefined)
    context.subscriptions.add(sourcegraph.configuration.subscribe(() => configurationChanges.next(undefined)))
    if (sourcegraph.app.activeWindowChanges) {
        const activeEditor = from(sourcegraph.app.activeWindowChanges).pipe(
            filter((window): window is sourcegraph.Window => window !== undefined),
            switchMap(window => window.activeViewComponentChanges),
            filter((editor): editor is sourcegraph.CodeEditor => editor !== undefined)
        )

        // When the active editor changes, publish new decorations.
        context.subscriptions.add(
            combineLatest([configurationChanges, activeEditor]).subscribe(([, editor]) => {
                const settings = resolveSettings(sourcegraph.configuration.get<Settings>().value)
                const sentryProjects = settings['sentry.projects']

                if (editor.document.text) {
                    const decorationSettings = settings['sentry.decorations.inline']
                    if (!decorationSettings) {
                        editor.setDecorations(DECORATION_TYPE, []) // clear decorations
                        return
                    }

                    const decorations = getDecorations(editor.document.uri, editor.document.text, sentryProjects)

                    if (decorations.length === 0) {
                        return
                    }

                    editor.setDecorations(DECORATION_TYPE, decorations)
                }
            })
        )
    }
}

/**
 * Get and varify the necessary uri and config data and build the decorations.
 * @param documentUri the current document's URI
 * @param documentText content of the document being scanned for error handling code
 * @param sentryProjects list of Sentry projects sourced from the user's Sentry extension configurations
 */
export function getDecorations(
    documentUri: string,
    documentText: string,
    sentryProjects?: SentryProject[]
): sourcegraph.TextDocumentDecoration[] {
    const params: Params = getParamsFromUriPath(documentUri)

    const matched = sentryProjects && matchSentryProject(params, sentryProjects)
    let missingConfigData: string[] = []

    // Do not decorate lines if the document file format does not match the
    // file matching patterns listed in the Sentry extension configurations.
    if (matched && matched.fileMatched === false) {
        return []
    }
    if (matched && matched.project) {
        missingConfigData = findEmptyConfigs(matched.project)

        return buildDecorations(
            missingConfigData,
            documentText,
            matched.project.projectId,
            matched.project.linePatterns
        )
    }
    return buildDecorations(missingConfigData, documentText)
}

/**
 * Build decorations by matching error handling code with either user config or common error patterns.
 * @param missingConfigData list of missing configs that will appear as a hover warning on the Sentry link
 * @param documentText content of the document being scanned for error handling code
 * @param sentryProjectId Sentry project id retrieved from Sentry extension settings
 * @param linePatterns line patching patterns set in the user's Sentry extension configurations
 * @return a list of decorations to render as links on each matching line
 */
// TODO: add tests for that new function (kind of like getBlameDecorations())
export function buildDecorations(
    missingConfigData: string[],
    documentText: string,
    sentryProjectId?: string,
    linePatterns?: RegExp[]
): sourcegraph.TextDocumentDecoration[] {
    const decorations: sourcegraph.TextDocumentDecoration[] = []

    for (const [index, line] of documentText.split('\n').entries()) {
        let match: RegExpExecArray | null

        for (let pattern of linePatterns && linePatterns.length > 0 ? linePatterns : COMMON_ERRORLOG_PATTERNS) {
            pattern = new RegExp(pattern, 'gi')

            do {
                match = pattern.exec(line)
                // Depending on the line matching pattern the query m is indexed in position 1 or 2.
                // TODO: Specify which capture group should be used through configuration.

                if (match && match.length <= 2) {
                    decorations.push(decorateLine(index, match[1], missingConfigData, sentryProjectId))
                } else if (match && match.length > 2) {
                    decorations.push(decorateLine(index, match[2], missingConfigData, sentryProjectId))
                }
            } while (match)

            pattern.lastIndex = 0 // reset
        }
    }
    return decorations
}

/**
 * Decorate a line that matches either the line match pattern from the Sentry extension configurations
 * or that matches common error loggin patterns.
 * @param index for decoration range
 * @param match for a line containing an error query
 * @param missingConfigData list of missing configs that will appear as a hover warning on the Sentry link
 * @param sentryProjectId Sentry project id retrieved from Sentry extension settings
 * @return either a successful or a warning decoration to render the Sentry link
 */
export function decorateLine(
    index: number,
    match: string,
    missingConfigData: string[],
    sentryProjectId?: string
): sourcegraph.TextDocumentDecoration {
    const sentryOrg = resolveSettings(sourcegraph.configuration.get<Settings>().value)['sentry.organization']
    const lineDecorationText = createDecoration(missingConfigData, sentryOrg, sentryProjectId)
    const decoration: sourcegraph.TextDocumentDecoration = {
        range: new sourcegraph.Range(index, 0, index, 0),
        isWholeLine: true,
        after: {
            backgroundColor: missingConfigData.length === 0 && sentryProjectId ? '#e03e2f' : '#f2736d',
            color: 'rgba(255, 255, 255, 0.8)',
            contentText: lineDecorationText.content,
            hoverMessage: lineDecorationText.hover,
            // TODO: If !SENTRYORGANIZATION is missing in config, link to $USER/settings and hint
            // user to fill it out.
            linkURL: !sentryOrg
                ? ''
                : sentryProjectId
                ? buildUrl(match, sentryProjectId).toString()
                : buildUrl(match).toString(),
        },
    }
    return decoration
}

/**
 * Build URL to the Sentry issues stream page with the Sentry Org, query and, if available, Sentry project ID.
 * @param errorQuery extracted from the error handling code matching the config matching pattern.
 * @param sentryProjectId from the associated Sentry project receiving logs from the document's repo.
 * @return URL to the Sentry unresolved issues stream page for this kind of query.
 */
function buildUrl(errorQuery: string, sentryProjectId?: string): URL {
    const sentryOrg = resolveSettings(sourcegraph.configuration.get<Settings>().value)['sentry.organization']
    const url = new URL('https://sentry.io/organizations/' + sentryOrg + '/issues/')

    if (sentryProjectId) {
        url.searchParams.set('project', sentryProjectId)
        url.searchParams.set('query', 'is:unresolved ' + errorQuery)
        url.searchParams.set('statsPeriod', '14d')
    }

    return url
}
