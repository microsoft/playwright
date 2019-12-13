
# Playwright API <!-- GEN:version -->Tip-Of-Tree<!-- GEN:stop-->
<!-- GEN:empty-if-release --><!-- GEN:stop -->

- API Translations: [中文|Chinese](https://zhaoqize.github.io/playwright-api-zh_CN/#/)
- Troubleshooting: [troubleshooting.md](https://github.com/Microsoft/playwright/blob/master/docs/troubleshooting.md)


##### Table of Contents

<!-- GEN:toc -->
- [Overview](#overview)
- [Working with Chrome Extensions](#working-with-chrome-extensions)
- [class: Playwright](#class-playwright)
  * [playwright.connect(options)](#playwrightconnectoptions)
  * [playwright.createBrowserFetcher([options])](#playwrightcreatebrowserfetcheroptions)
  * [playwright.defaultArgs([options])](#playwrightdefaultargsoptions)
  * [playwright.devices](#playwrightdevices)
  * [playwright.downloadBrowser([options])](#playwrightdownloadbrowseroptions)
  * [playwright.errors](#playwrighterrors)
  * [playwright.executablePath()](#playwrightexecutablepath)
  * [playwright.launch([options])](#playwrightlaunchoptions)
- [class: BrowserFetcher](#class-browserfetcher)
  * [browserFetcher.canDownload(revision)](#browserfetchercandownloadrevision)
  * [browserFetcher.download(revision[, progressCallback])](#browserfetcherdownloadrevision-progresscallback)
  * [browserFetcher.localRevisions()](#browserfetcherlocalrevisions)
  * [browserFetcher.platform()](#browserfetcherplatform)
  * [browserFetcher.remove(revision)](#browserfetcherremoverevision)
  * [browserFetcher.revisionInfo(revision)](#browserfetcherrevisioninforevision)
- [class: Browser](#class-browser)
  * [event: 'disconnected'](#event-disconnected)
  * [browser.browserContexts()](#browserbrowsercontexts)
  * [browser.chromium](#browserchromium)
  * [browser.close()](#browserclose)
  * [browser.defaultBrowserContext()](#browserdefaultbrowsercontext)
  * [browser.disconnect()](#browserdisconnect)
  * [browser.isConnected()](#browserisconnected)
  * [browser.newContext()](#browsernewcontext)
  * [browser.newPage()](#browsernewpage)
  * [browser.pages()](#browserpages)
  * [browser.process()](#browserprocess)
  * [browser.userAgent()](#browseruseragent)
  * [browser.version()](#browserversion)
- [class: BrowserContext](#class-browsercontext)
  * [browserContext.browser()](#browsercontextbrowser)
  * [browserContext.clearCookies()](#browsercontextclearcookies)
  * [browserContext.close()](#browsercontextclose)
  * [browserContext.cookies([...urls])](#browsercontextcookiesurls)
  * [browserContext.isIncognito()](#browsercontextisincognito)
  * [browserContext.newPage()](#browsercontextnewpage)
  * [browserContext.pages()](#browsercontextpages)
  * [browserContext.permissions](#browsercontextpermissions)
  * [browserContext.setCookies(cookies)](#browsercontextsetcookiescookies)
- [class: Overrides](#class-overrides)
  * [overrides.setGeolocation(options)](#overridessetgeolocationoptions)
  * [overrides.setTimezone(timezoneId)](#overridessettimezonetimezoneid)
- [class: Permissions](#class-permissions)
  * [permissions.clearOverrides()](#permissionsclearoverrides)
  * [permissions.override(origin, permissions)](#permissionsoverrideorigin-permissions)
- [class: Page](#class-page)
  * [event: 'close'](#event-close)
  * [event: 'console'](#event-console)
  * [event: 'dialog'](#event-dialog)
  * [event: 'domcontentloaded'](#event-domcontentloaded)
  * [event: 'filechooser'](#event-filechooser)
  * [event: 'frameattached'](#event-frameattached)
  * [event: 'framedetached'](#event-framedetached)
  * [event: 'framenavigated'](#event-framenavigated)
  * [event: 'load'](#event-load)
  * [event: 'pageerror'](#event-pageerror)
  * [event: 'popup'](#event-popup)
  * [event: 'request'](#event-request)
  * [event: 'requestfailed'](#event-requestfailed)
  * [event: 'requestfinished'](#event-requestfinished)
  * [event: 'response'](#event-response)
  * [page.$(selector)](#pageselector)
  * [page.$$(selector)](#pageselector-1)
  * [page.$$eval(selector, pageFunction[, ...args])](#pageevalselector-pagefunction-args)
  * [page.$eval(selector, pageFunction[, ...args])](#pageevalselector-pagefunction-args-1)
  * [page.$x(expression)](#pagexexpression)
  * [page.accessibility](#pageaccessibility)
  * [page.addScriptTag(options)](#pageaddscripttagoptions)
  * [page.addStyleTag(options)](#pageaddstyletagoptions)
  * [page.browser()](#pagebrowser)
  * [page.browserContext()](#pagebrowsercontext)
  * [page.click(selector[, options])](#pageclickselector-options)
  * [page.close([options])](#pagecloseoptions)
  * [page.content()](#pagecontent)
  * [page.coverage](#pagecoverage)
  * [page.dblclick(selector[, options])](#pagedblclickselector-options)
  * [page.emulate(options)](#pageemulateoptions)
  * [page.emulateMedia(options)](#pageemulatemediaoptions)
  * [page.evaluate(pageFunction[, ...args])](#pageevaluatepagefunction-args)
  * [page.evaluateHandle(pageFunction[, ...args])](#pageevaluatehandlepagefunction-args)
  * [page.evaluateOnNewDocument(pageFunction[, ...args])](#pageevaluateonnewdocumentpagefunction-args)
  * [page.exposeFunction(name, playwrightFunction)](#pageexposefunctionname-playwrightfunction)
  * [page.fill(selector, value)](#pagefillselector-value)
  * [page.focus(selector)](#pagefocusselector)
  * [page.frames()](#pageframes)
  * [page.goBack([options])](#pagegobackoptions)
  * [page.goForward([options])](#pagegoforwardoptions)
  * [page.goto(url[, options])](#pagegotourl-options)
  * [page.hover(selector[, options])](#pagehoverselector-options)
  * [page.interception](#pageinterception)
  * [page.isClosed()](#pageisclosed)
  * [page.keyboard](#pagekeyboard)
  * [page.mainFrame()](#pagemainframe)
  * [page.mouse](#pagemouse)
  * [page.overrides](#pageoverrides)
  * [page.pdf](#pagepdf)
  * [page.reload([options])](#pagereloadoptions)
  * [page.screenshot([options])](#pagescreenshotoptions)
  * [page.select(selector, ...values)](#pageselectselector-values)
  * [page.setBypassCSP(enabled)](#pagesetbypasscspenabled)
  * [page.setCacheEnabled([enabled])](#pagesetcacheenabledenabled)
  * [page.setContent(html[, options])](#pagesetcontenthtml-options)
  * [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout)
  * [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout)
  * [page.setExtraHTTPHeaders(headers)](#pagesetextrahttpheadersheaders)
  * [page.setJavaScriptEnabled(enabled)](#pagesetjavascriptenabledenabled)
  * [page.setUserAgent(userAgent)](#pagesetuseragentuseragent)
  * [page.setViewport(viewport)](#pagesetviewportviewport)
  * [page.title()](#pagetitle)
  * [page.tripleclick(selector[, options])](#pagetripleclickselector-options)
  * [page.type(selector, text[, options])](#pagetypeselector-text-options)
  * [page.url()](#pageurl)
  * [page.viewport()](#pageviewport)
  * [page.waitFor(selectorOrFunctionOrTimeout[, options[, ...args]])](#pagewaitforselectororfunctionortimeout-options-args)
  * [page.waitForFileChooser([options])](#pagewaitforfilechooseroptions)
  * [page.waitForFunction(pageFunction[, options[, ...args]])](#pagewaitforfunctionpagefunction-options-args)
  * [page.waitForNavigation([options])](#pagewaitfornavigationoptions)
  * [page.waitForRequest(urlOrPredicate[, options])](#pagewaitforrequesturlorpredicate-options)
  * [page.waitForResponse(urlOrPredicate[, options])](#pagewaitforresponseurlorpredicate-options)
  * [page.waitForSelector(selector[, options])](#pagewaitforselectorselector-options)
  * [page.waitForXPath(xpath[, options])](#pagewaitforxpathxpath-options)
  * [page.workers](#pageworkers)
- [class: Worker](#class-worker)
  * [worker.evaluate(pageFunction[, ...args])](#workerevaluatepagefunction-args)
  * [worker.evaluateHandle(pageFunction[, ...args])](#workerevaluatehandlepagefunction-args)
  * [worker.executionContext()](#workerexecutioncontext)
  * [worker.url()](#workerurl)
- [class: Workers](#class-workers)
  * [event: 'workercreated'](#event-workercreated)
  * [event: 'workerdestroyed'](#event-workerdestroyed)
  * [workers.list()](#workerslist)
- [class: Accessibility](#class-accessibility)
  * [accessibility.snapshot([options])](#accessibilitysnapshotoptions)
- [class: Keyboard](#class-keyboard)
  * [keyboard.down(key[, options])](#keyboarddownkey-options)
  * [keyboard.press(key[, options])](#keyboardpresskey-options)
  * [keyboard.sendCharacters(text)](#keyboardsendcharacterstext)
  * [keyboard.type(text[, options])](#keyboardtypetext-options)
  * [keyboard.up(key)](#keyboardupkey)
- [class: Mouse](#class-mouse)
  * [mouse.click(x, y[, options])](#mouseclickx-y-options)
  * [mouse.dblclick(x, y[, options])](#mousedblclickx-y-options)
  * [mouse.down([options])](#mousedownoptions)
  * [mouse.move(x, y[, options])](#mousemovex-y-options)
  * [mouse.tripleclick(x, y[, options])](#mousetripleclickx-y-options)
  * [mouse.up([options])](#mouseupoptions)
- [class: PDF](#class-pdf)
  * [pdf.generate([options])](#pdfgenerateoptions)
- [class: Firefox](#class-firefox)
  * [firefox.wsEndpoint()](#firefoxwsendpoint)
- [class: Chromium](#class-chromium)
  * [event: 'targetchanged'](#event-targetchanged)
  * [event: 'targetcreated'](#event-targetcreated)
  * [event: 'targetdestroyed'](#event-targetdestroyed)
  * [chromium.browserTarget()](#chromiumbrowsertarget)
  * [chromium.pageTarget(page)](#chromiumpagetargetpage)
  * [chromium.serviceWorker(target)](#chromiumserviceworkertarget)
  * [chromium.startTracing(page, [options])](#chromiumstarttracingpage-options)
  * [chromium.stopTracing()](#chromiumstoptracing)
  * [chromium.targets(context)](#chromiumtargetscontext)
  * [chromium.waitForTarget(predicate[, options])](#chromiumwaitfortargetpredicate-options)
  * [chromium.wsEndpoint()](#chromiumwsendpoint)
- [class: Dialog](#class-dialog)
  * [dialog.accept([promptText])](#dialogacceptprompttext)
  * [dialog.defaultValue()](#dialogdefaultvalue)
  * [dialog.dismiss()](#dialogdismiss)
  * [dialog.message()](#dialogmessage)
  * [dialog.type()](#dialogtype)
- [class: ConsoleMessage](#class-consolemessage)
  * [consoleMessage.args()](#consolemessageargs)
  * [consoleMessage.location()](#consolemessagelocation)
  * [consoleMessage.text()](#consolemessagetext)
  * [consoleMessage.type()](#consolemessagetype)
- [class: Frame](#class-frame)
  * [frame.$(selector)](#frameselector)
  * [frame.$$(selector)](#frameselector-1)
  * [frame.$$eval(selector, pageFunction[, ...args])](#frameevalselector-pagefunction-args)
  * [frame.$eval(selector, pageFunction[, ...args])](#frameevalselector-pagefunction-args-1)
  * [frame.$x(expression)](#framexexpression)
  * [frame.addScriptTag(options)](#frameaddscripttagoptions)
  * [frame.addStyleTag(options)](#frameaddstyletagoptions)
  * [frame.childFrames()](#framechildframes)
  * [frame.click(selector[, options])](#frameclickselector-options)
  * [frame.content()](#framecontent)
  * [frame.dblclick(selector[, options])](#framedblclickselector-options)
  * [frame.evaluate(pageFunction[, ...args])](#frameevaluatepagefunction-args)
  * [frame.evaluateHandle(pageFunction[, ...args])](#frameevaluatehandlepagefunction-args)
  * [frame.executionContext()](#frameexecutioncontext)
  * [frame.fill(selector, value)](#framefillselector-value)
  * [frame.focus(selector)](#framefocusselector)
  * [frame.goto(url[, options])](#framegotourl-options)
  * [frame.hover(selector[, options])](#framehoverselector-options)
  * [frame.isDetached()](#frameisdetached)
  * [frame.name()](#framename)
  * [frame.parentFrame()](#frameparentframe)
  * [frame.select(selector, ...values)](#frameselectselector-values)
  * [frame.setContent(html[, options])](#framesetcontenthtml-options)
  * [frame.title()](#frametitle)
  * [frame.tripleclick(selector[, options])](#frametripleclickselector-options)
  * [frame.type(selector, text[, options])](#frametypeselector-text-options)
  * [frame.url()](#frameurl)
  * [frame.waitFor(selectorOrFunctionOrTimeout[, options[, ...args]])](#framewaitforselectororfunctionortimeout-options-args)
  * [frame.waitForFunction(pageFunction[, options[, ...args]])](#framewaitforfunctionpagefunction-options-args)
  * [frame.waitForNavigation([options])](#framewaitfornavigationoptions)
  * [frame.waitForSelector(selector[, options])](#framewaitforselectorselector-options)
  * [frame.waitForXPath(xpath[, options])](#framewaitforxpathxpath-options)
- [class: ExecutionContext](#class-executioncontext)
  * [executionContext.evaluate(pageFunction[, ...args])](#executioncontextevaluatepagefunction-args)
  * [executionContext.evaluateHandle(pageFunction[, ...args])](#executioncontextevaluatehandlepagefunction-args)
  * [executionContext.frame()](#executioncontextframe)
- [class: Interception](#class-interception)
  * [interception.abort(request, [errorCode])](#interceptionabortrequest-errorcode)
  * [interception.authenticate(credentials)](#interceptionauthenticatecredentials)
  * [interception.continue(request, [overrides])](#interceptioncontinuerequest-overrides)
  * [interception.disable()](#interceptiondisable)
  * [interception.enable()](#interceptionenable)
  * [interception.fulfill(request, response)](#interceptionfulfillrequest-response)
  * [interception.setOfflineMode(enabled)](#interceptionsetofflinemodeenabled)
- [class: JSHandle](#class-jshandle)
  * [jsHandle.asElement()](#jshandleaselement)
  * [jsHandle.dispose()](#jshandledispose)
  * [jsHandle.evaluate(pageFunction[, ...args])](#jshandleevaluatepagefunction-args)
  * [jsHandle.evaluateHandle(pageFunction[, ...args])](#jshandleevaluatehandlepagefunction-args)
  * [jsHandle.executionContext()](#jshandleexecutioncontext)
  * [jsHandle.getProperties()](#jshandlegetproperties)
  * [jsHandle.getProperty(propertyName)](#jshandlegetpropertypropertyname)
  * [jsHandle.jsonValue()](#jshandlejsonvalue)
- [class: ElementHandle](#class-elementhandle)
  * [elementHandle.$(selector)](#elementhandleselector)
  * [elementHandle.$$(selector)](#elementhandleselector-1)
  * [elementHandle.$$eval(selector, pageFunction[, ...args])](#elementhandleevalselector-pagefunction-args)
  * [elementHandle.$eval(selector, pageFunction[, ...args])](#elementhandleevalselector-pagefunction-args-1)
  * [elementHandle.$x(expression)](#elementhandlexexpression)
  * [elementHandle.asElement()](#elementhandleaselement)
  * [elementHandle.boundingBox()](#elementhandleboundingbox)
  * [elementHandle.click([options])](#elementhandleclickoptions)
  * [elementHandle.contentFrame()](#elementhandlecontentframe)
  * [elementHandle.dblclick([options])](#elementhandledblclickoptions)
  * [elementHandle.dispose()](#elementhandledispose)
  * [elementHandle.evaluate(pageFunction[, ...args])](#elementhandleevaluatepagefunction-args)
  * [elementHandle.evaluateHandle(pageFunction[, ...args])](#elementhandleevaluatehandlepagefunction-args)
  * [elementHandle.executionContext()](#elementhandleexecutioncontext)
  * [elementHandle.fill(value)](#elementhandlefillvalue)
  * [elementHandle.focus()](#elementhandlefocus)
  * [elementHandle.getProperties()](#elementhandlegetproperties)
  * [elementHandle.getProperty(propertyName)](#elementhandlegetpropertypropertyname)
  * [elementHandle.hover([options])](#elementhandlehoveroptions)
  * [elementHandle.isIntersectingViewport()](#elementhandleisintersectingviewport)
  * [elementHandle.jsonValue()](#elementhandlejsonvalue)
  * [elementHandle.press(key[, options])](#elementhandlepresskey-options)
  * [elementHandle.screenshot([options])](#elementhandlescreenshotoptions)
  * [elementHandle.select(...values)](#elementhandleselectvalues)
  * [elementHandle.setInputFiles(...files)](#elementhandlesetinputfilesfiles)
  * [elementHandle.toString()](#elementhandletostring)
  * [elementHandle.tripleclick([options])](#elementhandletripleclickoptions)
  * [elementHandle.type(text[, options])](#elementhandletypetext-options)
- [class: Request](#class-request)
  * [request.failure()](#requestfailure)
  * [request.frame()](#requestframe)
  * [request.headers()](#requestheaders)
  * [request.isNavigationRequest()](#requestisnavigationrequest)
  * [request.method()](#requestmethod)
  * [request.postData()](#requestpostdata)
  * [request.redirectChain()](#requestredirectchain)
  * [request.resourceType()](#requestresourcetype)
  * [request.response()](#requestresponse)
  * [request.url()](#requesturl)
- [class: Response](#class-response)
  * [response.buffer()](#responsebuffer)
  * [response.frame()](#responseframe)
  * [response.headers()](#responseheaders)
  * [response.json()](#responsejson)
  * [response.ok()](#responseok)
  * [response.remoteAddress()](#responseremoteaddress)
  * [response.request()](#responserequest)
  * [response.status()](#responsestatus)
  * [response.statusText()](#responsestatustext)
  * [response.text()](#responsetext)
  * [response.url()](#responseurl)
- [class: Target](#class-target)
  * [target.browser()](#targetbrowser)
  * [target.browserContext()](#targetbrowsercontext)
  * [target.createCDPSession()](#targetcreatecdpsession)
  * [target.opener()](#targetopener)
  * [target.page()](#targetpage)
  * [target.type()](#targettype)
  * [target.url()](#targeturl)
- [class: CDPSession](#class-cdpsession)
  * [cdpSession.detach()](#cdpsessiondetach)
  * [cdpSession.send(method[, params])](#cdpsessionsendmethod-params)
- [class: Coverage](#class-coverage)
  * [coverage.startCSSCoverage([options])](#coveragestartcsscoverageoptions)
  * [coverage.startJSCoverage([options])](#coveragestartjscoverageoptions)
  * [coverage.stopCSSCoverage()](#coveragestopcsscoverage)
  * [coverage.stopJSCoverage()](#coveragestopjscoverage)
- [class: TimeoutError](#class-timeouterror)
- [class: Selector](#class-selector)
  * [selector.selector](#selectorselector)
  * [selector.visible](#selectorvisible)
<!-- GEN:stop -->

### Overview

Playwright is a Node library which provides a high-level API to control Chromium or Chrome over the DevTools Protocol.

The Playwright API is hierarchical and mirrors the browser structure.

> **NOTE** On the following diagram, faded entities are not currently represented in Playwright.

![playwright overview](https://user-images.githubusercontent.com/746130/40333229-5df5480c-5d0c-11e8-83cb-c3e371de7374.png)

- [`Playwright`](#class-playwright) communicates with the browser using [DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/).
- [`Browser`](#class-browser) instance can own multiple browser contexts.
- [`BrowserContext`](#class-browsercontext) instance defines a browsing session and can own multiple pages.
- [`Page`](#class-page) has at least one frame: main frame. There might be other frames created by [iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe) or [frame](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/frame) tags.
- [`Frame`](#class-frame) has at least one execution context - the default execution context - where the frame's JavaScript is executed. A Frame might have additional execution contexts that are associated with [extensions](https://developer.chrome.com/extensions).
- [`Worker`](#class-worker) has a single execution context and facilitates interacting with [WebWorkers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API).

(Diagram source: [link](https://docs.google.com/drawings/d/1Q_AM6KYs9kbyLZF-Lpp5mtpAWth73Cq8IKCsWYgi8MM/edit?usp=sharing))

### Working with Chrome Extensions

Playwright can be used for testing Chrome Extensions.

> **NOTE** Extensions in Chrome / Chromium currently only work in non-headless mode.

The following is code for getting a handle to the [background page](https://developer.chrome.com/extensions/background_pages) of an extension whose source is located in `./my-extension`:
```js
const playwright = require('playwright');

(async () => {
  const pathToExtension = require('path').join(__dirname, 'my-extension');
  const browser = await playwright.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ]
  });
  const targets = await browser.chromium.targets();
  const backgroundPageTarget = targets.find(target => target.type() === 'background_page');
  const backgroundPage = await backgroundPageTarget.page();
  // Test the background page as you would any other page.
  await browser.close();
})();
```

> **NOTE** It is not yet possible to test extension popups or content scripts.

### class: Playwright

Playwright module provides a method to launch a Chromium instance.
The following is a typical example of using Playwright to drive automation:
```js
const playwright = require('playwright');

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  await page.goto('https://www.google.com');
  // other actions...
  await browser.close();
})();
```

#### playwright.connect(options)
- `options` <[Object]>
  - `browserWSEndpoint` <?[string]> a [browser websocket endpoint](#browserwsendpoint) to connect to.
  - `browserURL` <?[string]> a browser url to connect to, in format `http://${host}:${port}`. Use interchangeably with `browserWSEndpoint` to let Playwright fetch it from [metadata endpoint](https://chromedevtools.github.io/devtools-protocol/#how-do-i-access-the-browser-target).
  - `ignoreHTTPSErrors` <[boolean]> Whether to ignore HTTPS errors during navigation. Defaults to `false`.
  - `defaultViewport` <?[Object]> Sets a consistent viewport for each page. Defaults to an 800x600 viewport. `null` disables the default viewport.
    - `width` <[number]> page width in pixels.
    - `height` <[number]> page height in pixels.
    - `deviceScaleFactor` <[number]> Specify device scale factor (can be thought of as dpr). Defaults to `1`.
    - `isMobile` <[boolean]> Whether the `meta viewport` tag is taken into account. Defaults to `false`.
    - `hasTouch`<[boolean]> Specifies if viewport supports touch events. Defaults to `false`
    - `isLandscape` <[boolean]> Specifies if viewport is in landscape mode. Defaults to `false`.
  - `slowMo` <[number]> Slows down Playwright operations by the specified amount of milliseconds. Useful so that you can see what is going on.
  - `transport` <[ConnectionTransport]> **Experimental** Specify a custom transport object for Playwright to use.
- returns: <[Promise]<[Browser]>>

This methods attaches Playwright to an existing Chromium instance.

#### playwright.createBrowserFetcher([options])
- `options` <[Object]>
  - `host` <[string]> A download host to be used. Defaults to `https://storage.googleapis.com`.
  - `path` <[string]> A path for the downloads folder. Defaults to `<root>/.local-chromium`, where `<root>` is playwright's package root.
  - `platform` <[string]> Possible values are: `mac`, `win32`, `win64`, `linux`. Defaults to the current platform.
- returns: <[BrowserFetcher]>

#### playwright.defaultArgs([options])
- `options` <[Object]>  Set of configurable options to set on the browser. Can have the following fields:
  - `headless` <[boolean]> Whether to run browser in [headless mode](https://developers.google.com/web/updates/2017/04/headless-chrome). Defaults to `true` unless the `devtools` option is `true`.
  - `args` <[Array]<[string]>> Additional arguments to pass to the browser instance. The list of Chromium flags can be found [here](http://peter.sh/experiments/chromium-command-line-switches/).
  - `userDataDir` <[string]> Path to a [User Data Directory](https://chromium.googlesource.com/chromium/src/+/master/docs/user_data_dir.md).
  - `devtools` <[boolean]> Whether to auto-open a DevTools panel for each tab. If this option is `true`, the `headless` option will be set `false`.
- returns: <[Array]<[string]>>

The default flags that Chromium will be launched with.

#### playwright.devices
- returns: <[Object]>

Returns a list of devices to be used with [`page.emulate(options)`](#pageemulateoptions). Actual list of
devices can be found in [lib/DeviceDescriptors.js](https://github.com/Microsoft/playwright/blob/master/lib/DeviceDescriptors.js).

```js
const playwright = require('playwright');
const iPhone = playwright.devices['iPhone 6'];

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  await page.emulate(iPhone);
  await page.goto('https://www.google.com');
  // other actions...
  await browser.close();
})();
```

> **NOTE** The old way (Playwright versions <= v1.14.0) devices can be obtained with `require('playwright/DeviceDescriptors')`.

#### playwright.downloadBrowser([options])
- `options` <[Object]>
  - `onProgress` <[function]([number], [number])> A function that will be called with two arguments:
    - `downloadedBytes` <[number]> how many bytes have been downloaded
    - `totalBytes` <[number]> how large is the total download.
- returns: <[Promise]<[Object]>> Resolves with revision information when the revision is downloaded and extracted
  - `revision` <[string]> the revision the info was created from
  - `folderPath` <[string]> path to the extracted revision folder
  - `executablePath` <[string]> path to the revision executable
  - `url` <[string]> URL this revision can be downloaded from
  - `local` <[boolean]> whether the revision is locally available on disk

Downloads the default browser that Playwright controls. The browser is usually around 100mb.

#### playwright.errors
- returns: <[Object]>
  - `TimeoutError` <[function]> A class of [TimeoutError].

Playwright methods might throw errors if they are unable to fulfill a request. For example, [page.waitForSelector(selector[, options])](#pagewaitforselectorselector-options)
might fail if the selector doesn't match any nodes during the given timeframe.

For certain types of errors Playwright uses specific error classes.
These classes are available via [`playwright.errors`](#playwrighterrors)

An example of handling a timeout error:
```js
try {
  await page.waitForSelector('.foo');
} catch (e) {
  if (e instanceof playwright.errors.TimeoutError) {
    // Do something if this is a timeout.
  }
}
```

> **NOTE** The old way (Playwright versions <= v1.14.0) errors can be obtained with `require('playwright/Errors')`.

#### playwright.executablePath()
- returns: <[string]> A path where Playwright expects to find bundled Chromium.

#### playwright.launch([options])
- `options` <[Object]>  Set of configurable options to set on the browser. Can have the following fields:
  - `ignoreHTTPSErrors` <[boolean]> Whether to ignore HTTPS errors during navigation. Defaults to `false`.
  - `headless` <[boolean]> Whether to run browser in [headless mode](https://developers.google.com/web/updates/2017/04/headless-chrome). Defaults to `true` unless the `devtools` option is `true`.
  - `executablePath` <[string]> Path to a Chromium or Chrome executable to run instead of the bundled Chromium. If `executablePath` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd). **BEWARE**: Playwright is only [guaranteed to work](https://github.com/Microsoft/playwright/#q-why-doesnt-playwright-vxxx-work-with-chromium-vyyy) with the bundled Chromium, use at your own risk.
  - `slowMo` <[number]> Slows down Playwright operations by the specified amount of milliseconds. Useful so that you can see what is going on.
  - `defaultViewport` <?[Object]> Sets a consistent viewport for each page. Defaults to an 800x600 viewport. `null` disables the default viewport.
    - `width` <[number]> page width in pixels.
    - `height` <[number]> page height in pixels.
    - `deviceScaleFactor` <[number]> Specify device scale factor (can be thought of as dpr). Defaults to `1`.
    - `isMobile` <[boolean]> Whether the `meta viewport` tag is taken into account. Defaults to `false`.
    - `hasTouch`<[boolean]> Specifies if viewport supports touch events. Defaults to `false`
    - `isLandscape` <[boolean]> Specifies if viewport is in landscape mode. Defaults to `false`.
  - `args` <[Array]<[string]>> Additional arguments to pass to the browser instance. The list of Chromium flags can be found [here](http://peter.sh/experiments/chromium-command-line-switches/).
  - `ignoreDefaultArgs` <[boolean]|[Array]<[string]>> If `true`, then do not use [`playwright.defaultArgs()`](#playwrightdefaultargsoptions). If an array is given, then filter out the given default arguments. Dangerous option; use with care. Defaults to `false`.
  - `handleSIGINT` <[boolean]> Close the browser process on Ctrl-C. Defaults to `true`.
  - `handleSIGTERM` <[boolean]> Close the browser process on SIGTERM. Defaults to `true`.
  - `handleSIGHUP` <[boolean]> Close the browser process on SIGHUP. Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds to wait for the browser instance to start. Defaults to `30000` (30 seconds). Pass `0` to disable timeout.
  - `dumpio` <[boolean]> Whether to pipe the browser process stdout and stderr into `process.stdout` and `process.stderr`. Defaults to `false`.
  - `userDataDir` <[string]> Path to a [User Data Directory](https://chromium.googlesource.com/chromium/src/+/master/docs/user_data_dir.md).
  - `env` <[Object]> Specify environment variables that will be visible to the browser. Defaults to `process.env`.
  - `devtools` <[boolean]> Whether to auto-open a DevTools panel for each tab. If this option is `true`, the `headless` option will be set `false`.
  - `pipe` <[boolean]> Connects to the browser over a pipe instead of a WebSocket. Defaults to `false`.
- returns: <[Promise]<[Browser]>> Promise which resolves to browser instance.


You can use `ignoreDefaultArgs` to filter out `--mute-audio` from default arguments:
```js
const browser = await playwright.launch({
  ignoreDefaultArgs: ['--mute-audio']
});
```

> **NOTE** Playwright can also be used to control the Chrome browser, but it works best with the version of Chromium it is bundled with. There is no guarantee it will work with any other version. Use `executablePath` option with extreme caution.
>
> If Google Chrome (rather than Chromium) is preferred, a [Chrome Canary](https://www.google.com/chrome/browser/canary.html) or [Dev Channel](https://www.chromium.org/getting-involved/dev-channel) build is suggested.
>
> In [playwright.launch([options])](#playwrightlaunchoptions) above, any mention of Chromium also applies to Chrome.
>
> See [`this article`](https://www.howtogeek.com/202825/what%E2%80%99s-the-difference-between-chromium-and-chrome/) for a description of the differences between Chromium and Chrome. [`This article`](https://chromium.googlesource.com/chromium/src/+/lkgr/docs/chromium_browser_vs_google_chrome.md) describes some differences for Linux users.

### class: BrowserFetcher

BrowserFetcher can download and manage different versions of Chromium.

BrowserFetcher operates on revision strings that specify a precise version of Chromium, e.g. `"533271"`. Revision strings can be obtained from [omahaproxy.appspot.com](http://omahaproxy.appspot.com/).

An example of using BrowserFetcher to download a specific version of Chromium and running
Playwright against it:

```js
const browserFetcher = playwright.createBrowserFetcher();
const revisionInfo = await browserFetcher.download('533271');
const browser = await playwright.launch({executablePath: revisionInfo.executablePath})
```

> **NOTE** BrowserFetcher is not designed to work concurrently with other
> instances of BrowserFetcher that share the same downloads directory.

#### browserFetcher.canDownload(revision)
- `revision` <[string]> a revision to check availability.
- returns: <[Promise]<[boolean]>>  returns `true` if the revision could be downloaded from the host.

The method initiates a HEAD request to check if the revision is available.

#### browserFetcher.download(revision[, progressCallback])
- `revision` <[string]> a revision to download.
- `progressCallback` <[function]([number], [number])> A function that will be called with two arguments:
  - `downloadedBytes` <[number]> how many bytes have been downloaded
  - `totalBytes` <[number]> how large is the total download.
- returns: <[Promise]<[Object]>> Resolves with revision information when the revision is downloaded and extracted
  - `revision` <[string]> the revision the info was created from
  - `folderPath` <[string]> path to the extracted revision folder
  - `executablePath` <[string]> path to the revision executable
  - `url` <[string]> URL this revision can be downloaded from
  - `local` <[boolean]> whether the revision is locally available on disk

The method initiates a GET request to download the revision from the host.

#### browserFetcher.localRevisions()
- returns: <[Promise]<[Array]<[string]>>> A list of all revisions available locally on disk.

#### browserFetcher.platform()
- returns: <[string]> One of `mac`, `linux`, `win32` or `win64`.

#### browserFetcher.remove(revision)
- `revision` <[string]> a revision to remove. The method will throw if the revision has not been downloaded.
- returns: <[Promise]> Resolves when the revision has been removed.

#### browserFetcher.revisionInfo(revision)
- `revision` <[string]> a revision to get info for.
- returns: <[Object]>
  - `revision` <[string]> the revision the info was created from
  - `folderPath` <[string]> path to the extracted revision folder
  - `executablePath` <[string]> path to the revision executable
  - `url` <[string]> URL this revision can be downloaded from
  - `local` <[boolean]> whether the revision is locally available on disk

### class: Browser

* extends: [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

A Browser is created when Playwright connects to a Chromium instance, either through [`playwright.launch`](#playwrightlaunchoptions) or [`playwright.connect`](#playwrightconnectoptions).

An example of using a [Browser] to create a [Page]:
```js
const playwright = require('playwright');

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  await browser.close();
})();
```

An example of disconnecting from and reconnecting to a [Browser]:
```js
const playwright = require('playwright');

(async () => {
  const browser = await playwright.launch();
  // Store the endpoint to be able to reconnect to Chromium
  const browserWSEndpoint = browser.chromium.wsEndpoint();
  // Disconnect playwright from Chromium
  browser.disconnect();

  // Use the endpoint to reestablish a connection
  const browser2 = await playwright.connect({browserWSEndpoint});
  // Close Chromium
  await browser2.close();
})();
```
#### event: 'disconnected'
Emitted when Playwright gets disconnected from the Chromium instance. This might happen because of one of the following:
- Chromium is closed or crashed
- The [`browser.disconnect`](#browserdisconnect) method was called

#### browser.browserContexts()
- returns: <[Array]<[BrowserContext]>>

Returns an array of all open browser contexts. In a newly created browser, this will return
a single instance of [BrowserContext].

#### browser.chromium
- returns: <[Chromium]>

#### browser.close()
- returns: <[Promise]>

Closes Chromium and all of its pages (if any were opened). The [Browser] object itself is considered to be disposed and cannot be used anymore.

#### browser.defaultBrowserContext()
- returns: <[BrowserContext]>

Returns the default browser context. The default browser context can not be closed.

#### browser.disconnect()

Disconnects Playwright from the browser, but leaves the Chromium process running. After calling `disconnect`, the [Browser] object is considered disposed and cannot be used anymore.

#### browser.isConnected()

- returns: <[boolean]>

Indicates that the browser is connected.

#### browser.newContext()
- returns: <[Promise]<[BrowserContext]>>

Creates a new browser context. It won't share cookies/cache with other browser contexts.

```js
(async () => {
  const browser = await playwright.launch();
  // Create a new incognito browser context.
  const context = await browser.newContext();
  // Create a new page in a pristine context.
  const page = await context.newPage();
  // Do stuff
  await page.goto('https://example.com');
})();
```

#### browser.newPage()
- returns: <[Promise]<[Page]>>

Promise which resolves to a new [Page] object. The [Page] is created in a default browser context.

#### browser.pages()
- returns: <[Promise]<[Array]<[Page]>>> Promise which resolves to an array of all open pages. Non visible pages, such as `"background_page"`, will not be listed here. You can find them using [target.page()](#targetpage).

An array of all pages inside the Browser. In case of multiple browser contexts,
the method will return an array with all the pages in all browser contexts.

#### browser.process()
- returns: <?[ChildProcess]> Spawned browser process. Returns `null` if the browser instance was created with [`playwright.connect`](#playwrightconnectoptions) method.

#### browser.userAgent()
- returns: <[Promise]<[string]>> Promise which resolves to the browser's original user agent.

> **NOTE** Pages can override browser user agent with [page.setUserAgent](#pagesetuseragentuseragent)

#### browser.version()
- returns: <[Promise]<[string]>> For headless Chromium, this is similar to `HeadlessChrome/61.0.3153.0`. For non-headless, this is similar to `Chrome/61.0.3153.0`.

> **NOTE** the format of browser.version() might change with future releases of Chromium.

### class: BrowserContext

* extends: [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

BrowserContexts provide a way to operate multiple independent browser sessions. When a browser is launched, it has
a single BrowserContext used by default. The method `browser.newPage()` creates a page in the default browser context.

If a page opens another page, e.g. with a `window.open` call, the popup will belong to the parent page's browser
context.

Playwright allows creation of "incognito" browser contexts with `browser.newContext()` method.
"Incognito" browser contexts don't write any browsing data to disk.

```js
// Create a new incognito browser context
const context = await browser.newContext();
// Create a new page inside context.
const page = await context.newPage();
// ... do stuff with page ...
await page.goto('https://example.com');
// Dispose context once it's no longer needed.
await context.close();
```

#### browserContext.browser()
- returns: <[Browser]>

The browser this browser context belongs to.

#### browserContext.clearCookies()
- returns: <[Promise]>

Clears context bookies.

#### browserContext.close()
- returns: <[Promise]>

Closes the browser context. All the targets that belong to the browser context
will be closed.

> **NOTE** only incognito browser contexts can be closed.

#### browserContext.cookies([...urls])
- `...urls` <...[string]>
- returns: <[Promise]<[Array]<[Object]>>>
  - `name` <[string]>
  - `value` <[string]>
  - `domain` <[string]>
  - `path` <[string]>
  - `expires` <[number]> Unix time in seconds.
  - `size` <[number]>
  - `httpOnly` <[boolean]>
  - `secure` <[boolean]>
  - `session` <[boolean]>
  - `sameSite` <"Strict"|"Lax"|"None">

If no URLs are specified, this method returns all cookies.
If URLs are specified, only cookies that affect those URLs are returned.

#### browserContext.isIncognito()
- returns: <[boolean]>

Returns whether BrowserContext is incognito.
The default browser context is the only non-incognito browser context.

> **NOTE** the default browser context cannot be closed.

#### browserContext.newPage()
- returns: <[Promise]<[Page]>>

Creates a new page in the browser context.

#### browserContext.pages()
- returns: <[Promise]<[Array]<[Page]>>> Promise which resolves to an array of all open pages. Non visible pages, such as `"background_page"`, will not be listed here. You can find them using [target.page()](#targetpage).

An array of all pages inside the browser context.

#### browserContext.permissions
- returns: <[Permissions]>

#### browserContext.setCookies(cookies)
- `cookies` <[Array]<[Object]>>
  - `name` <[string]> **required**
  - `value` <[string]> **required**
  - `url` <[string]> either url or domain / path are **required**
  - `domain` <[string]> either url or domain / path are **required**
  - `path` <[string]> either url or domain / path are **required**
  - `expires` <[number]> Unix time in seconds.
  - `httpOnly` <[boolean]>
  - `secure` <[boolean]>
  - `sameSite` <"Strict"|"Lax"|"None">
- returns: <[Promise]>

```js
await browserContext.setCookies([cookieObject1, cookieObject2]);
```

### class: Overrides

#### overrides.setGeolocation(options)
- `options` <[Object]>
  - `latitude` <[number]> Latitude between -90 and 90.
  - `longitude` <[number]> Longitude between -180 and 180.
  - `accuracy` <[number]> Optional non-negative accuracy value.
- returns: <[Promise]>

Sets the page's geolocation.

```js
await page.overrides.setGeolocation({latitude: 59.95, longitude: 30.31667});
```

> **NOTE** Consider using [browserContext.permissions.override](#permissionsoverrideorigin-permissions) to grant permissions for the page to read its geolocation.

#### overrides.setTimezone(timezoneId)
- `timezoneId` <?[string]> Changes the timezone of the page. See [ICU’s `metaZones.txt`](https://cs.chromium.org/chromium/src/third_party/icu/source/data/misc/metaZones.txt?rcl=faee8bc70570192d82d2978a71e2a615788597d1) for a list of supported timezone IDs. Passing `null` disables timezone emulation.
- returns: <[Promise]>

### class: Permissions

#### permissions.clearOverrides()
- returns: <[Promise]>

Clears all permission overrides for the browser context.

```js
const context = browser.defaultBrowserContext();
context.permissions.override('https://example.com', ['clipboard-read']);
// do stuff ..
context.permissions.clearOverrides();
```

#### permissions.override(origin, permissions)
- `origin` <[string]> The [origin] to grant permissions to, e.g. "https://example.com".
- `permissions` <[Array]<[string]>> An array of permissions to grant. All permissions that are not listed here will be automatically denied. Permissions can be one of the following values:
    - `'geolocation'`
    - `'midi'`
    - `'midi-sysex'` (system-exclusive midi)
    - `'notifications'`
    - `'push'`
    - `'camera'`
    - `'microphone'`
    - `'background-sync'`
    - `'ambient-light-sensor'`
    - `'accelerometer'`
    - `'gyroscope'`
    - `'magnetometer'`
    - `'accessibility-events'`
    - `'clipboard-read'`
    - `'clipboard-write'`
    - `'payment-handler'`
- returns: <[Promise]>


```js
const context = browser.defaultBrowserContext();
await context.permissions.override('https://html5demos.com', ['geolocation']);
```

### class: Page

* extends: [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

Page provides methods to interact with a single tab or [extension background page](https://developer.chrome.com/extensions/background_pages) in Chromium. One [Browser] instance might have multiple [Page] instances.

This example creates a page, navigates it to a URL, and then saves a screenshot:
```js
const playwright = require('playwright');

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  await page.screenshot({path: 'screenshot.png'});
  await browser.close();
})();
```

The Page class emits various events (described below) which can be handled using any of Node's native [`EventEmitter`](https://nodejs.org/api/events.html#events_class_eventemitter) methods, such as `on`, `once` or `removeListener`.

This example logs a message for a single page `load` event:
```js
page.once('load', () => console.log('Page loaded!'));
```

To unsubscribe from events use the `removeListener` method:

```js
function logRequest(interceptedRequest) {
  console.log('A request was made:', interceptedRequest.url());
}
page.on('request', logRequest);
// Sometime later...
page.removeListener('request', logRequest);
```

#### event: 'close'

Emitted when the page closes.

#### event: 'console'
- <[ConsoleMessage]>

Emitted when JavaScript within the page calls one of console API methods, e.g. `console.log` or `console.dir`. Also emitted if the page throws an error or a warning.

The arguments passed into `console.log` appear as arguments on the event handler.

An example of handling `console` event:
```js
page.on('console', msg => {
  for (let i = 0; i < msg.args().length; ++i)
    console.log(`${i}: ${msg.args()[i]}`);
});
page.evaluate(() => console.log('hello', 5, {foo: 'bar'}));
```

#### event: 'dialog'
- <[Dialog]>

Emitted when a JavaScript dialog appears, such as `alert`, `prompt`, `confirm` or `beforeunload`. Playwright can respond to the dialog via [Dialog]'s [accept](#dialogacceptprompttext) or [dismiss](#dialogdismiss) methods.

#### event: 'domcontentloaded'

Emitted when the JavaScript [`DOMContentLoaded`](https://developer.mozilla.org/en-US/docs/Web/Events/DOMContentLoaded) event is dispatched.

#### event: 'filechooser'
- <[Object]>
  - `element` <[ElementHandle]> handle to the input element that was clicked
  - `multiple` <[boolean]> Whether file chooser allow for [multiple](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file#attr-multiple) file selection.

Emitted when a file chooser is supposed to appear, such as after clicking the  `<input type=file>`. Playwright can respond to it via setting the input files using [`elementHandle.setInputFiles`](#elementhandlesetinputfilesfiles).

```js
page.on('filechooser', async ({element, multiple}) => {
  await element.setInputFiles('/tmp/myfile.pdf');
});
```

#### event: 'frameattached'
- <[Frame]>

Emitted when a frame is attached.

#### event: 'framedetached'
- <[Frame]>

Emitted when a frame is detached.

#### event: 'framenavigated'
- <[Frame]>

Emitted when a frame is navigated to a new url.

#### event: 'load'

Emitted when the JavaScript [`load`](https://developer.mozilla.org/en-US/docs/Web/Events/load) event is dispatched.

#### event: 'pageerror'
- <[Error]> The exception message

Emitted when an uncaught exception happens within the page.

#### event: 'popup'
- <[Page]> Page corresponding to "popup" window

Emitted when the page opens a new tab or window.

```js
const [popup] = await Promise.all([
  new Promise(resolve => page.once('popup', resolve)),
  page.click('a[target=_blank]'),
]);
```

```js
const [popup] = await Promise.all([
  new Promise(resolve => page.once('popup', resolve)),
  page.evaluate(() => window.open('https://example.com')),
]);
```

#### event: 'request'
- <[Request]>

Emitted when a page issues a request. The [request] object is read-only.
In order to intercept and mutate requests, see `page.interception.enable()`.

#### event: 'requestfailed'
- <[Request]>

Emitted when a request fails, for example by timing out.

> **NOTE** HTTP Error responses, such as 404 or 503, are still successful responses from HTTP standpoint, so request will complete with [`'requestfinished'`](#event-requestfinished) event and not with [`'requestfailed'`](#event-requestfailed).

#### event: 'requestfinished'
- <[Request]>

Emitted when a request finishes successfully.

#### event: 'response'
- <[Response]>

Emitted when a [response] is received.

#### page.$(selector)
- `selector` <[string]|[Selector]> A [selector] to query page for
- returns: <[Promise]<?[ElementHandle]>>

The method runs `document.querySelector` within the page. If no element matches the selector, the return value resolves to `null`.

Shortcut for [page.mainFrame().$(selector)](#frameselector).

#### page.$$(selector)
- `selector` <[string]|[Selector]> A [selector] to query page for
- returns: <[Promise]<[Array]<[ElementHandle]>>>

The method runs `document.querySelectorAll` within the page. If no elements match the selector, the return value resolves to `[]`.

Shortcut for [page.mainFrame().$$(selector)](#frameselector-1).

#### page.$$eval(selector, pageFunction[, ...args])
- `selector` <[string]|[Selector]> A [selector] to query page for
- `pageFunction` <[function]\([Array]<[Element]>\)> Function to be evaluated in browser context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

This method runs `Array.from(document.querySelectorAll(selector))` within the page and passes it as the first argument to `pageFunction`.

If `pageFunction` returns a [Promise], then `page.$$eval` would wait for the promise to resolve and return its value.

Examples:
```js
const divsCounts = await page.$$eval('div', divs => divs.length);
```

#### page.$eval(selector, pageFunction[, ...args])
- `selector` <[string]|[Selector]> A [selector] to query page for
- `pageFunction` <[function]\([Element]\)> Function to be evaluated in browser context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

This method runs `document.querySelector` within the page and passes it as the first argument to `pageFunction`. If there's no element matching `selector`, the method throws an error.

If `pageFunction` returns a [Promise], then `page.$eval` would wait for the promise to resolve and return its value.

Examples:
```js
const searchValue = await page.$eval('#search', el => el.value);
const preloadHref = await page.$eval('link[rel=preload]', el => el.href);
const html = await page.$eval('.main-container', e => e.outerHTML);
```

Shortcut for [page.mainFrame().$eval(selector, pageFunction)](#frameevalselector-pagefunction-args).

#### page.$x(expression)
- `expression` <[string]> Expression to [evaluate](https://developer.mozilla.org/en-US/docs/Web/API/Document/evaluate).
- returns: <[Promise]<[Array]<[ElementHandle]>>>

The method evaluates the XPath expression.

Shortcut for [page.mainFrame().$x(expression)](#framexexpression)

#### page.accessibility
- returns: <[Accessibility]>

#### page.addScriptTag(options)
- `options` <[Object]>
  - `url` <[string]> URL of a script to be added.
  - `path` <[string]> Path to the JavaScript file to be injected into frame. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd).
  - `content` <[string]> Raw JavaScript content to be injected into frame.
  - `type` <[string]> Script type. Use 'module' in order to load a Javascript ES6 module. See [script](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script) for more details.
- returns: <[Promise]<[ElementHandle]>> which resolves to the added tag when the script's onload fires or when the script content was injected into frame.

Adds a `<script>` tag into the page with the desired url or content.

Shortcut for [page.mainFrame().addScriptTag(options)](#frameaddscripttagoptions).

#### page.addStyleTag(options)
- `options` <[Object]>
  - `url` <[string]> URL of the `<link>` tag.
  - `path` <[string]> Path to the CSS file to be injected into frame. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd).
  - `content` <[string]> Raw CSS content to be injected into frame.
- returns: <[Promise]<[ElementHandle]>> which resolves to the added tag when the stylesheet's onload fires or when the CSS content was injected into frame.

Adds a `<link rel="stylesheet">` tag into the page with the desired url or a `<style type="text/css">` tag with the content.

Shortcut for [page.mainFrame().addStyleTag(options)](#frameaddstyletagoptions).

#### page.browser()

- returns: <[Browser]>

Get the browser the page belongs to.

#### page.browserContext()

- returns: <[BrowserContext]>

Get the browser context that the page belongs to.

#### page.click(selector[, options])
- `selector` <[string]|[Selector]> A [selector] to search for element to click. If there are multiple elements satisfying the selector, the first will be clicked.
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `clickCount` <[number]> defaults to 1. See [UIEvent.detail].
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `relativePoint` <[Object]> A point to click relative to the top-left corner of element padding box. If not specified, clicks to some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully clicked. The Promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector`, scrolls it into view if needed, and then uses [page.mouse](#pagemouse) to click in the center of the element.
If there's no element matching `selector`, the method throws an error.

Bear in mind that if `click()` triggers a navigation event and there's a separate `page.waitForNavigation()` promise to be resolved, you may end up with a race condition that yields unexpected results. The correct pattern for click and wait for navigation is the following:

```javascript
const [response] = await Promise.all([
  page.waitForNavigation(waitOptions),
  page.click(selector, clickOptions),
]);
```

Shortcut for [page.mainFrame().click(selector[, options])](#frameclickselector-options).

#### page.close([options])
- `options` <[Object]>
  - `runBeforeUnload` <[boolean]> Defaults to `false`. Whether to run the
    [before unload](https://developer.mozilla.org/en-US/docs/Web/Events/beforeunload)
    page handlers.
- returns: <[Promise]>

By default, `page.close()` **does not** run beforeunload handlers.

> **NOTE** if `runBeforeUnload` is passed as true, a `beforeunload` dialog might be summoned
> and should be handled manually via page's ['dialog'](#event-dialog) event.

#### page.content()
- returns: <[Promise]<[string]>>

Gets the full HTML contents of the page, including the doctype.

#### page.coverage

- returns: <[Coverage]>

#### page.dblclick(selector[, options])
- `selector` <[string]|[Selector]> A [selector] to search for element to double click. If there are multiple elements satisfying the selector, the first will be double clicked.
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `relativePoint` <[Object]> A point to double click relative to the top-left corner of element padding box. If not specified, double clicks to some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the double click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully double clicked. The Promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector`, scrolls it into view if needed, and then uses [page.mouse](#pagemouse) to double click in the center of the element.
If there's no element matching `selector`, the method throws an error.

Bear in mind that if the first click of the `dblclick()` triggers a navigation event, there will be an exception.

> **NOTE** `page.dblclick()` dispatches two `click` events and a single `dblclick` event.

Shortcut for [page.mainFrame().dblclick(selector[, options])](#framedblclickselector-options).

#### page.emulate(options)
- `options` <[Object]>
  - `viewport` <[Object]>
    - `width` <[number]> page width in pixels.
    - `height` <[number]> page height in pixels.
    - `deviceScaleFactor` <[number]> Specify device scale factor (can be thought of as dpr). Defaults to `1`.
    - `isMobile` <[boolean]> Whether the `meta viewport` tag is taken into account. Defaults to `false`.
    - `hasTouch`<[boolean]> Specifies if viewport supports touch events. Defaults to `false`
    - `isLandscape` <[boolean]> Specifies if viewport is in landscape mode. Defaults to `false`.
  - `userAgent` <[string]>
- returns: <[Promise]>

Emulates given device metrics and user agent. This method is a shortcut for calling two methods:
- [page.setUserAgent(userAgent)](#pagesetuseragentuseragent)
- [page.setViewport(viewport)](#pagesetviewportviewport)

To aid emulation, playwright provides a list of device descriptors which can be obtained via the [`playwright.devices`](#playwrightdevices).

`page.emulate` will resize the page. A lot of websites don't expect phones to change size, so you should emulate before navigating to the page.

```js
const playwright = require('playwright');
const iPhone = playwright.devices['iPhone 6'];

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  await page.emulate(iPhone);
  await page.goto('https://www.google.com');
  // other actions...
  await browser.close();
})();
```

List of all available devices is available in the source code: [DeviceDescriptors.js](https://github.com/Microsoft/playwright/blob/master/lib/DeviceDescriptors.js).

#### page.emulateMedia(options)
- `options` <[Object]>
  - `type` <?[string]> Optional. Changes the CSS media type of the page. The only allowed values are `'screen'`, `'print'` and `null`. Passing `null` disables CSS media emulation.
  - `colorScheme` <"dark"|"light"|"no-preference"> Optional. Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`.
- returns: <[Promise]>

```js
await page.evaluate(() => matchMedia('screen').matches));
// → true
await page.evaluate(() => matchMedia('print').matches));
// → true

await page.emulateMedia({ type: 'print' });
await page.evaluate(() => matchMedia('screen').matches));
// → false
await page.evaluate(() => matchMedia('print').matches));
// → true

await page.emulateMedia({});
await page.evaluate(() => matchMedia('screen').matches));
// → true
await page.evaluate(() => matchMedia('print').matches));
// → true
```

```js
await page.emulateMedia({ colorScheme: 'dark' }] });
await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches));
// → true
await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches));
// → false
await page.evaluate(() => matchMedia('(prefers-color-scheme: no-preference)').matches));
// → false
```

#### page.evaluate(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated in the page context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

If the function passed to the `page.evaluate` returns a [Promise], then `page.evaluate` would wait for the promise to resolve and return its value.

If the function passed to the `page.evaluate` returns a non-[Serializable] value, then `page.evaluate` resolves to `undefined`. DevTools Protocol also supports transferring some additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`, and bigint literals.

Passing arguments to `pageFunction`:
```js
const result = await page.evaluate(x => {
  return Promise.resolve(8 * x);
}, 7);
console.log(result); // prints "56"
```

A string can also be passed in instead of a function:
```js
console.log(await page.evaluate('1 + 2')); // prints "3"
const x = 10;
console.log(await page.evaluate(`1 + ${x}`)); // prints "11"
```

[ElementHandle] instances can be passed as arguments to the `page.evaluate`:
```js
const bodyHandle = await page.$('body');
const html = await page.evaluate(body => body.innerHTML, bodyHandle);
await bodyHandle.dispose();
```

Shortcut for [page.mainFrame().evaluate(pageFunction, ...args)](#frameevaluatepagefunction-args).

#### page.evaluateHandle(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated in the page context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves to the return value of `pageFunction` as in-page object (JSHandle)

The only difference between `page.evaluate` and `page.evaluateHandle` is that `page.evaluateHandle` returns in-page object (JSHandle).

If the function passed to the `page.evaluateHandle` returns a [Promise], then `page.evaluateHandle` would wait for the promise to resolve and return its value.

A string can also be passed in instead of a function:
```js
const aHandle = await page.evaluateHandle('document'); // Handle for the 'document'
```

[JSHandle] instances can be passed as arguments to the `page.evaluateHandle`:
```js
const aHandle = await page.evaluateHandle(() => document.body);
const resultHandle = await page.evaluateHandle(body => body.innerHTML, aHandle);
console.log(await resultHandle.jsonValue());
await resultHandle.dispose();
```

Shortcut for [page.mainFrame().executionContext().evaluateHandle(pageFunction, ...args)](#executioncontextevaluatehandlepagefunction-args).

#### page.evaluateOnNewDocument(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated in browser context
- `...args` <...[Serializable]> Arguments to pass to `pageFunction`
- returns: <[Promise]>

Adds a function which would be invoked in one of the following scenarios:
- whenever the page is navigated
- whenever the child frame is attached or navigated. In this case, the function is invoked in the context of the newly attached frame

The function is invoked after the document was created but before any of its scripts were run. This is useful to amend  the JavaScript environment, e.g. to seed `Math.random`.

An example of overriding the navigator.languages property before the page loads:

```js
// preload.js

// overwrite the `languages` property to use a custom getter
Object.defineProperty(navigator, "languages", {
  get: function() {
    return ["en-US", "en", "bn"];
  }
});

// In your playwright script, assuming the preload.js file is in same folder of our script
const preloadFile = fs.readFileSync('./preload.js', 'utf8');
await page.evaluateOnNewDocument(preloadFile);
```

#### page.exposeFunction(name, playwrightFunction)
- `name` <[string]> Name of the function on the window object
- `playwrightFunction` <[function]> Callback function which will be called in Playwright's context.
- returns: <[Promise]>

The method adds a function called `name` on the page's `window` object.
When called, the function executes `playwrightFunction` in node.js and returns a [Promise] which resolves to the return value of `playwrightFunction`.

If the `playwrightFunction` returns a [Promise], it will be awaited.

> **NOTE** Functions installed via `page.exposeFunction` survive navigations.

An example of adding an `md5` function into the page:
```js
const playwright = require('playwright');
const crypto = require('crypto');

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log(msg.text()));
  await page.exposeFunction('md5', text =>
    crypto.createHash('md5').update(text).digest('hex')
  );
  await page.evaluate(async () => {
    // use window.md5 to compute hashes
    const myString = 'PLAYWRIGHT';
    const myHash = await window.md5(myString);
    console.log(`md5 of ${myString} is ${myHash}`);
  });
  await browser.close();
})();
```

An example of adding a `window.readfile` function into the page:

```js
const playwright = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log(msg.text()));
  await page.exposeFunction('readfile', async filePath => {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, text) => {
        if (err)
          reject(err);
        else
          resolve(text);
      });
    });
  });
  await page.evaluate(async () => {
    // use window.readfile to read contents of a file
    const content = await window.readfile('/etc/hosts');
    console.log(content);
  });
  await browser.close();
})();
```

#### page.fill(selector, value)
- `selector` <[string]|[Selector]> A [selector] to query page for.
- `value` <[string]> Value to fill for the `<input>`, `<textarea>` or `[contenteditable]` element.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully filled. The promise will be rejected if there is no element matching `selector`.

This method focuses the element and triggers an `input` event after filling.
If there's no text `<input>`, `<textarea>` or `[contenteditable]` element matching `selector`, the method throws an error.

Shortcut for [page.mainFrame().fill()](#framefillselector-value)

#### page.focus(selector)
- `selector` <[string]|[Selector]> A [selector] of an element to focus. If there are multiple elements satisfying the selector, the first will be focused.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully focused. The promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector` and focuses it.
If there's no element matching `selector`, the method throws an error.

Shortcut for [page.mainFrame().focus(selector)](#framefocusselector).

#### page.frames()
- returns: <[Array]<[Frame]>> An array of all frames attached to the page.

#### page.goBack([options])
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <[string]|[Array]<[string]>> When to consider navigation succeeded, defaults to `load`. Given an array of event strings, navigation is considered to be successful after all events have been fired. Events can be either:
    - `load` - consider navigation to be finished when the `load` event is fired.
    - `domcontentloaded` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `networkidle0` - consider navigation to be finished when there are no more than 0 network connections for at least `500` ms.
    - `networkidle2` - consider navigation to be finished when there are no more than 2 network connections for at least `500` ms.
- returns: <[Promise]<?[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. If
can not go back, resolves to `null`.

Navigate to the previous page in history.

#### page.goForward([options])
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <[string]|[Array]<[string]>> When to consider navigation succeeded, defaults to `load`. Given an array of event strings, navigation is considered to be successful after all events have been fired. Events can be either:
    - `load` - consider navigation to be finished when the `load` event is fired.
    - `domcontentloaded` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `networkidle0` - consider navigation to be finished when there are no more than 0 network connections for at least `500` ms.
    - `networkidle2` - consider navigation to be finished when there are no more than 2 network connections for at least `500` ms.
- returns: <[Promise]<?[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. If
can not go forward, resolves to `null`.

Navigate to the next page in history.

#### page.goto(url[, options])
- `url` <[string]> URL to navigate page to. The url should include scheme, e.g. `https://`.
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <[string]|[Array]<[string]>> When to consider navigation succeeded, defaults to `load`. Given an array of event strings, navigation is considered to be successful after all events have been fired. Events can be either:
    - `load` - consider navigation to be finished when the `load` event is fired.
    - `domcontentloaded` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `networkidle0` - consider navigation to be finished when there are no more than 0 network connections for at least `500` ms.
    - `networkidle2` - consider navigation to be finished when there are no more than 2 network connections for at least `500` ms.
  - `referer` <[string]> Referer header value. If provided it will take preference over the referer header value set by [page.setExtraHTTPHeaders()](#pagesetextrahttpheadersheaders).
- returns: <[Promise]<?[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect.

`page.goto` will throw an error if:
- there's an SSL error (e.g. in case of self-signed certificates).
- target URL is invalid.
- the `timeout` is exceeded during navigation.
- the remote server does not respond or is unreachable.
- the main resource failed to load.

`page.goto` will not throw an error when any valid HTTP status code is returned by the remote server, including 404 "Not Found" and 500 "Internal Server Error".  The status code for such responses can be retrieved by calling [response.status()](#responsestatus).

> **NOTE** `page.goto` either throws an error or returns a main resource response. The only exceptions are navigation to `about:blank` or navigation to the same URL with a different hash, which would succeed and return `null`.

> **NOTE** Headless mode doesn't support navigation to a PDF document. See the [upstream issue](https://bugs.chromium.org/p/chromium/issues/detail?id=761295).

Shortcut for [page.mainFrame().goto(url, options)](#framegotourl-options)

#### page.hover(selector[, options])
- `selector` <[string]|[Selector]> A [selector] to search for element to hover. If there are multiple elements satisfying the selector, the first will be hovered.
- `options` <[Object]>
  - `relativePoint` <[Object]> A point to hover relative to the top-left corner of element padding box. If not specified, hovers over some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the hover, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully hovered. Promise gets rejected if there's no element matching `selector`.

This method fetches an element with `selector`, scrolls it into view if needed, and then uses [page.mouse](#pagemouse) to hover over the center of the element.
If there's no element matching `selector`, the method throws an error.

Shortcut for [page.mainFrame().hover(selector)](#framehoverselector).

#### page.interception
- returns: <[Interception]>

#### page.isClosed()

- returns: <[boolean]>

Indicates that the page has been closed.

#### page.keyboard

- returns: <[Keyboard]>

#### page.mainFrame()
- returns: <[Frame]> The page's main frame.

Page is guaranteed to have a main frame which persists during navigations.

#### page.mouse

- returns: <[Mouse]>

#### page.overrides
- returns: <[Overrides]>

#### page.pdf
- returns: <[PDF]>

#### page.reload([options])
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <[string]|[Array]<[string]>> When to consider navigation succeeded, defaults to `load`. Given an array of event strings, navigation is considered to be successful after all events have been fired. Events can be either:
    - `load` - consider navigation to be finished when the `load` event is fired.
    - `domcontentloaded` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `networkidle0` - consider navigation to be finished when there are no more than 0 network connections for at least `500` ms.
    - `networkidle2` - consider navigation to be finished when there are no more than 2 network connections for at least `500` ms.
- returns: <[Promise]<[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect.

#### page.screenshot([options])
- `options` <[Object]> Options object which might have the following properties:
  - `path` <[string]> The file path to save the image to. The screenshot type will be inferred from file extension. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd). If no path is provided, the image won't be saved to the disk.
  - `type` <"png"|"jpeg"> Specify screenshot type, defaults to 'png'.
  - `quality` <[number]> The quality of the image, between 0-100. Not applicable to `png` images.
  - `fullPage` <[boolean]> When true, takes a screenshot of the full scrollable page. Defaults to `false`.
  - `clip` <[Object]> An object which specifies clipping region of the page. Should have the following fields:
    - `x` <[number]> x-coordinate of top-left corner of clip area
    - `y` <[number]> y-coordinate of top-left corner of clip area
    - `width` <[number]> width of clipping area
    - `height` <[number]> height of clipping area
  - `omitBackground` <[boolean]> Hides default white background and allows capturing screenshots with transparency. Defaults to `false`.
- returns: <[Promise]<[Buffer]>> Promise which resolves to buffer with the captured screenshot.

> **NOTE** Screenshots take at least 1/6 second on OS X. See https://crbug.com/741689 for discussion.

#### page.select(selector, ...values)
- `selector` <[string]|[Selector]> A [selector] to query page for.
- `...values` <...[string]|[ElementHandle]|[Object]> Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the first option matching one of the passed options is selected. String values are equivalent to `{value:'string'}`. Option is considered matching if all specified properties match.
  - `value` <[string]> Matches by `option.value`.
  - `label` <[string]> Matches by `option.label`.
  - `index` <[number]> Matches by the index.
- returns: <[Promise]<[Array]<[string]>>> An array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected.
If there's no `<select>` element matching `selector`, the method throws an error.

```js
// single selection matching the value
page.select('select#colors', 'blue');

// single selection matching both the value and the label
page.select('select#colors', { value: 'blue', label: 'Blue' });

// multiple selection
page.select('select#colors', 'red', 'green', 'blue');

// multiple selection for blue, red and second option
page.select('select#colors', { value: 'blue' }, { index: 2 }, 'red');
```

Shortcut for [page.mainFrame().select()](#frameselectselector-values)

#### page.setBypassCSP(enabled)
- `enabled` <[boolean]> sets bypassing of page's Content-Security-Policy.
- returns: <[Promise]>

Toggles bypassing page's Content-Security-Policy.

> **NOTE** CSP bypassing happens at the moment of CSP initialization rather then evaluation. Usually this means
that `page.setBypassCSP` should be called before navigating to the domain.

#### page.setCacheEnabled([enabled])
- `enabled` <[boolean]> sets the `enabled` state of the cache.
- returns: <[Promise]>

Toggles ignoring cache for each request based on the enabled state. By default, caching is enabled.

#### page.setContent(html[, options])
- `html` <[string]> HTML markup to assign to the page.
- `options` <[Object]> Parameters which might have the following properties:
  - `timeout` <[number]> Maximum time in milliseconds for resources to load, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <[string]|[Array]<[string]>> When to consider setting markup succeeded, defaults to `load`. Given an array of event strings, setting content is considered to be successful after all events have been fired. Events can be either:
    - `load` - consider setting content to be finished when the `load` event is fired.
    - `domcontentloaded` - consider setting content to be finished when the `DOMContentLoaded` event is fired.
    - `networkidle0` - consider setting content to be finished when there are no more than 0 network connections for at least `500` ms.
    - `networkidle2` - consider setting content to be finished when there are no more than 2 network connections for at least `500` ms.
- returns: <[Promise]>

#### page.setDefaultNavigationTimeout(timeout)
- `timeout` <[number]> Maximum navigation time in milliseconds

This setting will change the default maximum navigation time for the following methods and related shortcuts:
- [page.goBack([options])](#pagegobackoptions)
- [page.goForward([options])](#pagegoforwardoptions)
- [page.goto(url[, options])](#pagegotourl-options)
- [page.reload([options])](#pagereloadoptions)
- [page.setContent(html[, options])](#pagesetcontenthtml-options)
- [page.waitForNavigation([options])](#pagewaitfornavigationoptions)

> **NOTE** [`page.setDefaultNavigationTimeout`](#pagesetdefaultnavigationtimeouttimeout) takes priority over [`page.setDefaultTimeout`](#pagesetdefaulttimeouttimeout)


#### page.setDefaultTimeout(timeout)
- `timeout` <[number]> Maximum time in milliseconds

This setting will change the default maximum time for the following methods and related shortcuts:
- [page.goBack([options])](#pagegobackoptions)
- [page.goForward([options])](#pagegoforwardoptions)
- [page.goto(url[, options])](#pagegotourl-options)
- [page.reload([options])](#pagereloadoptions)
- [page.setContent(html[, options])](#pagesetcontenthtml-options)
- [page.waitFor(selectorOrFunctionOrTimeout[, options[, ...args]])](#pagewaitforselectororfunctionortimeout-options-args)
- [page.waitForFileChooser([options])](#pagewaitforfilechooseroptions)
- [page.waitForFunction(pageFunction[, options[, ...args]])](#pagewaitforfunctionpagefunction-options-args)
- [page.waitForNavigation([options])](#pagewaitfornavigationoptions)
- [page.waitForRequest(urlOrPredicate[, options])](#pagewaitforrequesturlorpredicate-options)
- [page.waitForResponse(urlOrPredicate[, options])](#pagewaitforresponseurlorpredicate-options)
- [page.waitForSelector(selector[, options])](#pagewaitforselectorselector-options)
- [page.waitForXPath(xpath[, options])](#pagewaitforxpathxpath-options)

> **NOTE** [`page.setDefaultNavigationTimeout`](#pagesetdefaultnavigationtimeouttimeout) takes priority over [`page.setDefaultTimeout`](#pagesetdefaulttimeouttimeout)

#### page.setExtraHTTPHeaders(headers)
- `headers` <[Object]> An object containing additional HTTP headers to be sent with every request. All header values must be strings.
- returns: <[Promise]>

The extra HTTP headers will be sent with every request the page initiates.

> **NOTE** page.setExtraHTTPHeaders does not guarantee the order of headers in the outgoing requests.

#### page.setJavaScriptEnabled(enabled)
- `enabled` <[boolean]> Whether or not to enable JavaScript on the page.
- returns: <[Promise]>

> **NOTE** changing this value won't affect scripts that have already been run. It will take full effect on the next [navigation](#pagegotourl-options).

#### page.setUserAgent(userAgent)
- `userAgent` <[string]> Specific user agent to use in this page
- returns: <[Promise]> Promise which resolves when the user agent is set.

#### page.setViewport(viewport)
- `viewport` <[Object]>
  - `width` <[number]> page width in pixels. **required**
  - `height` <[number]> page height in pixels. **required**
  - `deviceScaleFactor` <[number]> Specify device scale factor (can be thought of as dpr). Defaults to `1`.
  - `isMobile` <[boolean]> Whether the `meta viewport` tag is taken into account. Defaults to `false`.
  - `hasTouch`<[boolean]> Specifies if viewport supports touch events. Defaults to `false`
  - `isLandscape` <[boolean]> Specifies if viewport is in landscape mode. Defaults to `false`.
- returns: <[Promise]>

> **NOTE** in certain cases, setting viewport will reload the page in order to set the `isMobile` or `hasTouch` properties.

In the case of multiple pages in a single browser, each page can have its own viewport size.

`page.setViewport` will resize the page. A lot of websites don't expect phones to change size, so you should set the viewport before navigating to the page.

```js
const page = await browser.newPage();
await page.setViewport({
  width: 640,
  height: 480,
  deviceScaleFactor: 1,
});
await page.goto('https://example.com');
```

#### page.title()
- returns: <[Promise]<[string]>> The page's title.

Shortcut for [page.mainFrame().title()](#frametitle).

#### page.tripleclick(selector[, options])
- `selector` <[string]|[Selector]> A [selector] to search for element to triple click. If there are multiple elements satisfying the selector, the first will be triple clicked.
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `relativePoint` <[Object]> A point to triple click relative to the top-left corner of element padding box. If not specified, triple clicks to some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the triple click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully triple clicked. The Promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector`, scrolls it into view if needed, and then uses [page.mouse](#pagemouse) to triple click in the center of the element.
If there's no element matching `selector`, the method throws an error.

Bear in mind that if the first or second click of the `tripleclick()` triggers a navigation event, there will be an exception.

> **NOTE** `page.tripleclick()` dispatches three `click` events and a single `dblclick` event.

Shortcut for [page.mainFrame().tripleclick(selector[, options])](#frametripleclickselector-options).

#### page.type(selector, text[, options])
- `selector` <[string]|[Selector]> A [selector] of an element to type into. If there are multiple elements satisfying the selector, the first will be used.
- `text` <[string]> A text to type into a focused element.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between key presses in milliseconds. Defaults to 0.
- returns: <[Promise]>

Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.

To press a special key, like `Control` or `ArrowDown`, use [`keyboard.press`](#keyboardpresskey-options).

```js
await page.type('#mytextarea', 'Hello'); // Types instantly
await page.type('#mytextarea', 'World', {delay: 100}); // Types slower, like a user
```

Shortcut for [page.mainFrame().type(selector, text[, options])](#frametypeselector-text-options).

#### page.url()
- returns: <[string]>

This is a shortcut for [page.mainFrame().url()](#frameurl)

#### page.viewport()
- returns: <?[Object]>
  - `width` <[number]> page width in pixels.
  - `height` <[number]> page height in pixels.
  - `deviceScaleFactor` <[number]> Specify device scale factor (can be though of as dpr). Defaults to `1`.
  - `isMobile` <[boolean]> Whether the `meta viewport` tag is taken into account. Defaults to `false`.
  - `hasTouch`<[boolean]> Specifies if viewport supports touch events. Defaults to `false`
  - `isLandscape` <[boolean]> Specifies if viewport is in landscape mode. Defaults to `false`.

#### page.waitFor(selectorOrFunctionOrTimeout[, options[, ...args]])
- `selectorOrFunctionOrTimeout` <[string]|[number]|[function]> A [selector], predicate or timeout to wait for
- `options` <[Object]> Optional waiting parameters
  - `visible` <[boolean]> wait for element to be present in DOM and to be visible. Defaults to `false`.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) method.
  - `hidden` <[boolean]> wait for element to not be found in the DOM or to be hidden. Defaults to `false`.
  - `polling` <[string]|[number]> An interval at which the `pageFunction` is executed, defaults to `raf`. If `polling` is a number, then it is treated as an interval in milliseconds at which the function would be executed. If `polling` is a string, then it can be one of the following values:
    - `raf` - to constantly execute `pageFunction` in `requestAnimationFrame` callback. This is the tightest polling mode which is suitable to observe styling changes.
    - `mutation` - to execute `pageFunction` on every DOM mutation.
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to  `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves to a JSHandle of the success value

This method behaves differently with respect to the type of the first parameter:
- if `selectorOrFunctionOrTimeout` is a `string`, then the first argument is treated as a [selector] or [xpath], depending on whether or not it starts with '//', and the method is a shortcut for
  [page.waitForSelector](#pagewaitforselectorselector-options) or [page.waitForXPath](#pagewaitforxpathxpath-options)
- if `selectorOrFunctionOrTimeout` is a `function`, then the first argument is treated as a predicate to wait for and the method is a shortcut for [page.waitForFunction()](#pagewaitforfunctionpagefunction-options-args).
- if `selectorOrFunctionOrTimeout` is a `number`, then the first argument is treated as a timeout in milliseconds and the method returns a promise which resolves after the timeout
- otherwise, an exception is thrown

```js
// wait for selector
await page.waitFor('.foo');
// wait for 1 second
await page.waitFor(1000);
// wait for predicate
await page.waitFor(() => !!document.querySelector('.foo'));
```

To pass arguments from node.js to the predicate of `page.waitFor` function:

```js
const selector = '.foo';
await page.waitFor(selector => !!document.querySelector(selector), {}, selector);
```

Shortcut for [page.mainFrame().waitFor(selectorOrFunctionOrTimeout[, options[, ...args]])](#framewaitforselectororfunctionortimeout-options-args).

#### page.waitForFileChooser([options])
- `options` <[Object]> Optional waiting parameters
  - `timeout` <[number]> Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be changed by using the [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) method.
- returns: <[Promise]<[Object]>>
  - `element` <[ElementHandle]> handle to the input element that was clicked
  - `multiple` <[boolean]> Whether file chooser allow for [multiple](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file#attr-multiple) file selection.

> **NOTE** In non-headless Chromium, this method results in the native file picker dialog **not showing up** for the user.

This method is typically coupled with an action that triggers file choosing.
The following example clicks a button that issues a file chooser, and then
responds with `/tmp/myfile.pdf` as if a user has selected this file.

```js
const [{element, multiple}] = await Promise.all([
  page.waitForFileChooser(),
  page.click('#upload-file-button'), // some button that triggers file selection
]);
await element.setInputFiles('/tmp/myfile.pdf');
```

> **NOTE** This must be called *before* the file chooser is launched. It will not return a currently active file chooser.

#### page.waitForFunction(pageFunction[, options[, ...args]])
- `pageFunction` <[function]|[string]> Function to be evaluated in browser context
- `options` <[Object]> Optional waiting parameters
  - `polling` <[number]|"raf"|"mutation"> An interval at which the `pageFunction` is executed, defaults to `raf`. If `polling` is a number, then it is treated as an interval in milliseconds at which the function would be executed. If `polling` is a string, then it can be one of the following values:
    - `raf` - to constantly execute `pageFunction` in `requestAnimationFrame` callback. This is the tightest polling mode which is suitable to observe styling changes.
    - `mutation` - to execute `pageFunction` on every DOM mutation.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) method.
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to  `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves when the `pageFunction` returns a truthy value. It resolves to a JSHandle of the truthy value.

The `waitForFunction` can be used to observe viewport size change:
```js
const playwright = require('playwright');

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  const watchDog = page.waitForFunction('window.innerWidth < 100');
  await page.setViewport({width: 50, height: 50});
  await watchDog;
  await browser.close();
})();
```

To pass arguments from node.js to the predicate of `page.waitForFunction` function:

```js
const selector = '.foo';
await page.waitForFunction(selector => !!document.querySelector(selector), {}, selector);
```

Shortcut for [page.mainFrame().waitForFunction(pageFunction[, options[, ...args]])](#framewaitforfunctionpagefunction-options-args).

#### page.waitForNavigation([options])
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <[string]|[Array]<[string]>> When to consider navigation succeeded, defaults to `load`. Given an array of event strings, navigation is considered to be successful after all events have been fired. Events can be either:
    - `load` - consider navigation to be finished when the `load` event is fired.
    - `domcontentloaded` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `networkidle0` - consider navigation to be finished when there are no more than 0 network connections for at least `500` ms.
    - `networkidle2` - consider navigation to be finished when there are no more than 2 network connections for at least `500` ms.
- returns: <[Promise]<?[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. In case of navigation to a different anchor or navigation due to History API usage, the navigation will resolve with `null`.

This resolves when the page navigates to a new URL or reloads. It is useful for when you run code
which will indirectly cause the page to navigate. Consider this example:

```js
const [response] = await Promise.all([
  page.waitForNavigation(), // The promise resolves after navigation has finished
  page.click('a.my-link'), // Clicking the link will indirectly cause a navigation
]);
```

**NOTE** Usage of the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) to change the URL is considered a navigation.

Shortcut for [page.mainFrame().waitForNavigation(options)](#framewaitfornavigationoptions).

#### page.waitForRequest(urlOrPredicate[, options])
- `urlOrPredicate` <[string]|[Function]> A URL or predicate to wait for.
- `options` <[Object]> Optional waiting parameters
  - `timeout` <[number]> Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be changed by using the [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) method.
- returns: <[Promise]<[Request]>> Promise which resolves to the matched request.

```js
const firstRequest = await page.waitForRequest('http://example.com/resource');
const finalRequest = await page.waitForRequest(request => request.url() === 'http://example.com' && request.method() === 'GET');
return firstRequest.url();
```

#### page.waitForResponse(urlOrPredicate[, options])
- `urlOrPredicate` <[string]|[Function]> A URL or predicate to wait for.
- `options` <[Object]> Optional waiting parameters
  - `timeout` <[number]> Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be changed by using the [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) method.
- returns: <[Promise]<[Response]>> Promise which resolves to the matched response.

```js
const firstResponse = await page.waitForResponse('https://example.com/resource');
const finalResponse = await page.waitForResponse(response => response.url() === 'https://example.com' && response.status() === 200);
return finalResponse.ok();
```

#### page.waitForSelector(selector[, options])
- `selector` <[string]|[Selector]> A [selector] of an element to wait for
- `options` <[Object]> Optional waiting parameters
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) method.
- returns: <[Promise]<?[ElementHandle]>> Promise which resolves when element specified by selector string is added to DOM. Resolves to `null` if waiting for `hidden: true` and selector is not found in DOM.

Wait for the `selector` to appear in page. If at the moment of calling
the method the `selector` already exists, the method will return
immediately. If the selector doesn't appear after the `timeout` milliseconds of waiting, the function will throw.

This method works across navigations:
```js
const playwright = require('playwright');

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  let currentURL;
  page
    .waitForSelector('img')
    .then(() => console.log('First URL with image: ' + currentURL));
  for (currentURL of ['https://example.com', 'https://google.com', 'https://bbc.com']) {
    await page.goto(currentURL);
  }
  await browser.close();
})();
```
Shortcut for [page.mainFrame().waitForSelector(selector[, options])](#framewaitforselectorselector-options).

#### page.waitForXPath(xpath[, options])
- `xpath` <[string]> A [xpath] of an element to wait for
- `options` <[Object]> Optional waiting parameters
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) method.
- returns: <[Promise]<?[ElementHandle]>> Promise which resolves when element specified by xpath string is added to DOM. Resolves to `null` if waiting for `hidden: true` and xpath is not found in DOM.

Wait for the `xpath` to appear in page. If at the moment of calling
the method the `xpath` already exists, the method will return
immediately. If the xpath doesn't appear after the `timeout` milliseconds of waiting, the function will throw.

This method works across navigations:
```js
const playwright = require('playwright');

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  let currentURL;
  page
    .waitForXPath('//img')
    .then(() => console.log('First URL with image: ' + currentURL));
  for (currentURL of ['https://example.com', 'https://google.com', 'https://bbc.com']) {
    await page.goto(currentURL);
  }
  await browser.close();
})();
```
Shortcut for [page.mainFrame().waitForXPath(xpath[, options])](#framewaitforxpathxpath-options).

#### page.workers
- returns: <[Workers]>

> **NOTE** This does not contain ServiceWorkers

### class: Worker

The Worker class represents a [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API).
The events `workercreated` and `workerdestroyed` are emitted on the page object to signal the worker lifecycle.

```js
page.workers.on('workercreated', worker => console.log('Worker created: ' + worker.url()));
page.workers.on('workerdestroyed', worker => console.log('Worker destroyed: ' + worker.url()));

console.log('Current workers:');
for (const worker of page.workers())
  console.log('  ' + worker.url());
```

#### worker.evaluate(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated in the worker context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

If the function passed to the `worker.evaluate` returns a [Promise], then `worker.evaluate` would wait for the promise to resolve and return its value.

If the function passed to the `worker.evaluate` returns a non-[Serializable] value, then `worker.evaluate` resolves to `undefined`. DevTools Protocol also supports transferring some additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`, and bigint literals.

Shortcut for [(await worker.executionContext()).evaluate(pageFunction, ...args)](#executioncontextevaluatepagefunction-args).

#### worker.evaluateHandle(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated in the page context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves to the return value of `pageFunction` as in-page object (JSHandle)

The only difference between `worker.evaluate` and `worker.evaluateHandle` is that `worker.evaluateHandle` returns in-page object (JSHandle).

If the function passed to the `worker.evaluateHandle` returns a [Promise], then `worker.evaluateHandle` would wait for the promise to resolve and return its value.

Shortcut for [(await worker.executionContext()).evaluateHandle(pageFunction, ...args)](#executioncontextevaluatehandlepagefunction-args).

#### worker.executionContext()
- returns: <[Promise]<[ExecutionContext]>>

#### worker.url()
- returns: <[string]>

### class: Workers

The Workers class represents a [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) collection.

#### event: 'workercreated'
- <[Worker]>

Emitted when a dedicated [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) is spawned by the page.

#### event: 'workerdestroyed'
- <[Worker]>

Emitted when a dedicated [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) is terminated.

#### workers.list()
- returns: <[Array]<[Worker]>>
This method returns all of the dedicated [WebWorkers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) associated with the page.

> **NOTE** This does not contain ServiceWorkers

### class: Accessibility

The Accessibility class provides methods for inspecting Chromium's accessibility tree. The accessibility tree is used by assistive technology such as [screen readers](https://en.wikipedia.org/wiki/Screen_reader) or [switches](https://en.wikipedia.org/wiki/Switch_access).

Accessibility is a very platform-specific thing. On different platforms, there are different screen readers that might have wildly different output.

Blink - Chrome's rendering engine - has a concept of "accessibility tree", which is then translated into different platform-specific APIs. Accessibility namespace gives users
access to the Blink Accessibility Tree.

Most of the accessibility tree gets filtered out when converting from Blink AX Tree to Platform-specific AX-Tree or by assistive technologies themselves. By default, Playwright tries to approximate this filtering, exposing only the "interesting" nodes of the tree.



#### accessibility.snapshot([options])
- `options` <[Object]>
  - `interestingOnly` <[boolean]> Prune uninteresting nodes from the tree. Defaults to `true`.
  - `root` <[ElementHandle]> The root DOM element for the snapshot. Defaults to the whole page.
- returns: <[Promise]<[Object]>> An [AXNode] object with the following properties:
  - `role` <[string]> The [role](https://www.w3.org/TR/wai-aria/#usage_intro).
  - `name` <[string]> A human readable name for the node.
  - `value` <[string]|[number]> The current value of the node.
  - `description` <[string]> An additional human readable description of the node.
  - `keyshortcuts` <[string]> Keyboard shortcuts associated with this node.
  - `roledescription` <[string]> A human readable alternative to the role.
  - `valuetext` <[string]> A description of the current value.
  - `disabled` <[boolean]> Whether the node is disabled.
  - `expanded` <[boolean]> Whether the node is expanded or collapsed.
  - `focused` <[boolean]> Whether the node is focused.
  - `modal` <[boolean]> Whether the node is [modal](https://en.wikipedia.org/wiki/Modal_window).
  - `multiline` <[boolean]> Whether the node text input supports multiline.
  - `multiselectable` <[boolean]> Whether more than one child can be selected.
  - `readonly` <[boolean]> Whether the node is read only.
  - `required` <[boolean]> Whether the node is required.
  - `selected` <[boolean]> Whether the node is selected in its parent node.
  - `checked` <[boolean]|"mixed"> Whether the checkbox is checked, or "mixed".
  - `pressed` <[boolean]|"mixed"> Whether the toggle button is checked, or "mixed".
  - `level` <[number]> The level of a heading.
  - `valuemin` <[number]> The minimum value in a node.
  - `valuemax` <[number]> The maximum value in a node.
  - `autocomplete` <[string]> What kind of autocomplete is supported by a control.
  - `haspopup` <[string]> What kind of popup is currently being shown for a node.
  - `invalid` <[string]> Whether and in what way this node's value is invalid.
  - `orientation` <[string]> Whether the node is oriented horizontally or vertically.
  - `children` <[Array]<[Object]>> Child [AXNode]s of this node, if any.

Captures the current state of the accessibility tree. The returned object represents the root accessible node of the page.

> **NOTE** The Chromium accessibility tree contains nodes that go unused on most platforms and by
most screen readers. Playwright will discard them as well for an easier to process tree,
unless `interestingOnly` is set to `false`.

An example of dumping the entire accessibility tree:
```js
const snapshot = await page.accessibility.snapshot();
console.log(snapshot);
```

An example of logging the focused node's name:
```js
const snapshot = await page.accessibility.snapshot();
const node = findFocusedNode(snapshot);
console.log(node && node.name);

function findFocusedNode(node) {
  if (node.focused)
    return node;
  for (const child of node.children || []) {
    const foundNode = findFocusedNode(child);
    return foundNode;
  }
  return null;
}
```

### class: Keyboard

Keyboard provides an api for managing a virtual keyboard. The high level api is [`keyboard.type`](#keyboardtypetext-options), which takes raw characters and generates proper keydown, keypress/input, and keyup events on your page.

For finer control, you can use [`keyboard.down`](#keyboarddownkey-options), [`keyboard.up`](#keyboardupkey), and [`keyboard.sendCharacters`](#keyboardsendcharacterstext) to manually fire events as if they were generated from a real keyboard.

An example of holding down `Shift` in order to select and delete some text:
```js
await page.keyboard.type('Hello World!');
await page.keyboard.press('ArrowLeft');

await page.keyboard.down('Shift');
for (let i = 0; i < ' World'.length; i++)
  await page.keyboard.press('ArrowLeft');
await page.keyboard.up('Shift');

await page.keyboard.press('Backspace');
// Result text will end up saying 'Hello!'
```

An example of pressing `A`
```js
await page.keyboard.down('Shift');
await page.keyboard.press('KeyA');
await page.keyboard.up('Shift');
```

> **NOTE** On MacOS, keyboard shortcuts like `⌘ A` -> Select All do not work. See [#1313](https://github.com/GoogleChrome/puppeteer/issues/1313)

#### keyboard.down(key[, options])
- `key` <[string]> Name of key to press, such as `ArrowLeft`. See [USKeyboardLayout] for a list of all key names.
- `options` <[Object]>
  - `text` <[string]> If specified, generates an input event with this text.
- returns: <[Promise]>

Dispatches a `keydown` event.

If `key` is a single character and no modifier keys besides `Shift` are being held down, a `keypress`/`input` event will also generated. The `text` option can be specified to force an input event to be generated.

If `key` is a modifier key, `Shift`, `Meta`, `Control`, or `Alt`, subsequent key presses will be sent with that modifier active. To release the modifier key, use [`keyboard.up`](#keyboardupkey).

After the key is pressed once, subsequent calls to [`keyboard.down`](#keyboarddownkey-options) will have [repeat](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat) set to true. To release the key, use [`keyboard.up`](#keyboardupkey).

> **NOTE** Modifier keys DO influence `keyboard.down`. Holding down `Shift` will type the text in upper case.

#### keyboard.press(key[, options])
- `key` <[string]> Name of key to press, such as `ArrowLeft`. See [USKeyboardLayout] for a list of all key names.
- `options` <[Object]>
  - `text` <[string]> If specified, generates an input event with this text.
  - `delay` <[number]> Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.
- returns: <[Promise]>

If `key` is a single character and no modifier keys besides `Shift` are being held down, a `keypress`/`input` event will also generated. The `text` option can be specified to force an input event to be generated.

> **NOTE** Modifier keys DO effect `keyboard.press`. Holding down `Shift` will type the text in upper case.

Shortcut for [`keyboard.down`](#keyboarddownkey-options) and [`keyboard.up`](#keyboardupkey).

#### keyboard.sendCharacters(text)
- `text` <[string]> Characters to send into the page.
- returns: <[Promise]>

Dispatches a `keypress` and `input` event. This does not send a `keydown` or `keyup` event.

```js
page.keyboard.sendCharacters('嗨');
```

> **NOTE** Modifier keys DO NOT effect `keyboard.sendCharacters`. Holding down `Shift` will not type the text in upper case.

#### keyboard.type(text[, options])
- `text` <[string]> A text to type into a focused element.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between key presses in milliseconds. Defaults to 0.
- returns: <[Promise]>

Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.

To press a special key, like `Control` or `ArrowDown`, use [`keyboard.press`](#keyboardpresskey-options).

```js
await page.keyboard.type('Hello'); // Types instantly
await page.keyboard.type('World', {delay: 100}); // Types slower, like a user
```

> **NOTE** Modifier keys DO NOT effect `keyboard.type`. Holding down `Shift` will not type the text in upper case.

#### keyboard.up(key)
- `key` <[string]> Name of key to release, such as `ArrowLeft`. See [USKeyboardLayout] for a list of all key names.
- returns: <[Promise]>

Dispatches a `keyup` event.

### class: Mouse

The Mouse class operates in main-frame CSS pixels relative to the top-left corner of the viewport.

Every `page` object has its own Mouse, accessible with [`page.mouse`](#pagemouse).

```js
// Using ‘page.mouse’ to trace a 100x100 square.
await page.mouse.move(0, 0);
await page.mouse.down();
await page.mouse.move(0, 100);
await page.mouse.move(100, 100);
await page.mouse.move(100, 0);
await page.mouse.move(0, 0);
await page.mouse.up();
```

#### mouse.click(x, y[, options])
- `x` <[number]>
- `y` <[number]>
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `clickCount` <[number]> defaults to 1. See [UIEvent.detail].
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">>
  - `relativePoint` <[Object]> Optional relative point
    - `x` <[number]> x coordinate
    - `y` <[number]> y coordinate
- returns: <[Promise]>

Shortcut for [`mouse.move`](#mousemovex-y-options), [`mouse.down`](#mousedownoptions) and [`mouse.up`](#mouseupoptions).

#### mouse.dblclick(x, y[, options])
- `x` <[number]>
- `y` <[number]>
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">>
  - `relativePoint` <[Object]> Optional relative point
    - `x` <[number]> x coordinate
    - `y` <[number]> y coordinate
- returns: <[Promise]>

Shortcut for [`mouse.move`](#mousemovex-y-options), [`mouse.down`](#mousedownoptions), [`mouse.up`](#mouseupoptions), [`mouse.down`](#mousedownoptions) and [`mouse.up`](#mouseupoptions).

#### mouse.down([options])
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `clickCount` <[number]> defaults to 1. See [UIEvent.detail].
- returns: <[Promise]>

Dispatches a `mousedown` event.

#### mouse.move(x, y[, options])
- `x` <[number]>
- `y` <[number]>
- `options` <[Object]>
  - `steps` <[number]> defaults to 1. Sends intermediate `mousemove` events.
- returns: <[Promise]>

Dispatches a `mousemove` event.

#### mouse.tripleclick(x, y[, options])
- `x` <[number]>
- `y` <[number]>
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">>
  - `relativePoint` <[Object]> Optional relative point
    - `x` <[number]> x coordinate
    - `y` <[number]> y coordinate
- returns: <[Promise]>

Shortcut for [`mouse.move`](#mousemovex-y-options), [`mouse.down`](#mousedownoptions), [`mouse.up`](#mouseupoptions), [`mouse.down`](#mousedownoptions), [`mouse.up`](#mouseupoptions), [`mouse.down`](#mousedownoptions) and [`mouse.up`](#mouseupoptions).

#### mouse.up([options])
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `clickCount` <[number]> defaults to 1. See [UIEvent.detail].
- returns: <[Promise]>

Dispatches a `mouseup` event.

### class: PDF

#### pdf.generate([options])
- `options` <[Object]> Options object which might have the following properties:
  - `path` <[string]> The file path to save the PDF to. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd). If no path is provided, the PDF won't be saved to the disk.
  - `scale` <[number]> Scale of the webpage rendering. Defaults to `1`. Scale amount must be between 0.1 and 2.
  - `displayHeaderFooter` <[boolean]> Display header and footer. Defaults to `false`.
  - `headerTemplate` <[string]> HTML template for the print header. Should be valid HTML markup with following classes used to inject printing values into them:
    - `date` formatted print date
    - `title` document title
    - `url` document location
    - `pageNumber` current page number
    - `totalPages` total pages in the document
  - `footerTemplate` <[string]> HTML template for the print footer. Should use the same format as the `headerTemplate`.
  - `printBackground` <[boolean]> Print background graphics. Defaults to `false`.
  - `landscape` <[boolean]> Paper orientation. Defaults to `false`.
  - `pageRanges` <[string]> Paper ranges to print, e.g., '1-5, 8, 11-13'. Defaults to the empty string, which means print all pages.
  - `format` <[string]> Paper format. If set, takes priority over `width` or `height` options. Defaults to 'Letter'.
  - `width` <[string]|[number]> Paper width, accepts values labeled with units.
  - `height` <[string]|[number]> Paper height, accepts values labeled with units.
  - `margin` <[Object]> Paper margins, defaults to none.
    - `top` <[string]|[number]> Top margin, accepts values labeled with units.
    - `right` <[string]|[number]> Right margin, accepts values labeled with units.
    - `bottom` <[string]|[number]> Bottom margin, accepts values labeled with units.
    - `left` <[string]|[number]> Left margin, accepts values labeled with units.
  - `preferCSSPageSize` <[boolean]> Give any CSS `@page` size declared in the page priority over what is declared in `width` and `height` or `format` options. Defaults to `false`, which will scale the content to fit the paper size.
- returns: <[Promise]<[Buffer]>> Promise which resolves with PDF buffer.

> **NOTE** Generating a pdf is currently only supported in Chrome headless.

`pdf.generate()` generates a pdf of the page with `print` css media. To generate a pdf with `screen` media, call [page.emulateMedia({ type: 'screen' })](#pageemulatemedia) before calling `pdf.generate()`:

> **NOTE** By default, `pdf.generate()` generates a pdf with modified colors for printing. Use the [`-webkit-print-color-adjust`](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-print-color-adjust) property to force rendering of exact colors.

```js
// Generates a PDF with 'screen' media type.
await page.emulateMedia({ type: 'screen' });
await page.pdf.generate({path: 'page.pdf'});
```

The `width`, `height`, and `margin` options accept values labeled with units. Unlabeled values are treated as pixels.

A few examples:
- `page.pdf.generate({width: 100})` - prints with width set to 100 pixels
- `page.pdf.generate({width: '100px'})` - prints with width set to 100 pixels
- `page.pdf.generate({width: '10cm'})` - prints with width set to 10 centimeters.

All possible units are:
- `px` - pixel
- `in` - inch
- `cm` - centimeter
- `mm` - millimeter

The `format` options are:
- `Letter`: 8.5in x 11in
- `Legal`: 8.5in x 14in
- `Tabloid`: 11in x 17in
- `Ledger`: 17in x 11in
- `A0`: 33.1in x 46.8in
- `A1`: 23.4in x 33.1in
- `A2`: 16.54in x 23.4in
- `A3`: 11.7in x 16.54in
- `A4`: 8.27in x 11.7in
- `A5`: 5.83in x 8.27in
- `A6`: 4.13in x 5.83in

> **NOTE** `headerTemplate` and `footerTemplate` markup have the following limitations:
> 1. Script tags inside templates are not evaluated.
> 2. Page styles are not visible inside templates.

### class: Firefox

Firefox-specific features.

#### firefox.wsEndpoint()
- returns: <[string]> Browser websocket url.

Browser websocket endpoint which can be used as an argument to [playwright.connect](#playwrightconnectoptions).


### class: Chromium

Chromium-specific features including Tracing, service worker support, etc.
You can use [`chromium.startTracing`](#chromiumstarttracingpage-options) and [`chromium.stopTracing`](#chromiumstoptracing) to create a trace file which can be opened in Chrome DevTools or [timeline viewer](https://chromedevtools.github.io/timeline-viewer/).

```js
await browser.chromium.startTracing(page, {path: 'trace.json'});
await page.goto('https://www.google.com');
await browser.chromium.stopTracing();
```

#### event: 'targetchanged'
- <[Target]>

Emitted when the url of a target changes.

> **NOTE** This includes target changes in incognito browser contexts.


#### event: 'targetcreated'
- <[Target]>

Emitted when a target is created, for example when a new page is opened by [`window.open`](https://developer.mozilla.org/en-US/docs/Web/API/Window/open) or [`browser.newPage`](#browsernewpage).

> **NOTE** This includes target creations in incognito browser contexts.

#### event: 'targetdestroyed'
- <[Target]>

Emitted when a target is destroyed, for example when a page is closed.

> **NOTE** This includes target destructions in incognito browser contexts.

#### chromium.browserTarget()
- returns: <[Target]>

Returns browser target.

#### chromium.pageTarget(page)
- `page` <[Page]> Page to return target for.
- returns: <[Target]> a target given page was created from.

#### chromium.serviceWorker(target)
- `target` <[Target]> Target to treat as a service worker
- returns: <[Promise]<[Worker]>>

Attaches to the service worker target.

#### chromium.startTracing(page, [options])
- `page` <[Page]> Optional, if specified, tracing includes screenshots of the given page.
- `options` <[Object]>
  - `path` <[string]> A path to write the trace file to.
  - `screenshots` <[boolean]> captures screenshots in the trace.
  - `categories` <[Array]<[string]>> specify custom categories to use instead of default.
- returns: <[Promise]>

Only one trace can be active at a time per browser.

#### chromium.stopTracing()
- returns: <[Promise]<[Buffer]>> Promise which resolves to buffer with trace data.

#### chromium.targets(context)
- `context` <[BrowserContext]> Optional, if specified, only targets from this context are returned.
- returns: <[Array]<[Target]>>

An array of all active targets inside the Browser. In case of multiple browser contexts,
the method will return an array with all the targets in all browser contexts.

#### chromium.waitForTarget(predicate[, options])
- `predicate` <[function]\([Target]\):[boolean]> A function to be run for every target
- `options` <[Object]>
  - `timeout` <[number]> Maximum wait time in milliseconds. Pass `0` to disable the timeout. Defaults to 30 seconds.
- returns: <[Promise]<[Target]>> Promise which resolves to the first target found that matches the `predicate` function.

This searches for a target in all browser contexts.

An example of finding a target for a page opened via `window.open`:
```js
await page.evaluate(() => window.open('https://www.example.com/'));
const newWindowTarget = await browser.chromium.waitForTarget(target => target.url() === 'https://www.example.com/');
```

#### chromium.wsEndpoint()
- returns: <[string]> Browser websocket url.

Browser websocket endpoint which can be used as an argument to
[playwright.connect](#playwrightconnectoptions). The format is `ws://${host}:${port}/devtools/browser/<id>`

You can find the `webSocketDebuggerUrl` from `http://${host}:${port}/json/version`. Learn more about the [devtools protocol](https://chromedevtools.github.io/devtools-protocol) and the [browser endpoint](https://chromedevtools.github.io/devtools-protocol/#how-do-i-access-the-browser-target).

### class: Dialog

[Dialog] objects are dispatched by page via the ['dialog'](#event-dialog) event.

An example of using `Dialog` class:
```js
const playwright = require('playwright');

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  page.on('dialog', async dialog => {
    console.log(dialog.message());
    await dialog.dismiss();
    await browser.close();
  });
  page.evaluate(() => alert('1'));
})();
```

#### dialog.accept([promptText])
- `promptText` <[string]> A text to enter in prompt. Does not cause any effects if the dialog's `type` is not prompt.
- returns: <[Promise]> Promise which resolves when the dialog has been accepted.

#### dialog.defaultValue()
- returns: <[string]> If dialog is prompt, returns default prompt value. Otherwise, returns empty string.

#### dialog.dismiss()
- returns: <[Promise]> Promise which resolves when the dialog has been dismissed.

#### dialog.message()
- returns: <[string]> A message displayed in the dialog.

#### dialog.type()
- returns: <[string]> Dialog's type, can be one of `alert`, `beforeunload`, `confirm` or `prompt`.

### class: ConsoleMessage

[ConsoleMessage] objects are dispatched by page via the ['console'](#event-console) event.

#### consoleMessage.args()
- returns: <[Array]<[JSHandle]>>

#### consoleMessage.location()
- returns: <[Object]>
  - `url` <[string]> URL of the resource if known or `undefined` otherwise.
  - `lineNumber` <[number]> 0-based line number in the resource if known or `undefined` otherwise.
  - `columnNumber` <[number]> 0-based column number in the resource if known or `undefined` otherwise.

#### consoleMessage.text()
- returns: <[string]>

#### consoleMessage.type()
- returns: <[string]>

One of the following values: `'log'`, `'debug'`, `'info'`, `'error'`, `'warning'`, `'dir'`, `'dirxml'`, `'table'`, `'trace'`, `'clear'`, `'startGroup'`, `'startGroupCollapsed'`, `'endGroup'`, `'assert'`, `'profile'`, `'profileEnd'`, `'count'`, `'timeEnd'`.

### class: Frame

At every point of time, page exposes its current frame tree via the [page.mainFrame()](#pagemainframe) and [frame.childFrames()](#framechildframes) methods.

[Frame] object's lifecycle is controlled by three events, dispatched on the page object:
- ['frameattached'](#event-frameattached) - fired when the frame gets attached to the page. A Frame can be attached to the page only once.
- ['framenavigated'](#event-framenavigated) - fired when the frame commits navigation to a different URL.
- ['framedetached'](#event-framedetached) - fired when the frame gets detached from the page.  A Frame can be detached from the page only once.

An example of dumping frame tree:

```js
const playwright = require('playwright');

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  await page.goto('https://www.google.com/chrome/browser/canary.html');
  dumpFrameTree(page.mainFrame(), '');
  await browser.close();

  function dumpFrameTree(frame, indent) {
    console.log(indent + frame.url());
    for (const child of frame.childFrames()) {
      dumpFrameTree(child, indent + '  ');
    }
  }
})();
```

An example of getting text from an iframe element:

```js
  const frame = page.frames().find(frame => frame.name() === 'myframe');
  const text = await frame.$eval('.selector', element => element.textContent);
  console.log(text);
```

#### frame.$(selector)
- `selector` <[string]|[Selector]> A [selector] to query frame for
- returns: <[Promise]<?[ElementHandle]>> Promise which resolves to ElementHandle pointing to the frame element.

The method queries frame for the selector. If there's no such element within the frame, the method will resolve to `null`.

#### frame.$$(selector)
- `selector` <[string]|[Selector]> A [selector] to query frame for
- returns: <[Promise]<[Array]<[ElementHandle]>>> Promise which resolves to ElementHandles pointing to the frame elements.

The method runs `document.querySelectorAll` within the frame. If no elements match the selector, the return value resolves to `[]`.

#### frame.$$eval(selector, pageFunction[, ...args])
- `selector` <[string]|[Selector]> A [selector] to query frame for
- `pageFunction` <[function]\([Array]<[Element]>\)> Function to be evaluated in browser context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

This method runs `Array.from(document.querySelectorAll(selector))` within the frame and passes it as the first argument to `pageFunction`.

If `pageFunction` returns a [Promise], then `frame.$$eval` would wait for the promise to resolve and return its value.

Examples:
```js
const divsCounts = await frame.$$eval('div', divs => divs.length);
```

#### frame.$eval(selector, pageFunction[, ...args])
- `selector` <[string]|[Selector]> A [selector] to query frame for
- `pageFunction` <[function]\([Element]\)> Function to be evaluated in browser context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

This method runs `document.querySelector` within the frame and passes it as the first argument to `pageFunction`. If there's no element matching `selector`, the method throws an error.

If `pageFunction` returns a [Promise], then `frame.$eval` would wait for the promise to resolve and return its value.

Examples:
```js
const searchValue = await frame.$eval('#search', el => el.value);
const preloadHref = await frame.$eval('link[rel=preload]', el => el.href);
const html = await frame.$eval('.main-container', e => e.outerHTML);
```

#### frame.$x(expression)
- `expression` <[string]> Expression to [evaluate](https://developer.mozilla.org/en-US/docs/Web/API/Document/evaluate).
- returns: <[Promise]<[Array]<[ElementHandle]>>>

The method evaluates the XPath expression.

#### frame.addScriptTag(options)
- `options` <[Object]>
  - `url` <[string]> URL of a script to be added.
  - `path` <[string]> Path to the JavaScript file to be injected into frame. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd).
  - `content` <[string]> Raw JavaScript content to be injected into frame.
  - `type` <[string]> Script type. Use 'module' in order to load a Javascript ES6 module. See [script](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script) for more details.
- returns: <[Promise]<[ElementHandle]>> which resolves to the added tag when the script's onload fires or when the script content was injected into frame.

Adds a `<script>` tag into the page with the desired url or content.

#### frame.addStyleTag(options)
- `options` <[Object]>
  - `url` <[string]> URL of the `<link>` tag.
  - `path` <[string]> Path to the CSS file to be injected into frame. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd).
  - `content` <[string]> Raw CSS content to be injected into frame.
- returns: <[Promise]<[ElementHandle]>> which resolves to the added tag when the stylesheet's onload fires or when the CSS content was injected into frame.

Adds a `<link rel="stylesheet">` tag into the page with the desired url or a `<style type="text/css">` tag with the content.

#### frame.childFrames()
- returns: <[Array]<[Frame]>>

#### frame.click(selector[, options])
- `selector` <[string]|[Selector]> A [selector] to search for element to click. If there are multiple elements satisfying the selector, the first will be clicked.
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `clickCount` <[number]> defaults to 1. See [UIEvent.detail].
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `relativePoint` <[Object]> A point to click relative to the top-left corner of element padding box. If not specified, clicks to some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully clicked. The Promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector`, scrolls it into view if needed, and then uses [page.mouse](#pagemouse) to click in the center of the element.
If there's no element matching `selector`, the method throws an error.

Bear in mind that if `click()` triggers a navigation event and there's a separate `page.waitForNavigation()` promise to be resolved, you may end up with a race condition that yields unexpected results. The correct pattern for click and wait for navigation is the following:

```javascript
const [response] = await Promise.all([
  page.waitForNavigation(waitOptions),
  frame.click(selector, clickOptions),
]);
```

#### frame.content()
- returns: <[Promise]<[string]>>

Gets the full HTML contents of the frame, including the doctype.

#### frame.dblclick(selector[, options])
- `selector` <[string]|[Selector]> A [selector] to search for element to double click. If there are multiple elements satisfying the selector, the first will be double clicked.
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `relativePoint` <[Object]> A point to double click relative to the top-left corner of element padding box. If not specified, double clicks to some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the double click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully double clicked. The Promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector`, scrolls it into view if needed, and then uses [page.mouse](#pagemouse) to double click in the center of the element.
If there's no element matching `selector`, the method throws an error.

Bear in mind that if the first click of the `dblclick()` triggers a navigation event, there will be an exception.

> **NOTE** `frame.dblclick()` dispatches two `click` events and a single `dblclick` event.

#### frame.evaluate(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated in browser context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to  `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

If the function passed to the `frame.evaluate` returns a [Promise], then `frame.evaluate` would wait for the promise to resolve and return its value.

If the function passed to the `frame.evaluate` returns a non-[Serializable] value, then `frame.evaluate` resolves to `undefined`. DevTools Protocol also supports transferring some additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`, and bigint literals.

```js
const result = await frame.evaluate(() => {
  return Promise.resolve(8 * 7);
});
console.log(result); // prints "56"
```

A string can also be passed in instead of a function.

```js
console.log(await frame.evaluate('1 + 2')); // prints "3"
```

[ElementHandle] instances can be passed as arguments to the `frame.evaluate`:
```js
const bodyHandle = await frame.$('body');
const html = await frame.evaluate(body => body.innerHTML, bodyHandle);
await bodyHandle.dispose();
```

#### frame.evaluateHandle(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated in the page context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves to the return value of `pageFunction` as in-page object (JSHandle)

The only difference between `frame.evaluate` and `frame.evaluateHandle` is that `frame.evaluateHandle` returns in-page object (JSHandle).

If the function, passed to the `frame.evaluateHandle`, returns a [Promise], then `frame.evaluateHandle` would wait for the promise to resolve and return its value.

```js
const aWindowHandle = await frame.evaluateHandle(() => Promise.resolve(window));
aWindowHandle; // Handle for the window object.
```

A string can also be passed in instead of a function.

```js
const aHandle = await frame.evaluateHandle('document'); // Handle for the 'document'.
```

[JSHandle] instances can be passed as arguments to the `frame.evaluateHandle`:
```js
const aHandle = await frame.evaluateHandle(() => document.body);
const resultHandle = await frame.evaluateHandle(body => body.innerHTML, aHandle);
console.log(await resultHandle.jsonValue());
await resultHandle.dispose();
```


#### frame.executionContext()
- returns: <[Promise]<[ExecutionContext]>>

Returns promise that resolves to the frame's default execution context.

#### frame.fill(selector, value)
- `selector` <[string]|[Selector]> A [selector] to query page for.
- `value` <[string]> Value to fill for the `<input>`, `<textarea>` or `[contenteditable]` element.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully filled. The promise will be rejected if there is no element matching `selector`.

This method focuses the element and triggers an `input` event after filling.
If there's no text `<input>`, `<textarea>` or `[contenteditable]` element matching `selector`, the method throws an error.

#### frame.focus(selector)
- `selector` <[string]|[Selector]> A [selector] of an element to focus. If there are multiple elements satisfying the selector, the first will be focused.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully focused. The promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector` and focuses it.
If there's no element matching `selector`, the method throws an error.

#### frame.goto(url[, options])
- `url` <[string]> URL to navigate frame to. The url should include scheme, e.g. `https://`.
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <[string]|[Array]<[string]>> When to consider navigation succeeded, defaults to `load`. Given an array of event strings, navigation is considered to be successful after all events have been fired. Events can be either:
    - `load` - consider navigation to be finished when the `load` event is fired.
    - `domcontentloaded` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `networkidle0` - consider navigation to be finished when there are no more than 0 network connections for at least `500` ms.
    - `networkidle2` - consider navigation to be finished when there are no more than 2 network connections for at least `500` ms.
  - `referer` <[string]> Referer header value. If provided it will take preference over the referer header value set by [page.setExtraHTTPHeaders()](#pagesetextrahttpheadersheaders).
- returns: <[Promise]<?[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect.

`frame.goto` will throw an error if:
- there's an SSL error (e.g. in case of self-signed certificates).
- target URL is invalid.
- the `timeout` is exceeded during navigation.
- the remote server does not respond or is unreachable.
- the main resource failed to load.

`frame.goto` will not throw an error when any valid HTTP status code is returned by the remote server, including 404 "Not Found" and 500 "Internal Server Error".  The status code for such responses can be retrieved by calling [response.status()](#responsestatus).

> **NOTE** `frame.goto` either throws an error or returns a main resource response. The only exceptions are navigation to `about:blank` or navigation to the same URL with a different hash, which would succeed and return `null`.

> **NOTE** Headless mode doesn't support navigation to a PDF document. See the [upstream issue](https://bugs.chromium.org/p/chromium/issues/detail?id=761295).


#### frame.hover(selector[, options])
- `selector` <[string]|[Selector]> A [selector] to search for element to hover. If there are multiple elements satisfying the selector, the first will be hovered.
- `options` <[Object]>
  - `relativePoint` <[Object]> A point to hover relative to the top-left corner of element padding box. If not specified, hovers over some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the hover, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully hovered. Promise gets rejected if there's no element matching `selector`.

This method fetches an element with `selector`, scrolls it into view if needed, and then uses [page.mouse](#pagemouse) to hover over the center of the element.
If there's no element matching `selector`, the method throws an error.

#### frame.isDetached()
- returns: <[boolean]>

Returns `true` if the frame has been detached, or `false` otherwise.

#### frame.name()
- returns: <[string]>

Returns frame's name attribute as specified in the tag.

If the name is empty, returns the id attribute instead.

> **NOTE** This value is calculated once when the frame is created, and will not update if the attribute is changed later.

#### frame.parentFrame()
- returns: <?[Frame]> Parent frame, if any. Detached frames and main frames return `null`.

#### frame.select(selector, ...values)
- `selector` <[string]|[Selector]> A [selector] to query frame for.
- `...values` <...[string]|[ElementHandle]|[Object]> Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the first option matching one of the passed options is selected. String values are equivalent to `{value:'string'}`. Option is considered matching if all specified properties match.
  - `value` <[string]> Matches by `option.value`.
  - `label` <[string]> Matches by `option.label`.
  - `index` <[number]> Matches by the index.
- returns: <[Promise]<[Array]<[string]>>> An array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected.
If there's no `<select>` element matching `selector`, the method throws an error.

```js
// single selection matching the value
frame.select('select#colors', 'blue');

// single selection matching both the value and the label
frame.select('select#colors', { value: 'blue', label: 'Blue' });

// multiple selection
frame.select('select#colors', 'red', 'green', 'blue');

// multiple selection matching blue, red and second option
frame.select('select#colors', { value: 'blue' }, { index: 2 }, 'red');
```

#### frame.setContent(html[, options])
- `html` <[string]> HTML markup to assign to the page.
- `options` <[Object]> Parameters which might have the following properties:
  - `timeout` <[number]> Maximum time in milliseconds for resources to load, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <[string]|[Array]<[string]>> When to consider setting markup succeeded, defaults to `load`. Given an array of event strings, setting content is considered to be successful after all events have been fired. Events can be either:
    - `load` - consider setting content to be finished when the `load` event is fired.
    - `domcontentloaded` - consider setting content to be finished when the `DOMContentLoaded` event is fired.
    - `networkidle0` - consider setting content to be finished when there are no more than 0 network connections for at least `500` ms.
    - `networkidle2` - consider setting content to be finished when there are no more than 2 network connections for at least `500` ms.
- returns: <[Promise]>

#### frame.title()
- returns: <[Promise]<[string]>> The page's title.

#### frame.tripleclick(selector[, options])
- `selector` <[string]|[Selector]> A [selector] to search for element to triple click. If there are multiple elements satisfying the selector, the first will be triple clicked.
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `relativePoint` <[Object]> A point to triple click relative to the top-left corner of element padding box. If not specified, triple clicks to some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the triple click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully triple clicked. The Promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector`, scrolls it into view if needed, and then uses [page.mouse](#pagemouse) to triple click in the center of the element.
If there's no element matching `selector`, the method throws an error.

Bear in mind that if the first or second click of the `tripleclick()` triggers a navigation event, there will be an exception.

> **NOTE** `frame.tripleclick()` dispatches three `click` events and a single `dblclick` event.

#### frame.type(selector, text[, options])
- `selector` <[string]|[Selector]> A [selector] of an element to type into. If there are multiple elements satisfying the selector, the first will be used.
- `text` <[string]> A text to type into a focused element.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between key presses in milliseconds. Defaults to 0.
- returns: <[Promise]>

Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.

To press a special key, like `Control` or `ArrowDown`, use [`keyboard.press`](#keyboardpresskey-options).

```js
await frame.type('#mytextarea', 'Hello'); // Types instantly
await frame.type('#mytextarea', 'World', {delay: 100}); // Types slower, like a user
```

#### frame.url()
- returns: <[string]>

Returns frame's url.

#### frame.waitFor(selectorOrFunctionOrTimeout[, options[, ...args]])
- `selectorOrFunctionOrTimeout` <[string]|[number]|[function]> A [selector], predicate or timeout to wait for
- `options` <[Object]> Optional waiting parameters
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to  `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves to a JSHandle of the success value

This method behaves differently with respect to the type of the first parameter:
- if `selectorOrFunctionOrTimeout` is a `string`, then the first argument is treated as a [selector] or [xpath], depending on whether or not it starts with '//', and the method is a shortcut for
  [frame.waitForSelector](#framewaitforselectorselector-options) or [frame.waitForXPath](#framewaitforxpathxpath-options)
- if `selectorOrFunctionOrTimeout` is a `function`, then the first argument is treated as a predicate to wait for and the method is a shortcut for [frame.waitForFunction()](#framewaitforfunctionpagefunction-options-args).
- if `selectorOrFunctionOrTimeout` is a `number`, then the first argument is treated as a timeout in milliseconds and the method returns a promise which resolves after the timeout
- otherwise, an exception is thrown

```js
// wait for selector
await page.waitFor('.foo');
// wait for 1 second
await page.waitFor(1000);
// wait for predicate
await page.waitFor(() => !!document.querySelector('.foo'));
```

To pass arguments from node.js to the predicate of `page.waitFor` function:

```js
const selector = '.foo';
await page.waitFor(selector => !!document.querySelector(selector), {}, selector);
```

#### frame.waitForFunction(pageFunction[, options[, ...args]])
- `pageFunction` <[function]|[string]> Function to be evaluated in browser context
- `options` <[Object]> Optional waiting parameters
  - `polling` <[number]|"raf"|"mutation"> An interval at which the `pageFunction` is executed, defaults to `raf`. If `polling` is a number, then it is treated as an interval in milliseconds at which the function would be executed. If `polling` is a string, then it can be one of the following values:
    - `raf` - to constantly execute `pageFunction` in `requestAnimationFrame` callback. This is the tightest polling mode which is suitable to observe styling changes.
    - `mutation` - to execute `pageFunction` on every DOM mutation.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) method.
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to  `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves when the `pageFunction` returns a truthy value. It resolves to a JSHandle of the truthy value.

The `waitForFunction` can be used to observe viewport size change:
```js
const playwright = require('playwright');

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  const watchDog = page.mainFrame().waitForFunction('window.innerWidth < 100');
  page.setViewport({width: 50, height: 50});
  await watchDog;
  await browser.close();
})();
```

To pass arguments from node.js to the predicate of `page.waitForFunction` function:

```js
const selector = '.foo';
await page.waitForFunction(selector => !!document.querySelector(selector), {}, selector);
```

#### frame.waitForNavigation([options])
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <[string]|[Array]<[string]>> When to consider navigation succeeded, defaults to `load`. Given an array of event strings, navigation is considered to be successful after all events have been fired. Events can be either:
    - `load` - consider navigation to be finished when the `load` event is fired.
    - `domcontentloaded` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `networkidle0` - consider navigation to be finished when there are no more than 0 network connections for at least `500` ms.
    - `networkidle2` - consider navigation to be finished when there are no more than 2 network connections for at least `500` ms.
- returns: <[Promise]<?[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. In case of navigation to a different anchor or navigation due to History API usage, the navigation will resolve with `null`.

This resolves when the frame navigates to a new URL. It is useful for when you run code
which will indirectly cause the frame to navigate. Consider this example:

```js
const [response] = await Promise.all([
  frame.waitForNavigation(), // The navigation promise resolves after navigation has finished
  frame.click('a.my-link'), // Clicking the link will indirectly cause a navigation
]);
```

**NOTE** Usage of the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) to change the URL is considered a navigation.


#### frame.waitForSelector(selector[, options])
- `selector` <[string]|[Selector]> A [selector] of an element to wait for
- `options` <[Object]> Optional waiting parameters
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) method.
- returns: <[Promise]<?[ElementHandle]>> Promise which resolves when element specified by selector string is added to DOM. Resolves to `null` if waiting for `hidden: true` and selector is not found in DOM.

Wait for the `selector` to appear in page. If at the moment of calling
the method the `selector` already exists, the method will return
immediately. If the selector doesn't appear after the `timeout` milliseconds of waiting, the function will throw.

This method works across navigations:
```js
const playwright = require('playwright');

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  let currentURL;
  page.mainFrame()
    .waitForSelector('img')
    .then(() => console.log('First URL with image: ' + currentURL));
  for (currentURL of ['https://example.com', 'https://google.com', 'https://bbc.com']) {
    await page.goto(currentURL);
  }
  await browser.close();
})();
```

#### frame.waitForXPath(xpath[, options])
- `xpath` <[string]> A [xpath] of an element to wait for
- `options` <[Object]> Optional waiting parameters
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) method.
- returns: <[Promise]<?[ElementHandle]>> Promise which resolves when element specified by xpath string is added to DOM. Resolves to `null` if waiting for `hidden: true` and xpath is not found in DOM.

Wait for the `xpath` to appear in page. If at the moment of calling
the method the `xpath` already exists, the method will return
immediately. If the xpath doesn't appear after the `timeout` milliseconds of waiting, the function will throw.

This method works across navigations:
```js
const playwright = require('playwright');

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  let currentURL;
  page.mainFrame()
    .waitForXPath('//img')
    .then(() => console.log('First URL with image: ' + currentURL));
  for (currentURL of ['https://example.com', 'https://google.com', 'https://bbc.com']) {
    await page.goto(currentURL);
  }
  await browser.close();
})();
```

### class: ExecutionContext

The class represents a context for JavaScript execution. A [Page] might have many execution contexts:
- each [frame](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe) has "default" execution context that is
  always created after frame is attached to DOM. This context is returned by the [`frame.executionContext()`](#frameexecutioncontext) method.
- [Extensions](https://developer.chrome.com/extensions)'s content scripts create additional execution contexts.

Besides pages, execution contexts can be found in [workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API).

#### executionContext.evaluate(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated in `executionContext`
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

If the function passed to the `executionContext.evaluate` returns a [Promise], then `executionContext.evaluate` would wait for the promise to resolve and return its value.

If the function passed to the `executionContext.evaluate` returns a non-[Serializable] value, then `executionContext.evaluate` resolves to `undefined`. DevTools Protocol also supports transferring some additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`, and bigint literals.

```js
const executionContext = await page.mainFrame().executionContext();
const result = await executionContext.evaluate(() => Promise.resolve(8 * 7));
console.log(result); // prints "56"
```

A string can also be passed in instead of a function.

```js
console.log(await executionContext.evaluate('1 + 2')); // prints "3"
```

[JSHandle] instances can be passed as arguments to the `executionContext.evaluate`:
```js
const oneHandle = await executionContext.evaluateHandle(() => 1);
const twoHandle = await executionContext.evaluateHandle(() => 2);
const result = await executionContext.evaluate((a, b) => a + b, oneHandle, twoHandle);
await oneHandle.dispose();
await twoHandle.dispose();
console.log(result); // prints '3'.
```

#### executionContext.evaluateHandle(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated in the `executionContext`
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves to the return value of `pageFunction` as in-page object (JSHandle)

The only difference between `executionContext.evaluate` and `executionContext.evaluateHandle` is that `executionContext.evaluateHandle` returns in-page object (JSHandle).

If the function passed to the `executionContext.evaluateHandle` returns a [Promise], then `executionContext.evaluateHandle` would wait for the promise to resolve and return its value.

```js
const context = await page.mainFrame().executionContext();
const aHandle = await context.evaluateHandle(() => Promise.resolve(self));
aHandle; // Handle for the global object.
```

A string can also be passed in instead of a function.

```js
const aHandle = await context.evaluateHandle('1 + 2'); // Handle for the '3' object.
```

[JSHandle] instances can be passed as arguments to the `executionContext.evaluateHandle`:
```js
const aHandle = await context.evaluateHandle(() => document.body);
const resultHandle = await context.evaluateHandle(body => body.innerHTML, aHandle);
console.log(await resultHandle.jsonValue()); // prints body's innerHTML
await aHandle.dispose();
await resultHandle.dispose();
```

#### executionContext.frame()
- returns: <?[Frame]> Frame associated with this execution context.

> **NOTE** Not every execution context is associated with a frame. For example, workers and extensions have execution contexts that are not associated with frames.

### class: Interception

#### interception.abort(request, [errorCode])
- `request` <[Request]>
- `errorCode` <[string]> Optional error code. Defaults to `failed`, could be
  one of the following:
  - `aborted` - An operation was aborted (due to user action)
  - `accessdenied` - Permission to access a resource, other than the network, was denied
  - `addressunreachable` - The IP address is unreachable. This usually means
    that there is no route to the specified host or network.
  - `blockedbyclient` - The client chose to block the request.
  - `blockedbyresponse` - The request failed because the response was delivered along with requirements which are not met ('X-Frame-Options' and 'Content-Security-Policy' ancestor checks, for instance).
  - `connectionaborted` - A connection timed out as a result of not receiving an ACK for data sent.
  - `connectionclosed` - A connection was closed (corresponding to a TCP FIN).
  - `connectionfailed` - A connection attempt failed.
  - `connectionrefused` - A connection attempt was refused.
  - `connectionreset` - A connection was reset (corresponding to a TCP RST).
  - `internetdisconnected` - The Internet connection has been lost.
  - `namenotresolved` - The host name could not be resolved.
  - `timedout` - An operation timed out.
  - `failed` - A generic failure occurred.
- returns: <[Promise]>

Aborts request. To use this, request interception should be enabled with `page.interception.enable()`.
Exception is immediately thrown if the request interception is not enabled.

#### interception.authenticate(credentials)
- `credentials` <?[Object]>
  - `username` <[string]>
  - `password` <[string]>
- returns: <[Promise]>

Provide credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).

To disable authentication, pass `null`.

#### interception.continue(request, [overrides])
- `request` <[Request]>
- `overrides` <[Object]> Optional request overwrites, which can be one of the following:
  - `url` <[string]> If set, the request url will be changed. This is not a redirect. The request will be silently forwarded to the new url. For example, the address bar will show the original url.
  - `method` <[string]> If set changes the request method (e.g. `GET` or `POST`)
  - `postData` <[string]> If set changes the post data of request
  - `headers` <[Object]> If set changes the request HTTP headers. Header values will be converted to a string.
- returns: <[Promise]>

Continues request with optional request overrides. To use this, request interception should be enabled with `page.interception.enable()`.
Exception is immediately thrown if the request interception is not enabled.

```js
await page.interception.enable();
page.on('request', request => {
  // Override headers
  const headers = Object.assign({}, request.headers(), {
    foo: 'bar', // set "foo" header
    origin: undefined, // remove "origin" header
  });
  page.interception.continue(request, {headers});
});
```

#### interception.disable()
- returns: <[Promise]>

Disables network request interception.

#### interception.enable()
- returns: <[Promise]>

Once request interception is enabled, every request will stall unless it's continued, responded or aborted.
An example of a naïve request interceptor that aborts all image requests:

```js
const playwright = require('playwright');

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  await page.interception.enable();
  page.on('request', interceptedRequest => {
    if (interceptedRequest.url().endsWith('.png') || interceptedRequest.url().endsWith('.jpg'))
      page.interception.abort(interceptedRequest);
    else
      page.interception.continue(interceptedRequest);
  });
  await page.goto('https://example.com');
  await browser.close();
})();
```

> **NOTE** Enabling request interception disables page caching.

#### interception.fulfill(request, response)
- `request` <[Request]>
- `response` <[Object]> Response that will fulfill this request
  - `status` <[number]> Response status code, defaults to `200`.
  - `headers` <[Object]> Optional response headers. Header values will be converted to a string.
  - `contentType` <[string]> If set, equals to setting `Content-Type` response header
  - `body` <[string]|[Buffer]> Optional response body
- returns: <[Promise]>

Fulfills request with given response. To use this, request interception should
be enabled with `page.interception.enable()`. Exception is thrown if
request interception is not enabled.

An example of fulfilling all requests with 404 responses:

```js
await page.interception.enable();
page.on('request', request => {
  page.interception.respond(request, {
    status: 404,
    contentType: 'text/plain',
    body: 'Not Found!'
  });
});
```

> **NOTE** Mocking responses for dataURL requests is not supported.
> Calling `request.respond` for a dataURL request is a noop.

#### interception.setOfflineMode(enabled)
- `enabled` <[boolean]> When `true`, enables offline mode for the page.
- returns: <[Promise]>

### class: JSHandle

JSHandle represents an in-page JavaScript object. JSHandles can be created with the [page.evaluateHandle](#pageevaluatehandlepagefunction-args) method.

```js
const windowHandle = await page.evaluateHandle(() => window);
// ...
```

JSHandle prevents the referenced JavaScript object being garbage collected unless the handle is [disposed](#jshandledispose). JSHandles are auto-disposed when their origin frame gets navigated or the parent context gets destroyed.

JSHandle instances can be used as arguments in [`page.$eval()`](#pageevalselector-pagefunction-args), [`page.evaluate()`](#pageevaluatepagefunction-args) and [`page.evaluateHandle`](#pageevaluatehandlepagefunction-args) methods.

#### jsHandle.asElement()
- returns: <?[ElementHandle]>

Returns either `null` or the object handle itself, if the object handle is an instance of [ElementHandle].

#### jsHandle.dispose()
- returns: <[Promise]> Promise which resolves when the object handle is successfully disposed.

The `jsHandle.dispose` method stops referencing the element handle.

#### jsHandle.evaluate(pageFunction[, ...args])
- `pageFunction` <[function]\([Object]\)> Function to be evaluated in browser context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

This method passes this handle as the first argument to `pageFunction`.

If `pageFunction` returns a [Promise], then `handle.evaluate` would wait for the promise to resolve and return its value.

Examples:
```js
const tweetHandle = await page.$('.tweet .retweets');
expect(await tweetHandle.evaluate(node => node.innerText)).toBe('10');
```

#### jsHandle.evaluateHandle(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves to the return value of `pageFunction` as in-page object (JSHandle)

This method passes this handle as the first argument to `pageFunction`.

The only difference between `jsHandle.evaluate` and `jsHandle.evaluateHandle` is that `executionContext.evaluateHandle` returns in-page object (JSHandle).

If the function passed to the `jsHandle.evaluateHandle` returns a [Promise], then `jsHandle.evaluateHandle` would wait for the promise to resolve and return its value.

See [Page.evaluateHandle](#pageevaluatehandlepagefunction-args) for more details.

#### jsHandle.executionContext()
- returns: <[ExecutionContext]>

Returns execution context the handle belongs to.

#### jsHandle.getProperties()
- returns: <[Promise]<[Map]<[string], [JSHandle]>>>

The method returns a map with property names as keys and JSHandle instances for the property values.

```js
const handle = await page.evaluateHandle(() => ({window, document}));
const properties = await handle.getProperties();
const windowHandle = properties.get('window');
const documentHandle = properties.get('document');
await handle.dispose();
```

#### jsHandle.getProperty(propertyName)
- `propertyName` <[string]> property to get
- returns: <[Promise]<[JSHandle]>>

Fetches a single property from the referenced object.

#### jsHandle.jsonValue()
- returns: <[Promise]<[Object]>>

Returns a JSON representation of the object. If the object has a
[`toJSON`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#toJSON()_behavior)
function, it **will not be called**.

> **NOTE** The method will return an empty JSON object if the referenced object is not stringifiable. It will throw an error if the object has circular references.

### class: ElementHandle
* extends: [JSHandle]

ElementHandle represents an in-page DOM element. ElementHandles can be created with the [page.$](#pageselector) method.

```js
const playwright = require('playwright');

(async () => {
  const browser = await playwright.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  const hrefElement = await page.$('a');
  await hrefElement.click();
  // ...
})();
```

ElementHandle prevents DOM element from garbage collection unless the handle is [disposed](#elementhandledispose). ElementHandles are auto-disposed when their origin frame gets navigated.

ElementHandle instances can be used as arguments in [`page.$eval()`](#pageevalselector-pagefunction-args) and [`page.evaluate()`](#pageevaluatepagefunction-args) methods.

#### elementHandle.$(selector)
- `selector` <[string]|[Selector]> A [selector] to query element for
- returns: <[Promise]<?[ElementHandle]>>

The method runs `element.querySelector` within the page. If no element matches the selector, the return value resolves to `null`.

#### elementHandle.$$(selector)
- `selector` <[string]|[Selector]> A [selector] to query element for
- returns: <[Promise]<[Array]<[ElementHandle]>>>

The method runs `element.querySelectorAll` within the page. If no elements match the selector, the return value resolves to `[]`.

#### elementHandle.$$eval(selector, pageFunction[, ...args])
- `selector` <[string]|[Selector]> A [selector] to query page for
- `pageFunction` <[function]\([Array]<[Element]>\)> Function to be evaluated in browser context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

This method runs `document.querySelectorAll` within the element and passes it as the first argument to `pageFunction`. If there's no element matching `selector`, the method throws an error.

If `pageFunction` returns a [Promise], then `frame.$$eval` would wait for the promise to resolve and return its value.

Examples:
```html
<div class="feed">
  <div class="tweet">Hello!</div>
  <div class="tweet">Hi!</div>
</div>
```
```js
const feedHandle = await page.$('.feed');
expect(await feedHandle.$$eval('.tweet', nodes => nodes.map(n => n.innerText))).toEqual(['Hello!', 'Hi!']);
```

#### elementHandle.$eval(selector, pageFunction[, ...args])
- `selector` <[string]|[Selector]> A [selector] to query page for
- `pageFunction` <[function]\([Element]\)> Function to be evaluated in browser context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

This method runs `document.querySelector` within the element and passes it as the first argument to `pageFunction`. If there's no element matching `selector`, the method throws an error.

If `pageFunction` returns a [Promise], then `frame.$eval` would wait for the promise to resolve and return its value.

Examples:
```js
const tweetHandle = await page.$('.tweet');
expect(await tweetHandle.$eval('.like', node => node.innerText)).toBe('100');
expect(await tweetHandle.$eval('.retweets', node => node.innerText)).toBe('10');
```

#### elementHandle.$x(expression)
- `expression` <[string]> Expression to [evaluate](https://developer.mozilla.org/en-US/docs/Web/API/Document/evaluate).
- returns: <[Promise]<[Array]<[ElementHandle]>>>

The method evaluates the XPath expression relative to the elementHandle. If there are no such elements, the method will resolve to an empty array.

#### elementHandle.asElement()
- returns: <[ElementHandle]>

#### elementHandle.boundingBox()
- returns: <[Promise]<?[Object]>>
  - x <[number]> the x coordinate of the element in pixels.
  - y <[number]> the y coordinate of the element in pixels.
  - width <[number]> the width of the element in pixels.
  - height <[number]> the height of the element in pixels.

This method returns the bounding box of the element (relative to the main frame), or `null` if the element is not visible.

#### elementHandle.click([options])
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `clickCount` <[number]> defaults to 1. See [UIEvent.detail].
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `relativePoint` <[Object]> A point to click relative to the top-left corner of element padding box. If not specified, clicks to some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
- returns: <[Promise]> Promise which resolves when the element is successfully clicked. Promise gets rejected if the element is detached from DOM.

This method scrolls element into view if needed, and then uses [page.mouse](#pagemouse) to click in the center of the element.
If the element is detached from DOM, the method throws an error.

#### elementHandle.contentFrame()
- returns: <[Promise]<?[Frame]>> Resolves to the content frame for element handles referencing iframe nodes, or null otherwise

#### elementHandle.dblclick([options])
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `relativePoint` <[Object]> A point to double click relative to the top-left corner of element padding box. If not specified, double clicks to some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the double click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
- returns: <[Promise]> Promise which resolves when the element is successfully double clicked. Promise gets rejected if the element is detached from DOM.

This method scrolls element into view if needed, and then uses [page.mouse](#pagemouse) to click in the center of the element.
If the element is detached from DOM, the method throws an error.

Bear in mind that if the first click of the `dblclick()` triggers a navigation event, there will be an exception.

> **NOTE** `elementHandle.dblclick()` dispatches two `click` events and a single `dblclick` event.

#### elementHandle.dispose()
- returns: <[Promise]> Promise which resolves when the element handle is successfully disposed.

The `elementHandle.dispose` method stops referencing the element handle.

#### elementHandle.evaluate(pageFunction[, ...args])
- `pageFunction` <[function]\([Object]\)> Function to be evaluated in browser context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

This method passes this handle as the first argument to `pageFunction`.

If `pageFunction` returns a [Promise], then `handle.evaluate` would wait for the promise to resolve and return its value.

Examples:
```js
const tweetHandle = await page.$('.tweet .retweets');
expect(await tweetHandle.evaluate(node => node.innerText)).toBe('10');
```

#### elementHandle.evaluateHandle(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves to the return value of `pageFunction` as in-page object (JSHandle)

This method passes this handle as the first argument to `pageFunction`.

The only difference between `evaluateHandle.evaluate` and `evaluateHandle.evaluateHandle` is that `executionContext.evaluateHandle` returns in-page object (JSHandle).

If the function passed to the `evaluateHandle.evaluateHandle` returns a [Promise], then `evaluateHandle.evaluateHandle` would wait for the promise to resolve and return its value.

See [Page.evaluateHandle](#pageevaluatehandlepagefunction-args) for more details.

#### elementHandle.executionContext()
- returns: <[ExecutionContext]>

#### elementHandle.fill(value)
- `value` <[string]> Value to set for the `<input>`, `<textarea>` or `[contenteditable]` element.
- returns: <[Promise]> Promise which resolves when the element is successfully filled.

This method focuses the element and triggers an `input` event after filling.
If element is not a text `<input>`, `<textarea>` or `[contenteditable]` element, the method throws an error.

#### elementHandle.focus()
- returns: <[Promise]>

Calls [focus](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus) on the element.

#### elementHandle.getProperties()
- returns: <[Promise]<[Map]<[string], [JSHandle]>>>

The method returns a map with property names as keys and JSHandle instances for the property values.

```js
const listHandle = await page.evaluateHandle(() => document.body.children);
const properties = await listHandle.getProperties();
const children = [];
for (const property of properties.values()) {
  const element = property.asElement();
  if (element)
    children.push(element);
}
children; // holds elementHandles to all children of document.body
```

#### elementHandle.getProperty(propertyName)
- `propertyName` <[string]> property to get
- returns: <[Promise]<[JSHandle]>>

Fetches a single property from the objectHandle.

#### elementHandle.hover([options])
- `options` <[Object]>
  - `relativePoint` <[Object]> A point to hover relative to the top-left corner of element padding box. If not specified, hovers over some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the hover, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
- returns: <[Promise]> Promise which resolves when the element is successfully hovered.

This method scrolls element into view if needed, and then uses [page.mouse](#pagemouse) to hover over the center of the element.
If the element is detached from DOM, the method throws an error.

#### elementHandle.isIntersectingViewport()
- returns: <[Promise]<[boolean]>> Resolves to true if the element is visible in the current viewport.

#### elementHandle.jsonValue()
- returns: <[Promise]<[Object]>>

Returns a JSON representation of the object. The JSON is generated by running [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) on the object in page and consequent [`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse) in playwright.

> **NOTE** The method will throw if the referenced object is not stringifiable.

#### elementHandle.press(key[, options])
- `key` <[string]> Name of key to press, such as `ArrowLeft`. See [USKeyboardLayout] for a list of all key names.
- `options` <[Object]>
  - `text` <[string]> If specified, generates an input event with this text.
  - `delay` <[number]> Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.
- returns: <[Promise]>

Focuses the element, and then uses [`keyboard.down`](#keyboarddownkey-options) and [`keyboard.up`](#keyboardupkey).

If `key` is a single character and no modifier keys besides `Shift` are being held down, a `keypress`/`input` event will also be generated. The `text` option can be specified to force an input event to be generated.

> **NOTE** Modifier keys DO effect `elementHandle.press`. Holding down `Shift` will type the text in upper case.

#### elementHandle.screenshot([options])
- `options` <[Object]> Screenshot options.
  - `path` <[string]> The file path to save the image to. The screenshot type will be inferred from file extension. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd). If no path is provided, the image won't be saved to the disk.
  - `type` <"png"|"jpeg"> Specify screenshot type, defaults to 'png'.
  - `quality` <[number]> The quality of the image, between 0-100. Not applicable to `png` images.
  - `omitBackground` <[boolean]> Hides default white background and allows capturing screenshots with transparency. Defaults to `false`.
- returns: <[Promise]<|[Buffer]>> Promise which resolves to buffer with the captured screenshot.

This method scrolls element into view if needed, and then uses [page.screenshot](#pagescreenshotoptions) to take a screenshot of the element.
If the element is detached from DOM, the method throws an error.

#### elementHandle.select(...values)
- `...values` <...[string]|[ElementHandle]|[Object]> Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the first option matching one of the passed options is selected. String values are equivalent to `{value:'string'}`. Option is considered matching if all specified properties match.
  - `value` <[string]> Matches by `option.value`.
  - `label` <[string]> Matches by `option.label`.
  - `index` <[number]> Matches by the index.
- returns: <[Promise]<[Array]<[string]>>> An array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected.
If element is not a `<select>` element, the method throws an error.

```js
// single selection matching the value
handle.select('blue');

// single selection matching both the value and the label
handle.select({ value: 'blue', label: 'Blue' });

// multiple selection
handle.select('red', 'green', 'blue');

// multiple selection for blue, red and second option
handle.select({ value: 'blue' }, { index: 2 }, 'red');
```

#### elementHandle.setInputFiles(...files)
- `...files` <...[string]|[Object]> Sets the value of the file input to these file paths or files. If some of the  `filePaths` are relative paths, then they are resolved relative to the [current working directory](https://nodejs.org/api/process.html#process_process_cwd).
  - `name` <[string]> <[File]> name
  - `type` <[string]> <[File]> type
  - `data` <[string]> Base64-encoded data
- returns: <[Promise]>

This method expects `elementHandle` to point to an [input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input).

#### elementHandle.toString()
- returns: <[string]>

#### elementHandle.tripleclick([options])
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `relativePoint` <[Object]> A point to triple click relative to the top-left corner of element padding box. If not specified, triple clicks to some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the triple click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
- returns: <[Promise]> Promise which resolves when the element is successfully triple clicked. Promise gets rejected if the element is detached from DOM.

This method scrolls element into view if needed, and then uses [page.mouse](#pagemouse) to click in the center of the element.
If the element is detached from DOM, the method throws an error.

Bear in mind that if the first or second click of the `tripleclick()` triggers a navigation event, there will be an exception.

> **NOTE** `elementHandle.tripleclick()` dispatches three `click` events and a single `dblclick` event.

#### elementHandle.type(text[, options])
- `text` <[string]> A text to type into a focused element.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between key presses in milliseconds. Defaults to 0.
- returns: <[Promise]>

Focuses the element, and then sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.

To press a special key, like `Control` or `ArrowDown`, use [`elementHandle.press`](#elementhandlepresskey-options).

```js
await elementHandle.type('Hello'); // Types instantly
await elementHandle.type('World', {delay: 100}); // Types slower, like a user
```

An example of typing into a text field and then submitting the form:
```js
const elementHandle = await page.$('input');
await elementHandle.type('some text');
await elementHandle.press('Enter');
```

### class: Request

Whenever the page sends a request, such as for a network resource, the following events are emitted by playwright's page:
- [`'request'`](#event-request) emitted when the request is issued by the page.
- [`'response'`](#event-response) emitted when/if the response is received for the request.
- [`'requestfinished'`](#event-requestfinished) emitted when the response body is downloaded and the request is complete.

If request fails at some point, then instead of `'requestfinished'` event (and possibly instead of 'response' event), the  [`'requestfailed'`](#event-requestfailed) event is emitted.

> **NOTE** HTTP Error responses, such as 404 or 503, are still successful responses from HTTP standpoint, so request will complete with `'requestfinished'` event.

If request gets a 'redirect' response, the request is successfully finished with the 'requestfinished' event, and a new request is  issued to a redirected url.

#### request.failure()
- returns: <?[Object]> Object describing request failure, if any
  - `errorText` <[string]> Human-readable error message, e.g. `'net::ERR_FAILED'`.

The method returns `null` unless this request was failed, as reported by
`requestfailed` event.

Example of logging all failed requests:

```js
page.on('requestfailed', request => {
  console.log(request.url() + ' ' + request.failure().errorText);
});
```

#### request.frame()
- returns: <?[Frame]> A [Frame] that initiated this request, or `null` if navigating to error pages.

#### request.headers()
- returns: <[Object]> An object with HTTP headers associated with the request. All header names are lower-case.

#### request.isNavigationRequest()
- returns: <[boolean]>

Whether this request is driving frame's navigation.

#### request.method()
- returns: <[string]> Request's method (GET, POST, etc.)

#### request.postData()
- returns: <[string]> Request's post body, if any.

#### request.redirectChain()
- returns: <[Array]<[Request]>>

A `redirectChain` is a chain of requests initiated to fetch a resource.
- If there are no redirects and the request was successful, the chain will be empty.
- If a server responds with at least a single redirect, then the chain will
contain all the requests that were redirected.

`redirectChain` is shared between all the requests of the same chain.

For example, if the website `http://example.com` has a single redirect to
`https://example.com`, then the chain will contain one request:

```js
const response = await page.goto('http://example.com');
const chain = response.request().redirectChain();
console.log(chain.length); // 1
console.log(chain[0].url()); // 'http://example.com'
```

If the website `https://google.com` has no redirects, then the chain will be empty:
```js
const response = await page.goto('https://google.com');
const chain = response.request().redirectChain();
console.log(chain.length); // 0
```

#### request.resourceType()
- returns: <[string]>

Contains the request's resource type as it was perceived by the rendering engine.
ResourceType will be one of the following: `document`, `stylesheet`, `image`, `media`, `font`, `script`, `texttrack`, `xhr`, `fetch`, `eventsource`, `websocket`, `manifest`, `other`.

#### request.response()
- returns: <?[Response]> A matching [Response] object, or `null` if the response has not been received yet.

#### request.url()
- returns: <[string]> URL of the request.

### class: Response

[Response] class represents responses which are received by page.

#### response.buffer()
- returns: <Promise<[Buffer]>> Promise which resolves to a buffer with response body.

#### response.frame()
- returns: <?[Frame]> A [Frame] that initiated this response, or `null` if navigating to error pages.

#### response.headers()
- returns: <[Object]> An object with HTTP headers associated with the response. All header names are lower-case.

#### response.json()
- returns: <Promise<[Object]>> Promise which resolves to a JSON representation of response body.

This method will throw if the response body is not parsable via `JSON.parse`.

#### response.ok()
- returns: <[boolean]>

Contains a boolean stating whether the response was successful (status in the range 200-299) or not.

#### response.remoteAddress()
- returns: <[Object]>
  - `ip` <[string]> the IP address of the remote server
  - `port` <[number]> the port used to connect to the remote server

#### response.request()
- returns: <[Request]> A matching [Request] object.

#### response.status()
- returns: <[number]>

Contains the status code of the response (e.g., 200 for a success).

#### response.statusText()
- returns: <[string]>

Contains the status text of the response (e.g. usually an "OK" for a success).

#### response.text()
- returns: <[Promise]<[string]>> Promise which resolves to a text representation of response body.

#### response.url()
- returns: <[string]>

Contains the URL of the response.

### class: Target

#### target.browser()

- returns: <[Browser]>

Get the browser the target belongs to.

#### target.browserContext()

- returns: <[BrowserContext]>

The browser context the target belongs to.

#### target.createCDPSession()
- returns: <[Promise]<[CDPSession]>>

Creates a Chrome Devtools Protocol session attached to the target.

#### target.opener()
- returns: <?[Target]>

Get the target that opened this target. Top-level targets return `null`.

#### target.page()
- returns: <[Promise]<?[Page]>>

If the target is not of type `"page"` or `"background_page"`, returns `null`.

#### target.type()
- returns: <"page"|"background_page"|"service_worker"|"shared_worker"|"other"|"browser">

Identifies what kind of target this is. Can be `"page"`, [`"background_page"`](https://developer.chrome.com/extensions/background_pages), `"service_worker"`, `"shared_worker"`, `"browser"` or `"other"`.

#### target.url()
- returns: <[string]>

### class: CDPSession

* extends: [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

The `CDPSession` instances are used to talk raw Chrome Devtools Protocol:
- protocol methods can be called with `session.send` method.
- protocol events can be subscribed to with `session.on` method.

Useful links:
- Documentation on DevTools Protocol can be found here: [DevTools Protocol Viewer](https://chromedevtools.github.io/devtools-protocol/).
- Getting Started with DevTools Protocol: https://github.com/aslushnikov/getting-started-with-cdp/blob/master/README.md

```js
const client = await page.chromium.pageTarget(page).createCDPSession();
await client.send('Animation.enable');
client.on('Animation.animationCreated', () => console.log('Animation created!'));
const response = await client.send('Animation.getPlaybackRate');
console.log('playback rate is ' + response.playbackRate);
await client.send('Animation.setPlaybackRate', {
  playbackRate: response.playbackRate / 2
});
```

#### cdpSession.detach()
- returns: <[Promise]>

Detaches the cdpSession from the target. Once detached, the cdpSession object won't emit any events and can't be used
to send messages.

#### cdpSession.send(method[, params])
- `method` <[string]> protocol method name
- `params` <[Object]> Optional method parameters
- returns: <[Promise]<[Object]>>

### class: Coverage

Coverage gathers information about parts of JavaScript and CSS that were used by the page.

An example of using JavaScript and CSS coverage to get percentage of initially
executed code:

```js
// Enable both JavaScript and CSS coverage
await Promise.all([
  page.coverage.startJSCoverage(),
  page.coverage.startCSSCoverage()
]);
// Navigate to page
await page.goto('https://example.com');
// Disable both JavaScript and CSS coverage
const [jsCoverage, cssCoverage] = await Promise.all([
  page.coverage.stopJSCoverage(),
  page.coverage.stopCSSCoverage(),
]);
let totalBytes = 0;
let usedBytes = 0;
const coverage = [...jsCoverage, ...cssCoverage];
for (const entry of coverage) {
  totalBytes += entry.text.length;
  for (const range of entry.ranges)
    usedBytes += range.end - range.start - 1;
}
console.log(`Bytes used: ${usedBytes / totalBytes * 100}%`);
```

_To output coverage in a form consumable by [Istanbul](https://github.com/istanbuljs),
  see [playwright-to-istanbul](https://github.com/istanbuljs/playwright-to-istanbul)._

#### coverage.startCSSCoverage([options])
- `options` <[Object]>  Set of configurable options for coverage
  - `resetOnNavigation` <[boolean]> Whether to reset coverage on every navigation. Defaults to `true`.
- returns: <[Promise]> Promise that resolves when coverage is started

#### coverage.startJSCoverage([options])
- `options` <[Object]>  Set of configurable options for coverage
  - `resetOnNavigation` <[boolean]> Whether to reset coverage on every navigation. Defaults to `true`.
  - `reportAnonymousScripts` <[boolean]> Whether anonymous scripts generated by the page should be reported. Defaults to `false`.
- returns: <[Promise]> Promise that resolves when coverage is started

> **NOTE** Anonymous scripts are ones that don't have an associated url. These are scripts that are dynamically created on the page using `eval` or `new Function`. If `reportAnonymousScripts` is set to `true`, anonymous scripts will have `__playwright_evaluation_script__` as their URL.

#### coverage.stopCSSCoverage()
- returns: <[Promise]<[Array]<[Object]>>> Promise that resolves to the array of coverage reports for all stylesheets
  - `url` <[string]> StyleSheet URL
  - `text` <[string]> StyleSheet content
  - `ranges` <[Array]<[Object]>> StyleSheet ranges that were used. Ranges are sorted and non-overlapping.
    - `start` <[number]> A start offset in text, inclusive
    - `end` <[number]> An end offset in text, exclusive

> **NOTE** CSS Coverage doesn't include dynamically injected style tags without sourceURLs.

#### coverage.stopJSCoverage()
- returns: <[Promise]<[Array]<[Object]>>> Promise that resolves to the array of coverage reports for all scripts
  - `url` <[string]> Script URL
  - `text` <[string]> Script content
  - `ranges` <[Array]<[Object]>> Script ranges that were executed. Ranges are sorted and non-overlapping.
    - `start` <[number]> A start offset in text, inclusive
    - `end` <[number]> An end offset in text, exclusive

> **NOTE** JavaScript Coverage doesn't include anonymous scripts by default. However, scripts with sourceURLs are
reported.

### class: TimeoutError

* extends: [Error]

TimeoutError is emitted whenever certain operations are terminated due to timeout, e.g. [page.waitForSelector(selector[, options])](#pagewaitforselectorselector-options) or [playwright.launch([options])](#playwrightlaunchoptions).

### class: Selector

Selector describes an element in the page. It can be used to obtain `ElementHandle` (see [page.$()](#pageselector) for example) or shortcut element operations to avoid intermediate handle (see [page.click()](#pageclickselector-options) for example).

All methods accepting selector also accept a string shorthand which is equivalent to `{selector: 'string'}`.

#### selector.selector
- returns: <[string]> Selector in the following format: `engine=body [>> engine=body]*`. Here `engine` is one of the supported selector engines (currently, either `css` or `xpath`), and `body` is a selector body in the format of the particular engine. When multiple `engine=body` clauses are present (separated by `>>`), next one is queried relative to the previous one's result.

For convenience, selectors in the wrong format are heuristically converted to the right format:
- selector starting with `//` is assumed to be `xpath=selector`;
- selector starting with `"` is assumed to be `zs=selector`;
- otherwise selector is assumed to be `css=selector`.

```js
// queries 'div' css selector
const handle = await page.$('css=div');

// queries '//html/body/div' xpath selector
const handle = await page.$('xpath=//html/body/div');

// queries '"foo"' zs selector
const handle = await page.$('zs="foo"');

// queries 'span' css selector inside the result of '//html/body/div' xpath selector
const handle = await page.$('xpath=//html/body/div >> css=span');

// converted to 'css=div'
const handle = await page.$('div');

// converted to 'xpath=//html/body/div'
const handle = await page.$('//html/body/div');

// converted to 'zs="foo"'
const handle = await page.$('"foo"');

// queries 'span' css selector inside the div handle
const handle = await divHandle.$('css=span');
```

#### selector.visible
- returns: <[boolean]> Optional visibility to check for. If `true`, only visible elements match. If `false`, only non-visible elements match. If `undefined`, all elements match.

Note that elements are first queried by `selector`, and only after that are checked for visiblity. In particular, [page.$()](#pageselector) will not skip to the first visible element, but instead return `null` if the first matching element is not visible.

Element is defined visible if it does not have `visibility: hidden` CSS property and it's bounding box is not empty.

```js
// queries 'div', and only returns it when visible
const handle = await page.$({selector: 'css=div', visible: true});

// queries 'div', and only returns it when non-visible
const handle = await page.$({selector: 'css=div', visible: false});

// queries 'div', and returns it no matter the visibility
const handle = await page.$({selector: 'css=div'});

// returns all visible 'div' elements
const handles = await page.$$({selector: 'css=div', visible: true});
```


[AXNode]: #accessibilitysnapshotoptions "AXNode"
[Accessibility]: #class-accessibility "Accessibility"
[Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array "Array"
[Body]: #class-body  "Body"
[BrowserContext]: #class-browsercontext  "BrowserContext"
[BrowserFetcher]: #class-browserfetcher  "BrowserFetcher"
[Browser]: #class-browser  "Browser"
[Buffer]: https://nodejs.org/api/buffer.html#buffer_class_buffer "Buffer"
[CDPSession]: #class-cdpsession  "CDPSession"
[ChildProcess]: https://nodejs.org/api/child_process.html "ChildProcess"
[Chromium]: #class-chromium "Chromium"
[ConnectionTransport]: ../lib/WebSocketTransport.js "ConnectionTransport"
[ConsoleMessage]: #class-consolemessage "ConsoleMessage"
[Coverage]: #class-coverage "Coverage"
[Dialog]: #class-dialog "Dialog"
[ElementHandle]: #class-elementhandle "ElementHandle"
[Element]: https://developer.mozilla.org/en-US/docs/Web/API/element "Element"
[Error]: https://nodejs.org/api/errors.html#errors_class_error "Error"
[ExecutionContext]: #class-executioncontext "ExecutionContext"
[File]: #class-file "https://developer.mozilla.org/en-US/docs/Web/API/File"
[FileChooser]: #class-filechooser "FileChooser"
[Frame]: #class-frame "Frame"
[JSHandle]: #class-jshandle "JSHandle"
[Keyboard]: #class-keyboard "Keyboard"
[Map]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map "Map"
[Mouse]: #class-mouse "Mouse"
[Object]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object "Object"
[Page]: #class-page "Page"
[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise "Promise"
[Request]: #class-request  "Request"
[Response]: #class-response  "Response"
[Selector]: #class-selector "Selector"
[Serializable]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Description "Serializable"
[Target]: #class-target "Target"
[TimeoutError]: #class-timeouterror "TimeoutError"
[UIEvent.detail]: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/detail "UIEvent.detail"
[USKeyboardLayout]: ../lib/USKeyboardLayout.js "USKeyboardLayout"
[UnixTime]: https://en.wikipedia.org/wiki/Unix_time "Unix Time"
[Worker]: #class-worker "Worker"
[boolean]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type "Boolean"
[function]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function "Function"
[iterator]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols "Iterator"
[number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "Number"
[origin]: https://developer.mozilla.org/en-US/docs/Glossary/Origin "Origin"
[selector]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors "selector"
[stream.Readable]: https://nodejs.org/api/stream.html#stream_class_stream_readable "stream.Readable"
[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type "String"
[xpath]: https://developer.mozilla.org/en-US/docs/Web/XPath "xpath"
