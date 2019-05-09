import { createStubExtensionContext, createStubSourcegraphAPI } from '@sourcegraph/extension-api-stubs'
import expect from 'expect'
import mock from 'mock-require'

export const sourcegraph = createStubSourcegraphAPI()
// For modules importing Range/Location/Position/URI/etc
mock('sourcegraph', sourcegraph)

import { activate, decorateEditor, decorateLine, getDecorations } from '../extension'
import { resolveSettings, SentryProject } from '../settings'

describe('check for extension activation', () => {
    const context = createStubExtensionContext()
    it('activate extension', () => expect(activate(context)).toEqual(void 0))
})

const settings = {
    'sentry.decorations.inline': false,
    'sentry.organization': 'sourcegraph',
    'sentry.projects': [
        {
            additionalProperties: {
                contentText: 'View sourcegraph/sourcegraph_dot_com errors',
                hoverMessage: 'View errors matching "$1" in Sentry',
                query: '$1',
            },
            name: 'Webapp typescript errors',
            patternProperties: {
                fileMatches: [/(web|shared|src)\/.*\.tsx?/, /\/.*\\.ts?/],
                lineMatches: [
                    /throw new Error+\(['"]([^'"]+)['"]\)/,
                    /console\.(warn|debug|info|error|log)\(['"`]([^'"`]+)['"`]\)/,
                    /log\.(Printf|Print|Println)\(['"]([^'"]+)['"]\)/,
                ],
                repoMatches: [/sourcegraph\/sourcegraph/, /bucket/],
            },
            projectId: '1334031',
        },
        {
            additionalProperties: {
                contentText: 'View sourcegraph/dev-repo errors',
                hoverMessage: 'View errors matching "$1" in Sentry',
                query: '$1',
            },
            name: 'Dev env errors',
            patternProperties: {
                fileMatches: [/(dev)\/.*\\.go?/],
                lineMatches: [/log\.(Printf|Print|Println)\(['"]([^'"]+)['"]\)/],
                repoMatches: [/dev-repo/],
            },
            projectId: '213332',
        },
    ],
}

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

describe('check for configurations', () => {
    beforeEach(async () => {
        await sourcegraph.configuration.get().update('sentry.organization', 'sourcegraph')
        await sourcegraph.configuration.get().update('sentry.projects', projects)
    })
    it('activate extension', () => expect(resolveSettings(sourcegraph.configuration.get().value)).toEqual(settings))
})

const data = [
    {
        goal: 'render complete Sentry link',
        index: 1,
        match: 'cannot determine file path',
        missingConfigData: [],
        sentryProjectId: '134412',
        expected: {
            range: new sourcegraph.Range(new sourcegraph.Position(1, 0), new sourcegraph.Position(1, 0)),
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
    },
    {
        goal: 'warn about incomplete config with missing repoMatches',
        index: 1,
        match: 'cannot determine file path',
        missingConfigData: ['repoMatches'],
        sentryProjectId: '134412',
        expected: {
            range: new sourcegraph.Range(new sourcegraph.Position(1, 0), new sourcegraph.Position(1, 0)),
            isWholeLine: true,
            after: {
                backgroundColor: '#f2736d',
                color: 'rgba(255, 255, 255, 0.8)',
                contentText: ' View logs in Sentry (❕)» ',
                hoverMessage:
                    ' Please fill out the following configurations in your Sentry extension settings: repoMatches',
                linkURL:
                    'https://sentry.io/organizations/sourcegraph/issues/?project=134412&query=is%3Aunresolved+cannot%20determine%20file%20path&statsPeriod=14d',
            },
        },
    },
    {
        goal: 'warn about incomplete config with missing repoMatches and fileMatches patterns',
        index: 1,
        match: 'cannot determine file path',
        missingConfigData: ['repoMatches', 'fileMatches'],
        sentryProjectId: '134412',
        expected: {
            range: new sourcegraph.Range(new sourcegraph.Position(1, 0), new sourcegraph.Position(1, 0)),
            isWholeLine: true,
            after: {
                backgroundColor: '#f2736d',
                color: 'rgba(255, 255, 255, 0.8)',
                contentText: ' View logs in Sentry (❕)» ',
                hoverMessage:
                    ' Please fill out the following configurations in your Sentry extension settings: repoMatches, fileMatches',
                linkURL:
                    'https://sentry.io/organizations/sourcegraph/issues/?project=134412&query=is%3Aunresolved+cannot%20determine%20file%20path&statsPeriod=14d',
            },
        },
    },
    {
        goal: 'render warning link hinting to add projectId and render link to general issues page',
        index: 1,
        match: 'cannot determine file path',
        missingConfigData: ['repoMatches', 'fileMatches'],
        sentryProjectId: undefined,
        expected: {
            range: new sourcegraph.Range(new sourcegraph.Position(1, 0), new sourcegraph.Position(1, 0)),
            isWholeLine: true,
            after: {
                backgroundColor: '#f2736d',
                color: 'rgba(255, 255, 255, 0.8)',
                contentText: ' View logs in Sentry (❕)» ',
                hoverMessage: ' Add Sentry projects to your Sentry extension settings for project matching.',
                linkURL: 'https://sentry.io/organizations/sourcegraph/issues/',
            },
        },
    },
    {
        goal:
            'match line based on common pattern, render warning link hinting to add projectId and render link to general issues page',
        index: 1,
        match: '',
        missingConfigData: ['repoMatches', 'fileMatches'],
        sentryProjectId: undefined,
        expected: {
            range: new sourcegraph.Range(new sourcegraph.Position(1, 0), new sourcegraph.Position(1, 0)),
            isWholeLine: true,
            after: {
                backgroundColor: '#f2736d',
                color: 'rgba(255, 255, 255, 0.8)',
                contentText: ' View logs in Sentry (❕)» ',
                hoverMessage: ' Add Sentry projects to your Sentry extension settings for project matching.',
                linkURL: 'https://sentry.io/organizations/sourcegraph/issues/',
            },
        },
    },
]

describe('decorate line', () => {
    beforeEach(async () => {
        await sourcegraph.configuration.get().update('sentry.organization', 'sourcegraph')
        await sourcegraph.configuration.get().update('sentry.projects', projects)
    })

    for (const deco of data) {
        it('decorates the line with the following goal: ' + deco.goal, () =>
            expect(decorateLine(deco.index, deco.match, deco.missingConfigData, deco.sentryProjectId)).toEqual(
                deco.expected
            )
        )
    }
})

const getDecorationsInput = [
    {
        goal: 'receive two decorations',
        documentUri:
            'git://github.com/sourcegraph/sourcegraph?c436567c152bf40668c75815ed3ce62983af942d#client/browser/src/libs/github/file_info.ts',
        documentText: `if (!headFilePath) {
            throw new Error('cannot determine file path')
        }
        return { ...rest, codeView, headFilePath, baseFilePath }
    }),
    map(data => {
        const diffResolvedRev = getDiffResolvedRev(codeView)
        if (!diffResolvedRev) {
            throw new Error('cannot determine delta info')
        },`,
        expected: [
            {
                range: new sourcegraph.Range(new sourcegraph.Position(1, 0), new sourcegraph.Position(1, 0)),
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
                range: new sourcegraph.Range(new sourcegraph.Position(8, 0), new sourcegraph.Position(8, 0)),
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
    },
    {
        goal: 'receive one decoration',
        documentUri:
            'git://github.com/sourcegraph/sourcegraph?c436567c152bf40668c75815ed3ce62983af942d#client/browser/src/libs/github/file_info.ts',
        documentText: `if (!headFilePath) {
            throw new Error('cannot determine file path')
        }
        return { ...rest, codeView, headFilePath, baseFilePath }
    }),`,
        expected: [
            {
                range: new sourcegraph.Range(new sourcegraph.Position(1, 0), new sourcegraph.Position(1, 0)),
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
    },
    {
        goal: 'receive no decoration due to file format mismatch',
        documentUri:
            'git://github.com/sourcegraph/sourcegraph?c436567c152bf40668c75815ed3ce62983af942d#client/browser/src/libs/github/file_info.php',
        documentText: `if (!headFilePath) {
            throw new Error('cannot determine file path')
        }

        return { ...rest, codeView, headFilePath, baseFilePath }
    }),`,
        expected: [],
    },
    {
        goal: 'receive no decoration due to no line matches',
        documentUri:
            'git://github.com/sourcegraph/sourcegraph?c436567c152bf40668c75815ed3ce62983af942d#client/browser/src/libs/github/empty.ts',
        documentText: `export const resolveDiffFileInfo = (codeView: HTMLElement): Observable<FileInfo> =>
of(codeView).pipe(
    map(({ codeView, ...rest }) => {
        const { headFilePath, baseFilePath } = getDeltaFileName(codeView)
    }),`,
        expected: [],
    },
    {
        goal: 'receive no decoration due to empty textdocument',
        documentUri:
            'git://github.com/sourcegraph/sourcegraph?c436567c152bf40668c75815ed3ce62983af942d#client/browser/src/libs/github/file_info.php',
        documentText: ``,
        expected: [],
    },
    {
        goal: 'receive one decoration on GitLab',
        documentUri:
            'git://gitlab.com/sourcegraph/sourcegraph?92a448bdda22fea9a422f37cf83d99edeaa7fe4c#client/browser/src/e2e/chrome.e2e.test.ts',
        documentText: `if (!headFilePath) {
            throw new Error('cannot determine file path')
        }
        return { ...rest, codeView, headFilePath, baseFilePath }
    }),`,
        expected: [
            {
                range: new sourcegraph.Range(new sourcegraph.Position(1, 0), new sourcegraph.Position(1, 0)),
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
    },
    {
        goal: 'returns empty array due to missing documentUri, documentText and projects list',
        documentUri: '',
        documentText: ``,
        expected: [],
    },
]

describe('get Decorations', () => {
    beforeEach(async () => {
        await sourcegraph.configuration.get().update('sentry.organization', 'sourcegraph')
        await sourcegraph.configuration.get().update('sentry.projects', projects)
    })

    for (const deco of getDecorationsInput) {
        it('fulfills the following goal:' + deco.goal, () =>
            expect(getDecorations(deco.documentUri, deco.documentText, projects)).toEqual(deco.expected)
        )
    }
})

// make sure matching code is located on line 1 to ensure same start/end as decorationsList[3]
const supportedLanguageCode = [
    {
        lang: 'go',
        code: `// ErrInvalidToken is returned by DiscussionMailReplyTokens.Get when the token is invalid
    var ErrInvalidToken = errors.New("invalid token")
    // Get returns the user and thread ID found for the given token. If there`,
    },
    {
        lang: 'typescript',
        code: `        if (!headFilePath) {
        throw new Error('cannot determine file path')
    }`,
    },
    {
        lang: 'python',
        code: `def create_app():
            raise TypeError('bad bad factory!')`,
    },
    {
        lang: 'java',
        code: `   } catch (UnsupportedEncodingException err) {
            logger.debug("failed to build URL");
            err.printStackTrace();`,
    },
]

const unsupportedLanguageCode = [
    {
        lang: 'C++',
        code: `   {
            log_error("Exception occurred!");
            throw;
          }`,
    },
]

const expectedLanguageTestOutcome = [
    {
        range: new sourcegraph.Range(new sourcegraph.Position(1, 0), new sourcegraph.Position(1, 0)),
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

describe('decorate Editor', () => {
    beforeEach(async () => {
        await sourcegraph.configuration.get().update('sentry.organization', 'sourcegraph')
        await sourcegraph.configuration.get().update('sentry.projects', projects)
    })

    projects[0].patternProperties.lineMatches = []
    for (const [i, codeExample] of supportedLanguageCode.entries()) {
        it('check common pattern matching for ' + supportedLanguageCode[i].lang, () =>
            expect(decorateEditor([], codeExample.code)).toEqual(expectedLanguageTestOutcome)
        )
    }
    for (const [i, codeExample] of unsupportedLanguageCode.entries()) {
        it('should not render due to unsupported language ' + unsupportedLanguageCode[i].lang, () =>
            expect(decorateEditor([], codeExample.code)).toEqual([])
        )
    }
    // set lineMatches back to original state for the other tests
    projects[0].patternProperties.lineMatches = [
        /throw new Error+\(['"]([^'"]+)['"]\)/,
        /console\.(warn|debug|info|error|log)\(['"`]([^'"`]+)['"`]\)/,
        /log\.(Printf|Print|Println)\(['"]([^'"]+)['"]\)/,
    ]
})
