import expect from 'expect'
import mock from 'mock-require'
import { createMockSourcegraphAPI, projects } from './stubs'

const sourcegraph = createMockSourcegraphAPI()
// For modules importing Range/Location/URI/etc
mock('sourcegraph', sourcegraph)

import { decorateLine, getDecorations } from '../extension'

describe('extension', () => {
    it('works', () => void 0)
})

const data = [
    {
        goal: 'render complete Sentry link',
        index: 5,
        match: 'cannot determine file path',
        missingConfigData: [],
        sentryProjectId: '134412',
    },
    {
        goal: 'warn about incomplete config with missing repoMatch',
        index: 5,
        match: 'cannot determine file path',
        missingConfigData: ['repoMatch'],
        sentryProjectId: '134412',
    },
    {
        goal: 'warn about incomplete config with missing repoMatch and fileMatch patterns',
        index: 5,
        match: 'cannot determine file path',
        missingConfigData: ['repoMatch', 'fileMatch'],
        sentryProjectId: '134412',
    },
    {
        goal: 'render warning link hinting to add projectId and render link to general issues page',
        index: 5,
        match: 'cannot determine file path',
        missingConfigData: ['repoMatch', 'fileMatch'],
        sentryProjectId: undefined,
    },
]

const decorationsList = [
    {
        range: new sourcegraph.Range(5, 0, 5, 0),
        isWholeLine: true,
        after: {
            backgroundColor: '#e03e2f',
            color: 'rgba(255, 255, 255, 0.8)',
            contentText: ' View logs in Sentry » ',
            hoverMessage: ' View logs in Sentry » ',
            linkURL:
                'https://sentry.io/organizations/sourcegraph/issues/?project=134412&query=is%3Aunresolved+cannot%20determine%20file%20path&statsPeriod=14d',
        },
    },
    {
        range: new sourcegraph.Range(5, 0, 5, 0),
        isWholeLine: true,
        after: {
            backgroundColor: '#f2736d',
            color: 'rgba(255, 255, 255, 0.8)',
            contentText: ' View logs in Sentry (❕)» ',
            hoverMessage: ' Please fill out the following configurations in your Sentry extension settings: repoMatch',
            linkURL:
                'https://sentry.io/organizations/sourcegraph/issues/?project=134412&query=is%3Aunresolved+cannot%20determine%20file%20path&statsPeriod=14d',
        },
    },
    {
        range: new sourcegraph.Range(5, 0, 5, 0),
        isWholeLine: true,
        after: {
            backgroundColor: '#f2736d',
            color: 'rgba(255, 255, 255, 0.8)',
            contentText: ' View logs in Sentry (❕)» ',
            hoverMessage:
                ' Please fill out the following configurations in your Sentry extension settings: repoMatch, fileMatch',
            linkURL:
                'https://sentry.io/organizations/sourcegraph/issues/?project=134412&query=is%3Aunresolved+cannot%20determine%20file%20path&statsPeriod=14d',
        },
    },
    {
        range: new sourcegraph.Range(5, 0, 5, 0),
        isWholeLine: true,
        after: {
            backgroundColor: '#f2736d',
            color: 'rgba(255, 255, 255, 0.8)',
            contentText: ' View logs in Sentry (❕)» ',
            hoverMessage: ' Add Sentry projects to your Sentry extension settings for project matching.',
            linkURL: 'https://sentry.io/organizations/sourcegraph/issues/',
        },
    },
]

describe('decorate line', () => {
    for (const [i, deco] of data.entries()) {
        it('decorates the line with the following goal: ' + deco.goal, () =>
            expect(decorateLine(deco.index, deco.match, deco.missingConfigData, deco.sentryProjectId)).toEqual(
                decorationsList[i]
            )
        )
    }
})

const decorationsData = [
    {
        goal: 'receive two decorations',
        documentUri:
            'git://github.com/sourcegraph/sourcegraph?c436567c152bf40668c75815ed3ce62983af942d#client/browser/src/libs/github/file_info.ts',
        documentText: `export const resolveDiffFileInfo = (codeView: HTMLElement): Observable<FileInfo> =>
of(codeView).pipe(
    map(({ codeView, ...rest }) => {
        const { headFilePath, baseFilePath } = getDeltaFileName(codeView)
        if (!headFilePath) {
            throw new Error('cannot determine file path')
        }

        return { ...rest, codeView, headFilePath, baseFilePath }
    }),
    map(data => {
        const diffResolvedRev = getDiffResolvedRev(codeView)
        if (!diffResolvedRev) {
            throw new Error('cannot determine delta info')
        }

        return {
            headRev: diffResolvedRev.headCommitID,
            baseRev: diffResolvedRev.baseCommitID,
            ...data,
        }
    }),`,
    },
    {
        goal: 'receive one decoration',
        documentUri:
            'git://github.com/sourcegraph/sourcegraph?c436567c152bf40668c75815ed3ce62983af942d#client/browser/src/libs/github/file_info.ts',
        documentText: `export const resolveDiffFileInfo = (codeView: HTMLElement): Observable<FileInfo> =>
of(codeView).pipe(
    map(({ codeView, ...rest }) => {
        const { headFilePath, baseFilePath } = getDeltaFileName(codeView)
        if (!headFilePath) {
            throw new Error('cannot determine file path')
        }

        return { ...rest, codeView, headFilePath, baseFilePath }
    }),`,
    },
    {
        goal: 'receive no decoration due to file format mismatch',
        documentUri:
            'git://github.com/sourcegraph/sourcegraph?c436567c152bf40668c75815ed3ce62983af942d#client/browser/src/libs/github/file_info.php',
        documentText: `export const resolveDiffFileInfo = (codeView: HTMLElement): Observable<FileInfo> =>
of(codeView).pipe(
    map(({ codeView, ...rest }) => {
        const { headFilePath, baseFilePath } = getDeltaFileName(codeView)
        if (!headFilePath) {
            throw new Error('cannot determine file path')
        }

        return { ...rest, codeView, headFilePath, baseFilePath }
    }),`,
    },
    {
        goal: 'receive no decoration due to no line matches',
        documentUri:
            'git://github.com/sourcegraph/sourcegraph?c436567c152bf40668c75815ed3ce62983af942d#client/browser/src/libs/github/file_info.php',
        documentText: `export const resolveDiffFileInfo = (codeView: HTMLElement): Observable<FileInfo> =>
of(codeView).pipe(
    map(({ codeView, ...rest }) => {
        const { headFilePath, baseFilePath } = getDeltaFileName(codeView)
    }),`,
    },
]

const expectedDecorations = [
    // receive two decorations
    [
        {
            range: new sourcegraph.Range(5, 0, 5, 0),
            isWholeLine: true,
            after: {
                backgroundColor: '#e03e2f',
                color: 'rgba(255, 255, 255, 0.8)',
                contentText: ' View logs in Sentry » ',
                hoverMessage: ' View logs in Sentry » ',
                linkURL:
                    'https://sentry.io/organizations/sourcegraph/issues/?project=1334031&query=is%3Aunresolved+cannot%20determine%20file%20path&statsPeriod=14d',
            },
        },
        {
            range: new sourcegraph.Range(13, 0, 13, 0),
            isWholeLine: true,
            after: {
                backgroundColor: '#e03e2f',
                color: 'rgba(255, 255, 255, 0.8)',
                contentText: ' View logs in Sentry » ',
                hoverMessage: ' View logs in Sentry » ',
                linkURL:
                    'https://sentry.io/organizations/sourcegraph/issues/?project=1334031&query=is%3Aunresolved+cannot%20determine%20delta%20info&statsPeriod=14d',
            },
        },
    ],
    // receive one decoration
    [
        {
            range: new sourcegraph.Range(5, 0, 5, 0),
            isWholeLine: true,
            after: {
                backgroundColor: '#e03e2f',
                color: 'rgba(255, 255, 255, 0.8)',
                contentText: ' View logs in Sentry » ',
                hoverMessage: ' View logs in Sentry » ',
                linkURL:
                    'https://sentry.io/organizations/sourcegraph/issues/?project=1334031&query=is%3Aunresolved+cannot%20determine%20file%20path&statsPeriod=14d',
            },
        },
    ],
    // receive no decoration due to file format mismatch
    [],
    // receive no decoration due to no line matches
    [],
]

describe('get Decorations', () => {
    for (const [i, deco] of decorationsData.entries()) {
        it('fulfills the following goal:' + deco.goal, () =>
            expect(getDecorations(deco.documentUri, deco.documentText, projects)).toEqual(expectedDecorations[i])
        )
    }
})
