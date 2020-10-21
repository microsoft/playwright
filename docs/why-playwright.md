# Why Playwright?

Playwright enables fast, reliable and capable automation across all modern browsers. This guide covers those key differentiators to help you decide on the right tool for your automated tests.

<!-- GEN:toc-top-level -->
- [Support for all browsers](#support-for-all-browsers)
- [Fast and reliable execution](#fast-and-reliable-execution)
- [Powerful automation capabilities](#powerful-automation-capabilities)
- [Integrates with your workflow](#integrates-with-your-workflow)
- [Limitations](#limitations)
<!-- GEN:stop -->

## Support for all browsers
* **Test on Chromium, Firefox and WebKit**. Playwright has full API coverage for all modern browsers, including Google Chrome and Microsoft Edge (with [Chromium](https://www.chromium.org/)), Apple Safari (with [WebKit](https://webkit.org/)) and Mozilla Firefox.

* **Cross-platform WebKit testing**. With Playwright, test how your app behaves in Apple Safari with WebKit builds for Windows, Linux and macOS. Test locally and on CI.

* **Test for mobile**. Use [device emulation](emulation.md) to test your responsive web apps in mobile web browsers.

* **Headless and headful**. Playwright supports headless (without browser UI) and headful (with browser UI) modes for all browsers and all platforms. Headful is great for debugging, and headless is faster and suited for CI/cloud executions.

## Fast and reliable execution
* **Auto-wait APIs**. Playwright interactions [auto-wait for elements](actionability.md) to be ready. This improves reliability and simplifies test authoring.

* **Timeout-free automation**. Playwright receives browser signals, like network requests, page navigations and page load events to eliminate the need for sleep timeouts that cause flakiness.

* **Lean parallelization with browser contexts**. Reuse a single browser instance for multiple parallelized, isolated execution environments with [browser contexts](core-concepts.md).

* **Resilient element selectors**. Playwright can rely on user-facing strings, like text content and accessibility labels to [select elements](selectors.md). These strings are more resilient than selectors tightly-coupled to the DOM structure.

## Powerful automation capabilities
* **Multiple domains, pages and frames**. Playwright is an out-of-process automation driver that is not limited by the scope of in-page JavaScript execution and can automate scenarios with [multiple pages](multi-pages.md).

* **Powerful network control**. Playwright introduces context-wide [network interception](network.md) to stub and mock network requests.

* **Modern web features**. Playwright supports web components through [shadow-piercing selectors](selectors.md), [geolocation, permissions](emulation.md), web workers and other modern web APIs. 

* **Capabilities to cover all scenarios**. Support for [file downloads](network.md) and [uploads](input.md), out-of-process iframes, native [input events](input.md), and even [dark mode](emulation.md).

## Integrates with your workflow
* **One-line installation**. Running `npm i playwright` auto-downloads browser dependencies for your team to be onboarded quickly.

* **TypeScript support**. Playwright ships with built-in types for auto-completion and other benefits.

* **Debugging tools**. Playwright works with the [editor debugger and browser developer tools](debug.md) to pause execution and inspect the web page.

* **Language bindings**. Playwright is also available in [Python](https://github.com/microsoft/playwright-python) and [C#](https://github.com/microsoft/playwright-sharp). Learn about [supported languages](./languages.md).

* **Deploy tests to CI**. First-party [Docker image](docker/README.md) and [GitHub Actions](https://github.com/microsoft/playwright-github-action) to deploy tests to [your preferred CI/CD provider](ci.md).

## Limitations

* **Legacy Edge and IE11 support**. Playwright does not support legacy Microsoft Edge or IE11 ([deprecation notice](https://techcommunity.microsoft.com/t5/microsoft-365-blog/microsoft-365-apps-say-farewell-to-internet-explorer-11-and/ba-p/1591666)). The new Microsoft Edge (on Chromium) is supported.

* **Java language bindings**: The Playwright API cannot be used in Java or Ruby today. This is a temporary limitation as Playwright is built to support bindings for any language.

* **Test on real mobile devices**: Playwright uses desktop browsers to emulate mobile devices. If you are interested in running on real mobile devices, please [upvote this issue](https://github.com/microsoft/playwright/issues/1122).
