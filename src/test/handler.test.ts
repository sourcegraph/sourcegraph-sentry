import { createStubSourcegraphAPI } from '@sourcegraph/extension-api-stubs'
import expect from 'expect'
import mock from 'mock-require'
import { projects } from './extension.test'

export const sourcegraph = createStubSourcegraphAPI()
// For modules importing Range/Location/Position/URI/etc
mock('sourcegraph', sourcegraph)

import { checkMissingConfig, createDecoration, getParamsFromUriPath, matchSentryProject } from '../handler'

describe('getParamsFromUriPath', () => {
    beforeEach(async () => {
        await sourcegraph.configuration.get().update('sentry.organization', 'sourcegraph')
        await sourcegraph.configuration.get().update('sentry.projects', projects)
    })
    it('extracts repo and file params from root folder', () =>
        expect(getParamsFromUriPath('git://github.com/sourcegraph/sourcegraph?264...#index.tsx')).toEqual({
            repo: 'sourcegraph/sourcegraph?264...#index.tsx',
            file: '#index.tsx',
        }))

    it('extracts repo and file params from subfolder', () =>
        expect(
            getParamsFromUriPath('git://github.com/sourcegraph/sourcegraph?264...#web/src/e2e/index.e2e.test.tsx')
        ).toEqual({
            repo: 'sourcegraph/sourcegraph?264...#web/src/e2e/index.e2e.test.tsx',
            file: '#web/src/e2e/index.e2e.test.tsx',
        }))

    it('return empty repo if host is not GitHub', () =>
        expect(getParamsFromUriPath('git://unknownhost.com/sourcegraph/testrepo#http/req/main.go')).toEqual({
            repo: null,
            file: '#http/req/main.go',
        }))

    it('return empty file if document has no file format', () =>
        expect(getParamsFromUriPath('git://github.com/sourcegraph/sourcegraph/testrepo#formatless')).toEqual({
            repo: 'sourcegraph/sourcegraph/testrepo#formatless',
            file: null,
        }))
})

const paramsInput = [
    {
        goal: 'returns a web project that matches the repo and file patterns',
        params: {
            repo: 'sourcegraph/sourcegraph',
            file: '#web/src/storm/index.tsx',
        },
        expected: projects[0],
    },
    {
        goal: 'returns a dev project that matches the repo and file patterns',
        params: {
            repo: 'sourcegraph/dev-repo',
            file: '#dev/backend/main.go',
        },
        expected: projects[1],
    },
    {
        goal: 'returns undefined for not matching repo and file patterns',
        params: {
            repo: 'sourcegraph/test-repo',
            file: '#dev/test/start.rb',
        },
        expected: undefined,
    },
    {
        goal: 'returns undefined for not matching repo and file patterns',
        params: {
            repo: 'sourcegraph/test-repo',
            file: '#dev/test/start.rb',
        },
        expected: undefined,
    },
]

describe('matchSentryProject', () => {
    beforeEach(async () => {
        await sourcegraph.configuration.get().update('sentry.organization', 'sourcegraph')
        await sourcegraph.configuration.get().update('sentry.projects', projects)
    })
    for (const paramsCase of paramsInput) {
        it('fullfils the following goal: ' + paramsCase.goal, () =>
            expect(matchSentryProject(paramsCase.params, projects)).toEqual(paramsCase.expected)
        )
    }
})

const incompleteConfigs = [
    {
        goal: 'return one missing config',
        settings: {
            name: 'sourcegraph',
            projectId: '1334031',
            patternProperties: {
                repoMatches: undefined,
                fileMatches: [/(web|shared|src).*\.java?/, /(dev|src).*\.java?/, /.java?/],
                lineMatches: [/logger\.debug\(['"`]([^'"`]+)['"`]\);/],
            },
        },
        expected: ['repoMatches'],
    },
    {
        goal: 'return two missing configs',
        settings: {
            name: 'sourcegraph',
            projectId: '',
            patternProperties: {
                repoMatches: undefined,
                fileMatches: [/(web|shared|src).*\.java?/, /(dev|src).*\.java?/, /.java?/],
                lineMatches: [/logger\.debug\(['"`]([^'"`]+)['"`]\);/],
            },
        },
        expected: ['projectId', 'repoMatches'],
    },
]

describe('missingConfig', () => {
    for (const config of incompleteConfigs) {
        it('check missing configs with goal to ' + config.goal, () =>
            expect(checkMissingConfig(config.settings)).toEqual(config.expected)
        )
    }
    it('handle empty settings', () => expect(checkMissingConfig()).toEqual([]))
})

const createDecorationWithoutOrgOutcome = {
    content: ' Configure the Sentry extension to view logs. ',
    hover: ' Configure the Sentry extension to view logs in Sentry. ',
    backgroundColor: '#e03e2f',
}

describe('createDecoration', () => {
    it('handle empty organization setting', () =>
        expect(createDecoration([])).toEqual(createDecorationWithoutOrgOutcome))
})
