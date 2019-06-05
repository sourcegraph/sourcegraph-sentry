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
export function getParamsFromUriPath(textDocumentURI: string): Params | null {
    let paramsRepo
    let fileMatch
    const filePattern = /#(.*\.(.*))$/gi
    try {
        paramsRepo = new URL(textDocumentURI).pathname
        fileMatch = filePattern.exec(textDocumentURI)
    } catch (err) {
        return null
    }
    return {
        repo: paramsRepo,
        file: fileMatch && fileMatch[1],
    }
}

interface Matched {
    project: SentryProject | undefined
    missingConfigs: string[]
}
/**
 * Verify if the params from the document URI match with the repo and file formats specified
 * in the Sentry extension settings. If there is a match we know the document is enabled to send logs
 * to Sentry and can send back the corresponding Sentry project ID.
 * @param params params extracted from the document's URI.
 * @param projects Sentry extension projects configurations.
 * @return Sentry projectID this document reports to.
 */
export function matchSentryProject(params: Params | null, projects: SentryProject[]): Matched | null {
    if (!projects || !params || !params.repo || !params.file) {
        return null
    }

    let missingConfigs

    // Check if a Sentry project is associated with this document's repository and/or file and retrieve the project.
    // TODO: Handle the null case instead of using a non-null assertion !
    // TODO: Handle cases where the wrong project is matched due to similar repo name,
    // e.g. `sourcegraph-jetbrains` repo will match the `sourcegraph` project
    for (const [index, project] of projects.entries()) {
        missingConfigs = missingConfigs
            ? missingConfigs.concat(findEmptyConfigs(project, 'project', index))
            : findEmptyConfigs(project, 'project', index)

        if (project.filters) {
            for (const filter of project.filters) {
                if (filter.files && !matchesFile(filter.files, params.file)) {
                    break
                }

                if (
                    filter.repositories &&
                    filter.repositories.length > 0 &&
                    !matchesRepository(filter.repositories, params.repo)
                ) {
                    break
                }

                // both repository and file match
                return { project, missingConfigs }
            }
            // if there is only one project in the settings and no filters,
            // always match with that Sentry project
        } else if (projects.length === 1) {
            return { project, missingConfigs: [] }
        }
    }
    return null
}

function matchesRepository(repositories: string[], repoParam: string): boolean {
    return repositories.some(repo => !!new RegExp(repo).exec(repoParam))
}

function matchesFile(files: string[], fileParam: string): boolean {
    return files.some(file => !!new RegExp(file).exec(fileParam))
}

/**
 * Check for missing configurations in the Sentry extension settings
 * @param settings
 */
export function findEmptyConfigs(settings?: SentryProject, path?: string, index?: number): string[] {
    if (!settings && !path && !index) {
        return ['settings']
    }

    if (path === 'project' && typeof index === 'number') {
        path += '[' + index + ']'
    }
    // Check object key length to safeguard against user error of setting an empty repositories array
    if ((!settings || Object.keys(settings).length === 0) && path) {
        return [path]
    }

    // Add repositories to missingConfigs array when no settings.filters are set and return
    let missingConfigurations: string[] = []
    if (settings instanceof Object && 'projectId' in settings && !settings.filters) {
        return missingConfigurations.concat(path + '[' + index + '].filters[0].repositories')
    }
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
    if (missingConfigData.includes('settings') || !sentryOrg) {
        return {
            content: ' Configure the Sentry extension to view logs (❕)» ',
            hover: ' Please fill out the configurations in your Sentry extension settings.',
        }
    }
    if (missingConfigData.includes('repositories')) {
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
                ' Please fill out these configurations for better Sentry project matching: ' +
                missingConfigData.join(', '),
        }
    }

    return {
        content: ' View logs in Sentry » ',
        hover: ' View logs in Sentry » ',
    }
}
