import { uniqueId } from 'lodash'
import { Subject } from 'rxjs'
import * as sourcegraph from 'sourcegraph'

const URI = URL
type URI = URL
class Position {
    constructor(public line: number, public character: number) {}
}
class Range {
    constructor(public start: Position, public end: Position) {}
}
class Location {
    constructor(public uri: URI, public range: Range) {}
}
/**
 * Creates an object that (mostly) implements the Sourcegraph API,
 * with all methods being Sinon spys and all Subscribables being Subjects.
 */
export const createMockSourcegraphAPI = () => {
    // const shims: typeof import('sourcegraph') = {
    const openedTextDocuments = new Subject<sourcegraph.TextDocument>()
    return {
        internal: {
            sourcegraphURL: 'https://sourcegraph.test',
        },
        URI,
        Position,
        Range,
        Location,
        workspace: {
            openedTextDocuments,
            textDocuments: [] as sourcegraph.TextDocument[],
        },
        app: {
            createDecorationType: () => ({ key: uniqueId('decorationType') }),
        },
        configuration: {},
        search: {},
        commands: {},
    }
}
