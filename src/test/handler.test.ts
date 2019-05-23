import { createStubSourcegraphAPI } from '@sourcegraph/extension-api-stubs'
import expect from 'expect'
import mock from 'mock-require'

const sourcegraph = createStubSourcegraphAPI()
// For modules importing Range/Location/Position/URI/etc
mock('sourcegraph', sourcegraph)

import { createDecoration, findEmptyConfigs, getParamsFromUriPath, matchSentryProject } from '../handler'
import { SentryProject } from '../settings'

const projects: SentryProject[] = [
    {
        name: 'Webapp typescript errors',
        projectId: '1334031',
        linePatterns: [
            'throw new Error+\\([\'"]([^\'"]+)[\'"]\\)',
            'console\\.(?:warn|debug|info|error|log)\\([\'"`]([^\'"`]+)[\'"`]\\)',
            'log\\.(Printf|Print|Println)\\([\'"]([^\'"]+)[\'"]\\)',
        ],
        filters: [
            {
                repositories: ['sourcegraph/sourcegraph', '/bucket'],
                files: ['(?:web|shared|src)/.*\\.tsx?', '\\.ts?'],
            },
        ],
    },
    {
        name: 'Dev env errors',
        projectId: '213332',
        linePatterns: ['log\\.(?:Printf|Print|Println)\\([\'"]([^\'"]+)[\'"]\\)'],
        filters: [
            {
                repositories: ['/dev-repo'],
                files: ['dev/.*\\.go?'],
            },
        ],
    },
    {
        name: 'docs pages errors',
        projectId: '544533',
        linePatterns: ['throw new Error+\\([\'"]([^\'"]+)[\'"]\\)'],
        filters: [
            {
                repositories: ['sourcegraph/docs'],
            },
        ],
    },
    {
        name: 'dot com errors',
        projectId: '242677',
        linePatterns: ['throw new Error+\\([\'"]([^\'"]+)[\'"]\\)'],
        filters: [
            {
                files: ['\\.tsx?'],
            },
        ],
    },
]

const setDefaults = async () => {
    await sourcegraph.configuration.get().update('sentry.organization', 'sourcegraph')
    await sourcegraph.configuration.get().update('sentry.projects', projects)
}

describe('getParamsFromUriPath', () => {
    it('extracts repo and file params from root folder', () =>
        expect(getParamsFromUriPath('git://github.com/sourcegraph/sourcegraph?264...#index.tsx')).toEqual({
            repo: '/sourcegraph/sourcegraph',
            file: 'index.tsx',
        }))

    it('extracts repo and file params from subfolder', () =>
        expect(
            getParamsFromUriPath('git://github.com/sourcegraph/sourcegraph?264...#web/src/e2e/index.e2e.test.tsx')
        ).toEqual({
            repo: '/sourcegraph/sourcegraph',
            file: 'web/src/e2e/index.e2e.test.tsx',
        }))

    it('return null if URI is corupt', () =>
        expect(getParamsFromUriPath('git://thisisnotavaliduri')).toEqual({
            repo: '',
            file: null,
        }))

    it('return empty file if document has no file format', () =>
        expect(getParamsFromUriPath('git://github.com/sourcegraph/testrepo#formatless')).toEqual({
            repo: '/sourcegraph/testrepo',
            file: null,
        }))
})

const paramsInput = [
    {
        goal: 'returns a web project that matches the repo and file patterns',
        params: {
            repo: '/sourcegraph/sourcegraph',
            file: 'web/src/storm/index.tsx',
        },
        expected: { project: projects[0], missingConfigs: [] },
    },
    {
        goal: 'returns a dev project that matches the repo and file patterns',
        params: {
            repo: '/sourcegraph/dev-repo',
            file: 'dev/backend/main.go',
        },
        expected: { project: projects[1], missingConfigs: [] },
    },
    {
        goal: 'returns file false for not matching file patterns',
        params: {
            repo: '/sourcegraph/dev-repo',
            file: 'dev/test/start.rb',
        },
        expected: null,
    },
    {
        goal: 'returns undefined for not matching repo and false for not matching file patterns',
        params: {
            repo: '/sourcegraph/test-repo',
            file: 'dev/test/start.rb',
        },
        expected: null,
    },
    {
        goal: 'returns undefined for not matching repo and file patterns',
        params: {
            repo: '/sourcegraph/test-repo',
            file: 'dev/test/start.rb',
        },
        expected: null,
    },
    {
        goal: 'returns project for matching repo and undefined for not having file patterns',
        params: {
            repo: '/sourcegraph/docs',
            file: 'src/development/tutorial.tsx',
        },
        expected: { project: projects[2], missingConfigs: [] },
    },
    {
        goal: 'returns project for matching file patterns',
        params: {
            repo: '/sourcegraph/website',
            file: 'web/search/start.tsx',
        },
        expected: { project: projects[3], missingConfigs: [] },
    },
]

describe('matchSentryProject', () => {
    beforeEach(setDefaults)
    for (const paramsCase of paramsInput) {
        it(paramsCase.goal, () => expect(matchSentryProject(paramsCase.params, projects)).toEqual(paramsCase.expected))
    }
})

const incompleteConfigs: { goal: string; settings: SentryProject; expected: string[] }[] = [
    {
        goal: 'returns one missing config',
        settings: {
            name: 'sourcegraph',
            projectId: '1334031',
            linePatterns: ['logger\\.debug\\([\'"`]([^\'"`]+)[\'"`]\\);'],
            filters: [
                {
                    repositories: undefined,
                    files: ['(?:web|shared|src)/.*\\.java?', '(?:dev|src)/.*\\.java?', '\\.java?'],
                },
            ],
        },
        expected: ['settings.filters[0].repositories'],
    },
    {
        goal: 'returns two missing configs',
        settings: {
            name: 'sourcegraph',
            projectId: '',
            linePatterns: ['logger\\.debug\\([\'"`]([^\'"`]+)[\'"`]\\);'],
            filters: [
                {
                    repositories: undefined,
                    files: ['(?:web|shared|src)/.*\\.java?', '(?:dev|src)/.*\\.java?', '\\.java?'],
                },
            ],
        },
        expected: ['settings.projectId', 'settings.filters[0].repositories'],
    },
]

describe('findEmptyConfigs()', () => {
    for (const config of incompleteConfigs) {
        it(config.goal, () => expect(findEmptyConfigs(config.settings)).toEqual(config.expected))
    }
    it('handles empty settings', () => expect(findEmptyConfigs()).toEqual(['settings']))
})

const createDecorationInputs = [
    {
        goal: 'handles an empty organization setting',
        params: { missingConfigData: [] },
        expected: {
            content: ' Configure the Sentry extension to view logs (❕)» ',
            hover: ' Please fill out the configurations in your Sentry extension settings.',
        },
    },
    {
        goal: 'informs user to fill out settings.',
        params: { missingConfigData: ['settings'] },
        expected: {
            content: ' Configure the Sentry extension to view logs (❕)» ',
            hover: ' Please fill out the configurations in your Sentry extension settings.',
        },
    },
    {
        goal: 'informs user to add the repository to their Sentry settings.',
        params: { missingConfigData: ['repositories'], sentryOrg: 'sourcegraph' },
        expected: {
            content: ' View logs in Sentry (❕)» ',
            hover: ' Add this repository to your Sentry extension settings for project matching.',
        },
    },
    {
        goal: 'informs user to add to add missing configs to their Sentry settings.',
        params: { missingConfigData: ['linePatterns', 'files'], sentryProjectId: '1334031', sentryOrg: 'sourcegraph' },
        expected: {
            content: ' View logs in Sentry (❕)» ',
            hover:
                ' Please fill out the following configurations in your Sentry extension settings: linePatterns, files',
        },
    },
]

describe('createDecoration', () => {
    for (const decoInput of createDecorationInputs) {
        it(decoInput.goal, () =>
            expect(
                createDecoration(
                    decoInput.params.missingConfigData,
                    decoInput.params.sentryOrg,
                    decoInput.params.sentryProjectId
                )
            ).toEqual(decoInput.expected)
        )
    }
})
