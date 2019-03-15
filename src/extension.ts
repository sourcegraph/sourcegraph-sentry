import { from } from 'rxjs'
import { filter, switchMap } from 'rxjs/operators'
import * as sourcegraph from 'sourcegraph'
import { resolveSettings, Settings } from './settings'

/**
 * Params derived from the document's URI.
 */
interface Params {
    repo: string | null
    file: string | null
}

interface SentryProject {
    projectId: string
    lineMatches: RegExp[]
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

/**
 * Extract Sentry params from document URI necessary to
 * check if the current document sends log events to Sentry and
 * use these params build URL to the Sentry issues stream page.
 * @param textDocument A document URI.
 * @returns repo and file part of URI.
 */
export function getParamsFromUriPath(textDocument: string): Params {
    // TODO: Support more than just GitHub.
    const repoPattern = /github\.com\/([^\?\#]+)/gi
    const filePattern = /#([^\?\#\/]+)\/.*\.?$/gi
    const repoM = repoPattern.exec(textDocument)
    const fileM = filePattern.exec(textDocument)
    return {
        repo: repoM![1],
        file: fileM![0],
    }
}

/**
 * Verify if the params from the document URI match with the repo and file formats specified
 * in the Sentry extension settings. If there is a match we know the document is enabled to send logs
 * to Sentry and can send back the corresponding Sentry project ID.
 * @param params params extracted from the document's URI.
 * @param projects Sentry extension projects configurations.
 * @return Sentry projectID this document reports to.
 */
export function matchSentryProject(params: Params, projects: Settings['sentry.projects']): SentryProject | undefined {
    // Check if a Sentry project is associated with this document's repo and retrieve the project.
    const project = projects!.find(p => !!new RegExp(p.patternProperties.repoMatch).exec(params.repo!))
    if (!project) {
        return
    }

    // Check if document matches the file matching pattern specified under the Sentry extension configuration.
    const fileMatched: boolean = !!project.patternProperties.fileMatches.find(
        pattern => !!new RegExp(pattern).exec(params.file!)
    )
    if (!fileMatched) {
        return
    }

    return {
        projectId: project.projectId,
        lineMatches: project.patternProperties.lineMatches,
    }
}

function decorateEditor(editor: sourcegraph.CodeEditor, sentryProjectId: string, lineMatches: RegExp[]): void {
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
