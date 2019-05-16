import { SentryProject } from './settings'

interface Params {
    repo: string | null
    file: string | null
}

export interface LineDecorationText {
    content: string
    hover: string
}

/**
 * Extract Sentry params from document URI necessary to
 * check if the current document sends log events to Sentry and
 * use these params build URL to the Sentry issues stream page.
 * @param textDocumentURI A document URI.
 * @returns repo and file part of URI.
 */
export function getParamsFromUriPath(textDocumentURI: string): Params {
    // TODO: Support more than just GitHub & Gitlab.
    // TODO: Safeguard for cases where repo/fileMatch are null.
    const repoPattern = /(github\.com|gitlab\.com)\/([^\?\#\/]+\/[^\?\#\/]*)/gi
    const filePattern = /#(.*\.(.*))$/gi
    const repoMatch = repoPattern.exec(textDocumentURI)
    const fileMatch = filePattern.exec(textDocumentURI)
    return {
        repo: repoMatch && repoMatch[2],
        file: fileMatch && fileMatch[1],
    }
}

interface Matched {
    project: SentryProject | undefined | false
    fileMatched: boolean | undefined
}
/**
 * Verify if the params from the document URI match with the repo and file formats specified
 * in the Sentry extension settings. If there is a match we know the document is enabled to send logs
 * to Sentry and can send back the corresponding Sentry project ID.
 * @param params params extracted from the document's URI.
 * @param projects Sentry extension projects configurations.
 * @return Sentry projectID this document reports to.
 */
export function matchSentryProject(params: Params, projects: SentryProject[]): Matched {
    let matched: Matched = { project: undefined, fileMatched: undefined }

    if (!projects || !params.repo || !params.file) {
        return matched
    }

    // Check if a Sentry project is associated with this document's repository and/or file and retrieve the project.
    // TODO: Handle the null case instead of using a non-null assertion !
    // TODO: Handle cases where the wrong project is matched due to similar repo name,
    // e.g. `sourcegraph-jetbrains` repo will match the `sourcegraph` project
    for (const project of projects) {
        for (const filter of project.filters) {
            // both repository and file match
            if (filter.repository && filter.file) {
                if (
                    !!filter.repository.find(repo => !!new RegExp(repo).exec(params.repo!)) &&
                    filter.file.some(file => !!new RegExp(file).exec(params.file!))
                ) {
                    matched = { project, fileMatched: true }
                }
                // repository doesn't match and file matches
                if (
                    !!!filter.repository.find(repo => !!new RegExp(repo).exec(params.repo!)) &&
                    filter.file.some(file => !!new RegExp(file).exec(params.file!))
                ) {
                    matched = { project: undefined, fileMatched: true }
                }
                // repository matches and file does not match
                if (
                    !!filter.repository.find(repo => !!new RegExp(repo).exec(params.repo!)) &&
                    !filter.file.some(file => !!new RegExp(file).exec(params.file!))
                ) {
                    matched = { project, fileMatched: false }
                }
                // repository doesn't match and file does not match
                if (
                    !!!filter.repository.find(repo => !!new RegExp(repo).exec(params.repo!)) &&
                    !filter.file.some(file => !!new RegExp(file).exec(params.file!))
                ) {
                    matched = { project: undefined, fileMatched: false }
                }
            }
            // repository matches and there is no filter for file matching
            if (
                (!filter.file || filter.file.length === 0) &&
                filter.repository &&
                !!filter.repository.find(repo => !!new RegExp(repo).exec(params.repo!))
            ) {
                matched = { project, fileMatched: undefined }
            }
            // file matches and there is no filter for repository matching
            if (
                (!filter.repository || filter.repository.length === 0) &&
                filter.file &&
                filter.file.some(file => !!new RegExp(file).exec(params.file!))
            ) {
                matched = { project, fileMatched: true }
            }

            // if project is matched return project
            if (matched.project) {
                return matched
            }
        }
    }
    return matched
}

/**
 * Check for missing configurations in the Sentry extension settings
 * @param settings
 */
export function findEmptyConfigs(settings?: SentryProject, path?: string): string[] {
    if (!path) {
        path = 'settings'
    }
    if (!settings) {
        return [path]
    }

    let missingConfigurations: string[] = []

    if (settings instanceof Array) {
        for (const [index, element] of settings.entries()) {
            missingConfigurations = missingConfigurations.concat(findEmptyConfigs(element, path + '[' + index + ']'))
        }
    } else if (settings instanceof Object) {
        for (const [k, v] of Object.entries(settings)) {
            missingConfigurations = missingConfigurations.concat(findEmptyConfigs(v, path + '.' + k))
        }
    }
    return missingConfigurations
}

export function createDecoration(
    missingConfigData: string[],
    sentryOrg?: string,
    sentryProjectId?: string
): LineDecorationText {
    if ((missingConfigData.length > 0 && missingConfigData.includes('settings')) || !sentryOrg) {
        return {
            content: ' Configure the Sentry extension to view logs (❕)» ',
            hover: ' Please fill out the configurations in your Sentry extension settings.',
        }
    }
    if (missingConfigData.length > 0 && missingConfigData.includes('repository')) {
        return {
            content: ' View logs in Sentry (❕)» ',
            hover: ' Add this repository to your Sentry extension settings for project matching.',
        }
    }
    if (!sentryProjectId) {
        return {
            content: ' View logs in Sentry (❕)» ',
            hover: ' Add Sentry projects to your Sentry extension settings for project matching.',
        }
    }
    if (missingConfigData.length > 0 && missingConfigData[0] !== 'settings') {
        return {
            content: ' View logs in Sentry (❕)» ',
            hover:
                ' Please fill out the following configurations in your Sentry extension settings: ' +
                missingConfigData.join(', '),
        }
    }

    return {
        content: ' View logs in Sentry » ',
        hover: ' View logs in Sentry » ',
    }
}
