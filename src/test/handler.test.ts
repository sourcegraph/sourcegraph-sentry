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
        projectId: '1334031',
        filters: [
            {
                repositories: ['/sourcegraph/sourcegraph', '/bucket'],
                files: ['(?:web|shared|src)/.*\\.tsx?', '\\.ts?'],
            },
        ],
        linePatterns: [
            'throw new Error+\\([\'"]([^\'"]+)[\'"]\\)',
            'console\\.(?:warn|debug|info|error|log)\\([\'"`]([^\'"`]+)[\'"`]\\)',
            'log\\.(Printf|Print|Println)\\([\'"]([^\'"]+)[\'"]\\)',
        ],
    },
    {
        projectId: '213332',
        filters: [
            {
                repositories: ['/dev-repo'],
                files: ['dev/.*\\.go?'],
            },
        ],
        linePatterns: ['log\\.(?:Printf|Print|Println)\\([\'"]([^\'"]+)[\'"]\\)'],
    },
    {
        projectId: '544533',
        filters: [
            {
                repositories: ['/sourcegraph/docs'],
            },
        ],
        linePatterns: ['throw new Error+\\([\'"]([^\'"]+)[\'"]\\)'],
    },
    {
        projectId: '242677',
        filters: [
            {
                files: ['\\.tsx?'],
            },
        ],
        linePatterns: ['throw new Error+\\([\'"]([^\'"]+)[\'"]\\)'],
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

    it('returns null if URI is corrupted', () => expect(getParamsFromUriPath('thisisnotavaliduri')).toEqual(null))

    it('returns empty file if document has no file format', () =>
        expect(getParamsFromUriPath('git://github.com/sourcegraph/testrepo#formatless')).toEqual({
            repo: '/sourcegraph/testrepo',
            file: null,
        }))
})

const paramsInput = [
    {
        goal: 'returns a web project that matches the repo and file patterns and an empty missingConfigs list',
        params: {
            repo: '/sourcegraph/sourcegraph',
            file: 'web/src/storm/index.tsx',
        },
        expected: { project: projects[0], missingConfigs: [] },
    },
    {
        goal: 'does not return a web project, as the params repo does not match the config repo, despite being similar',
        params: {
            repo: '/different-sourcegraph/docs',
            file: 'web/src/storm/index.md',
        },
        expected: null,
    },
    {
        goal: 'returns a dev project that matches the repo and file patterns and an empty missingConfigs list',
        params: {
            repo: '/sourcegraph/dev-repo',
            file: 'dev/backend/main.go',
        },
        expected: { project: projects[1], missingConfigs: [] },
    },
    {
        goal: 'returns null for not matching file patterns',
        params: {
            repo: '/sourcegraph/dev-repo',
            file: 'dev/test/start.rb',
        },
        expected: null,
    },
    {
        goal: 'returns null for not matching repo and file patterns',
        params: {
            repo: '/sourcegraph/test-repo',
            file: 'dev/test/start.rb',
        },
        expected: null,
    },
    {
        goal: 'returns project for matching repo despite not having a files config and an empty missingConfigs list',
        params: {
            repo: '/sourcegraph/docs',
            file: 'src/development/tutorial.tsx',
        },
        expected: { project: projects[2], missingConfigs: [] },
    },
    {
        goal:
            'returns project for matching file patterns despite not having a repositories config and an empty missingConfigs list',
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
            projectId: '1334031',
            linePatterns: ['logger\\.debug\\([\'"`]([^\'"`]+)[\'"`]\\);'],
            filters: [
                {
                    repositories: [],
                    files: ['(?:web|shared|src)/.*\\.java?', '(?:dev|src)/.*\\.java?', '\\.java?'],
                },
            ],
        },
        expected: ['project[0].filters[0].repositories'],
    },
    {
        goal: 'returns two missing configs with correct indexes',
        settings: {
            projectId: '',
            linePatterns: ['logger\\.debug\\([\'"`]([^\'"`]+)[\'"`]\\);'],
            filters: [
                {
                    repositories: [],
                    files: ['(?:web|shared|src)/.*\\.java?', '(?:dev|src)/.*\\.java?', '\\.java?'],
                },
            ],
        },
        expected: ['project[1].projectId', 'project[1].filters[0].repositories'],
    },
    {
        goal: 'returns two missing configs with correct indexes',
        settings: {
            projectId: '1334031',
            linePatterns: ['logger\\.debug\\([\'"`]([^\'"`]+)[\'"`]\\);'],
            filters: [
                {
                    repositories: [],
                    files: [],
                },
            ],
        },
        expected: ['project[2].filters[0].repositories', 'project[2].filters[0].files'],
    },
    {
        goal: 'returns three missing configs with correct indexes',
        settings: {
            projectId: '',
            linePatterns: ['logger\\.debug\\([\'"`]([^\'"`]+)[\'"`]\\);'],
            filters: [
                {
                    repositories: [],
                    files: [],
                },
            ],
        },
        expected: ['project[3].projectId', 'project[3].filters[0].repositories', 'project[3].filters[0].files'],
    },
    {
        goal: 'returns one missing config and does not expect a files filter',
        settings: {
            projectId: '425773',
            linePatterns: ['logger\\.debug\\([\'"`]([^\'"`]+)[\'"`]\\);'],
            filters: [
                {
                    repositories: [],
                },
            ],
        },
        expected: ['project[4].filters[0].repositories'],
    },
    {
        goal: 'returns one missing config and does not expect a files filter',
        settings: {
            projectId: '425773',
        },
        expected: ['project[5].filters[0].repositories'],
    },
]

describe('findEmptyConfigs()', () => {
    for (const [index, config] of incompleteConfigs.entries()) {
        it(config.goal, () => expect(findEmptyConfigs(config.settings, 'project', index)).toEqual(config.expected))
    }
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
            hover: ' Please fill out these configurations for better Sentry project matching: linePatterns, files',
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
