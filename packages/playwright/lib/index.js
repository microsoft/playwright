"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports._baseTest = void 0;
Object.defineProperty(exports, "defineConfig", {
  enumerable: true,
  get: function () {
    return _configLoader.defineConfig;
  }
});
Object.defineProperty(exports, "expect", {
  enumerable: true,
  get: function () {
    return _expect.expect;
  }
});
Object.defineProperty(exports, "mergeExpects", {
  enumerable: true,
  get: function () {
    return _expect.mergeExpects;
  }
});
Object.defineProperty(exports, "mergeTests", {
  enumerable: true,
  get: function () {
    return _testType.mergeTests;
  }
});
exports.test = void 0;
var fs = _interopRequireWildcard(require("fs"));
var path = _interopRequireWildcard(require("path"));
var _utils = require("playwright-core/lib/utils");
var _testType = require("./common/testType");
var _globals = require("./common/globals");
var _expect = require("./matchers/expect");
var _configLoader = require("./common/configLoader");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const _baseTest = exports._baseTest = _testType.rootTestType.test;
(0, _utils.addInternalStackPrefix)(path.dirname(require.resolve('../package.json')));
if (process['__pw_initiator__']) {
  const originalStackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 200;
  try {
    throw new Error('Requiring @playwright/test second time, \nFirst:\n' + process['__pw_initiator__'] + '\n\nSecond: ');
  } finally {
    Error.stackTraceLimit = originalStackTraceLimit;
  }
} else {
  process['__pw_initiator__'] = new Error().stack;
}
const playwrightFixtures = {
  defaultBrowserType: ['chromium', {
    scope: 'worker',
    option: true
  }],
  browserName: [({
    defaultBrowserType
  }, use) => use(defaultBrowserType), {
    scope: 'worker',
    option: true
  }],
  _playwrightImpl: [({}, use) => use(require('playwright-core')), {
    scope: 'worker'
  }],
  playwright: [async ({
    _playwrightImpl,
    screenshot
  }, use) => {
    await connector.setPlaywright(_playwrightImpl, screenshot);
    await use(_playwrightImpl);
    await connector.setPlaywright(undefined, screenshot);
  }, {
    scope: 'worker',
    _hideStep: true
  }],
  headless: [({
    launchOptions
  }, use) => {
    var _launchOptions$headle;
    return use((_launchOptions$headle = launchOptions.headless) !== null && _launchOptions$headle !== void 0 ? _launchOptions$headle : true);
  }, {
    scope: 'worker',
    option: true
  }],
  channel: [({
    launchOptions
  }, use) => use(launchOptions.channel), {
    scope: 'worker',
    option: true
  }],
  launchOptions: [{}, {
    scope: 'worker',
    option: true
  }],
  connectOptions: [async ({
    _optionConnectOptions
  }, use) => {
    await use(connectOptionsFromEnv() || _optionConnectOptions);
  }, {
    scope: 'worker',
    option: true
  }],
  screenshot: ['off', {
    scope: 'worker',
    option: true
  }],
  video: ['off', {
    scope: 'worker',
    option: true
  }],
  trace: ['off', {
    scope: 'worker',
    option: true
  }],
  _browserOptions: [async ({
    playwright,
    headless,
    channel,
    launchOptions
  }, use) => {
    const options = {
      handleSIGINT: false,
      ...launchOptions
    };
    if (headless !== undefined) options.headless = headless;
    if (channel !== undefined) options.channel = channel;
    options.tracesDir = tracing().tracesDir();
    for (const browserType of [playwright.chromium, playwright.firefox, playwright.webkit]) browserType._defaultLaunchOptions = options;
    await use(options);
    for (const browserType of [playwright.chromium, playwright.firefox, playwright.webkit]) browserType._defaultLaunchOptions = undefined;
  }, {
    scope: 'worker',
    auto: true
  }],
  browser: [async ({
    playwright,
    browserName,
    _browserOptions,
    connectOptions,
    _reuseContext
  }, use, testInfo) => {
    if (!['chromium', 'firefox', 'webkit'].includes(browserName)) throw new Error(`Unexpected browserName "${browserName}", must be one of "chromium", "firefox" or "webkit"`);
    if (connectOptions) {
      var _connectOptions$expos;
      const browser = await playwright[browserName].connect({
        ...connectOptions,
        exposeNetwork: (_connectOptions$expos = connectOptions.exposeNetwork) !== null && _connectOptions$expos !== void 0 ? _connectOptions$expos : connectOptions._exposeNetwork,
        headers: {
          ...(_reuseContext ? {
            'x-playwright-reuse-context': '1'
          } : {}),
          // HTTP headers are ASCII only (not UTF-8).
          'x-playwright-launch-options': (0, _utils.jsonStringifyForceASCII)(_browserOptions),
          ...connectOptions.headers
        }
      });
      await use(browser);
      await browser._wrapApiCall(async () => {
        await browser.close({
          reason: 'Test ended.'
        });
      }, true);
      return;
    }
    const browser = await playwright[browserName].launch();
    await use(browser);
    await browser._wrapApiCall(async () => {
      await browser.close({
        reason: 'Test ended.'
      });
    }, true);
  }, {
    scope: 'worker',
    timeout: 0
  }],
  acceptDownloads: [({
    contextOptions
  }, use) => {
    var _contextOptions$accep;
    return use((_contextOptions$accep = contextOptions.acceptDownloads) !== null && _contextOptions$accep !== void 0 ? _contextOptions$accep : true);
  }, {
    option: true
  }],
  bypassCSP: [({
    contextOptions
  }, use) => {
    var _contextOptions$bypas;
    return use((_contextOptions$bypas = contextOptions.bypassCSP) !== null && _contextOptions$bypas !== void 0 ? _contextOptions$bypas : false);
  }, {
    option: true
  }],
  colorScheme: [({
    contextOptions
  }, use) => use(contextOptions.colorScheme === undefined ? 'light' : contextOptions.colorScheme), {
    option: true
  }],
  deviceScaleFactor: [({
    contextOptions
  }, use) => use(contextOptions.deviceScaleFactor), {
    option: true
  }],
  extraHTTPHeaders: [({
    contextOptions
  }, use) => use(contextOptions.extraHTTPHeaders), {
    option: true
  }],
  geolocation: [({
    contextOptions
  }, use) => use(contextOptions.geolocation), {
    option: true
  }],
  hasTouch: [({
    contextOptions
  }, use) => {
    var _contextOptions$hasTo;
    return use((_contextOptions$hasTo = contextOptions.hasTouch) !== null && _contextOptions$hasTo !== void 0 ? _contextOptions$hasTo : false);
  }, {
    option: true
  }],
  httpCredentials: [({
    contextOptions
  }, use) => use(contextOptions.httpCredentials), {
    option: true
  }],
  ignoreHTTPSErrors: [({
    contextOptions
  }, use) => {
    var _contextOptions$ignor;
    return use((_contextOptions$ignor = contextOptions.ignoreHTTPSErrors) !== null && _contextOptions$ignor !== void 0 ? _contextOptions$ignor : false);
  }, {
    option: true
  }],
  isMobile: [({
    contextOptions
  }, use) => {
    var _contextOptions$isMob;
    return use((_contextOptions$isMob = contextOptions.isMobile) !== null && _contextOptions$isMob !== void 0 ? _contextOptions$isMob : false);
  }, {
    option: true
  }],
  javaScriptEnabled: [({
    contextOptions
  }, use) => {
    var _contextOptions$javaS;
    return use((_contextOptions$javaS = contextOptions.javaScriptEnabled) !== null && _contextOptions$javaS !== void 0 ? _contextOptions$javaS : true);
  }, {
    option: true
  }],
  locale: [({
    contextOptions
  }, use) => {
    var _contextOptions$local;
    return use((_contextOptions$local = contextOptions.locale) !== null && _contextOptions$local !== void 0 ? _contextOptions$local : 'en-US');
  }, {
    option: true
  }],
  offline: [({
    contextOptions
  }, use) => {
    var _contextOptions$offli;
    return use((_contextOptions$offli = contextOptions.offline) !== null && _contextOptions$offli !== void 0 ? _contextOptions$offli : false);
  }, {
    option: true
  }],
  permissions: [({
    contextOptions
  }, use) => use(contextOptions.permissions), {
    option: true
  }],
  proxy: [({
    contextOptions
  }, use) => use(contextOptions.proxy), {
    option: true
  }],
  storageState: [({
    contextOptions
  }, use) => use(contextOptions.storageState), {
    option: true
  }],
  timezoneId: [({
    contextOptions
  }, use) => use(contextOptions.timezoneId), {
    option: true
  }],
  userAgent: [({
    contextOptions
  }, use) => use(contextOptions.userAgent), {
    option: true
  }],
  viewport: [({
    contextOptions
  }, use) => use(contextOptions.viewport === undefined ? {
    width: 1280,
    height: 720
  } : contextOptions.viewport), {
    option: true
  }],
  actionTimeout: [0, {
    option: true
  }],
  testIdAttribute: ['data-testid', {
    option: true
  }],
  navigationTimeout: [0, {
    option: true
  }],
  baseURL: [async ({}, use) => {
    await use(process.env.PLAYWRIGHT_TEST_BASE_URL);
  }, {
    option: true
  }],
  serviceWorkers: [({
    contextOptions
  }, use) => {
    var _contextOptions$servi;
    return use((_contextOptions$servi = contextOptions.serviceWorkers) !== null && _contextOptions$servi !== void 0 ? _contextOptions$servi : 'allow');
  }, {
    option: true
  }],
  contextOptions: [{}, {
    option: true
  }],
  _combinedContextOptions: async ({
    acceptDownloads,
    bypassCSP,
    colorScheme,
    deviceScaleFactor,
    extraHTTPHeaders,
    hasTouch,
    geolocation,
    httpCredentials,
    ignoreHTTPSErrors,
    isMobile,
    javaScriptEnabled,
    locale,
    offline,
    permissions,
    proxy,
    storageState,
    viewport,
    timezoneId,
    userAgent,
    baseURL,
    contextOptions,
    serviceWorkers
  }, use) => {
    const options = {};
    if (acceptDownloads !== undefined) options.acceptDownloads = acceptDownloads;
    if (bypassCSP !== undefined) options.bypassCSP = bypassCSP;
    if (colorScheme !== undefined) options.colorScheme = colorScheme;
    if (deviceScaleFactor !== undefined) options.deviceScaleFactor = deviceScaleFactor;
    if (extraHTTPHeaders !== undefined) options.extraHTTPHeaders = extraHTTPHeaders;
    if (geolocation !== undefined) options.geolocation = geolocation;
    if (hasTouch !== undefined) options.hasTouch = hasTouch;
    if (httpCredentials !== undefined) options.httpCredentials = httpCredentials;
    if (ignoreHTTPSErrors !== undefined) options.ignoreHTTPSErrors = ignoreHTTPSErrors;
    if (isMobile !== undefined) options.isMobile = isMobile;
    if (javaScriptEnabled !== undefined) options.javaScriptEnabled = javaScriptEnabled;
    if (locale !== undefined) options.locale = locale;
    if (offline !== undefined) options.offline = offline;
    if (permissions !== undefined) options.permissions = permissions;
    if (proxy !== undefined) options.proxy = proxy;
    if (storageState !== undefined) options.storageState = storageState;
    if (timezoneId !== undefined) options.timezoneId = timezoneId;
    if (userAgent !== undefined) options.userAgent = userAgent;
    if (viewport !== undefined) options.viewport = viewport;
    if (baseURL !== undefined) options.baseURL = baseURL;
    if (serviceWorkers !== undefined) options.serviceWorkers = serviceWorkers;
    await use({
      ...contextOptions,
      ...options
    });
  },
  _setupContextOptions: [async ({
    playwright,
    _combinedContextOptions,
    actionTimeout,
    navigationTimeout,
    testIdAttribute
  }, use, testInfo) => {
    if (testIdAttribute) playwright.selectors.setTestIdAttribute(testIdAttribute);
    testInfo.snapshotSuffix = process.platform;
    if ((0, _utils.debugMode)()) testInfo.setTimeout(0);
    for (const browserType of [playwright.chromium, playwright.firefox, playwright.webkit]) {
      browserType._defaultContextOptions = _combinedContextOptions;
      browserType._defaultContextTimeout = actionTimeout || 0;
      browserType._defaultContextNavigationTimeout = navigationTimeout || 0;
    }
    playwright.request._defaultContextOptions = {
      ..._combinedContextOptions
    };
    playwright.request._defaultContextOptions.tracesDir = tracing().tracesDir();
    playwright.request._defaultContextOptions.timeout = actionTimeout || 0;
    await use();
    playwright.request._defaultContextOptions = undefined;
    for (const browserType of [playwright.chromium, playwright.firefox, playwright.webkit]) {
      browserType._defaultContextOptions = undefined;
      browserType._defaultContextTimeout = undefined;
      browserType._defaultContextNavigationTimeout = undefined;
    }
  }, {
    auto: 'all-hooks-included',
    _title: 'context configuration'
  }],
  _contextFactory: [async ({
    browser,
    video,
    _reuseContext
  }, use, testInfo) => {
    const testInfoImpl = testInfo;
    const videoMode = normalizeVideoMode(video);
    const captureVideo = shouldCaptureVideo(videoMode, testInfo) && !_reuseContext;
    const contexts = new Map();
    await use(async options => {
      const hook = testInfoImpl._currentHookType();
      if (hook === 'beforeAll' || hook === 'afterAll') {
        throw new Error([`"context" and "page" fixtures are not supported in "${hook}" since they are created on a per-test basis.`, `If you would like to reuse a single page between tests, create context manually with browser.newContext(). See https://aka.ms/playwright/reuse-page for details.`, `If you would like to configure your page before each test, do that in beforeEach hook instead.`].join('\n'));
      }
      const videoOptions = captureVideo ? {
        recordVideo: {
          dir: tracing().artifactsDir(),
          size: typeof video === 'string' ? undefined : video.size
        }
      } : {};
      const context = await browser.newContext({
        ...videoOptions,
        ...options
      });
      const contextData = {
        pagesWithVideo: []
      };
      contexts.set(context, contextData);
      if (captureVideo) context.on('page', page => contextData.pagesWithVideo.push(page));
      return context;
    });
    let counter = 0;
    const closeReason = testInfo.status === 'timedOut' ? 'Test timeout of ' + testInfo.timeout + 'ms exceeded.' : 'Test ended.';
    await Promise.all([...contexts.keys()].map(async context => {
      await context._wrapApiCall(async () => {
        await context.close({
          reason: closeReason
        });
      }, true);
      const testFailed = testInfo.status !== testInfo.expectedStatus;
      const preserveVideo = captureVideo && (videoMode === 'on' || testFailed && videoMode === 'retain-on-failure' || videoMode === 'on-first-retry' && testInfo.retry === 1);
      if (preserveVideo) {
        const {
          pagesWithVideo: pagesForVideo
        } = contexts.get(context);
        const videos = pagesForVideo.map(p => p.video()).filter(Boolean);
        await Promise.all(videos.map(async v => {
          try {
            const savedPath = testInfo.outputPath(`video${counter ? '-' + counter : ''}.webm`);
            ++counter;
            await v.saveAs(savedPath);
            testInfo.attachments.push({
              name: 'video',
              path: savedPath,
              contentType: 'video/webm'
            });
          } catch (e) {
            // Silent catch empty videos.
          }
        }));
      }
    }));
  }, {
    scope: 'test',
    _title: 'context'
  }],
  _optionContextReuseMode: ['none', {
    scope: 'worker',
    option: true
  }],
  _optionConnectOptions: [undefined, {
    scope: 'worker',
    option: true
  }],
  _reuseContext: [async ({
    video,
    _optionContextReuseMode
  }, use) => {
    let mode = _optionContextReuseMode;
    if (process.env.PW_TEST_REUSE_CONTEXT) mode = 'when-possible';
    const reuse = mode === 'when-possible' && normalizeVideoMode(video) === 'off';
    await use(reuse);
  }, {
    scope: 'worker',
    _title: 'context'
  }],
  context: async ({
    playwright,
    browser,
    _reuseContext,
    _contextFactory
  }, use, testInfo) => {
    attachConnectedHeaderIfNeeded(testInfo, browser);
    if (!_reuseContext) {
      await use(await _contextFactory());
      return;
    }
    const defaultContextOptions = playwright.chromium._defaultContextOptions;
    const context = await browser._newContextForReuse(defaultContextOptions);
    context[kIsReusedContext] = true;
    await use(context);
    const closeReason = testInfo.status === 'timedOut' ? 'Test timeout of ' + testInfo.timeout + 'ms exceeded.' : 'Test ended.';
    await browser._stopPendingOperations(closeReason);
  },
  page: async ({
    context,
    _reuseContext
  }, use) => {
    if (!_reuseContext) {
      await use(await context.newPage());
      return;
    }

    // First time we are reusing the context, we should create the page.
    let [page] = context.pages();
    if (!page) page = await context.newPage();
    await use(page);
  },
  request: async ({
    playwright
  }, use) => {
    const request = await playwright.request.newContext();
    await use(request);
    const hook = test.info()._currentHookType();
    if (hook === 'beforeAll') {
      await request.dispose({
        reason: [`Fixture { request } from beforeAll cannot be reused in a test.`, `  - Recommended fix: use a separate { request } in the test.`, `  - Alternatively, manually create APIRequestContext in beforeAll and dispose it in afterAll.`, `See https://playwright.dev/docs/api-testing#sending-api-requests-from-ui-tests for more details.`].join('\n')
      });
    } else {
      await request.dispose();
    }
  }
};
function normalizeVideoMode(video) {
  if (!video) return 'off';
  let videoMode = typeof video === 'string' ? video : video.mode;
  if (videoMode === 'retry-with-video') videoMode = 'on-first-retry';
  return videoMode;
}
function shouldCaptureVideo(videoMode, testInfo) {
  return videoMode === 'on' || videoMode === 'retain-on-failure' || videoMode === 'on-first-retry' && testInfo.retry === 1;
}
function normalizeScreenshotMode(screenshot) {
  if (!screenshot) return 'off';
  return typeof screenshot === 'string' ? screenshot : screenshot.mode;
}
function attachConnectedHeaderIfNeeded(testInfo, browser) {
  const connectHeaders = browser === null || browser === void 0 ? void 0 : browser._connectHeaders;
  if (!connectHeaders) return;
  for (const header of connectHeaders) {
    if (header.name !== 'x-playwright-attachment') continue;
    const [name, value] = header.value.split('=');
    if (!name || !value) continue;
    if (testInfo.attachments.some(attachment => attachment.name === name)) continue;
    testInfo.attachments.push({
      name,
      contentType: 'text/plain',
      body: Buffer.from(value)
    });
  }
}
const kTracingStarted = Symbol('kTracingStarted');
const kIsReusedContext = Symbol('kReusedContext');
function connectOptionsFromEnv() {
  const wsEndpoint = process.env.PW_TEST_CONNECT_WS_ENDPOINT;
  if (!wsEndpoint) return undefined;
  const headers = process.env.PW_TEST_CONNECT_HEADERS ? JSON.parse(process.env.PW_TEST_CONNECT_HEADERS) : undefined;
  return {
    wsEndpoint,
    headers,
    exposeNetwork: process.env.PW_TEST_CONNECT_EXPOSE_NETWORK
  };
}
class ArtifactsRecorder {
  constructor(playwright, artifactsDir, screenshot) {
    this._testInfo = void 0;
    this._playwright = void 0;
    this._artifactsDir = void 0;
    this._screenshotMode = void 0;
    this._screenshotOptions = void 0;
    this._temporaryScreenshots = [];
    this._temporaryArtifacts = [];
    this._reusedContexts = new Set();
    this._screenshotOrdinal = 0;
    this._screenshottedSymbol = void 0;
    this._startedCollectingArtifacts = void 0;
    this._playwright = playwright;
    this._artifactsDir = artifactsDir;
    this._screenshotMode = normalizeScreenshotMode(screenshot);
    this._screenshotOptions = typeof screenshot === 'string' ? undefined : screenshot;
    this._screenshottedSymbol = Symbol('screenshotted');
    this._startedCollectingArtifacts = Symbol('startedCollectingArtifacts');
  }
  _createTemporaryArtifact(...name) {
    const file = path.join(this._artifactsDir, ...name);
    this._temporaryArtifacts.push(file);
    return file;
  }
  async willStartTest(testInfo) {
    this._testInfo = testInfo;

    // Since beforeAll(s), test and afterAll(s) reuse the same TestInfo, make sure we do not
    // overwrite previous screenshots.
    this._screenshotOrdinal = testInfo.attachments.filter(a => a.name === 'screenshot').length;

    // Process existing contexts.
    for (const browserType of [this._playwright.chromium, this._playwright.firefox, this._playwright.webkit]) {
      const promises = [];
      const existingContexts = Array.from(browserType._contexts);
      for (const context of existingContexts) {
        if (context[kIsReusedContext]) this._reusedContexts.add(context);else promises.push(this.didCreateBrowserContext(context));
      }
      await Promise.all(promises);
    }
    {
      const existingApiRequests = Array.from(this._playwright.request._contexts);
      await Promise.all(existingApiRequests.map(c => this.didCreateRequestContext(c)));
    }
  }
  async didCreateBrowserContext(context) {
    await this._startTraceChunkOnContextCreation(context.tracing);
  }
  async willCloseBrowserContext(context) {
    // When reusing context, we get all previous contexts closed at the start of next test.
    // Do not record empty traces and useless screenshots for them.
    if (this._reusedContexts.has(context)) return;
    await this._stopTracing(context.tracing);
    if (this._screenshotMode === 'on' || this._screenshotMode === 'only-on-failure') {
      // Capture screenshot for now. We'll know whether we have to preserve them
      // after the test finishes.
      await Promise.all(context.pages().map(page => this._screenshotPage(page, true)));
    }
  }
  async didCreateRequestContext(context) {
    const tracing = context._tracing;
    await this._startTraceChunkOnContextCreation(tracing);
  }
  async willCloseRequestContext(context) {
    const tracing = context._tracing;
    await this._stopTracing(tracing);
  }
  async didFinishTestFunction() {
    const captureScreenshots = this._screenshotMode === 'on' || this._screenshotMode === 'only-on-failure' && this._testInfo._isFailure();
    if (captureScreenshots) await this._screenshotOnTestFailure();
  }
  async didFinishTest() {
    const captureScreenshots = this._screenshotMode === 'on' || this._screenshotMode === 'only-on-failure' && this._testInfo._isFailure();
    if (captureScreenshots) await this._screenshotOnTestFailure();
    const leftoverContexts = [];
    for (const browserType of [this._playwright.chromium, this._playwright.firefox, this._playwright.webkit]) leftoverContexts.push(...browserType._contexts);
    const leftoverApiRequests = Array.from(this._playwright.request._contexts);

    // Collect traces/screenshots for remaining contexts.
    await Promise.all(leftoverContexts.map(async context => {
      await this._stopTracing(context.tracing);
    }).concat(leftoverApiRequests.map(async context => {
      const tracing = context._tracing;
      await this._stopTracing(tracing);
    })));

    // Attach temporary screenshots for contexts closed before collecting the test trace.
    if (captureScreenshots) {
      for (const file of this._temporaryScreenshots) {
        try {
          const screenshotPath = this._createScreenshotAttachmentPath();
          await fs.promises.rename(file, screenshotPath);
          this._attachScreenshot(screenshotPath);
        } catch {}
      }
    }
  }
  _createScreenshotAttachmentPath() {
    const testFailed = this._testInfo._isFailure();
    const index = this._screenshotOrdinal + 1;
    ++this._screenshotOrdinal;
    const screenshotPath = this._testInfo.outputPath(`test-${testFailed ? 'failed' : 'finished'}-${index}.png`);
    return screenshotPath;
  }
  async _screenshotPage(page, temporary) {
    if (page[this._screenshottedSymbol]) return;
    page[this._screenshottedSymbol] = true;
    try {
      const screenshotPath = temporary ? this._createTemporaryArtifact((0, _utils.createGuid)() + '.png') : this._createScreenshotAttachmentPath();
      // Pass caret=initial to avoid any evaluations that might slow down the screenshot
      // and let the page modify itself from the problematic state it had at the moment of failure.
      await page.screenshot({
        ...this._screenshotOptions,
        timeout: 5000,
        path: screenshotPath,
        caret: 'initial'
      });
      if (temporary) this._temporaryScreenshots.push(screenshotPath);else this._attachScreenshot(screenshotPath);
    } catch {
      // Screenshot may fail, just ignore.
    }
  }
  _attachScreenshot(screenshotPath) {
    this._testInfo.attachments.push({
      name: 'screenshot',
      path: screenshotPath,
      contentType: 'image/png'
    });
  }
  async _screenshotOnTestFailure() {
    const contexts = [];
    for (const browserType of [this._playwright.chromium, this._playwright.firefox, this._playwright.webkit]) contexts.push(...browserType._contexts);
    const pages = contexts.map(ctx => ctx.pages()).flat();
    await Promise.all(pages.map(page => this._screenshotPage(page, false)));
  }
  async _startTraceChunkOnContextCreation(tracing) {
    const options = this._testInfo._tracing.traceOptions();
    if (options) {
      const title = this._testInfo._tracing.traceTitle();
      const name = this._testInfo._tracing.generateNextTraceRecordingName();
      if (!tracing[kTracingStarted]) {
        await tracing.start({
          ...options,
          title,
          name
        });
        tracing[kTracingStarted] = true;
      } else {
        await tracing.startChunk({
          title,
          name
        });
      }
    } else {
      if (tracing[kTracingStarted]) {
        tracing[kTracingStarted] = false;
        await tracing.stop();
      }
    }
  }
  async _stopTracing(tracing) {
    if (tracing[this._startedCollectingArtifacts]) return;
    tracing[this._startedCollectingArtifacts] = true;
    if (this._testInfo._tracing.traceOptions() && tracing[kTracingStarted]) await tracing.stopChunk({
      path: this._testInfo._tracing.generateNextTraceRecordingPath()
    });
  }
}
const paramsToRender = ['url', 'selector', 'text', 'key'];
function renderApiCall(apiName, params) {
  const paramsArray = [];
  if (params) {
    for (const name of paramsToRender) {
      if (!(name in params)) continue;
      let value;
      if (name === 'selector' && (0, _utils.isString)(params[name]) && params[name].startsWith('internal:')) {
        const getter = (0, _utils.asLocator)('javascript', params[name]);
        apiName = apiName.replace(/^locator\./, 'locator.' + getter + '.');
        apiName = apiName.replace(/^page\./, 'page.' + getter + '.');
        apiName = apiName.replace(/^frame\./, 'frame.' + getter + '.');
      } else {
        value = params[name];
        paramsArray.push(value);
      }
    }
  }
  const paramsText = paramsArray.length ? '(' + paramsArray.join(', ') + ')' : '';
  return apiName + paramsText;
}
function tracing() {
  return test.info()._tracing;
}
class InstrumentationConnector {
  constructor() {
    this._playwright = void 0;
    this._screenshot = 'off';
    this._artifactsRecorder = void 0;
    this._testIsRunning = false;
    (0, _globals.setTestLifecycleInstrumentation)(this);
  }
  async setPlaywright(playwright, screenshot) {
    if (this._playwright) {
      if (this._testIsRunning) {
        // When "playwright" is destroyed during a test, collect artifacts immediately.
        await this.onTestEnd();
      }
      const clientInstrumentation = this._playwright._instrumentation;
      clientInstrumentation.removeListener(this);
    }
    this._playwright = playwright;
    this._screenshot = screenshot;
    if (this._playwright) {
      const clientInstrumentation = this._playwright._instrumentation;
      clientInstrumentation.addListener(this);
      if (this._testIsRunning) {
        // When "playwright" is created during a test, wire it up immediately.
        await this.onTestBegin();
      }
    }
  }
  async onTestBegin() {
    this._testIsRunning = true;
    if (this._playwright) {
      this._artifactsRecorder = new ArtifactsRecorder(this._playwright, tracing().artifactsDir(), this._screenshot);
      await this._artifactsRecorder.willStartTest((0, _globals.currentTestInfo)());
    }
  }
  async onTestFunctionEnd() {
    var _this$_artifactsRecor;
    await ((_this$_artifactsRecor = this._artifactsRecorder) === null || _this$_artifactsRecor === void 0 ? void 0 : _this$_artifactsRecor.didFinishTestFunction());
  }
  async onTestEnd() {
    var _this$_artifactsRecor2;
    await ((_this$_artifactsRecor2 = this._artifactsRecorder) === null || _this$_artifactsRecor2 === void 0 ? void 0 : _this$_artifactsRecor2.didFinishTest());
    this._artifactsRecorder = undefined;
    this._testIsRunning = false;
  }
  onApiCallBegin(apiName, params, frames, userData, out) {
    const testInfo = (0, _globals.currentTestInfo)();
    if (!testInfo || apiName.includes('setTestIdAttribute')) return {
      userObject: null
    };
    const step = testInfo._addStep({
      location: frames[0],
      category: 'pw:api',
      title: renderApiCall(apiName, params),
      apiName,
      params
    });
    userData.userObject = step;
    out.stepId = step.stepId;
  }
  onApiCallEnd(userData, error) {
    const step = userData.userObject;
    step === null || step === void 0 || step.complete({
      error
    });
  }
  onWillPause() {
    var _currentTestInfo;
    (_currentTestInfo = (0, _globals.currentTestInfo)()) === null || _currentTestInfo === void 0 || _currentTestInfo.setTimeout(0);
  }
  async runAfterCreateBrowserContext(context) {
    var _this$_artifactsRecor3;
    await ((_this$_artifactsRecor3 = this._artifactsRecorder) === null || _this$_artifactsRecor3 === void 0 ? void 0 : _this$_artifactsRecor3.didCreateBrowserContext(context));
    const testInfo = (0, _globals.currentTestInfo)();
    if (testInfo) attachConnectedHeaderIfNeeded(testInfo, context.browser());
  }
  async runAfterCreateRequestContext(context) {
    var _this$_artifactsRecor4;
    await ((_this$_artifactsRecor4 = this._artifactsRecorder) === null || _this$_artifactsRecor4 === void 0 ? void 0 : _this$_artifactsRecor4.didCreateRequestContext(context));
  }
  async runBeforeCloseBrowserContext(context) {
    var _this$_artifactsRecor5;
    await ((_this$_artifactsRecor5 = this._artifactsRecorder) === null || _this$_artifactsRecor5 === void 0 ? void 0 : _this$_artifactsRecor5.willCloseBrowserContext(context));
  }
  async runBeforeCloseRequestContext(context) {
    var _this$_artifactsRecor6;
    await ((_this$_artifactsRecor6 = this._artifactsRecorder) === null || _this$_artifactsRecor6 === void 0 ? void 0 : _this$_artifactsRecor6.willCloseRequestContext(context));
  }
}
const connector = new InstrumentationConnector();
const test = exports.test = _baseTest.extend(playwrightFixtures);