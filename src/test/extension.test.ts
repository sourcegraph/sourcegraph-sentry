import { createStubExtensionContext, createStubSourcegraphAPI } from '@sourcegraph/extension-api-stubs'
import expect from 'expect'
import mock from 'mock-require'

const sourcegraph = createStubSourcegraphAPI()
// For modules importing Range/Location/Position/URI/etc
mock('sourcegraph', sourcegraph)

import { activate, buildDecorations, decorateLine, getDecorations } from '../extension'
import { resolveSettings, SentryProject } from '../settings'

describe('activation', () => {
    it('does not throw an error', () => {
        const context = createStubExtensionContext()
        expect(activate(context)).toEqual(void 0)
    })
})

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
                file: [/(dev)\/.*\\.go?/],
            },
        ],
    },
]

const setDefaults = async () => {
    await sourcegraph.configuration.get().update('sentry.organization', 'sourcegraph')
    await sourcegraph.configuration.get().update('sentry.projects', projects)
}

describe('resolveSettings()', () => {
    beforeEach(setDefaults)
    it('should return configuration with applied defaults', () => {
        const settings = {
            'sentry.decorations.inline': false,
            'sentry.organization': 'sourcegraph',
            'sentry.projects': [
                {
                    projectId: '1334031',
                    name: 'Webapp typescript errors',
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
                    projectId: '213332',
                    name: 'Dev env errors',
                    linePatterns: [/log\.(Printf|Print|Println)\(['"]([^'"]+)['"]\)/],
                    filters: [
                        {
                            repository: [/dev-repo/],
                            file: [/(dev)\/.*\\.go?/],
                        },
                    ],
                },
            ],
        }
        expect(resolveSettings(sourcegraph.configuration.get().value)).toEqual(settings)
    })
})

const decorateLineInput = [
    {
        goal: 'renders complete Sentry link',
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
                    'https://sentry.io/organizations/sourcegraph/issues/?project=134412&query=is%3Aunresolved+cannot+determine+file+path&statsPeriod=14d',
            },
        },
    },
    {
        goal: 'warns about incomplete config with missing repository',
        index: 1,
        match: 'cannot determine file path',
        missingConfigData: ['repository'],
        sentryProjectId: '134412',
        expected: {
            range: new sourcegraph.Range(new sourcegraph.Position(1, 0), new sourcegraph.Position(1, 0)),
            isWholeLine: true,
            after: {
                backgroundColor: '#f2736d',
                color: 'rgba(255, 255, 255, 0.8)',
                contentText: ' View logs in Sentry (❕)» ',
                hoverMessage: ' Add this repository to your Sentry extension settings for project matching.',
                linkURL:
                    'https://sentry.io/organizations/sourcegraph/issues/?project=134412&query=is%3Aunresolved+cannot+determine+file+path&statsPeriod=14d',
            },
        },
    },
    {
        goal: 'warns about incomplete config with missing repository and file patterns',
        index: 1,
        match: 'cannot determine file path',
        missingConfigData: ['repository', 'file'],
        sentryProjectId: '134412',
        expected: {
            range: new sourcegraph.Range(new sourcegraph.Position(1, 0), new sourcegraph.Position(1, 0)),
            isWholeLine: true,
            after: {
                backgroundColor: '#f2736d',
                color: 'rgba(255, 255, 255, 0.8)',
                contentText: ' View logs in Sentry (❕)» ',
                hoverMessage: ' Add this repository to your Sentry extension settings for project matching.',
                linkURL:
                    'https://sentry.io/organizations/sourcegraph/issues/?project=134412&query=is%3Aunresolved+cannot+determine+file+path&statsPeriod=14d',
            },
        },
    },
    {
        goal: 'renders warning link hinting to add projectId and render link to general issues page',
        index: 1,
        match: 'cannot determine file path',
        missingConfigData: ['file'],
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
            'matches line based on common pattern, render warning link hinting to add projectId and render link to general issues page',
        index: 1,
        match: '',
        missingConfigData: ['file'],
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

describe('decorateLine()', () => {
    beforeEach(setDefaults)

    for (const decoInput of decorateLineInput) {
        it(decoInput.goal, () =>
            expect(
                decorateLine(decoInput.index, decoInput.match, decoInput.missingConfigData, decoInput.sentryProjectId)
            ).toEqual(decoInput.expected)
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
                        'https://sentry.io/organizations/sourcegraph/issues/?project=1334031&query=is%3Aunresolved+cannot+determine+file+path&statsPeriod=14d',
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
                        'https://sentry.io/organizations/sourcegraph/issues/?project=1334031&query=is%3Aunresolved+cannot+determine+delta+info&statsPeriod=14d',
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
                        'https://sentry.io/organizations/sourcegraph/issues/?project=1334031&query=is%3Aunresolved+cannot+determine+file+path&statsPeriod=14d',
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
                        'https://sentry.io/organizations/sourcegraph/issues/?project=1334031&query=is%3Aunresolved+cannot+determine+file+path&statsPeriod=14d',
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

describe('getDecorations()', () => {
    beforeEach(setDefaults)

    for (const deco of getDecorationsInput) {
        it(deco.goal, () =>
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
        lang: 'typescript',
        code: `        if (!headFilePath) {
        throw new Error('cannot determine file path')
    }`,
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
        lang: 'python',
        code: `def create_app():
            raise TypeError('bad bad factory!')`,
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
        lang: 'java',
        code: `   } catch (UnsupportedEncodingException err) {
            logger.debug("failed to build URL");
            err.printStackTrace();`,
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

const unsupportedLanguageCode = [
    {
        lang: 'C++',
        code: `   {
            log_error("Exception occurred!");
            throw;
          }`,
    },
]

describe('buildDecorations()', () => {
    beforeEach(setDefaults)

    projects[0].linePatterns = []
    for (const [, codeExample] of supportedLanguageCode.entries()) {
        it('check common pattern matching for ' + codeExample.lang, () =>
            expect(buildDecorations([], codeExample.code)).toEqual([codeExample.expected])
        )
    }
    for (const [, codeExample] of unsupportedLanguageCode.entries()) {
        it('should not render due to unsupported language ' + codeExample.lang, () =>
            expect(buildDecorations([], codeExample.code)).toEqual([])
        )
    }
    // set linePatterns back to original state for the other tests
    projects[0].linePatterns = [
        /throw new Error+\(['"]([^'"]+)['"]\)/,
        /console\.(warn|debug|info|error|log)\(['"`]([^'"`]+)['"`]\)/,
        /log\.(Printf|Print|Println)\(['"]([^'"]+)['"]\)/,
    ]
})
