import * as sourcegraph from 'sourcegraph'
import { resolveSettings, Settings } from './settings'

/**
 * Common error log patterns to use in case no line matching regexes
 * are set in the sentry extension settings.
 */
const COMMON_ERRORLOG_PATTERNS = [
    // typescript/javascript
    /throw new [A-Za-z0-9]+\(['"]([^'"]+)['"]\)/gi,
    /console\.(?:error|info|warn)\(['"`]([^'"`]+)['"`]\)/gi,
    // go
    /log\.(?:Printf|Print|Println)\(['"]([^'"]+)['"]\)/gi,
    /fmt\.Errorf\(['"]([^'"]+)['"]\)/gi,
    /errors\.New\(['"]([^'"]+)['"]\)/gi,
    /panic\(['"]([^'"]+)['"]\)/gi,
    // python
    /logger.[A-Za-z0-9]+\(['"`]([^'"`]+)['"`]\)$/gi,
    /raise [A-Za-z0-9]+\(['"`]([^'"`]+)['"`]\)/gi,
    // java
    /logger\.[A-Za-z0-9]+\(['"`]([^'"`]+)['"`]\);/gi,
]

/**
 * Check for missing configurations in the Sentry extension settings
 * @param settings
 */
export function findEmptyConfigs(settings: Settings): string[] {
    // Check object key length to safeguard against user error of setting empty confirgurations
    if (!settings || Object.keys(settings).length === 0) {
        return ['sentry.authtoken', 'sentry.organization']
    }

    // Add configurations to missingConfigs array when sentry.authtoken or sentry.organization are missing
    const missingConfigurations: string[] = []

    if (!settings['sentry.authtoken']) {
        missingConfigurations.push('sentry.authtoken')
    }

    if (!settings['sentry.organization']) {
        missingConfigurations.push('sentry.organization')
    }
    if (!settings['sentry.decorations.inline']) {
        missingConfigurations.push('sentry.decorations.inline')
    }
    return missingConfigurations
}

interface SentryProject {
    id: number
    slug: string
}

interface SentryProjects extends Array<SentryProject> {}

/**
 * Fetch Sentry projects from Sentry
 * @param sentryAuthToken
 */
export async function fetchSentryProjects(sentryAuthToken: string): Promise<SentryProjects> {
    const sentryData = await fetch(`https://cors-anywhere.sourcegraph.com/https://sentry.io/api/0/projects/`, {
        method: 'GET',
        headers: {
            Authorization: 'Bearer ' + sentryAuthToken,
            AccessControlAllowOrigin: 'no-cors',
        },
    })
        .then(response => response.json())
        .catch(error => console.error('Error:', error))

    const sentryProjects: SentryProjects = []
    for (const project of sentryData) {
        sentryProjects.push({ id: project.id, slug: project.slug })
    }
    return sentryProjects
}

export interface ErrorQuery {
    lineNumber: number
    query: string
}
/**
 * Find error handling code and compose an array of error queries and their line numbers
 * to then later match them with the corresponding Sentry projects.
 * @param documentText
 * @return array of error queries and their line numbers
 */
export function findErrorPatterns(documentText: string): ErrorQuery[] {
    const errorQueries = []
    for (const [index, line] of documentText.split('\n').entries()) {
        let match: RegExpExecArray | null
        const patterns = COMMON_ERRORLOG_PATTERNS
        for (const pattern of patterns) {
            do {
                match = pattern.exec(line)
                // Depending on the line matching pattern the query m is indexed in position 1 or 2.
                if (match && match.length <= 2) {
                    errorQueries.push({ lineNumber: index, query: match[1].toString() })
                    // Safeguard if a user forgets to use `?:` and uncapture part of the error message that doesn't need to be captured.
                    // e.g.
                } else if (match && match.length > 2) {
                    errorQueries.push({ lineNumber: index, query: match[2].toString() })
                }
            } while (match)

            pattern.lastIndex = 0 // reset
        }
    }
    return errorQueries
}

export interface MatchedSentryIssue {
    matchedProjectId: number
    errorQuery: ErrorQuery
    count: number
}
export interface MatchedSentryIssues extends Array<MatchedSentryIssue> {}
/**
 * Iterate through each error query from error queries list and compare with each issue in each Sentry project to find a match
 * @param sentryAuthToken Sentry authorization token
 * @param sentryProjects List of Sentry projects
 * @param errorQueries List of error queries and corresponding line numbers from the document
 * @return array of error queries and their line numbers
 */
export async function matchErrorQueriesToProjects(
    sentryAuthToken: string,
    sentryProjects: SentryProjects,
    errorQueries: ErrorQuery[]
): Promise<MatchedSentryIssues> {
    const sentryOrg = resolveSettings(sourcegraph.configuration.get<Settings>().value)['sentry.organization']
    const matchedIssues: MatchedSentryIssues = []
    for (const project of sentryProjects) {
        for (const error of errorQueries) {
            const url = new URL(
                'https://cors-anywhere.sourcegraph.com/https://sentry.io/api/0/projects/' +
                    sentryOrg +
                    '/' +
                    project.slug +
                    '/issues/'
            )
            url.searchParams.set('query', 'is:unresolved ' + error.query)
            const sentryIssues = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    Authorization: 'Bearer ' + sentryAuthToken,
                    AccessControlAllowOrigin: 'no-cors',
                },
            })
                .then(response => response.json())
                .catch(error => console.error('Error:', error))
            if (sentryIssues.length > 0) {
                matchedIssues.push({
                    matchedProjectId: project.id,
                    errorQuery: {
                        lineNumber: error.lineNumber,
                        query: error.query,
                    },
                    count: sentryIssues.length,
                })
            }
        }
    }
    return matchedIssues
}

/**
 * Build warning decorations when there are no Sentry projects by matching error handling code with common error patterns
 * and passing the corresponding location of the matched error handling code.
 * @param documentText content of the document being scanned for error handling code
 * @return a list of decorations to render as links on each matching line
 */
export function buildWarningDecorations(documentText: string): sourcegraph.TextDocumentDecoration[] {
    const decorations: sourcegraph.TextDocumentDecoration[] = []

    for (const [index, line] of documentText.split('\n').entries()) {
        let match: RegExpExecArray | null

        for (const pattern of COMMON_ERRORLOG_PATTERNS) {
            do {
                match = pattern.exec(line)
                if (match) {
                    decorations.push(decorateWarningLine(index))
                }
            } while (match)

            pattern.lastIndex = 0 // reset
        }
    }
    return decorations
}

/**
 * Decorate a line warning about missing Sentry projects that links to the Sentry issues overview page.
 * @param index for decoration range
 * @return either a successful or a warning decoration to render the Sentry link
 */
export function decorateWarningLine(index: number): sourcegraph.TextDocumentDecoration {
    const decoration: sourcegraph.TextDocumentDecoration = {
        range: new sourcegraph.Range(index, 0, index, 0),
        isWholeLine: true,
        after: {
            backgroundColor: '#f2736d',
            color: 'rgba(255, 255, 255, 0.8)',
            contentText: ' Error connecting to Sentry (!) ',
            hoverMessage: ' Setup Sentry projects to link to the Sentry issue page.',
            linkURL: buildUrl().toString(),
        },
    }
    return decoration
}

export function buildDecorations(matchedSentryIssues: MatchedSentryIssues): sourcegraph.TextDocumentDecoration[] {
    const decorations: sourcegraph.TextDocumentDecoration[] = []
    const lineDecorationText = {
        content: ' View logs in Sentry',
        hover: ' View logs in Sentry',
    }
    for (const issue of matchedSentryIssues) {
        const decoration: sourcegraph.TextDocumentDecoration = {
            range: new sourcegraph.Range(issue.errorQuery.lineNumber, 0, issue.errorQuery.lineNumber, 0),
            isWholeLine: true,
            after: {
                backgroundColor: '#e03e2f',
                color: 'rgba(255, 255, 255, 0.8)',
                contentText: lineDecorationText.content + '(' + issue.count.toString() + ') » ',
                hoverMessage: lineDecorationText.hover + '(' + issue.count.toString() + ') » ',
                // TODO: If !SENTRYORGANIZATION is missing in config, link to $USER/settings and hint
                // user to fill it out.
                linkURL: buildUrl(issue.errorQuery.query, issue.matchedProjectId.toString()).toString(),
            },
        }
        decorations.push(decoration)
    }
    return decorations
}

/**
 * Build URL to the Sentry issues stream page with the Sentry Org, query and, if available, Sentry project ID.
 * @param errorQuery extracted from the error handling code matching the config matching pattern.
 * @param sentryProjectId from the associated Sentry project receiving logs from the document's repo.
 * @return URL to the Sentry unresolved issues stream page for this kind of query.
 */
export function buildUrl(errorQuery?: string, sentryProjectId?: string): URL {
    const sentryOrg = resolveSettings(sourcegraph.configuration.get<Settings>().value)['sentry.organization']
    const url = new URL('https://sentry.io/organizations/' + sentryOrg + '/issues/')

    if (sentryProjectId) {
        url.searchParams.set('project', sentryProjectId)
        // Query must be wrapped in double quotes to be used as a search query in Sentry
        url.searchParams.set('query', 'is:unresolved ' + '"' + errorQuery + '"')
        url.searchParams.set('statsPeriod', '14d')
    }

    return url
}
