import expect from 'expect'
import { getParamsFromUriPath, matchSentryProject } from './handler'
import { Settings } from './settings'

describe('getParamsFromUriPath', () => {
    it('extracts repo and file params', () =>
        expect(
            getParamsFromUriPath('git://github.com/sourcegraph/sourcegraph?264...#web/src/e2e/index.e2e.test.tsx')
        ).toEqual({ repo: 'sourcegraph/sourcegraph', file: '#web/src/e2e/index.e2e.test.tsx' }))

    it('return empty repo if host is not GitHub', () =>
        expect(getParamsFromUriPath('git://unknownhost.com/sourcegraph/testrepo#http/req/main.go')).toEqual({
            repo: '',
            file: '#http/req/main.go',
        }))

    it('return empty file if document has no file format', () =>
        expect(getParamsFromUriPath('git://github.com/sourcegraph/sourcegraph/testrepo#formatless')).toEqual({
            repo: 'sourcegraph/sourcegraph',
            file: '',
        }))
})

const projects: Settings['sentry.projects'] = [
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
]

const params = {
    repo: 'sourcegraph/sourcegraph',
    file: '#web/src/storm/index.tsx',
}

describe('matchSentryProject', () => {
    it('extracts repo and file params', () =>
        expect(matchSentryProject(params, projects)).toEqual({
            projectId: '1334031',
            lineMatches: [
                /throw new Error+\(['"]([^'"]+)['"]\)/,
                /console\.(warn|debug|info|error|log)\(['"`]([^'"`]+)['"`]\)/,
                /log\.(Printf|Print|Println)\(['"]([^'"]+)['"]\)/,
            ],
        }))
})
