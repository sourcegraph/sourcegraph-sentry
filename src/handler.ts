import { Settings } from './settings'

interface Params {
    repo: string | null
    file: string | null
}

interface SentryProject {
    projectId: string
    lineMatches: RegExp[]
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
    const repoPattern = /github\.com\/([^\?\#\/]+\/[^\?\#\/]*)/gi
    const filePattern = /#([^\?\#\/]+)\/.*\.?$/gi
    const repoM = repoPattern.exec(textDocument)
    const fileM = filePattern.exec(textDocument)
    return {
        repo: repoM && repoM[1],
        file: fileM && fileM[0],
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
export function matchSentryProject(
    params: Params,
    projects: Settings['sentry.projects'] | null
): SentryProject | undefined {
    if (!projects || !params.repo) {
        return
    }
    // Check if a Sentry project is associated with this document's repo and retrieve the project.
    const project = projects.find(p => !!new RegExp(p.patternProperties.repoMatch).exec(params.repo!))
    if (!project) {
        return
    }

    // Check if document matches the file matching pattern specified under the Sentry extension configuration.
    if (project.patternProperties.fileMatches) {
        if (!params.file) {
            return
        }
        const fileMatched: boolean = project.patternProperties.fileMatches.some(
            pattern => !!new RegExp(pattern).exec(params.file!)
        )
        if (!fileMatched) {
            return
        }
    }

    return {
        projectId: project.projectId,
        lineMatches: project.patternProperties.lineMatches,
    }
}
