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

import * as fs from 'fs';
import * as path from 'path';
import type { APIRequestContext, BrowserContext, Browser, BrowserContextOptions, LaunchOptions, Page, Tracing, Video } from 'playwright-core';
import * as playwrightLibrary from 'playwright-core';
import { createGuid, debugMode, addInternalStackPrefix, isString, asLocator, jsonStringifyForceASCII } from 'playwright-core/lib/utils';
import type { Fixtures, PlaywrightTestArgs, PlaywrightTestOptions, PlaywrightWorkerArgs, PlaywrightWorkerOptions, ScreenshotMode, TestInfo, TestType, VideoMode } from '../types/test';
import type { TestInfoImpl } from './worker/testInfo';
import { rootTestType } from './common/testType';
import type { ContextReuseMode } from './common/config';
import type { ClientInstrumentation, ClientInstrumentationListener } from '../../playwright-core/src/client/clientInstrumentation';
import { currentTestInfo } from './common/globals';
export { expect } from './matchers/expect';
export const _baseTest: TestType<{}, {}> = rootTestType.test;

addInternalStackPrefix(path.dirname(require.resolve('../package.json')));

if ((process as any)['__pw_initiator__']) {
  const originalStackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 200;
  try {
    throw new Error('Requiring @playwright/test second time, \nFirst:\n' + (process as any)['__pw_initiator__'] + '\n\nSecond: ');
  } finally {
    Error.stackTraceLimit = originalStackTraceLimit;
  }
} else {
  (process as any)['__pw_initiator__'] = new Error().stack;
}

type TestFixtures = PlaywrightTestArgs & PlaywrightTestOptions & {
  _combinedContextOptions: BrowserContextOptions,
  _setupContextOptions: void;
  _setupArtifacts: void;
  _contextFactory: (options?: BrowserContextOptions) => Promise<BrowserContext>;
};

type WorkerFixtures = PlaywrightWorkerArgs & PlaywrightWorkerOptions & {
  _browserOptions: LaunchOptions;
  _optionContextReuseMode: ContextReuseMode,
  _optionConnectOptions: PlaywrightWorkerOptions['connectOptions'],
  _reuseContext: boolean,
};

const playwrightFixtures: Fixtures<TestFixtures, WorkerFixtures> = ({
  defaultBrowserType: ['chromium', { scope: 'worker', option: true }],
  browserName: [({ defaultBrowserType }, use) => use(defaultBrowserType), { scope: 'worker', option: true }],
  playwright: [async ({}, use) => {
    await use(require('playwright-core'));
  }, { scope: 'worker', box: true }],
  headless: [({ launchOptions }, use) => use(launchOptions.headless ?? true), { scope: 'worker', option: true }],
  channel: [({ launchOptions }, use) => use(launchOptions.channel), { scope: 'worker', option: true }],
  launchOptions: [{}, { scope: 'worker', option: true }],
  connectOptions: [async ({ _optionConnectOptions }, use) => {
    await use(connectOptionsFromEnv() || _optionConnectOptions);
  }, { scope: 'worker', option: true }],
  screenshot: ['off', { scope: 'worker', option: true }],
  video: ['off', { scope: 'worker', option: true }],
  trace: ['off', { scope: 'worker', option: true }],

  _browserOptions: [async ({ playwright, headless, channel, launchOptions }, use) => {
    const options: LaunchOptions = {
      handleSIGINT: false,
      ...launchOptions,
    };
    if (headless !== undefined)
      options.headless = headless;
    if (channel !== undefined)
      options.channel = channel;
    options.tracesDir = tracing().tracesDir();

    for (const browserType of [playwright.chromium, playwright.firefox, playwright.webkit])
      (browserType as any)._defaultLaunchOptions = options;
    await use(options);
    for (const browserType of [playwright.chromium, playwright.firefox, playwright.webkit])
      (browserType as any)._defaultLaunchOptions = undefined;
  }, { scope: 'worker', auto: true, box: true }],

  browser: [async ({ playwright, browserName, _browserOptions, connectOptions, _reuseContext }, use, testInfo) => {
    if (!['chromium', 'firefox', 'webkit'].includes(browserName))
      throw new Error(`Unexpected browserName "${browserName}", must be one of "chromium", "firefox" or "webkit"`);

    if (connectOptions) {
      const browser = await playwright[browserName].connect({
        ...connectOptions,
        exposeNetwork: connectOptions.exposeNetwork ?? (connectOptions as any)._exposeNetwork,
        headers: {
          ...(_reuseContext ? { 'x-playwright-reuse-context': '1' } : {}),
          // HTTP headers are ASCII only (not UTF-8).
          'x-playwright-launch-options': jsonStringifyForceASCII(_browserOptions),
          ...connectOptions.headers,
        },
      });
      await use(browser);
      await (browser as any)._wrapApiCall(async () => {
        await browser.close({ reason: 'Test ended.' });
      }, true);
      return;
    }

    const browser = await playwright[browserName].launch();
    await use(browser);
    await (browser as any)._wrapApiCall(async () => {
      await browser.close({ reason: 'Test ended.' });
    }, true);
  }, { scope: 'worker', timeout: 0 }],

  acceptDownloads: [({ contextOptions }, use) => use(contextOptions.acceptDownloads ?? true), { option: true }],
  bypassCSP: [({ contextOptions }, use) => use(contextOptions.bypassCSP ?? false), { option: true }],
  colorScheme: [({ contextOptions }, use) => use(contextOptions.colorScheme === undefined ? 'light' : contextOptions.colorScheme), { option: true }],
  deviceScaleFactor: [({ contextOptions }, use) => use(contextOptions.deviceScaleFactor), { option: true }],
  extraHTTPHeaders: [({ contextOptions }, use) => use(contextOptions.extraHTTPHeaders), { option: true }],
  geolocation: [({ contextOptions }, use) => use(contextOptions.geolocation), { option: true }],
  hasTouch: [({ contextOptions }, use) => use(contextOptions.hasTouch ?? false), { option: true }],
  httpCredentials: [({ contextOptions }, use) => use(contextOptions.httpCredentials), { option: true }],
  ignoreHTTPSErrors: [({ contextOptions }, use) => use(contextOptions.ignoreHTTPSErrors ?? false), { option: true }],
  isMobile: [({ contextOptions }, use) => use(contextOptions.isMobile ?? false), { option: true }],
  javaScriptEnabled: [({ contextOptions }, use) => use(contextOptions.javaScriptEnabled ?? true), { option: true }],
  locale: [({ contextOptions }, use) => use(contextOptions.locale ?? 'en-US'), { option: true }],
  offline: [({ contextOptions }, use) => use(contextOptions.offline ?? false), { option: true }],
  permissions: [({ contextOptions }, use) => use(contextOptions.permissions), { option: true }],
  proxy: [({ contextOptions }, use) => use(contextOptions.proxy), { option: true }],
  storageState: [({ contextOptions }, use) => use(contextOptions.storageState), { option: true }],
  clientCertificates: [({ contextOptions }, use) => use(contextOptions.clientCertificates), { option: true }],
  timezoneId: [({ contextOptions }, use) => use(contextOptions.timezoneId), { option: true }],
  userAgent: [({ contextOptions }, use) => use(contextOptions.userAgent), { option: true }],
  viewport: [({ contextOptions }, use) => use(contextOptions.viewport === undefined ? { width: 1280, height: 720 } : contextOptions.viewport), { option: true }],
  actionTimeout: [0, { option: true }],
  testIdAttribute: ['data-testid', { option: true }],
  navigationTimeout: [0, { option: true }],
  baseURL: [async ({ }, use) => {
    await use(process.env.PLAYWRIGHT_TEST_BASE_URL);
  }, { option: true }],
  serviceWorkers: [({ contextOptions }, use) => use(contextOptions.serviceWorkers ?? 'allow'), { option: true }],
  contextOptions: [{}, { option: true }],

  _combinedContextOptions: [async ({
    acceptDownloads,
    bypassCSP,
    clientCertificates,
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
    serviceWorkers,
  }, use) => {
    const options: BrowserContextOptions = {};
    if (acceptDownloads !== undefined)
      options.acceptDownloads = acceptDownloads;
    if (bypassCSP !== undefined)
      options.bypassCSP = bypassCSP;
    if (colorScheme !== undefined)
      options.colorScheme = colorScheme;
    if (deviceScaleFactor !== undefined)
      options.deviceScaleFactor = deviceScaleFactor;
    if (extraHTTPHeaders !== undefined)
      options.extraHTTPHeaders = extraHTTPHeaders;
    if (geolocation !== undefined)
      options.geolocation = geolocation;
    if (hasTouch !== undefined)
      options.hasTouch = hasTouch;
    if (httpCredentials !== undefined)
      options.httpCredentials = httpCredentials;
    if (ignoreHTTPSErrors !== undefined)
      options.ignoreHTTPSErrors = ignoreHTTPSErrors;
    if (isMobile !== undefined)
      options.isMobile = isMobile;
    if (javaScriptEnabled !== undefined)
      options.javaScriptEnabled = javaScriptEnabled;
    if (locale !== undefined)
      options.locale = locale;
    if (offline !== undefined)
      options.offline = offline;
    if (permissions !== undefined)
      options.permissions = permissions;
    if (proxy !== undefined)
      options.proxy = proxy;
    if (storageState !== undefined)
      options.storageState = storageState;
    if (clientCertificates?.length)
      options.clientCertificates = resolveClientCerticates(clientCertificates);
    if (timezoneId !== undefined)
      options.timezoneId = timezoneId;
    if (userAgent !== undefined)
      options.userAgent = userAgent;
    if (viewport !== undefined)
      options.viewport = viewport;
    if (baseURL !== undefined)
      options.baseURL = baseURL;
    if (serviceWorkers !== undefined)
      options.serviceWorkers = serviceWorkers;
    await use({
      ...contextOptions,
      ...options,
    });
  }, { box: true }],

  _setupContextOptions: [async ({ playwright, _combinedContextOptions, actionTimeout, navigationTimeout, testIdAttribute }, use, testInfo) => {
    if (testIdAttribute)
      playwrightLibrary.selectors.setTestIdAttribute(testIdAttribute);
    testInfo.snapshotSuffix = process.platform;
    if (debugMode())
      (testInfo as TestInfoImpl)._setDebugMode();
    for (const browserType of [playwright.chromium, playwright.firefox, playwright.webkit]) {
      (browserType as any)._defaultContextOptions = _combinedContextOptions;
      (browserType as any)._defaultContextTimeout = actionTimeout || 0;
      (browserType as any)._defaultContextNavigationTimeout = navigationTimeout || 0;
    }
    (playwright.request as any)._defaultContextOptions = { ..._combinedContextOptions };
    (playwright.request as any)._defaultContextOptions.tracesDir = tracing().tracesDir();
    (playwright.request as any)._defaultContextOptions.timeout = actionTimeout || 0;
    await use();
    (playwright.request as any)._defaultContextOptions = undefined;
    for (const browserType of [playwright.chromium, playwright.firefox, playwright.webkit]) {
      (browserType as any)._defaultContextOptions = undefined;
      (browserType as any)._defaultContextTimeout = undefined;
      (browserType as any)._defaultContextNavigationTimeout = undefined;
    }
  }, { auto: 'all-hooks-included',  title: 'context configuration', box: true } as any],

  _setupArtifacts: [async ({ playwright, screenshot }, use, testInfo) => {
    // This fixture has a separate zero-timeout slot to ensure that artifact collection
    // happens even after some fixtures or hooks time out.
    // Now that default test timeout is known, we can replace zero with an actual value.
    testInfo.setTimeout(testInfo.project.timeout);

    const artifactsRecorder = new ArtifactsRecorder(playwright, tracing().artifactsDir(), screenshot);
    await artifactsRecorder.willStartTest(testInfo as TestInfoImpl);
    const csiListener: ClientInstrumentationListener = {
      onApiCallBegin: (apiName: string, params: Record<string, any>, frames: StackFrame[], userData: any, out: { stepId?: string }) => {
        const testInfo = currentTestInfo();
        if (!testInfo || apiName.includes('setTestIdAttribute'))
          return { userObject: null };
        const step = testInfo._addStep({
          location: frames[0] as any,
          category: 'pw:api',
          title: renderApiCall(apiName, params),
          apiName,
          params,
        });
        userData.userObject = step;
        out.stepId = step.stepId;
      },
      onApiCallEnd: (userData: any, error?: Error) => {
        const step = userData.userObject;
        step?.complete({ error });
      },
      onWillPause: () => {
        currentTestInfo()?._setDebugMode();
      },
      runAfterCreateBrowserContext: async (context: BrowserContext) => {
        await artifactsRecorder?.didCreateBrowserContext(context);
        const testInfo = currentTestInfo();
        if (testInfo)
          attachConnectedHeaderIfNeeded(testInfo, context.browser());
      },
      runAfterCreateRequestContext: async (context: APIRequestContext) => {
        await artifactsRecorder?.didCreateRequestContext(context);
      },
      runBeforeCloseBrowserContext: async (context: BrowserContext) => {
        await artifactsRecorder?.willCloseBrowserContext(context);
      },
      runBeforeCloseRequestContext: async (context: APIRequestContext) => {
        await artifactsRecorder?.willCloseRequestContext(context);
      },
    };

    const clientInstrumentation = (playwright as any)._instrumentation as ClientInstrumentation;
    clientInstrumentation.addListener(csiListener);

    await use();

    clientInstrumentation.removeListener(csiListener);
    await artifactsRecorder.didFinishTest();

  }, { auto: 'all-hooks-included',  title: 'trace recording', box: true, timeout: 0 } as any],

  _contextFactory: [async ({ browser, video, _reuseContext, _combinedContextOptions /** mitigate dep-via-auto lack of traceability */ }, use, testInfo) => {
    const testInfoImpl = testInfo as TestInfoImpl;
    const videoMode = normalizeVideoMode(video);
    const captureVideo = shouldCaptureVideo(videoMode, testInfo) && !_reuseContext;
    const contexts = new Map<BrowserContext, { pagesWithVideo: Page[] }>();

    await use(async options => {
      const hook = testInfoImpl._currentHookType();
      if (hook === 'beforeAll' || hook === 'afterAll') {
        throw new Error([
          `"context" and "page" fixtures are not supported in "${hook}" since they are created on a per-test basis.`,
          `If you would like to reuse a single page between tests, create context manually with browser.newContext(). See https://aka.ms/playwright/reuse-page for details.`,
          `If you would like to configure your page before each test, do that in beforeEach hook instead.`,
        ].join('\n'));
      }
      const videoOptions: BrowserContextOptions = captureVideo ? {
        recordVideo: {
          dir: tracing().artifactsDir(),
          size: typeof video === 'string' ? undefined : video.size,
        }
      } : {};
      const context = await browser.newContext({ ...videoOptions, ...options });
      const contextData: { pagesWithVideo: Page[] } = { pagesWithVideo: [] };
      contexts.set(context, contextData);
      if (captureVideo)
        context.on('page', page => contextData.pagesWithVideo.push(page));

      if (process.env.PW_CLOCK === 'frozen') {
        await (context as any)._wrapApiCall(async () => {
          await context.clock.install({ time: 0 });
          await context.clock.pauseAt(1000);
        }, true);
      } else if (process.env.PW_CLOCK === 'realtime') {
        await (context as any)._wrapApiCall(async () => {
          await context.clock.install({ time: 0 });
        }, true);
      }

      return context;
    });

    let counter = 0;
    const closeReason = testInfo.status === 'timedOut' ? 'Test timeout of ' + testInfo.timeout + 'ms exceeded.' : 'Test ended.';
    await Promise.all([...contexts.keys()].map(async context => {
      await (context as any)._wrapApiCall(async () => {
        await context.close({ reason: closeReason });
      }, true);
      const testFailed = testInfo.status !== testInfo.expectedStatus;
      const preserveVideo = captureVideo && (videoMode === 'on' || (testFailed && videoMode === 'retain-on-failure') || (videoMode === 'on-first-retry' && testInfo.retry === 1));
      if (preserveVideo) {
        const { pagesWithVideo: pagesForVideo } = contexts.get(context)!;
        const videos = pagesForVideo.map(p => p.video()).filter(Boolean) as Video[];
        await Promise.all(videos.map(async v => {
          try {
            const savedPath = testInfo.outputPath(`video${counter ? '-' + counter : ''}.webm`);
            ++counter;
            await v.saveAs(savedPath);
            testInfo.attachments.push({ name: 'video', path: savedPath, contentType: 'video/webm' });
          } catch (e) {
            // Silent catch empty videos.
          }
        }));
      }
    }));

  }, { scope: 'test',  title: 'context', box: true }],

  _optionContextReuseMode: ['none', { scope: 'worker', option: true }],
  _optionConnectOptions: [undefined, { scope: 'worker', option: true }],

  _reuseContext: [async ({ video, _optionContextReuseMode }, use) => {
    let mode = _optionContextReuseMode;
    if (process.env.PW_TEST_REUSE_CONTEXT)
      mode = 'when-possible';
    const reuse = mode === 'when-possible' && normalizeVideoMode(video) === 'off';
    await use(reuse);
  }, { scope: 'worker',  title: 'context', box: true }],

  context: async ({ playwright, browser, _reuseContext, _contextFactory }, use, testInfo) => {
    attachConnectedHeaderIfNeeded(testInfo, browser);
    if (!_reuseContext) {
      await use(await _contextFactory());
      return;
    }

    const defaultContextOptions = (playwright.chromium as any)._defaultContextOptions as BrowserContextOptions;
    const context = await (browser as any)._newContextForReuse(defaultContextOptions);
    (context as any)[kIsReusedContext] = true;
    await use(context);
    const closeReason = testInfo.status === 'timedOut' ? 'Test timeout of ' + testInfo.timeout + 'ms exceeded.' : 'Test ended.';
    await (browser as any)._stopPendingOperations(closeReason);
  },

  page: async ({ context, _reuseContext }, use) => {
    if (!_reuseContext) {
      await use(await context.newPage());
      return;
    }

    // First time we are reusing the context, we should create the page.
    let [page] = context.pages();
    if (!page)
      page = await context.newPage();
    await use(page);
  },

  request: async ({ playwright }, use) => {
    const request = await playwright.request.newContext();
    await use(request);
    const hook = (test.info() as TestInfoImpl)._currentHookType();
    if (hook === 'beforeAll') {
      await request.dispose({ reason: [
        `Fixture { request } from beforeAll cannot be reused in a test.`,
        `  - Recommended fix: use a separate { request } in the test.`,
        `  - Alternatively, manually create APIRequestContext in beforeAll and dispose it in afterAll.`,
        `See https://playwright.dev/docs/api-testing#sending-api-requests-from-ui-tests for more details.`,
      ].join('\n') });
    } else {
      await request.dispose();
    }
  },
});

type StackFrame = {
  file: string,
  line?: number,
  column?: number,
  function?: string,
};

type ScreenshotOption = PlaywrightWorkerOptions['screenshot'] | undefined;
type Playwright = PlaywrightWorkerArgs['playwright'];

function normalizeVideoMode(video: VideoMode | 'retry-with-video' | { mode: VideoMode } | undefined): VideoMode {
  if (!video)
    return 'off';
  let videoMode = typeof video === 'string' ? video : video.mode;
  if (videoMode === 'retry-with-video')
    videoMode = 'on-first-retry';
  return videoMode;
}

function shouldCaptureVideo(videoMode: VideoMode, testInfo: TestInfo) {
  return (videoMode === 'on' || videoMode === 'retain-on-failure' || (videoMode === 'on-first-retry' && testInfo.retry === 1));
}

function normalizeScreenshotMode(screenshot: ScreenshotOption): ScreenshotMode {
  if (!screenshot)
    return 'off';
  return typeof screenshot === 'string' ? screenshot : screenshot.mode;
}

function attachConnectedHeaderIfNeeded(testInfo: TestInfo, browser: Browser | null) {
  const connectHeaders: { name: string, value: string }[] | undefined = (browser as any)?._connectHeaders;
  if (!connectHeaders)
    return;
  for (const header of connectHeaders) {
    if (header.name !== 'x-playwright-attachment')
      continue;
    const [name, value] = header.value.split('=');
    if (!name || !value)
      continue;
    if (testInfo.attachments.some(attachment => attachment.name === name))
      continue;
    testInfo.attachments.push({ name, contentType: 'text/plain', body: Buffer.from(value) });
  }
}

function resolveFileToConfig(file: string | undefined) {
  const config = test.info().config.configFile;
  if (!config || !file)
    return file;
  if (path.isAbsolute(file))
    return file;
  return path.resolve(path.dirname(config), file);
}

type ClientCertificates = NonNullable<PlaywrightTestOptions['clientCertificates']>;

function resolveClientCerticates(clientCertificates: ClientCertificates): ClientCertificates {
  for (const cert of clientCertificates) {
    cert.certPath = resolveFileToConfig(cert.certPath);
    cert.keyPath = resolveFileToConfig(cert.keyPath);
    cert.pfxPath = resolveFileToConfig(cert.pfxPath);
  }
  return clientCertificates;
}

const kTracingStarted = Symbol('kTracingStarted');
const kIsReusedContext = Symbol('kReusedContext');

function connectOptionsFromEnv() {
  const wsEndpoint = process.env.PW_TEST_CONNECT_WS_ENDPOINT;
  if (!wsEndpoint)
    return undefined;
  const headers = process.env.PW_TEST_CONNECT_HEADERS ? JSON.parse(process.env.PW_TEST_CONNECT_HEADERS) : undefined;
  return {
    wsEndpoint,
    headers,
    exposeNetwork: process.env.PW_TEST_CONNECT_EXPOSE_NETWORK,
  };
}

class ArtifactsRecorder {
  private _testInfo!: TestInfoImpl;
  private _playwright: Playwright;
  private _artifactsDir: string;
  private _screenshotMode: ScreenshotMode;
  private _screenshotOptions: { mode: ScreenshotMode } & Pick<playwrightLibrary.PageScreenshotOptions, 'fullPage' | 'omitBackground'> | undefined;
  private _temporaryScreenshots: string[] = [];
  private _temporaryArtifacts: string[] = [];
  private _reusedContexts = new Set<BrowserContext>();
  private _screenshotOrdinal = 0;
  private _screenshottedSymbol: symbol;
  private _startedCollectingArtifacts: symbol;

  constructor(playwright: Playwright, artifactsDir: string, screenshot: ScreenshotOption) {
    this._playwright = playwright;
    this._artifactsDir = artifactsDir;
    this._screenshotMode = normalizeScreenshotMode(screenshot);
    this._screenshotOptions = typeof screenshot === 'string' ? undefined : screenshot;
    this._screenshottedSymbol = Symbol('screenshotted');
    this._startedCollectingArtifacts = Symbol('startedCollectingArtifacts');
  }

  private _createTemporaryArtifact(...name: string[]) {
    const file = path.join(this._artifactsDir, ...name);
    this._temporaryArtifacts.push(file);
    return file;
  }

  async willStartTest(testInfo: TestInfoImpl) {
    this._testInfo = testInfo;
    testInfo._onDidFinishTestFunction = () => this.didFinishTestFunction();

    // Since beforeAll(s), test and afterAll(s) reuse the same TestInfo, make sure we do not
    // overwrite previous screenshots.
    this._screenshotOrdinal = testInfo.attachments.filter(a => a.name === 'screenshot').length;

    // Process existing contexts.
    for (const browserType of [this._playwright.chromium, this._playwright.firefox, this._playwright.webkit]) {
      const promises: (Promise<void> | undefined)[] = [];
      const existingContexts = Array.from((browserType as any)._contexts) as BrowserContext[];
      for (const context of existingContexts) {
        if ((context as any)[kIsReusedContext])
          this._reusedContexts.add(context);
        else
          promises.push(this.didCreateBrowserContext(context));
      }
      await Promise.all(promises);
    }
    {
      const existingApiRequests: APIRequestContext[] =  Array.from((this._playwright.request as any)._contexts as Set<APIRequestContext>);
      await Promise.all(existingApiRequests.map(c => this.didCreateRequestContext(c)));
    }
  }

  async didCreateBrowserContext(context: BrowserContext) {
    await this._startTraceChunkOnContextCreation(context.tracing);
  }

  async willCloseBrowserContext(context: BrowserContext) {
    // When reusing context, we get all previous contexts closed at the start of next test.
    // Do not record empty traces and useless screenshots for them.
    if (this._reusedContexts.has(context))
      return;
    await this._stopTracing(context.tracing);
    if (this._screenshotMode === 'on' || this._screenshotMode === 'only-on-failure') {
      // Capture screenshot for now. We'll know whether we have to preserve them
      // after the test finishes.
      await Promise.all(context.pages().map(page => this._screenshotPage(page, true)));
    }
  }

  async didCreateRequestContext(context: APIRequestContext) {
    const tracing = (context as any)._tracing as Tracing;
    await this._startTraceChunkOnContextCreation(tracing);
  }

  async willCloseRequestContext(context: APIRequestContext) {
    const tracing = (context as any)._tracing as Tracing;
    await this._stopTracing(tracing);
  }

  async didFinishTestFunction() {
    const captureScreenshots = this._screenshotMode === 'on' || (this._screenshotMode === 'only-on-failure' && this._testInfo._isFailure());
    if (captureScreenshots)
      await this._screenshotOnTestFailure();
  }

  async didFinishTest() {
    const captureScreenshots = this._screenshotMode === 'on' || (this._screenshotMode === 'only-on-failure' && this._testInfo._isFailure());
    if (captureScreenshots)
      await this._screenshotOnTestFailure();

    const leftoverContexts: BrowserContext[] = [];
    for (const browserType of [this._playwright.chromium, this._playwright.firefox, this._playwright.webkit])
      leftoverContexts.push(...(browserType as any)._contexts);
    const leftoverApiRequests: APIRequestContext[] =  Array.from((this._playwright.request as any)._contexts as Set<APIRequestContext>);

    // Collect traces/screenshots for remaining contexts.
    await Promise.all(leftoverContexts.map(async context => {
      await this._stopTracing(context.tracing);
    }).concat(leftoverApiRequests.map(async context => {
      const tracing = (context as any)._tracing as Tracing;
      await this._stopTracing(tracing);
    })));

    // Attach temporary screenshots for contexts closed before collecting the test trace.
    if (captureScreenshots) {
      for (const file of this._temporaryScreenshots) {
        try {
          const screenshotPath = this._createScreenshotAttachmentPath();
          await fs.promises.rename(file, screenshotPath);
          this._attachScreenshot(screenshotPath);
        } catch {
        }
      }
    }
  }

  private _createScreenshotAttachmentPath() {
    const testFailed = this._testInfo._isFailure();
    const index = this._screenshotOrdinal + 1;
    ++this._screenshotOrdinal;
    const screenshotPath = this._testInfo.outputPath(`test-${testFailed ? 'failed' : 'finished'}-${index}.png`);
    return screenshotPath;
  }

  private async _screenshotPage(page: Page, temporary: boolean) {
    if ((page as any)[this._screenshottedSymbol])
      return;
    (page as any)[this._screenshottedSymbol] = true;
    try {
      const screenshotPath = temporary ? this._createTemporaryArtifact(createGuid() + '.png') : this._createScreenshotAttachmentPath();
      // Pass caret=initial to avoid any evaluations that might slow down the screenshot
      // and let the page modify itself from the problematic state it had at the moment of failure.
      await page.screenshot({ ...this._screenshotOptions, timeout: 5000, path: screenshotPath, caret: 'initial' });
      if (temporary)
        this._temporaryScreenshots.push(screenshotPath);
      else
        this._attachScreenshot(screenshotPath);
    } catch {
      // Screenshot may fail, just ignore.
    }
  }

  private _attachScreenshot(screenshotPath: string) {
    this._testInfo.attachments.push({ name: 'screenshot', path: screenshotPath, contentType: 'image/png' });
  }

  private async _screenshotOnTestFailure() {
    const contexts: BrowserContext[] = [];
    for (const browserType of [this._playwright.chromium, this._playwright.firefox, this._playwright.webkit])
      contexts.push(...(browserType as any)._contexts);
    const pages = contexts.map(ctx => ctx.pages()).flat();
    await Promise.all(pages.map(page => this._screenshotPage(page, false)));
  }

  private async _startTraceChunkOnContextCreation(tracing: Tracing) {
    const options = this._testInfo._tracing.traceOptions();
    if (options) {
      const title = this._testInfo._tracing.traceTitle();
      const name = this._testInfo._tracing.generateNextTraceRecordingName();
      if (!(tracing as any)[kTracingStarted]) {
        await tracing.start({ ...options, title, name });
        (tracing as any)[kTracingStarted] = true;
      } else {
        await tracing.startChunk({ title, name });
      }
    } else {
      if ((tracing as any)[kTracingStarted]) {
        (tracing as any)[kTracingStarted] = false;
        await tracing.stop();
      }
    }
  }

  private async _stopTracing(tracing: Tracing) {
    if ((tracing as any)[this._startedCollectingArtifacts])
      return;
    (tracing as any)[this._startedCollectingArtifacts] = true;
    if (this._testInfo._tracing.traceOptions() && (tracing as any)[kTracingStarted])
      await tracing.stopChunk({ path: this._testInfo._tracing.generateNextTraceRecordingPath() });
  }
}

const paramsToRender = ['url', 'selector', 'text', 'key'];

function renderApiCall(apiName: string, params: any) {
  const paramsArray = [];
  if (params) {
    for (const name of paramsToRender) {
      if (!(name in params))
        continue;
      let value;
      if (name === 'selector' && isString(params[name]) && params[name].startsWith('internal:')) {
        const getter = asLocator('javascript', params[name]);
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
  return (test.info() as TestInfoImpl)._tracing;
}

export const test = _baseTest.extend<TestFixtures, WorkerFixtures>(playwrightFixtures);

export { defineConfig } from './common/configLoader';
export { mergeTests } from './common/testType';
export { mergeExpects } from './matchers/expect';
