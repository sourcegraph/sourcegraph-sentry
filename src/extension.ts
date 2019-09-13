import { BehaviorSubject, combineLatest, from } from 'rxjs'
import { filter, switchMap } from 'rxjs/operators'
import * as sourcegraph from 'sourcegraph'
import {
    buildDecorations,
    buildWarningDecorations,
    fetchSentryProjects,
    findEmptyConfigs,
    findErrorPatterns,
    matchErrorQueriesToProjects,
} from './handler'
import { resolveSettings, Settings } from './settings'

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
            combineLatest([configurationChanges, activeEditor]).subscribe(async ([, editor]) => {
                const settings = resolveSettings(sourcegraph.configuration.get<Settings>().value)
                const missingConfigs = findEmptyConfigs(settings)
                // TODO: Update context to trigger action and notify user via action item lable to add the missing
                // configurations to connect to Sentry (e.g. Lightstep extension)
                if (!settings['sentry.decorations.inline']) {
                    editor.setDecorations(DECORATION_TYPE, []) // clear decorations
                    return
                }
                if (missingConfigs.length === 0) {
                    const sentryAuthToken = settings['sentry.authtoken']
                    const sentryProjects = sentryAuthToken && (await fetchSentryProjects(sentryAuthToken))

                    if (editor.document.text && sentryAuthToken) {
                        // TODO: Use stack trace information received by Sentry to match error code by line vs. query match

                        // If there are no Sentry projects set up, render warning links to Sentry's issues overview page to
                        // show the user how this extension would work if provided with Sentry projects to match with
                        if (!sentryProjects || sentryProjects.length === 0) {
                            const decorations = buildWarningDecorations(editor.document.text)
                            editor.setDecorations(DECORATION_TYPE, decorations)
                            return
                        }

                        // Render links by matching common error handling code
                        const errorPatterns = findErrorPatterns(editor.document.text)
                        const matchedIssues = await matchErrorQueriesToProjects(
                            sentryAuthToken,
                            sentryProjects,
                            errorPatterns
                        )
                        // Only render links to Sentry if there is a matching Sentry issue page
                        if (matchedIssues.length > 0) {
                            const decorations = buildDecorations(matchedIssues)
                            editor.setDecorations(DECORATION_TYPE, decorations)
                        }
                    }
                }
            })
        )
    }
}
