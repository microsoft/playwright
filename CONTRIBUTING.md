# Contributing

- [How to Contribute](#how-to-contribute)
  * [Getting Code](#getting-code)
  * [Code reviews](#code-reviews)
  * [Code Style](#code-style)
  * [API guidelines](#api-guidelines)
  * [Commit Messages](#commit-messages)
  * [Writing Documentation](#writing-documentation)
  * [Adding New Dependencies](#adding-new-dependencies)
  * [Running & Writing Tests](#running--writing-tests)
  * [Public API Coverage](#public-api-coverage)
- [Contributor License Agreement](#contributor-license-agreement)
  * [Code of Conduct](#code-of-conduct)

## How to Contribute

We strongly recommend that you open an issue before beginning any code modifications. This is particularly important if the changes involve complex logic or if the existing code isn't immediately clear. By doing so, we can discuss and agree upon the best approach to address a bug or implement a feature, ensuring that our efforts are aligned.

### Getting Code

Make sure you're running Node.js 20 to verify and upgrade NPM do:

```bash
node --version
npm --version
npm i -g npm@latest
```

1. Clone this repository

```bash
git clone https://github.com/microsoft/playwright
cd playwright
```

2. Install dependencies

```bash
npm ci
```

3. Build Playwright

```bash
npm run build
```

4. Run tests

This will run a test on line `23` in `page-fill.spec.ts`:

```bash
npm run ctest -- page-fill:23
```

See [here](#running--writing-tests) for more information about running and writing tests.

### Code reviews

All submissions, including submissions by project members, require review. We
use GitHub pull requests for this purpose. Consult
[GitHub Help](https://help.github.com/articles/about-pull-requests/) for more
information on using pull requests.

### Code Style

- Coding style is fully defined in [.eslintrc](https://github.com/microsoft/playwright/blob/main/.eslintrc.js)
- Comments should be generally avoided. If the code would not be understood without comments, consider re-writing the code to make it self-explanatory.

To run code linter, use:

```bash
npm run eslint
```

### API guidelines

When authoring new API methods, consider the following:

- Expose as little information as needed. When in doubt, don’t expose new information.
- Methods are used in favor of getters/setters.
  - The only exception is namespaces, e.g. `page.keyboard` and `page.coverage`
- All string literals must be lowercase. This includes event names and option values.
- Avoid adding "sugar" API (API that is trivially implementable in user-space) unless they're **very** common.

### Commit Messages

Commit messages should follow the Semantic Commit Messages format:

```
label(namespace): title

description

footer
```

1. *label* is one of the following:
    - `fix` - playwright bug fixes.
    - `feat` - playwright features.
    - `docs` - changes to docs, e.g. `docs(api): ..` to change documentation.
    - `test` - changes to playwright tests infrastructure.
    - `devops` - build-related work, e.g. CI related patches and general changes to the browser build infrastructure
    - `chore` - everything that doesn't fall under previous categories
2. *namespace* is put in parenthesis after label and is optional. Must be lowercase.
3. *title* is a brief summary of changes.
4. *description* is **optional**, new-line separated from title and is in present tense.
5. *footer* is **optional**, new-line separated from *description* and contains "fixes" / "references" attribution to github issues.

Example:

```
fix(firefox): make sure session cookies work

This patch fixes session cookies in the firefox browser.

Fixes #123, fixes #234
```

### Writing Documentation

All API classes, methods, and events should have a description in [`docs/src`](https://github.com/microsoft/playwright/blob/main/docs/src). There's a [documentation linter](https://github.com/microsoft/playwright/tree/main/utils/doclint) which makes sure documentation is aligned with the codebase.

To run the documentation linter, use:

```bash
npm run doc
```

To build the documentation site locally and test how your changes will look in practice:

1. Clone the [microsoft/playwright.dev](https://github.com/microsoft/playwright.dev) repo
1. Follow [the playwright.dev README instructions to "roll docs"](https://github.com/microsoft/playwright.dev/#roll-docs) against your local `playwright` repo with your changes in progress
1. Follow [the playwright.dev README instructions to "run dev server"](https://github.com/microsoft/playwright.dev/#run-dev-server) to view your changes

### Adding New Dependencies

For all dependencies (both installation and development):
- **Do not add** a dependency if the desired functionality is easily implementable.
- If adding a dependency, it should be well-maintained and trustworthy.

A barrier for introducing new installation dependencies is especially high:
- **Do not add** installation dependency unless it's critical to project success.

### Running & Writing Tests

- Every feature should be accompanied by a test.
- Every public api event/method should be accompanied by a test.
- Tests should be *hermetic*. Tests should not depend on external services.
- Tests should work on all three platforms: Mac, Linux and Win. This is especially important for screenshot tests.

Playwright tests are located in [`tests`](https://github.com/microsoft/playwright/blob/main/tests) and use `@playwright/test` test runner.
These are integration tests, making sure public API methods and events work as expected.

- To run all tests:

```bash
npx playwright install
npm run test
```

Be sure to run `npm run build` or let `npm run watch` run before you re-run the
tests after making your changes to check them.

- To run tests in Chromium
```bash
npm run ctest # also `ftest` for firefox and `wtest` for WebKit
npm run ctest -- page-fill:23 # runs line 23 of page-fill.spec.ts
```

To run tests in WebKit / Firefox, use `wtest` or `ftest`.

- To run the Playwright test runner tests
```bash
npm run ttest
npm run ttest -- --grep "specific test"
```

- To run a specific test, substitute `it` with `it.only`, or use the `--grep 'My test'` CLI parameter:

```js
...
// Using "it.only" to run a specific test
it.only('should work', async ({server, page}) => {
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.ok).toBe(true);
});
// or
playwright test --config=xxx --grep 'should work'
```

- To disable a specific test, substitute `it` with `it.skip`:

```js
...
// Using "it.skip" to skip a specific test
it.skip('should work', async ({server, page}) => {
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.ok).toBe(true);
});
```

- To run tests in non-headless (headed) mode:

```bash
npm run ctest -- --headed
```

- To run tests with custom browser executable, specify `CRPATH`, `WKPATH` or `FFPATH` env variable that points to browser executable:

```bash
CRPATH=<path-to-executable> npm run ctest
```

- When should a test be marked with `skip` or `fixme`?

  - **`skip(condition)`**: This test *should ***never*** work* for `condition`
    where `condition` is usually something like: `test.skip(browserName === 'chromium', 'This does not work because of ...')`.

  - **`fixme(condition)`**: This test *should ***eventually*** work* for `condition`
    where `condition` is usually something like: `test.fixme(browserName === 'chromium', 'We are waiting for version x')`.

## Contributor License Agreement

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

### Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
