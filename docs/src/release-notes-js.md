# Playwright v1.18.0-rc1

## Locator Improvements

- [`locator.dragTo(locator)`]
- [`expect(locator).toBeChecked({ checked })`]
- Each locator can now be optionally filtered by the text it contains: 
    ```js
    await page.locator('li', { hasText: 'my item' }).locator('button').click();
    ```
    Read more in [locator documentation].


## Testing API improvements

- [`expect(response).toBeOK()`]
- [`testInfo.attach()`]
- [`test.info()`]

## Improved TypeScript Support

1. Playwright Test now respects `tsconfig.json`'s [`baseUrl`](https://www.typescriptlang.org/tsconfig#baseUrl) and [`paths`](https://www.typescriptlang.org/tsconfig#paths), so you can use aliases
1. There is a new environment variable `PW_EXPERIMENTAL_TS_ESM` that allows importing ESM modules in your TS code, without the need for the compile step. Don't forget the `.js` suffix when you are importing your esm modules. Run your tests as follows:

```bash
npm i --save-dev @playwright/test@1.18.0-rc1
PW_EXPERIMENTAL_TS_ESM=1 npx playwright test
```


## Testing Scenarios Cookbook

We now have a testing scenarios cookbook! Check out [aka.ms/playwright-examples](https://aka.ms/playwright-examples).

Feel free to [file an issue](https://github.com/microsoft/playwright-examples/issues/new?assignees=MarcusFelling&labels=testing-scenario-idea&template=testing-scenario-idea-template.md&title=%5BIdea+for+testing+scenario%5D) to that repo if you have an idea for a new example.

## Create Playwright

The `npm init playwright` command is now generally available for your use:

```sh
# Run from your project's root directory
npm init playwright
# Or create a new project
npm init playwright new-project
```

This will scaffold everything needed to get started with Playwright Test: configuration file, optionally add examples, a GitHub Action workflow and a first test `example.spec.ts`.


## New APIs & changes

- new [`testCase.repeatEachIndex`] API
- new [option fixtures]
- [`acceptDownloads`] option now defaults to `true`

## Browser Versions

- Chromium 99.0.4812.0
- Mozilla Firefox 95.0
- WebKit 15.4

This version was also tested against the following stable channels:

- Google Chrome 97
- Microsoft Edge 97

---

[`locator.dragTo(locator)`]: https://playwright.dev/docs/api/class-locator#locator-drag-to
[`expect(locator).toBeChecked({ checked })`]: https://playwright.dev/docs/api/class-locatorassertions#locator-assertions-to-be-checked
[locator documentation]: https://playwright.dev/docs/api/class-locator#locator-locator-option-has-text
[`expect(response).toBeOK()`]: https://playwright.dev/docs/api/class-apiresponseassertions
[`testInfo.attach()`]: https://playwright.dev/docs/api/class-testinfo#test-info-attach
[`test.info()`]: https://playwright.dev/docs/api/class-test#test-info
[`testCase.repeatEachIndex`]: https://playwright.dev/docs/api/class-testcase#test-case-repeat-each-index
[option fixtures]: https://playwright.dev/docs/test-fixtures#fixtures-options
[`acceptDownloads`]: https://playwright.dev/docs/api/class-browser#browser-new-context-option-accept-downloads
