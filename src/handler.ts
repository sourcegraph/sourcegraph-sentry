import * as sourcegraph from 'sourcegraph'
import { resolveSettings, SentryProject, Settings } from './settings'

interface Params {
    repo: string | null
    file: string | null
}

interface LineDecorationText {
    content: string
    hover: string
    backgroundColor: string
}

const SETTINGSCONFIG = resolveSettings(sourcegraph.configuration.get<Settings>().value)
const SENTRYORGANIZATION = SETTINGSCONFIG['sentry.organization']

/**
 * Extract Sentry params from document URI necessary to
 * check if the current document sends log events to Sentry and
 * use these params build URL to the Sentry issues stream page.
 * @param textDocument A document URI.
 * @returns repo and file part of URI.
 */
export function getParamsFromUriPath(textDocument: string): Params {
    // TODO: Support more than just GitHub.
    // TODO: Safeguard for cases where repo/fileMatch are null.
    const repoPattern = /github\.com\/([^\?\#\/]+\/[^\?\#\/]*)/gi
    const filePattern = /#([^\?\#\/]+)\/.*\.?$/gi
    const repoMatch = repoPattern.exec(textDocument)
    const fileMatch = filePattern.exec(textDocument)
    return {
        repo: repoMatch && repoMatch[1],
        file: fileMatch && fileMatch[0],
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
export function matchSentryProject(params: Params, projects: SentryProject[]): SentryProject | undefined {
    if (!projects || !params.repo || !params.file) {
        return
    }
    // Check if a Sentry project is associated with this document's repo and retrieve the project.
    // TODO: Handle the null case instead of using a non-null assertion !
    const project = projects.find(p => !!new RegExp(p.patternProperties.repoMatch).exec(params.repo!))
    if (!project) {
        return
    }
    return project
}

// Check if document file format matches the file pattern set of the project
export function isFileMatched(params: Params, project: SentryProject): boolean | null {
    // TODO: Handle edge case of when project.patternProperties.fileMatches is falsy and add a unit test for it.
    return project.patternProperties.fileMatches && project.patternProperties.fileMatches.length > 0
        ? project.patternProperties.fileMatches.some(pattern => !!new RegExp(pattern).exec(params.file!))
        : null
}

/**
 * Check for missing configurations in the Sentry extension settings
 * @param settings
 */
export function checkMissingConfig(settings: SentryProject): string[] {
    if (!settings) {
        return []
    }
    const missingConfig: string[] = []

    for (const [key, value] of Object.entries(settings)) {
        if (value instanceof Object) {
            for (const [k, v] of Object.entries(value)) {
                if (!v || Object.keys(v).length === 0) {
                    missingConfig.push(k)
                    console.log('object: ', k, v)
                }
            }
        } else if (!value) {
            missingConfig.push(key)
        }
    }
    return missingConfig
}

export function createDecoration(missingConfigData: string[], sentryProjectId?: string): LineDecorationText {
    let contentText = ' View logs in Sentry » '
    let hoverText = ' View logs in Sentry » '
    const color = '#e03e2f'

    if (!SENTRYORGANIZATION) {
        contentText = ' Configure the Sentry extension to view logs. '
        hoverText = ' Configure the Sentry extension to view logs in Sentry. '
    } else if (!sentryProjectId) {
        contentText = ' View logs in Sentry (❕)» '
        hoverText = ' Add Sentry projects to your Sentry extension settings for project matching.'
    } else if (missingConfigData.length > 0) {
        contentText = ' View logs in Sentry (❕)» '
        hoverText =
            ' Please fill out the following configurations in your Sentry extension settings: ' + missingConfigData
    }
    return {
        content: contentText,
        hover: hoverText,
        backgroundColor: color,
    }
}