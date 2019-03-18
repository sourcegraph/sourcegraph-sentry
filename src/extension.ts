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

const DECORATION_TYPE = sourcegraph.app.createDecorationType()
const SETTINGSCONFIG = resolveSettings(sourcegraph.configuration.get<Settings>().value)
const SENTRYORGANIZATION = SETTINGSCONFIG['sentry.organization']

const COMMON_ERRORLOG_PATTERNS = [
    /throw new Error+\(['"]([^'"]+)['"]\)/gi,
    /console\.[^'"`]+\(['"`]([^'"`]+)['"`]\)/gi,
    /log\.[^'"]+\(['"]([^'"]+)['"]\)/gi,
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
                        ? decorateEditor(editor, sentryProject.projectId, sentryProject.lineMatches)
                        : decorateEditor(editor)
                })
            )
        }
    })
}

function decorateEditor(editor: sourcegraph.CodeEditor, sentryProjectId?: string, lineMatches?: RegExp[]): void {
    if (!editor) {
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
                    decorations.push(decorateLine(i, m, sentryProjectId))
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
 * @param i index for decoration range
 * @param m line match containing error query
 * @param sentryProjectId Sentry project id retrieved from Sentry extension settings
 */
export function decorateLine(
    i: number,
    m: RegExpExecArray,
    sentryProjectId?: string
): sourcegraph.TextDocumentDecoration {
    let decoration: sourcegraph.TextDocumentDecoration
    decoration = {
        range: new sourcegraph.Range(i, 0, i, 0),
        isWholeLine: true,
        after: {
            backgroundColor: '#e03e2f',
            color: 'rgba(255, 255, 255, 0.8)',
            contentText: !SENTRYORGANIZATION
                ? ' Add Sentry extension configurations to your settings to view logs in Sentry » '
                : ' View logs in Sentry » ',
            hoverMessage: !SENTRYORGANIZATION
                ? ' Add Sentry extension configurations to your settings to view logs in Sentry. '
                : sentryProjectId
                ? ' View logs in Sentry » '
                : ' View logs in Sentry, add Sentry projects to your settings for project matching.',
            // Depending on the line matching pattern the query m is indexed in position 1 or 2.
            linkURL: !SENTRYORGANIZATION
                ? ''
                : sentryProjectId
                ? buildUrl(m.length > 2 ? m[2] : m[1], sentryProjectId).toString()
                : buildUrl(m.length > 2 ? m[2] : m[1]).toString(),
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
