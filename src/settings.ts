/**
 * The resolved and normalized settings for this extension, the result of calling resolveSettings on a raw settings
 * value.
 *
 * See the "contributes.configuration" field in package.json for the canonical documentation on these properties.
 */
export interface Settings {
    ['sentry.organization']?: string
    ['sentry.projects']?: [
        {
            name: string
            projectId: string
            patternProperties: {
                repoMatch: RegExp
                fileMatch: RegExp
                lineMatch: RegExp
            }
            additionalProperties: {
                contentText: string
                hoverMessage: string
                query: string
            }
        }
    ]
}

/** Returns a copy of the extension settings with values normalized and defaults applied. */
export function resolveSettings(raw: Partial<Settings>): Settings {
    return {
        ['sentry.organization']: raw['sentry.organization'],
        ['sentry.projects']: raw['sentry.projects'],
    }
}
