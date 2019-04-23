import expect from 'expect'
import mock from 'mock-require'
import { createMockSourcegraphAPI, projects } from './stubs'

const sourcegraph = createMockSourcegraphAPI()
// For modules importing Range/Location/URI/etc
mock('sourcegraph', sourcegraph)

import { activate, decorateEditor, decorateLine, getDecorations } from '../extension'

describe('extension', () => {
    it('works', () => void 0)
})

describe('check for extension activation', () => {
    it('activate extension', () => expect(activate(sourcegraph.ExtensionContext)).toEqual(void 0))
})

const data = [
    {
        goal: 'render complete Sentry link',
        index: 1,
        match: 'cannot determine file path',
        missingConfigData: [],
        sentryProjectId: '134412',
    },
    {
        goal: 'warn about incomplete config with missing repoMatch',
        index: 1,
        match: 'cannot determine file path',
        missingConfigData: ['repoMatch'],
        sentryProjectId: '134412',
    },
    {
        goal: 'warn about incomplete config with missing repoMatch and fileMatch patterns',
        index: 1,
        match: 'cannot determine file path',
        missingConfigData: ['repoMatch', 'fileMatch'],
        sentryProjectId: '134412',
    },
    {
        goal: 'render warning link hinting to add projectId and render link to general issues page',
        index: 1,
        match: 'cannot determine file path',
        missingConfigData: ['repoMatch', 'fileMatch'],
        sentryProjectId: undefined,
    },
    {
        goal:
            'match line based on common pattern, render warning link hinting to add projectId and render link to general issues page',
        index: 1,
        match: '',
        missingConfigData: ['repoMatch', 'fileMatch'],
        sentryProjectId: undefined,
    },
]

const decorationsList = [
    {
        range: new sourcegraph.Range(1, 0, 1, 0),
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
    {
        range: new sourcegraph.Range(1, 0, 1, 0),
        isWholeLine: true,
        after: {
            backgroundColor: '#f2736d',
            color: 'rgba(255, 255, 255, 0.8)',
            contentText: ' View logs in Sentry (❕)» ',
            hoverMessage: ' Please fill out the following configurations in your Sentry extension settings: repoMatch',
            linkURL:
                'https://sentry.io/organizations/sourcegraph/issues/?project=134412&query=is%3Aunresolved+cannot%20determine%20file%20path&statsPeriod=14d',
        },
    },
    {
        range: new sourcegraph.Range(1, 0, 1, 0),
        isWholeLine: true,
        after: {
            backgroundColor: '#f2736d',
            color: 'rgba(255, 255, 255, 0.8)',
            contentText: ' View logs in Sentry (❕)» ',
            hoverMessage:
                ' Please fill out the following configurations in your Sentry extension settings: repoMatch, fileMatch',
            linkURL:
                'https://sentry.io/organizations/sourcegraph/issues/?project=134412&query=is%3Aunresolved+cannot%20determine%20file%20path&statsPeriod=14d',
        },
    },
    {
        range: new sourcegraph.Range(1, 0, 1, 0),
        isWholeLine: true,
        after: {
            backgroundColor: '#f2736d',
            color: 'rgba(255, 255, 255, 0.8)',
            contentText: ' View logs in Sentry (❕)» ',
            hoverMessage: ' Add Sentry projects to your Sentry extension settings for project matching.',
            linkURL: 'https://sentry.io/organizations/sourcegraph/issues/',
        },
    },
    {
        range: new sourcegraph.Range(1, 0, 1, 0),
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

describe('decorate line', () => {
    for (const [i, deco] of data.entries()) {
        it('decorates the line with the following goal: ' + deco.goal, () =>
            expect(decorateLine(deco.index, deco.match, deco.missingConfigData, deco.sentryProjectId)).toEqual(
                decorationsList[i]
            )
        )
    }
})

const decorationsData = [
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
    },
    {
        goal: 'receive no decoration due to empty textdocument',
        documentUri:
            'git://github.com/sourcegraph/sourcegraph?c436567c152bf40668c75815ed3ce62983af942d#client/browser/src/libs/github/file_info.php',
        documentText: ``,
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
    },
]

const expectedDecorations = [
    // receive two decorations
    [
        {
            range: new sourcegraph.Range(1, 0, 1, 0),
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
            range: new sourcegraph.Range(8, 0, 8, 0),
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
    // receive one decoration
    [
        {
            range: new sourcegraph.Range(1, 0, 1, 0),
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
    // receive no decoration due to file format mismatch
    [],
    // receive no decoration due to no line matches
    [],
    // receive no decoration due to no textdocument
    [],
    // receive on decoration from GitLab
    [
        {
            range: new sourcegraph.Range(1, 0, 1, 0),
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
]

describe('get Decorations', () => {
    for (const [i, deco] of decorationsData.entries()) {
        it('fulfills the following goal:' + deco.goal, () =>
            expect(getDecorations(deco.documentUri, deco.documentText, projects)).toEqual(expectedDecorations[i])
        )
    }
})

// make sure matching code is located on line 1 to ensure same start/end as decorationsList[3]
const languageCode = [
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
    {
        lang: 'C++',
        code: `   {
            log_error("Exception occurred!");
            throw;
          }`,
    },
]

describe('decorate Editor', () => {
    projects[0].patternProperties.lineMatches = []
    for (const [i, codeExample] of languageCode.entries()) {
        if (i < 4) {
            it('check common pattern matching for ' + languageCode[i].lang, () =>
                expect(decorateEditor([], codeExample.code)).toEqual([decorationsList[3]])
            )
        } else {
            console.log(languageCode[i].lang)
            it('should not render due to unsupported language ' + languageCode[i].lang, () =>
                expect(decorateEditor([], codeExample.code)).toEqual([])
            )
        }
    }
    // set lineMatches back to original state for the other tests
    projects[0].patternProperties.lineMatches = [
        /throw new Error+\(['"]([^'"]+)['"]\)/,
        /console\.(warn|debug|info|error|log)\(['"`]([^'"`]+)['"`]\)/,
        /log\.(Printf|Print|Println)\(['"]([^'"]+)['"]\)/,
    ]
})
