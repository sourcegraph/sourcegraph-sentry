import expect from 'expect'
import mock from 'mock-require'
import { SentryProject } from '../settings'
import { createMockSourcegraphAPI } from './stubs'

const sourcegraph = createMockSourcegraphAPI()
// For modules importing Range/Location/Position/URI/etc
mock('sourcegraph', sourcegraph)

import { getParamsFromUriPath, matchSentryProject } from '../handler'

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

const project: SentryProject[] = [
    {
        name: 'Webapp typescript errors',
        projectId: '1334031',
        patternProperties: {
            repoMatch: /sourcegraph\/sourcegraph/,
            fileMatches: [/(web|shared)\/.*\.tsx?/, /(dev)\/.*\\.ts?/],
            lineMatches: [
                /throw new Error+\(['"]([^'"]+)['"]\)/,
                /console\.(warn|debug|info|error|log)\(['"`]([^'"`]+)['"`]\)/,
                /log\.(Printf|Print|Println)\(['"]([^'"]+)['"]\)/,
            ],
        },
        additionalProperties: {
            contentText: 'View sourcegraph/sourcegraph_dot_com errors',
            hoverMessage: 'View errors matching "$1" in Sentry',
            query: '$1',
        },
    },

    {
        name: 'Dev env errors',
        projectId: '213332',
        patternProperties: {
            repoMatch: /sourcegraph\/dev-repo/,
            fileMatches: [/(dev)\/.*\\.go?/],
            lineMatches: [/log\.(Printf|Print|Println)\(['"]([^'"]+)['"]\)/],
        },
        additionalProperties: {
            contentText: 'View sourcegraph/dev-repo errors',
            hoverMessage: 'View errors matching "$1" in Sentry',
            query: '$1',
        },
    },
]

const paramsWeb = {
    repo: 'sourcegraph/sourcegraph',
    file: '#web/src/storm/index.tsx',
}

const paramsDev = {
    repo: 'sourcegraph/dev-repo',
    file: '#dev/backend/main.go',
}

const paramsNone = {
    repo: 'sourcegraph/test-repo',
    file: '#dev/test/start.rb',
}

describe('matchSentryProject', () => {
    it('returns a web project that matches the repo and file patterns', () =>
        expect(matchSentryProject(paramsWeb, project)).toEqual({
            name: 'Webapp typescript errors',
            projectId: '1334031',
            patternProperties: {
                repoMatch: /sourcegraph\/sourcegraph/,
                fileMatches: [/(web|shared)\/.*\.tsx?/, /(dev)\/.*\\.ts?/],
                lineMatches: [
                    /throw new Error+\(['"]([^'"]+)['"]\)/,
                    /console\.(warn|debug|info|error|log)\(['"`]([^'"`]+)['"`]\)/,
                    /log\.(Printf|Print|Println)\(['"]([^'"]+)['"]\)/,
                ],
            },
            additionalProperties: {
                contentText: 'View sourcegraph/sourcegraph_dot_com errors',
                hoverMessage: 'View errors matching "$1" in Sentry',
                query: '$1',
            },
        })),
        it('returns a dev project that matches the repo and file patterns', () =>
            expect(matchSentryProject(paramsDev, project)).toEqual({
                name: 'Dev env errors',
                projectId: '213332',
                patternProperties: {
                    repoMatch: /sourcegraph\/dev-repo/,
                    fileMatches: [/(dev)\/.*\\.go?/],
                    lineMatches: [/log\.(Printf|Print|Println)\(['"]([^'"]+)['"]\)/],
                },
                additionalProperties: {
                    contentText: 'View sourcegraph/dev-repo errors',
                    hoverMessage: 'View errors matching "$1" in Sentry',
                    query: '$1',
                },
            })),
        it('returns undefined for not matching repo and file patterns', () =>
            expect(matchSentryProject(paramsNone, project)).toEqual(undefined))
})
