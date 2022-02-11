---
id: release-notes
title: "Release notes"
---

<!-- TOC -->

## Version 1.19

### Highlights

- Locator now supports a `has` option that makes sure it contains another locator inside:

  ```csharp
  await Page.Locator("article", new () { Has = Page.Locator(".highlight") }).click();
  ```

  Read more in [locator documentation](./api/class-locator#locator-locator-option-has)

- New [`method: Locator.page`]
- [`method: Page.screenshot`] and [`method: Locator.screenshot`] now automatically hide blinking caret
- Playwright Codegen now generates locators and frame locators

### Browser Versions

- Chromium 100.0.4863.0
- Mozilla Firefox 96.0.1
- WebKit 15.4

This version was also tested against the following stable channels:

- Google Chrome 98
- Microsoft Edge 98


## Version 1.18

### Locator Improvements

- [`method: Locator.dragTo`]
- Each locator can now be optionally filtered by the text it contains:
    ```csharp
    await Page.Locator("li", new () { HasTextString = "My Item" })
              .Locator("button").click();
    ```
    Read more in [locator documentation](./api/class-locator#locator-locator-option-has-text)


### New APIs & changes

- [`AcceptDownloads`](./api/class-browser#browser-new-context-option-accept-downloads) option now defaults to `true`.
- [`Sources`](./api/class-tracing#tracing-start-option-sources) option to embed sources into traces.

### Browser Versions

- Chromium 99.0.4812.0
- Mozilla Firefox 95.0
- WebKit 15.4

This version was also tested against the following stable channels:

- Google Chrome 97
- Microsoft Edge 97



## Version 1.17

### Frame Locators

Playwright 1.17 introduces [frame locators](./api/class-framelocator) - a locator to the iframe on the page. Frame locators capture the logic sufficient to retrieve the `iframe` and then locate elements in that iframe. Frame locators are strict by default, will wait for `iframe` to appear and can be used in Web-First assertions.

![Graphics](https://user-images.githubusercontent.com/746130/142082759-2170db38-370d-43ec-8d41-5f9941f57d83.png)

Frame locators can be created with either [`method: Page.frameLocator`] or [`method: Locator.frameLocator`] method.

```csharp
var locator = page.FrameLocator("#my-frame").Locator("text=Submit");
await locator.ClickAsync();
```

Read more at [our documentation](./api/class-framelocator).

### Trace Viewer Update

Playwright Trace Viewer is now **available online** at https://trace.playwright.dev! Just drag-and-drop your `trace.zip` file to inspect its contents.

> **NOTE**: trace files are not uploaded anywhere; [trace.playwright.dev](https://trace.playwright.dev) is a [progressive web application](https://web.dev/progressive-web-apps/) that processes traces locally.

- Playwright Test traces now include sources by default (these could be turned off with tracing option)
- Trace Viewer now shows test name
- New trace metadata tab with browser details
- Snapshots now have URL bar

![image](https://user-images.githubusercontent.com/746130/141877831-29e37cd1-e574-4bd9-aab5-b13a463bb4ae.png)

### HTML Report Update

- HTML report now supports dynamic filtering
- Report is now a **single static HTML file** that could be sent by e-mail or as a slack attachment.

![image](https://user-images.githubusercontent.com/746130/141877402-e486643d-72c7-4db3-8844-ed2072c5d676.png)

## Ubuntu ARM64 support + more

- Playwright now supports **Ubuntu 20.04 ARM64**. You can now run Playwright tests inside Docker on Apple M1 and on Raspberry Pi.
- You can now use Playwright to install stable version of Edge on Linux:
    ```bash
    npx playwright install msedge
    ```


### New APIs

- Tracing now supports a [`'title'`](./api/class-tracing#tracing-start-option-title) option
- Page navigations support a new [`'commit'`](./api/class-page#page-goto) waiting option

## Version 1.16

### 🎭 Playwright Library

#### Locator.WaitForAsync

Wait for a locator to resolve to a single element with a given state.
Defaults to the `state: 'visible'`.

```csharp
var orderSent = page.Locator("#order-sent");
orderSent.WaitForAsync();
```

Read more about [`method: Locator.waitFor`].

### 🎭 Playwright Trace Viewer

- run trace viewer with `npx playwright show-trace` and drop trace files to the trace viewer PWA
- better visual attribution of action targets

Read more about [Trace Viewer](./trace-viewer).

### Browser Versions

- Chromium 97.0.4666.0
- Mozilla Firefox 93.0
- WebKit 15.4

This version of Playwright was also tested against the following stable channels:

- Google Chrome 94
- Microsoft Edge 94


## Version 1.15

### 🖱️ Mouse Wheel

By using [`Page.Mouse.WheelAsync`](https://playwright.dev/dotnet/docs/next/api/class-mouse#mouse-wheel) you are now able to scroll vertically or horizontally.

### 📜 New Headers API

Previously it was not possible to get multiple header values of a response. This is now possible and additional helper functions are available:

- [Request.AllHeadersAsync()](https://playwright.dev/dotnet/docs/next/api/class-request#request-all-headers)
- [Request.HeadersArrayAsync()](https://playwright.dev/dotnet/docs/next/api/class-request#request-headers-array)
- [Request.HeaderValueAsync(name: string)](https://playwright.dev/dotnet/docs/next/api/class-request#request-header-value)
- [Response.AllHeadersAsync()](https://playwright.dev/dotnet/docs/next/api/class-response#response-all-headers)
- [Response.HeadersArrayAsync()](https://playwright.dev/dotnet/docs/next/api/class-response#response-headers-array)
- [Response.HeaderValueAsync(name: string)](https://playwright.dev/dotnet/docs/next/api/class-response#response-header-value)
- [Response.HeaderValuesAsync(name: string)](https://playwright.dev/dotnet/docs/next/api/class-response/#response-header-values)

### 🌈 Forced-Colors emulation

Its now possible to emulate the `forced-colors` CSS media feature by passing it in the [context options](https://playwright.dev/dotnet/docs/next/api/class-browser#browser-new-context-option-forced-colors) or calling [Page.EmulateMediaAsync()](https://playwright.dev/dotnet/docs/next/api/class-page#page-emulate-media).

### New APIs

- [Page.RouteAsync()](https://playwright.dev/dotnet/docs/next/api/class-page#page-route) accepts new `times` option to specify how many times this route should be matched.
- [Page.SetCheckedAsync(selector: string, checked: Boolean)](https://playwright.dev/dotnet/docs/next/api/class-page#page-set-checked) and [Locator.SetCheckedAsync(selector: string, checked: Boolean)](https://playwright.dev/dotnet/docs/next/api/class-locator#locator-set-checked) was introduced to set the checked state of a checkbox.
- [Request.SizesAsync()](https://playwright.dev/dotnet/docs/next/api/class-request#request-sizes) Returns resource size information for given http request.
- [Tracing.StartChunkAsync()](https://playwright.dev/dotnet/docs/next/api/class-tracing#tracing-start-chunk) - Start a new trace chunk.
- [Tracing.StopChunkAsync()](https://playwright.dev/dotnet/docs/next/api/class-tracing#tracing-stop-chunk) - Stops a new trace chunk.

### Important ⚠
* ⬆ .NET Core Apps 2.1 are **no longer** supported for our CLI tooling. As of August 31st, 2021, .NET Core 2.1 is no [longer supported](https://devblogs.microsoft.com/dotnet/net-core-2-1-will-reach-end-of-support-on-august-21-2021/) and will not receive any security updates. We've decided to move the CLI forward and require .NET Core 3.1 as a minimum. 

### Browser Versions

- Chromium 96.0.4641.0
- Mozilla Firefox 92.0
- WebKit 15.0

## Version 1.14

#### ⚡️ New "strict" mode

Selector ambiguity is a common problem in automation testing. **"strict" mode**
ensures that your selector points to a single element and throws otherwise.

Set `setStrict(true)` in your action calls to opt in.

```csharp
// This will throw if you have more than one button!
await page.ClickAsync("button", new Page.ClickOptions().setStrict(true));
```

#### 📍 New [**Locators API**](./api/class-locator)

Locator represents a view to the element(s) on the page. It captures the logic sufficient to retrieve the element at any given moment.

The difference between the [Locator](./api/class-locator) and [ElementHandle](./api/class-elementhandle) is that the latter points to a particular element, while [Locator](./api/class-locator) captures the logic of how to retrieve that element.

Also, locators are **"strict" by default**!

```csharp
var locator = page.Locator("button");
await locator.ClickAsync();
```

Learn more in the [documentation](./api/class-locator).

#### 🧩 Experimental [**React**](./selectors#react-selectors) and [**Vue**](./selectors#vue-selectors) selector engines

React and Vue selectors allow selecting elements by its component name and/or property values. The syntax is very similar to [attribute selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors) and supports all attribute selector operators.

```csharp
await page.ClickAsync("_react=SubmitButton[enabled=true]");
await page.ClickAsync("_vue=submit-button[enabled=true]");
```

Learn more in the [react selectors documentation](./selectors#react-selectors) and the [vue selectors documentation](./selectors#vue-selectors).

#### ✨ New [**`nth`**](./selectors#n-th-element-selector) and [**`visible`**](./selectors#selecting-visible-elements) selector engines

- [`nth`](./selectors#n-th-element-selector) selector engine is equivalent to the `:nth-match` pseudo class, but could be combined with other selector engines.
- [`visible`](./selectors#selecting-visible-elements) selector engine is equivalent to the `:visible` pseudo class, but could be combined with other selector engines.

```csharp
// select the first button among all buttons
await button.ClickAsync("button >> nth=0");
// or if you are using locators, you can use First, Nth() and Last
await page.Locator("button").First.ClickAsync();

// click a visible button
await button.ClickAsync("button >> visible=true");
```

### Browser Versions

- Chromium 94.0.4595.0
- Mozilla Firefox 91.0
- WebKit 15.0


## Version 1.13

#### Playwright

- **🖖 Programmatic drag-and-drop support** via the [`method: Page.dragAndDrop`] API.
- **🔎 Enhanced HAR** with body sizes for requests and responses. Use via `recordHar` option in [`method: Browser.newContext`].

#### Tools

- Playwright Trace Viewer now shows parameters, returned values and `console.log()` calls.

#### New and Overhauled Guides

- [Intro](./intro.md)
- [Authentication](./auth.md)

#### Browser Versions

- Chromium 93.0.4576.0
- Mozilla Firefox 90.0
- WebKit 14.2

#### New Playwright APIs

- new `baseURL` option in [`method: Browser.newContext`] and [`method: Browser.newPage`]
- [`method: Response.securityDetails`] and [`method: Response.serverAddr`]
- [`method: Page.dragAndDrop`] and [`method: Frame.dragAndDrop`]
- [`method: Download.cancel`]
- [`method: Page.inputValue`], [`method: Frame.inputValue`] and [`method: ElementHandle.inputValue`]
- new `force` option in [`method: Page.fill`], [`method: Frame.fill`], and [`method: ElementHandle.fill`]
- new `force` option in [`method: Page.selectOption`], [`method: Frame.selectOption`], and [`method: ElementHandle.selectOption`]

## Version 1.12

#### Highlights

- Playwright for .NET v1.12 is now stable!
- Ships with the [codegen](./cli.md#generate-code) and [trace viewer](./trace-viewer.md) tools out-of-the-box

#### Browser Versions

- Chromium 93.0.4530.0
- Mozilla Firefox 89.0
- WebKit 14.2

This version of Playwright was also tested against the following stable channels:

- Google Chrome 91
- Microsoft Edge 91


