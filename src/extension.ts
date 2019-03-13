import { from } from 'rxjs'
import { filter, switchMap } from 'rxjs/operators'
import * as sourcegraph from 'sourcegraph'
import { resolveSettings, Settings } from './settings'

interface Params {
    repo: string | null
    file: string | null
    folder: string | null
}

// TODO: Receive code matching patterns from the Sentry extension settings
const CODE_PATTERNS = [
    /throw new Error+\([\'\"]([^\'\"]+)[\'\"]\)/gi,
    /console\.[^\'\"\`]+\([\'\"\`]([^\'\"\`]+)[\'\"\`]\)/gi,
    /log\.[^\'\"]+\([\'\"]([^\'\"]+)[\'\"]\)/gi,
]

const DECORATION_TYPE = sourcegraph.app.createDecorationType()
const SETTINGSCONFIG = resolveSettings(sourcegraph.configuration.get<Settings>().value)

function decorateEditor(editor: sourcegraph.CodeEditor, sentryProjects: Settings['sentry.projects']): void {
    const decorations: sourcegraph.TextDocumentDecoration[] = []
    for (const [i, line] of editor.document.text!.split('\n').entries()) {
        let m: RegExpExecArray | null
        for (const pattern of CODE_PATTERNS) {
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
                            linkURL: buildUrl(m[1]).toString(),
                        },
                    })
                }
            } while (m)
            pattern.lastIndex = 0 // reset
        }
    }
    editor.setDecorations(DECORATION_TYPE, decorations)
}

export function activate(context: sourcegraph.ExtensionContext): void {
    sourcegraph.workspace.onDidOpenTextDocument.subscribe(textDocument => {
        const params: Params = getParamsFromUriPath(textDocument.uri)
        const sentryProjects = SETTINGSCONFIG['sentry.projects']

        if (sourcegraph.app.activeWindowChanges && sentryProjects && isSentryEnabled(params, sentryProjects)) {
            const activeEditor = from(sourcegraph.app.activeWindowChanges).pipe(
                filter((window): window is sourcegraph.Window => window !== undefined),
                switchMap(window => window.activeViewComponentChanges),
                filter((editor): editor is sourcegraph.CodeEditor => editor !== undefined)
            )
            // When the active editor changes, publish new decorations.
            context.subscriptions.add(
                activeEditor.subscribe(editor => {
                    decorateEditor(editor, sentryProjects)
                })
            )
        }
    })
}

/**
 * Extract Sentry params from Document URI necessary to
 * build URL to the Sentry issues stream page, if the current
 * Document sends log events to Sentry.
 *
 * TODO: Implement regex match of params with Sentry extension settings.
 */
export function getParamsFromUriPath(textDocument: string): Params {
    const repoPattern = /github\.com\/([^\?\#]+)/gi
    const filePattern = /#([^\?\#\/]+)\/.*\.tsx?$/gi
    const repoM = repoPattern.exec(textDocument)
    const fileM = filePattern.exec(textDocument)
    return {
        repo: repoM![1],
        file: fileM![0],
        folder: fileM![1],
    }
}

/**
 * Verify if the params from the document URI match with the repo and file formats specified
 * in the Sentry extension settings, we know the document is enabled to send logs
 * to Sentry.
 * @param params params extracted from the document's URI
 * @param projects Sentry extension projects configurations
 */
function isSentryEnabled(params: Params, projects: Settings['sentry.projects']): boolean {
    // Check if repo matches the repo specified under the Sentry extension configuration
    const doesRepoMatch: boolean = !!projects!.find(p => !!new RegExp(p.patternProperties.repoMatch).exec(params.repo!))

    // Check if document matches the file format specified under the Sentry extension configuration
    const doesFileMatch: boolean = !!projects!.find(p => !!new RegExp(p.patternProperties.fileMatch).exec(params.file!))

    if (doesRepoMatch && doesFileMatch) {
        return true
    }
    return false
}

// TODO receive projectId from enabled Sentry project
function buildUrl(errorQuery: string): URL {
    const url = new URL(
        'https://sentry.io/organizations/' +
            SETTINGSCONFIG['sentry.organization'] +
            '/issues/?project=1334031&query=is%3Aunresolved+' +
            errorQuery.split(' ').join('+') +
            '&statsPeriod=14d'
    )
    return url
}
// Sourcegraph extension documentation: https://docs.sourcegraph.com/extensions/authoring
