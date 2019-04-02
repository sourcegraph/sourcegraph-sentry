import { from } from 'rxjs'
import { filter, switchMap } from 'rxjs/operators'
import * as sourcegraph from 'sourcegraph'
import { getParamsFromUriPath, matchSentryProject } from './handler'
import { resolveSettings, Settings } from './settings'

/**
 * Params derived from the document's URI.
 */
interface Params {
    repo: string | null
    file: string | null
}

interface LineDecorationText {
    content: string
    hover: string
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
    /console\.(log|error|info|warn)\(['"`]([^'"`]+)['"`]\)/gi,
    /log\.(Printf|Print|Println)\(['"]([^'"]+)['"]\)/gi,
]

export function activate(context: sourcegraph.ExtensionContext): void {
    sourcegraph.workspace.onDidOpenTextDocument.subscribe(textDocument => {
        const params: Params = getParamsFromUriPath(textDocument.uri)
        const sentryProjects = SETTINGSCONFIG['sentry.projects']

        // Retrieve the Sentry project that this document reports to.
        const sentryProject = sentryProjects ? matchSentryProject(params, sentryProjects) : null

        if (sourcegraph.app.activeWindowChanges) {
            const activeEditor = from(sourcegraph.app.activeWindowChanges).pipe(
                filter((window): window is sourcegraph.Window => window !== undefined),
                switchMap(window => window.activeViewComponentChanges),
                filter((editor): editor is sourcegraph.CodeEditor => editor !== undefined)
            )
            // When the active editor changes, publish new decorations.
            context.subscriptions.add(
                activeEditor.subscribe(editor => {
                    sentryProject
                        ? decorateEditor(
                              editor,
                              sentryProject.projectId,
                              sentryProject.lineMatches,
                              sentryProject.fileMatch
                          )
                        : decorateEditor(editor)
                })
            )
        }
    })
}

function decorateEditor(
    editor: sourcegraph.CodeEditor,
    sentryProjectId?: string,
    lineMatches?: RegExp[],
    fileMatch?: boolean | null
): void {
    // Do not decorate lines if the document file format does not match the
    // file matching patterns listed in the Sentry extension configurations.
    if (fileMatch === false) {
        return
    }
    const decorations: sourcegraph.TextDocumentDecoration[] = []
    for (const [i, line] of editor.document.text!.split('\n').entries()) {
        let m: RegExpExecArray | null
        for (let pattern of lineMatches ? lineMatches : COMMON_ERRORLOG_PATTERNS) {
            pattern = new RegExp(pattern, 'gi')
            do {
                m = pattern.exec(line)
                if (m) {
                    decorations.push(decorateLine(i, m, sentryProjectId, fileMatch))
                }
            } while (m)
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
    sentryProjectId?: string,
    fileMatch?: boolean | null
): sourcegraph.TextDocumentDecoration {
    const lineDecorationText = setLineDecorationText(sentryProjectId, fileMatch)
    const decoration: sourcegraph.TextDocumentDecoration = {
        range: new sourcegraph.Range(index, 0, index, 0),
        isWholeLine: true,
        after: {
            backgroundColor: '#e03e2f',
            color: 'rgba(255, 255, 255, 0.8)',
            contentText: lineDecorationText.content,
            hoverMessage: lineDecorationText.hover,
            // Depending on the line matching pattern the query m is indexed in position 1 or 2.
            linkURL: !SENTRYORGANIZATION
                ? ''
                : sentryProjectId
                ? buildUrl(match.length > 2 ? match[2] : match[1], sentryProjectId).toString()
                : buildUrl(match.length > 2 ? match[2] : match[1]).toString(),
        },
    }
    return decoration
}

export function setLineDecorationText(sentryProjectId?: string, fileMatch?: boolean | null): LineDecorationText {
    let contentText = ' View logs in Sentry » '
    let hoverText = ' View logs in Sentry » '

    if (!SENTRYORGANIZATION) {
        contentText = ' Configure the Sentry extension to view logs. '
        hoverText = ' Configure the Sentry extension to view logs in Sentry. '
    } else if (!sentryProjectId) {
        contentText = ' View logs in Sentry (❕)» '
        hoverText = ' Add Sentry projects to your Sentry extension settings for project matching.'
    } else if (!fileMatch) {
        // If fileMatch is null (= not specified in the Sentry extension settings), suggest adding file matching
        contentText = ' View logs in Sentry (❕)» '
        hoverText = ' Add Sentry file matching regexes to your Sentry extension settings for file matching.'
    }
    return {
        content: contentText,
        hover: hoverText,
    }
}

/**
 * Build URL to the Sentry issues stream page with the Sentry Org, query and, if available, Sentry project ID.
 * @param errorQuery extracted from the error handling code matching the config matching pattern.
 * @param sentryProjectId from the associated Sentry project receiving logs from the document's repo.
 * @return URL to the Sentry unresolved issues stream page for this kind of query.
 */
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
