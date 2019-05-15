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
            /throw new Error+\(['"]([^'"]+)['"]\)/,
            /console\.(warn|debug|info|error|log)\(['"`]([^'"`]+)['"`]\)/,
            /log\.(Printf|Print|Println)\(['"]([^'"]+)['"]\)/,
        ],
        filters: [
            {
                repository: [/sourcegraph\/sourcegraph/, /bucket/],
                file: [/(web|shared|src)\/.*\.tsx?/, /\/.*\\.ts?/],
            },
        ],
    },

    {
        name: 'Dev env errors',
        projectId: '213332',
        linePatterns: [/log\.(Printf|Print|Println)\(['"]([^'"]+)['"]\)/],
        filters: [
            {
                repository: [/dev-repo/],
                file: [/dev\/.*.go?/],
            },
        ],
    },
]

const setDefaults = async () => {
    await sourcegraph.configuration.get().update('sentry.organization', 'sourcegraph')
    await sourcegraph.configuration.get().update('sentry.projects', projects)
}

describe('getParamsFromUriPath', () => {
    beforeEach(setDefaults)
    it('extracts repo and file params from root folder', () =>
        expect(getParamsFromUriPath('git://github.com/sourcegraph/sourcegraph?264...#index.tsx')).toEqual({
            repo: 'sourcegraph/sourcegraph',
            file: 'index.tsx',
        }))

    it('extracts repo and file params from subfolder', () =>
        expect(
            getParamsFromUriPath('git://github.com/sourcegraph/sourcegraph?264...#web/src/e2e/index.e2e.test.tsx')
        ).toEqual({
            repo: 'sourcegraph/sourcegraph',
            file: 'web/src/e2e/index.e2e.test.tsx',
        }))

    it('return empty repo if host is not GitHub', () =>
        expect(getParamsFromUriPath('git://unknownhost.com/sourcegraph/testrepo#http/req/main.go')).toEqual({
            repo: null,
            file: 'http/req/main.go',
        }))

    it('return empty file if document has no file format', () =>
        expect(getParamsFromUriPath('git://github.com/sourcegraph/sourcegraph/testrepo#formatless')).toEqual({
            repo: 'sourcegraph/sourcegraph',
            file: null,
        }))
})

const paramsInput = [
    {
        goal: 'returns a web project that matches the repo and file patterns',
        params: {
            repo: 'sourcegraph/sourcegraph',
            file: 'web/src/storm/index.tsx',
        },
        expected: { project: projects[0], fileMatched: true },
    },
    {
        goal: 'returns a dev project that matches the repo and file patterns',
        params: {
            repo: 'sourcegraph/dev-repo',
            file: 'dev/backend/main.go',
        },
        expected: { project: projects[1], fileMatched: true },
    },
    {
        goal: 'returns undefined for not matching repo and file patterns',
        params: {
            repo: 'sourcegraph/test-repo',
            file: 'dev/test/start.rb',
        },
        expected: { project: undefined, fileMatched: undefined },
    },
    {
        goal: 'returns undefined for not matching repo and file patterns',
        params: {
            repo: 'sourcegraph/test-repo',
            file: 'dev/test/start.rb',
        },
        expected: { project: undefined, fileMatched: undefined },
    },
]

describe('matchSentryProject', () => {
    beforeEach(setDefaults)
    for (const paramsCase of paramsInput) {
        it(paramsCase.goal, () => expect(matchSentryProject(paramsCase.params, projects)).toEqual(paramsCase.expected))
    }
})

const incompleteConfigs = [
    {
        goal: 'returns one missing config',
        settings: {
            name: 'sourcegraph',
            projectId: '1334031',
            linePatterns: [/logger\.debug\(['"`]([^'"`]+)['"`]\);/],
            filters: [
                {
                    repository: undefined,
                    file: [/(web|shared|src).*\.java?/, /(dev|src).*\.java?/, /.java?/],
                },
            ],
        },
        expected: ['settings.filters[0].repository'],
    },
    {
        goal: 'returns two missing configs',
        settings: {
            name: 'sourcegraph',
            projectId: '',
            linePatterns: [/logger\.debug\(['"`]([^'"`]+)['"`]\);/],
            filters: [
                {
                    repository: undefined,
                    file: [/(web|shared|src).*\.java?/, /(dev|src).*\.java?/, /.java?/],
                },
            ],
        },
        expected: ['settings.projectId', 'settings.filters[0].repository'],
    },
]

describe('findEmptyConfigs()', () => {
    for (const config of incompleteConfigs) {
        it(config.goal, () => expect(findEmptyConfigs(config.settings)).toEqual(config.expected))
    }
    it('handles empty settings', () => expect(findEmptyConfigs()).toEqual(['settings']))
})

const createDecorationWithoutOrgOutcome = {
    content: ' Configure the Sentry extension to view logs. ',
    hover: ' Configure the Sentry extension to view logs in Sentry. ',
    backgroundColor: '#e03e2f',
}

describe('createDecoration', () => {
    it('handles an empty organization setting', () =>
        expect(createDecoration([])).toEqual(createDecorationWithoutOrgOutcome))
})
