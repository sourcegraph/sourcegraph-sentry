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

In your user, organization, or global settings, add the following configurations:

```
"sentry.decorations.inline": true,
"sentry.organization": "<your_sentry_organization>",
"sentry.projects": [
    {
        // Frontend errors
        "projectId": "<your_sentry_project_id>",
    }
]
```

This will make it so that any time code that produces an error is found, a link to that one specified Sentry project will be generated.

To find your Sentry organization and project ID, go to sentry.io and look at the URL when on your project page, e.g.:

```
https://sentry.io/organizations/sourcegraph/events/?project=1251215
```
In the above, `sourcegraph` is the organization and `1251215` is the project ID.

## If you have multiple repositories reporting to different Sentry projects

You can add multiple Sentry projects and add repository `filters` to have them match only specific repositories, like so:

```
"sentry.decorations.inline": true,
"sentry.organization": "<your_sentry_organization>",
"sentry.projects": [
    {
        // Frontend errors
        "projectId": "<project_a>",
        "filters": [
            {
                "repositories": [
                    "myorg/repositoryA$" // Regexp matching repositories that report to this Sentry project
                ]
            }
        ]
    },
    {
        // Backend errors
        "projectId": "<project_b>",
        "filters": [
            {
                "repositories": [
                    "myorg/repositoryB$"
                ]
            }
        ]
    }
]
```
Now errors found in `repositoryA` will link to `project_a` and errors in `repositoryB` will link to `project_b` on Sentry.

## If you have code in the same repository reporting to different Sentry projects

You can add multiple Sentry projects and add file `filters` to have them only match specific files or folders, like so:

```
"sentry.decorations.inline": true,
"sentry.organization": "<your_sentry_organization>",
"sentry.projects": [
    {
        // Frontend errors
        "projectId": "<project_a>",
        "filters": [
            {
                "files": [
                    "\\.js?" // RegExp that matches file names reporting to this Sentry project
                ],
            }
        ]
    },
    {
        // Backend errors
        "projectId": "<project_b>",
        "filters": [
            {
                "files": [
                    "\\.go?"
                ],
            }
        ]
    }
]
```
Now errors found in JS files will link to `project_a` and errors in Go files will link to `project_b` on Sentry.

You can match subdirectories of code using regex like e.g. `"(?:web|node)\/.*\\.tsx?"` to match any files with the `.tsx` extension below a directory named web or node.

## Better error pattern recognition

By default the extension matches error messages from a few popular languages, but you may need to define your own patterns to match error generation sites in code that we don't currently support.

To do this, simply add to your Sentry project config a regex that captures the static error message generated. For example, to match JS/TS throw statements:

```
"sentry.projects": [
    {
        // Frontend errors
        "projectId": "<your_sentry_project_id>",
        "linePatterns": [
            // Matches JS/TS throw statements:
            "throw new Error+\\(['\"]([^'\"]+)['\"]\\)"
            // Note how the regex capture group captures the error string, which will be used as the search when linked to Sentry
        ],
    }
]
```

## Examples

- TypeScript

  Configuration:

  ```
  "sentry.decorations.inline": true,
  "sentry.organization": "sourcegraph",
  "sentry.projects": [
    {
        // Web errors
        "projectId": "1334031",
        "filters": [
            {
                "repositories": "sourcegraph/sourcegraph",
                "files": ["web/.*\\.ts?"],
            },
            {
                "files": ["sourcegraph-about/.*\\.tsx?"]
            }

        ],
        "linePatterns": [
            "throw new Error+\\(['\"]([^'\"]+)['\"]\\)",
            "console\\.(warn|debug|info|error)\\(['\"`]([^'\"`]+)['\"`]\\)"
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
  // Dev environment errors
  "projectId": "213332",
  "filters": [
      {
          "repositories": ["sourcegraph/sourcegraph", "sourcegraph/dev-repo"],
          "files": ["auth/.*.go?/"],
      },
      {
          "repositories": ["/dev-env"]
      }
  ],
  "linePatterns": ["errors\\.New\\(['\"`](.*)['\"`]\\)"],
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
