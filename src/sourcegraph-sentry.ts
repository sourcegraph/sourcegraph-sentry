import { from } from 'rxjs'
import { filter, switchMap } from 'rxjs/operators'
import * as sourcegraph from 'sourcegraph'
import { resolveSettings, Settings } from './settings'

const CODE_PATTERNS = [
    /throw new Error+\([\'\"]([^\'\"]+)[\'\"]\)/gi,
    /console\.[^\'\"\`]+\([\'\"\`]([^\'\"\`]+)[\'\"\`]\)/gi,
    /log\.[^\'\"]+\([\'\"]([^\'\"]+)[\'\"]\)/gi,
]

const DECORATION_TYPE = sourcegraph.app.createDecorationType()
const SETTINGS = resolveSettings(sourcegraph.configuration.get<Settings>().value)

function decorateEditor(editor: sourcegraph.CodeEditor): void {
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
        const params = getParamsFromUriPath(textDocument.uri)
    })

    if (sourcegraph.app.activeWindowChanges) {
        const activeEditor = from(sourcegraph.app.activeWindowChanges).pipe(
            filter((window): window is sourcegraph.Window => window !== undefined),
            switchMap(window => window.activeViewComponentChanges),
            filter((editor): editor is sourcegraph.CodeEditor => editor !== undefined)
        )
        // When the active editor changes, publish new decorations.
        context.subscriptions.add(activeEditor.subscribe(decorateEditor))
    }
}

/**
 * Extract Sentry params from Document URI necessary to
 * build URL to the Sentry issues stream page, if the current
 * Document sends log events to Sentry.
 *
 * TODO: Implement regex match of params with Sentry extension config settings.
 */
function getParamsFromUriPath(textDocument: string): object {
    const repoPattern = /github\.com\/([^\?\#]+)/gi
    const filePattern = /#([^\?\#\/]+)\/.*\.tsx?$/gi
    const repoM = repoPattern.exec(textDocument)
    const fileM = filePattern.exec(textDocument)
    const params = {
        repo: repoM && repoM[1],
        fileValidation: fileM,
    }
    return params
}

function buildUrl(errorQuery: string): URL {
    const url = new URL(
        'https://sentry.io/organizations/' +
            SETTINGS['sentry.organization'] +
            '/issues/?project=1334031&query=is%3Aunresolved+' +
            errorQuery.split(' ').join('+') +
            '&statsPeriod=14d'
    )
    return url
}
// Sourcegraph extension documentation: https://docs.sourcegraph.com/extensions/authoring
