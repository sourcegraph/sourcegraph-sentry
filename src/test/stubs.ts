import { uniqueId } from 'lodash'
import * as sourcegraph from 'sourcegraph'
import { SentryProject } from '../settings'

const URI = URL
type URI = URL

class Range {
    constructor(
        public startLine: number,
        public startCharacter: number,
        public endLine: number,
        public endCharacter: number
    ) {}
}
class Location {
    constructor(public uri: URI, public range: Range) {}
}
/**
 * Creates an object that (mostly) implements the Sourcegraph API,
 * with all methods being Sinon spys and all Subscribables being Subjects.
 */
export const createMockSourcegraphAPI = () => ({
    internal: {
        sourcegraphURL: 'https://sourcegraph.test',
    },
    URI,
    Range,
    Location,
    workspace: {
        textDocuments: [] as sourcegraph.TextDocument[],
    },
    app: {
        createDecorationType: () => ({ key: uniqueId('decorationType') }),
    },
    configuration: {
        get: () => ({
            value: {
                'sentry.organization': 'sourcegraph',
                projects,
            },
        }),
    },
    search: {},
    commands: {},
})

export let projects: SentryProject[] = [
    {
        name: 'Webapp typescript errors',
        projectId: '1334031',
        patternProperties: {
            repoMatches: [/sourcegraph\/sourcegraph/, /bucket/],
            fileMatches: [/(web|shared|src)\/.*\.tsx?/, /\/.*\\.ts?/],
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
            repoMatches: [/dev-repo/],
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

export const paramsWeb = {
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
