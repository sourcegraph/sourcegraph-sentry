import expect from 'expect'
import mock from 'mock-require'
import { createMockSourcegraphAPI } from './stubs'

const sourcegraph = createMockSourcegraphAPI()
// For modules importing Range/Location/Position/URI/etc
mock('sourcegraph', sourcegraph)

import { decorateLine } from '../extension'

describe('extension', () => {
    it('works', () => void 0)
})

const index = 5
const pattern = /throw new Error+\(['"]([^'"]+)['"]\)/gi
const line = "            throw new Error('cannot determine file path')"
const match = pattern.exec(line)
const noMissingConfigData: string[] = []
const missingConfigData = ['repoMatch']
const sentryProjectId = '134412'

const decorationSuccess = {
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
}

const decorationIncomplete = {
    range: new sourcegraph.Range(5, 0, 5, 0),
    isWholeLine: true,
    after: {
        backgroundColor: '#f2736d',
        color: 'rgba(255, 255, 255, 0.8)',
        contentText: ' View logs in Sentry (❕)» ',
        hoverMessage:
            ' Please fill out the following configurations in your Sentry extension settings: ' + missingConfigData,
        linkURL:
            'https://sentry.io/organizations/sourcegraph/issues/?project=134412&query=is%3Aunresolved+cannot%20determine%20file%20path&statsPeriod=14d',
    },
}

describe('decorate line', () => {
    it('decorates the line when no configs are missing', () =>
        expect(decorateLine(index, match!, noMissingConfigData, sentryProjectId)).toEqual(decorationSuccess))

    it('decorates the line with warning and list of configs that are missing', () =>
        expect(decorateLine(index, match!, missingConfigData, sentryProjectId)).toEqual(decorationIncomplete))
})
