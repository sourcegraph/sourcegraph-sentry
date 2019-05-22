# Sentry extension

[![build](https://travis-ci.org/sourcegraph/sourcegraph-sentry.svg?branch=master)](https://travis-ci.org/sourcegraph/sentry)
[![codecov](https://codecov.io/gh/sourcegraph/sourcegraph-sentry/branch/master/graph/badge.svg)](https://codecov.io/gh/sourcegraph/sourcegraph-sentry)

Sentry helps devs track, organize and break down errors more efficiently, facilitating their debug process. We want to make it more convenient for developers to access Sentry's error tracking tools directly from the code that is doing the error handling, code such as `throw new Error(QUERY)`, `console.log(QUERY)`, `console.error(QUERY)` etc..

The Sentry extension renders a `View logs in Sentry` next to error throwing statements, linking directly to the corresponding Sentry issues stream page. Links are rendered when viewing files on [Sourcegraph](https://sourcegraph.com), GitHub and GitLab.

- **Sentry: Show/hide Sentry**: toggles Sentry links decorations with each matching error handling code.

[**🗃️ Source code**](https://github.com/sourcegraph/sentry)

[**➕ Add to Sourcegraph**](https://sourcegraph.com/extensions/sourcegraph/sentry)

![image](https://user-images.githubusercontent.com/9110008/54014672-d7b4fe00-41c0-11e9-9b92-66d851401fa0.png)

## Language support

To work, the Sentry Sourcegraph extension must know how to recognize instances of error handling and/or exception throwing for each language. The first version will support:

- TypeScript
- Go
- JavaScript
- Python
- Java

## Setup

Set the following configurations in your settings:

```
"sentry.organization": "[Sentry organization name]",
"sentry.projects": [
  {
    "name": "[Project name for the config overview, e.g. Webapp errors]",
    "projectId": "[Sentry project ID, e.g. "1334031"]",
    "linePatterns": [
        // List of RegExp patterns that match error handling code, e.g. "throw new Error+\\(['\"]([^'\"]+)['\"]\\)",
        // !! Make sure to capture the error message in a RegExp group !!
      ]
    "filters": {
        [
            "repositories": [
                // List of RegExp repo names asociated with this Sentry project
            ],
            "files": [
                // List of RegExp that matches file format, e.g. "\\.tsx?",
                // or for more specific matching, folder matching, e.g. "(?:web|shared|src)\/.*\\.tsx?"
        ],
    }
  }

```

## Important features:

File patterns can also be narrowed down to certain folders by specifying this in the RegExp:

```
...
"files": ["(?:web|shared|src)\/.*\\.tsx?"]
...
```

## Examples

- TypeScript

  Configuration:

  ```
  "sentry.decorations.inline": true,
  "sentry.organization": "sourcegraph",
  "sentry.projects": [
    {
        "name": "sourcegraph",
        "projectId": "1334031",
        "linePatterns": [
            "throw new Error+\\(['\"]([^'\"]+)['\"]\\)",
            "console\\.(warn|debug|info|error)\\(['\"`]([^'\"`]+)['\"`]\\)"
            ]
        "filters": [
            {
                "repositories": "sourcegraph\/sourcegraph",
                "files": ["web\/.*\\.ts?"],
            },
            {
                "files": ["sourcegraph-subfolder\/.*\\.tsx?"]
            }

        ]
    }
  ]

  ```

  - [On Sourcegraph](https://sourcegraph.com/github.com/sourcegraph/sourcegraph/-/blob/browser/src/libs/github/file_info.ts#L22)
  - [On GitHub](https://github.com/sourcegraph/sourcegraph/blob/master/browser/src/libs/github/file_info.ts#L22)

- Go

Configuration:

```
"sentry.decorations.inline": true,
"sentry.organization": "sourcegraph",
"sentry.projects": [
  "name": "Dev env errors",
  "projectId": "213332",
  "linePatterns": ["errors\\.New\\(['\"`](.*)['\"`]\\)"],
  "filters": [
      {
          "repositories": ["sourcegraph\/sourcegraph", "sourcegraph\/dev-repo"],
          "files": ["/auth\/.*.go?/"],
      },
      {
          "repositories": ["/dev-env/"]
      }
  ],
]

```

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
