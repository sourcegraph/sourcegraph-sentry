# Sentry extension

[![build](https://travis-ci.org/sourcegraph/sourcegraph-sentry.svg?branch=master)](https://travis-ci.org/sourcegraph/sentry)
[![codecov](https://codecov.io/gh/sourcegraph/sourcegraph-sentry/branch/master/graph/badge.svg)](https://codecov.io/gh/sourcegraph/sourcegraph-sentry)

Sentry facilitates the debugging process by helping developers track, organize, and break down errors more efficiently. At Sourcegraph, we want to make it more convenient for developers to access Sentry's error tracking tools directly from the code that is doing the error handling. For example: `throw new Error(QUERY)`, `console.log(QUERY)`, and `console.error(QUERY)`.

The Sentry extension renders `View logs in Sentry` next to error throwing statements, and links directly to the corresponding Sentry issues stream page. Links are rendered when viewing files on [Sourcegraph](https://sourcegraph.com), GitHub, and GitLab.

- **Sentry: Show/hide Sentry**: toggles Sentry links decorations with each matching error handling code.

[**🗃️ Source code**](https://github.com/sourcegraph/sentry)

[**➕ Add to Sourcegraph**](https://sourcegraph.com/extensions/sourcegraph/sentry)

![image](https://user-images.githubusercontent.com/9110008/54014672-d7b4fe00-41c0-11e9-9b92-66d851401fa0.png)

## Language support

The Sentry Sourcegraph extension uses common error handling and/or exception throwing patterns specific to each language to identfy Sentry relevant lines of code. The following languages are currently supported:

- TypeScript, JavaScript ( e.g. `throw new Error()`, `console.error()`)
- Go ( e.g. `errors.New()`)
- JavaScript ( e.g. `console.error()`)
- Python ( e.g. `raise ValueError()`)
- Java ( e.g. `logger.error()`)

See the [default error patterns](https://sourcegraph.com/github.com/sourcegraph/sourcegraph-sentry@master/-/blob/src/extension.ts?diff=21f9b0716040dd96f917580ec4cacd59f3f1b5be&utm_source=chrome-extension#L11-25).

If you need to match more specific patterns in your codebase, you can configure them through [line matches](#improving-error-pattern-recognition-for-your-organization).

## Basic Setup

In your Sourcegraph settings (user, organization, or global), add the following configuration:

```
"sentry.decorations.inline": true,
"sentry.organization": "<your_sentry_organization>",
"sentry.projects": [
    {
        // All matching error statements in your sourcegraph instance will link to this project
        "projectId": "<your_sentry_project_id>",
    }
]
```

For organizations, we recommend to set this once by the site admin in the org or global settings, so that individual org users do not have to configure this individually.

With this simple configuration, any error that matches the default patterns will link to the specified Sentry organization and project.

To find your Sentry organization and project ID, go to [sentry.io](http://sentry.io) and look at the URL when on your project page, e.g.:

```
https://sentry.io/organizations/sourcegraph/events/?project=1251215
```

In the above, `sourcegraph` is the organization and `1251215` is the project ID.

## Mapping multiple Sentry projects to various repositories

Some organizations have multiple Sentry projects that capture errors from various repositories within their organization. Inside each Sentry project, use repository `filters` like so:

```
"sentry.decorations.inline": true,
"sentry.organization": "<your_sentry_organization>",
"sentry.projects": [
    {
        // All repositoryA error patterns link to Project A in Sentry
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
        // All repositoryB error patterns link to Project B in Sentry
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

In this example, errors found in `repositoryA` will link to `project_a`, and errors in `repositoryB` will link to `project_b` in Sentry.

## Mapping a single repository to multiple Sentry projects

Some organizations will have different parts of their code base map to different Sentry projects. For example, all frontend code is sent to one Sentry project, and all backend code is sent to another.

You can add multiple Sentry projects and add file `filters` to match specific files or folders, like so:

```
"sentry.decorations.inline": true,
"sentry.organization": "<your_sentry_organization>",
"sentry.projects": [
    {
        // All JS files link to Project A in Sentry
        "projectId": "<project_a>",
        "filters": [
            {
                "files": [
                    "\\.js?" // RegExp that matches JavaScript files
                ]
            }
        ]
    },
    {
        // All Go files link to Project B in Sentry
        "projectId": "<project_b>",
        "filters": [
            {
                "files": [
                    "\\.go?"
                ]
            }
        ]
    }
]
```

Now, errors found in JS files will link to `project_a` and errors in Go files will link to `project_b` in Sentry.

You can also match repository subdirectories using a regex (e.g. `"(?:web|node)\/.*\\.tsx?"` to match any files with the `.tsx` extension within directories named `web` or `node`).

## Improving error pattern recognition for your organization

By default, the extension matches error messages from a few popular languages. However, you may need to define your own patterns to enhance matches for your specific codebase, or that we do not currently support.

To do this, add a regex to your Sentry project config that captures the static error message generated. For example, to match JS/TS throw statements:

```
"sentry.projects": [
    {
        // Frontend errors
        "projectId": "<project_a>",
        "linePatterns": [
            // Matches JS/TS throw statements:
            "throw new [A-Za-z0-9]+\\(['\"]([^'\"]+)['\"]\\)"
        ]
    }
]
```

The error message should always be captured by the capture group \$INDEX=0. All other capture groups should be made optional with `?:`. For instance, in the above example, note how the first regex group is ignored with `?:`. It will match a variety of `throw new` error types, but doesn't need to be captured. The second regex group captures the error string, which will be used as the search when linked to Sentry.

## Language Specific Examples

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
                  "files": ["web/.*\\.ts?"]
              },
              {
                  "files": ["sourcegraph-about/.*\\.tsx?"]
              }

          ],
          "linePatterns": [
              "throw new [A-Za-z0-9]+\\(['\"]([^'\"]+)['\"]\\)",
              "console\\.(?:warn|debug|info|error)\\(['\"`]([^'\"`]+)['\"`]\\)"
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
      {
          // Dev environment errors
          "projectId": "213332",
          "filters": [
              {
                  "repositories": ["sourcegraph/sourcegraph", "sourcegraph/dev-repo"],
                  "files": ["auth/.*.go?/"]
              },
              {
                  "repositories": ["/dev-env"]
              }
          ],
          "linePatterns": ["errors\\.New\\(['\"`](.*)['\"`]\\)"]
      }
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
