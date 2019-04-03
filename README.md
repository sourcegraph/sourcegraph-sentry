# WIP: Sentry Sourcegraph extension

Sentry helps devs track, organize and break down errors more efficiently, facilitating their debug process. We want to make it more convenient for developers to access Sentry's error tracking tools directly from the code that is doing the error handling, code such as `throw new Error(QUERY)`, `console.log(QUERY)`, `console.error(QUERY)` etc..

In this first version, the Sentry extension will render a ```View logs in Sentry``` link on each line it detects such error handling code, leading the devs directly to the corresponding Sentry issues stream page.

![image](https://user-images.githubusercontent.com/9110008/54014672-d7b4fe00-41c0-11e9-9b92-66d851401fa0.png)

## Language support

To work, the Sentry Sourcegraph extension must know how to instances of error handling and/or exception throwing for each language. The first version will support:

- Go
- JavaScript
- TypeScript
- Python
- Java

Support for other languages is coming in future versions.
