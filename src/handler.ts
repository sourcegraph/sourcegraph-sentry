import { Settings } from './settings'

interface Params {
    repo: string | null
    file: string | null
}

export interface SentryProject {
    projectId: string
    lineMatches: RegExp[]
    fileMatch: boolean | null
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
export function matchSentryProject(
    params: Params,
    projects: Settings['sentry.projects'] | null
): SentryProject | undefined {
    if (!projects || !params.repo || !params.file) {
        return
    }
    // Check if a Sentry project is associated with this document's repo and retrieve the project.
    const project = projects.find(p => !!new RegExp(p.patternProperties.repoMatch).exec(params.repo!))
    if (!project) {
        return
    }

    // Check if document file format matches the file pattern set of the project.
    const fileMatched =
        project.patternProperties.fileMatches && project.patternProperties.fileMatches.length > 0
            ? project.patternProperties.fileMatches.some(pattern => !!new RegExp(pattern).exec(params.file!))
            : null

    return {
        projectId: project.projectId,
        lineMatches: project.patternProperties.lineMatches,
        fileMatch: fileMatched,
    }
}
