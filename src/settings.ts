/**
 * The resolved and normalized settings for this extension, the result of calling resolveSettings on a raw settings
 * value.
 *
 * See the "contributes.configuration" field in package.json for the canonical documentation on these properties.
 */
export interface Settings {
    ['sentry.decorations.inline']: boolean
    ['sentry.authtoken']?: string
    ['sentry.organization']?: string
}

/** Returns a copy of the extension settings with values normalized and defaults applied. */
export function resolveSettings(raw: Partial<Settings>): Settings {
    return {
        ['sentry.decorations.inline']: !!raw['sentry.decorations.inline'],
        ['sentry.authtoken']: raw['sentry.authtoken'],
        ['sentry.organization']: raw['sentry.organization'],
    }
}
