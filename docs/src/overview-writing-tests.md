---
id: overview-writing-tests
title: "Writing Tests Overview"
---

## Actionability

Playwright performs a range of [actionability checks](./actionability.md) on the elements before making actions to ensure these actions behave as expected. It auto-waits for all the relevant checks to pass and only then performs the requested action. If the required checks do not pass within the given timeout, the action fails with the TimeoutError.


:::info Learn More
See our full guide on [actionability](./actionability.md) to learn more.
:::

## Assertions
* langs: js

Playwright uses the [expect](https://jestjs.io/docs/expect) library for test [assertions](./test-assertions.md). This library provides a lot of matchers like `toEqual`, `toContain`, `toMatch`, `toMatchSnapshot` and many more. Playwright also extends it with convenience async matchers that will wait until the expected condition is met.


:::info Learn More
See our full guide on [assertions](./test-assertions.md) to learn more.
:::

## Authentication

Playwright can be used to automate scenarios that require [authentication](./auth.md). Tests written with Playwright are executed in isolated clean-slate environments called [browser contexts](./browser-contexts.md). This isolation model improves reproducibility and prevents cascading test failures. New browser contexts can load existing authentication state. This eliminates the need to login in every context and speeds up test execution.

:::info Learn More
See our full guide on [authentication](./auth.md) to learn more.
:::

## Debugging Selectors

Playwright will throw a timeout exception like `locator.click: Timeout 30000ms exceeded` when an element does not exist on the page. There are multiple ways of debugging selectors:

- [Playwright Inspector](./debug-selectors.md#using-playwright-inspector) to step over each Playwright API call to inspect the page.
- [Browser DevTools](./debug-selectors.md#using-devtools) to inspect selectors with the DevTools element panel.
- [Trace Viewer](./trace-viewer.md) to see what the page looked like during the test run.
- [Verbose API logs](./debug-selectors.md#verbose-api-logs) shows [actionability checks](./actionability.md) when locating the element.


:::info Learn More
See our full guide on [debugging Selectors](./debug-selectors.md) to learn more.
:::

## Dialogs

Playwright can interact with web page [dialogs](./dialogs.md) such as [`alert`](https://developer.mozilla.org/en-US/docs/Web/API/Window/alert), [`confirm`](https://developer.mozilla.org/en-US/docs/Web/API/Window/confirm), [`prompt`](https://developer.mozilla.org/en-US/docs/Web/API/Window/prompt) as well as [`beforeunload`](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event) confirmation.


:::info Learn More
See our full guide on [dialogs](./dialogs.md) to learn more.
:::

## Downloads

For every attachment downloaded by the page, [`event: Page.download`] event is emitted. The attachments are downloaded into a temporary folder. You can obtain the download url, file system path and payload stream using the [Download] object from the event.

:::info Learn More
See our full guide on [downloads](./downloads.md) to learn more.
:::

## Emulation

Playwright allows overriding various parameters of the device where the browser is running such as 
viewport size, device scale factor, touch support, locale, timezone, color scheme, geolocation etc. Most of these parameters are configured during the browser context construction, but some of them such as viewport size can be changed for individual pages.


:::info Learn More
See our full guide on [emulation](./emulation.md) to learn more.
:::

## Evaluating

Playwright scripts run in your Playwright environment. Your page scripts run in the browser page environment. Those environments don't intersect, they are running in different virtual machines in different processes and even potentially on different computers. The [`method: Page.evaluate`] API can run a JavaScript function in the context of the web page and bring results back to the Playwright environment. Browser globals like `window` and `document` can be used in `evaluate`.

:::info Learn More
See our full guide on [evaluating](./evaluating.md) to learn more.
:::

## Events

Playwright allows listening to various types of [events](./events.md) happening in the web page, such
as network requests, creation of child pages, dedicated workers etc. There are several ways to subscribe to such events.

:::info Learn More
See our full guide on [events](./events.md) to learn more.
:::

## Frames

A [Page] can have one or more [Frame] objects attached to it. Each page has a main frame and page-level interactions (like `click`) are assumed to operate in the main frame. A page can have additional frames attached with the `iframe` HTML tag. These frames can be accessed for interactions
inside the frame.

:::info Learn More
See our full guide on [frames](./frames.md) to learn more.
:::

## Input Elements

With Playwright you can test HTML input elements such as Text Inputs, Checkboxes and radio buttons, select options, mouse clicks, type characters, keys and shortcuts, upload files and focus elements.


:::info Learn More
See our full guide on [Input Elements](./input.md) to learn more.
:::

## Isolation

A [BrowserContext] is an isolated incognito-alike session within a browser instance. Browser contexts are fast and cheap to create. We recommend running each test scenario in its own new Browser context, so that the browser state is isolated between the tests. If you are using the Playwright Test Runner, this happens out of the box for each test. Otherwise, you can create browser contexts manually:

:::info Learn More
See our full guide on [Isolation](./browser-contexts.md) to learn more.
:::

## Locators

[Locators](./locators.md) are the central piece of Playwright's auto-waiting and retry-ability. They represent a way to find elements on the page at any moment. A Locator can be created with the [`method: Page.locator`] method.

:::info Learn More
See our full guide on [locators](./locators.md) to learn more.
:::

## Pages

Each [BrowserContext] can have multiple pages. A [Page] refers to a single tab or a popup window within a browser context. It should be used to navigate to URLs and interact with the page content.

:::info Learn More
See our full guide on [pages](./pages.md) to learn more.
:::

## Parameterize
* langs: js

Parameterized tests allow you to run the same test over and over again using different values. You can either parametrize tests on a test level or on a project level.

:::info Learn More
See our full guide on [parameterize](./test-parameterize.md) to learn more.
:::

## Selectors

Selectors are strings that are used to create [Locator]s. Locators are used to perform actions on the elements by means of methods such as [`method: Locator.click`], [`method: Locator.fill`] and many more. Checkout the [Best Practices](./selectors.md#best-practices) section to learn more on writing good selectors.

:::info Learn More
See our full guide on [selectors](./selectors.md) to learn more.
:::