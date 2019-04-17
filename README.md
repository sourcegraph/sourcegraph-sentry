[![codecov](https://codecov.io/gh/sourcegraph/sourcegraph-sentry/branch/master/graph/badge.svg)](https://codecov.io/gh/sourcegraph/sourcegraph-sentry)

# WIP: Sentry Sourcegraph extension

Sentry helps devs track, organize and break down errors more efficiently, facilitating their debug process. We want to make it more convenient for developers to access Sentry's error tracking tools directly from the code that is doing the error handling, code such as `throw new Error(QUERY)`, `console.log(QUERY)`, `console.error(QUERY)` etc..

In this first version, the Sentry extension will render a `View logs in Sentry` link on each line it detects such error handling code, leading the devs directly to the corresponding Sentry issues stream page.

![image](https://user-images.githubusercontent.com/9110008/54014672-d7b4fe00-41c0-11e9-9b92-66d851401fa0.png)

## Language support

To work, the Sentry Sourcegraph extension must know how to instances of error handling and/or exception throwing for each language. The first version will support:

- TypeScript
- Go
- JavaScript
- Python
- Java

## Setup

Set the following configurations in your settings:

```
"sentry.organization": "[Organization Name]",
"sentry.projects": [
  {
    "name": "[Project Name]",
    "projectId": "[Project ID, e.g. "1334031"]",
    "patternProperties": {
      "repoMatch": "[repo name asociated with this project]",
      "fileMatches": [
          [RegExp[] that matches file format, e.g. "\\.tsx?"]
        ],
      "lineMatches": [
        [RegExp[] that matches error handling code, e.g. "throw new Error+\\(['\"]([^'\"]+)['\"]\\)"],
      ]
    }
  }

```

Filematches can also be narrowed down to certain folders by specifying this in the RegExp:

```
...
"fileMatches": ["(web|shared|src)\/.*\\.tsx?"]
...
```

## Examples

- TypeScript

  Configuration:

  ```
  ...
  "patternProperties": {
      "repoMatch": "sourcegraph",
      "fileMatches": ["([^'\"]+)\/.*\\.ts?"],
      "lineMatches": ["throw new Error+\\(['\"]([^'\"]+)['\"]\\)"]
    }

  ```

  - [On Sourcegraph](https://sourcegraph.com/github.com/sourcegraph/sourcegraph/-/blob/client/browser/src/libs/github/file_info.ts#L16)
  - [On GitHub](https://github.com/sourcegraph/sourcegraph/blob/master/client/browser/src/libs/github/file_info.ts#L16)

- Go

  - [On Sourcegraph](https://sourcegraph.com/github.com/sourcegraph/sourcegraph/-/blob/cmd/frontend/auth/user_test.go#L54:19)
  - [On GitHub](https://github.com/sourcegraph/sourcegraph/blob/master/cmd/frontend/auth/user_test.go#L54)

- JavaScript

  - [On Sourcegraph](https://sourcegraph.com/github.com/sourcegraph/sourcegraph/-/blob/shared/.storybook/config.js#L26:15)
  - [On GitHub](https://github.com/sourcegraph/sourcegraph/blob/master/shared/.storybook/config.js#L26)

- Python

  - [On Sourcegraph](https://sourcegraph.com/github.com/reddit-archive/reddit/-/blob/r2/r2/lib/contrib/ipaddress.py#L279:15)
  - [On GitHub](https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/contrib/ipaddress.py#L279)

- Java
  - [On Sourcegraph](https://sourcegraph.com/github.com/sourcegraph/sourcegraph-jetbrains/-/blob/src/Open.java#L69:13)
  - [On GitHub](https://github.com/sourcegraph/sourcegraph-jetbrains/blob/master/src/Open.java#L69)

Support for other languages is coming in future versions.
