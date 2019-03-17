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

export function activate(context: sourcegraph.ExtensionContext): void {
    sourcegraph.workspace.onDidOpenTextDocument.subscribe(textDocument => {
        const params: Params = getParamsFromUriPath(textDocument.uri)
        const sentryProjects = SETTINGSCONFIG['sentry.projects']

        // Retrieve the Sentry project that this document reports to.
        const sentryProject = matchSentryProject(params, sentryProjects)

        if (sourcegraph.app.activeWindowChanges && sentryProjects && sentryProject) {
            const activeEditor = from(sourcegraph.app.activeWindowChanges).pipe(
                filter((window): window is sourcegraph.Window => window !== undefined),
                switchMap(window => window.activeViewComponentChanges),
                filter((editor): editor is sourcegraph.CodeEditor => editor !== undefined)
            )

            // When the active editor changes, publish new decorations.
            context.subscriptions.add(
                activeEditor.subscribe(editor => {
                    decorateEditor(editor, sentryProject.projectId, sentryProject.lineMatches)
                })
            )
        }
    })
}

function decorateEditor(editor: sourcegraph.CodeEditor, sentryProjectId: string, lineMatches: RegExp[]): void {
    if (!editor) {
        return
    }
    const decorations: sourcegraph.TextDocumentDecoration[] = []
    for (const [i, line] of editor.document.text!.split('\n').entries()) {
        let m: RegExpExecArray | null
        for (let pattern of lineMatches) {
            pattern = new RegExp(pattern, 'gi')
            do {
                m = pattern.exec(line)
                if (m) {
                    decorations.push({
                        range: new sourcegraph.Range(i, 0, i, 0),
                        isWholeLine: true,
                        after: {
                            backgroundColor: '#e03e2f',
                            color: 'rgba(255, 255, 255, 0.8)',
                            contentText: ' View logs in Sentry » ',
                            // Depending on the line matching pattern the query is indexed in position 1 or 2.
                            linkURL: buildUrl(m.length > 2 ? m[2] : m[1], sentryProjectId).toString(),
                        },
                    })
                }
            } while (m)
            pattern.lastIndex = 0 // reset
        }
    }
    editor.setDecorations(DECORATION_TYPE, decorations)
}

/**
 * Build URL to the Sentry issues stream page with the Sentry Org, Sentry project ID, and query.
 * @param errorQuery extracted from the error handling code matching the config matching pattern.
 * @param sentryProjectId from the associated Sentry project receiving logs from the document's repo.
 * @return URL to the Sentry unresolved issues stream page for this kind of query.
 */
function buildUrl(errorQuery: string, sentryProjectId: string): URL {
    const url = new URL(
        'https://sentry.io/organizations/' +
            encodeURIComponent(SETTINGSCONFIG['sentry.organization']!) +
            '/issues/?project=' +
            encodeURIComponent(sentryProjectId) +
            '&query=is%3Aunresolved+' +
            encodeURIComponent(errorQuery) +
            '&statsPeriod=14d'
    )
    return url
}
