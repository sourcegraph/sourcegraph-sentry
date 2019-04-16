import { from } from 'rxjs'
import { filter, switchMap } from 'rxjs/operators'
import * as sourcegraph from 'sourcegraph'
import {
    checkMissingConfig,
    createDecoration,
    getParamsFromUriPath,
    isFileMatched,
    matchSentryProject,
} from './handler'
import { resolveSettings, Settings } from './settings'

/**
 * Params derived from the document's URI.
 */
interface Params {
    repo: string | null
    file: string | null
}

const DECORATION_TYPE = sourcegraph.app.createDecorationType()
const SETTINGSCONFIG = resolveSettings(sourcegraph.configuration.get<Settings>().value)
const SENTRYORGANIZATION = SETTINGSCONFIG['sentry.organization']

/**
 * Common error log patterns to use in case no line matching regexes
 * are set in the sentry extension settings.
 */
const COMMON_ERRORLOG_PATTERNS = [
    /throw new Error+\(['"]([^'"]+)['"]\)/gi,
    /console\.(error|info|warn)\(['"`]([^'"`]+)['"`]\)/gi,
    /log\.(Printf|Print|Println)\(['"]([^'"]+)['"]\)/gi,
]

export function activate(context: sourcegraph.ExtensionContext): void {
    if (sourcegraph.app.activeWindowChanges) {
        const activeEditor = from(sourcegraph.app.activeWindowChanges).pipe(
            filter((window): window is sourcegraph.Window => window !== undefined),
            switchMap(window => window.activeViewComponentChanges),
            filter((editor): editor is sourcegraph.CodeEditor => editor !== undefined)
        )
        // When the active editor changes, publish new decorations.
        context.subscriptions.add(
            activeEditor.subscribe(editor => {
                const params: Params = getParamsFromUriPath(editor.document.uri)
                const sentryProjects = SETTINGSCONFIG['sentry.projects']

                // Retrieve the Sentry project that this document reports to.
                // TODO: Move this outside of activate() and into a separate, testable function.
                const sentryProject = sentryProjects && matchSentryProject(params, sentryProjects)
                let missingConfigData: string[] = []
                let fileMatched: boolean | null

                if (sentryProject) {
                    missingConfigData = checkMissingConfig(sentryProject)
                    fileMatched = isFileMatched(params, sentryProject)
                    // Do not decorate lines if the document file format does not match the
                    // file matching patterns listed in the Sentry extension configurations.
                    if (fileMatched === false) {
                        return
                    }
                    decorateEditor(
                        editor,
                        missingConfigData,
                        sentryProject.projectId,
                        sentryProject.patternProperties.lineMatches
                    )
                } else {
                    decorateEditor(editor, missingConfigData)
                }
            })
        )
    }
}

// TODO: Refactor so that it calls a new function that returns TextDocumentDecoration[],
// and add tests for that new function (kind of like getBlameDecorations())
function decorateEditor(
    editor: sourcegraph.CodeEditor,
    missingConfigData: string[],
    sentryProjectId?: string,
    lineMatches?: RegExp[]
): void {
    const decorations: sourcegraph.TextDocumentDecoration[] = []
    for (const [index, line] of editor.document.text!.split('\n').entries()) {
        let match: RegExpExecArray | null
        for (let pattern of lineMatches ? lineMatches : COMMON_ERRORLOG_PATTERNS) {
            pattern = new RegExp(pattern, 'gi')
            do {
                match = pattern.exec(line)
                if (match) {
                    decorations.push(decorateLine(index, match, missingConfigData, sentryProjectId))
                }
            } while (match)
            pattern.lastIndex = 0 // reset
        }
    }
    editor.setDecorations(DECORATION_TYPE, decorations)
}

/**
 * Decorate a line that matches either the line match pattern from the Sentry extension configurations
 * or that matches common error loggin patterns.
 * @param index for decoration range
 * @param match for a line containing an error query
 * @param sentryProjectId Sentry project id retrieved from Sentry extension settings
 */
export function decorateLine(
    index: number,
    match: RegExpExecArray,
    missingConfigData: string[],
    sentryProjectId?: string
): sourcegraph.TextDocumentDecoration {
    const lineDecorationText = createDecoration(missingConfigData, SENTRYORGANIZATION, sentryProjectId)
    const decoration: sourcegraph.TextDocumentDecoration = {
        range: new sourcegraph.Range(index, 0, index, 0),
        isWholeLine: true,
        after: {
            backgroundColor: missingConfigData.length === 0 ? '#e03e2f' : '#f2736d',
            color: 'rgba(255, 255, 255, 0.8)',
            contentText: lineDecorationText.content,
            hoverMessage: lineDecorationText.hover,
            // Depending on the line matching pattern the query m is indexed in position 1 or 2.
            // TODO: Specify which capture group should be used through configuration.
            // TODO: If !SENTRYORGANIZATION is missing in config, link to $USER/settings and hint
            // user to fill it out.
            linkURL: !SENTRYORGANIZATION
                ? ''
                : sentryProjectId
                ? buildUrl(match.length > 2 ? match[2] : match[1], sentryProjectId).toString()
                : buildUrl(match.length > 2 ? match[2] : match[1]).toString(),
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
// TODO: Use URLSearchParams instead of encodeURIComponent
function buildUrl(errorQuery: string, sentryProjectId?: string): URL {
    const url = new URL(
        'https://sentry.io/organizations/' +
            encodeURIComponent(SENTRYORGANIZATION!) +
            '/issues/' +
            (sentryProjectId
                ? '?project=' +
                  encodeURIComponent(sentryProjectId) +
                  '&query=is%3Aunresolved+' +
                  encodeURIComponent(errorQuery) +
                  '&statsPeriod=14d'
                : '')
    )
    return url
}
