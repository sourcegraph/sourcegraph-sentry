import expect from 'expect'
import mock from 'mock-require'
import { createMockSourcegraphAPI, projects } from './stubs'

const sourcegraph = createMockSourcegraphAPI()
// For modules importing Range/Location/URI/etc
mock('sourcegraph', sourcegraph)

import { checkMissingConfig, getParamsFromUriPath, matchSentryProject } from '../handler'
import { SentryProject } from '../settings'

describe('getParamsFromUriPath', () => {
    it('extracts repo and file params from root folder', () =>
        expect(getParamsFromUriPath('git://github.com/sourcegraph/sourcegraph?264...#index.tsx')).toEqual({
            repo: 'sourcegraph/sourcegraph',
            file: '#index.tsx',
        }))

    it('extracts repo and file params from subfolder', () =>
        expect(
            getParamsFromUriPath('git://github.com/sourcegraph/sourcegraph?264...#web/src/e2e/index.e2e.test.tsx')
        ).toEqual({ repo: 'sourcegraph/sourcegraph', file: '#web/src/e2e/index.e2e.test.tsx' }))

    it('return empty repo if host is not GitHub', () =>
        expect(getParamsFromUriPath('git://unknownhost.com/sourcegraph/testrepo#http/req/main.go')).toEqual({
            repo: null,
            file: '#http/req/main.go',
        }))

    it('return empty file if document has no file format', () =>
        expect(getParamsFromUriPath('git://github.com/sourcegraph/sourcegraph/testrepo#formatless')).toEqual({
            repo: 'sourcegraph/sourcegraph',
            file: null,
        }))
})

const paramsWeb = {
    repo: 'sourcegraph/sourcegraph',
    file: '#web/src/storm/index.tsx',
}

export const paramsDev = {
    repo: 'sourcegraph/dev-repo',
    file: '#dev/backend/main.go',
}

export const paramsNone = {
    repo: 'sourcegraph/test-repo',
    file: '#dev/test/start.rb',
}

describe('matchSentryProject', () => {
    it('returns a web project that matches the repo and file patterns', () =>
        expect(matchSentryProject(paramsWeb, projects)).toEqual(projects[0]))

    it('returns a dev project that matches the repo and file patterns', () =>
        expect(matchSentryProject(paramsDev, projects)).toEqual(projects[1]))

    it('returns undefined for not matching repo and file patterns', () =>
        expect(matchSentryProject(paramsNone, projects)).toEqual(undefined))
})

const incompleteConfigs: SentryProject = {
    name: 'sourcegraph',
    projectId: '1334031',
    patternProperties: {
        repoMatches: undefined,
        fileMatches: [/(web|shared|src).*\.java?/, /(dev|src).*\.java?/, /.java?/],
        lineMatches: [/logger\.debug\(['"`]([^'"`]+)['"`]\);/],
    },
}

describe('missingConfig', () => {
    it('check missing configs', () => expect(checkMissingConfig(incompleteConfigs)).toEqual(['repoMatches']))
})
