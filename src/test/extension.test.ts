import expect from 'expect'
import mock from 'mock-require'
import { createMockSourcegraphAPI } from './stubs'

const sourcegraph = createMockSourcegraphAPI()
// For modules importing Range/Location/URI/etc
mock('sourcegraph', sourcegraph)

import { decorateLine } from '../extension'

describe('extension', () => {
    it('works', () => void 0)
})

const data = [
    {
        goal: 'render complete Sentry link',
        index: 5,
        match: 'cannot determine file path',
        missingConfigData: [],
        sentryProjectId: '134412',
    },
    {
        goal: 'warn about incomplete config with missing repoMatch',
        index: 5,
        match: 'cannot determine file path',
        missingConfigData: ['repoMatch'],
        sentryProjectId: '134412',
    },
    {
        goal: 'warn about incomplete config with missing repoMatch and fileMatch patterns',
        index: 5,
        match: 'cannot determine file path',
        missingConfigData: ['repoMatch', 'fileMatch'],
        sentryProjectId: '134412',
    },
]

const decorationsList = [
    {
        range: new sourcegraph.Range(5, 0, 5, 0),
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
        range: new sourcegraph.Range(5, 0, 5, 0),
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
        range: new sourcegraph.Range(5, 0, 5, 0),
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
        range: new sourcegraph.Range(5, 0, 5, 0),
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
