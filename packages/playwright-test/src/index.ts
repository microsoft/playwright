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
import { createGuid, debugMode, addInternalStackPrefix, mergeTraceFiles, saveTraceFile, removeFolders, isString, asLocator, jsonStringifyForceASCII } from 'playwright-core/lib/utils';
import type { Fixtures, PlaywrightTestArgs, PlaywrightTestOptions, PlaywrightWorkerArgs, PlaywrightWorkerOptions, ScreenshotMode, TestInfo, TestType, TraceMode, VideoMode } from '../types/test';
import type { TestInfoImpl } from './worker/testInfo';
import { rootTestType } from './common/testType';
import type { ContextReuseMode } from './common/config';
import { artifactsFolderName } from './isomorphic/folders';
import type { ClientInstrumentation, ClientInstrumentationListener } from '../../playwright-core/src/client/clientInstrumentation';
import type { ParsedStackTrace } from '../../playwright-core/src/utils/stackTrace';
import { currentTestInfo } from './common/globals';
export { expect } from './matchers/expect';
export { store as _store } from './store';
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
  _contextReuseMode: ContextReuseMode,
  _reuseContext: boolean,
  _setupContextOptions: void;
  _setupArtifacts: void;
  _contextFactory: (options?: BrowserContextOptions) => Promise<BrowserContext>;
};
type WorkerFixtures = PlaywrightWorkerArgs & PlaywrightWorkerOptions & {
  _browserOptions: LaunchOptions;
  _artifactsDir: () => string;
};

const playwrightFixtures: Fixtures<TestFixtures, WorkerFixtures> = ({
  defaultBrowserType: ['chromium', { scope: 'worker', option: true }],
  browserName: [({ defaultBrowserType }, use) => use(defaultBrowserType), { scope: 'worker', option: true }],
  playwright: [async ({}, use) => {
    await use(require('playwright-core'));
  }, { scope: 'worker', _hideStep: true } as any],
  headless: [({ launchOptions }, use) => use(launchOptions.headless ?? true), { scope: 'worker', option: true }],
  channel: [({ launchOptions }, use) => use(launchOptions.channel), { scope: 'worker', option: true }],
  launchOptions: [{}, { scope: 'worker', option: true }],
  connectOptions: [async ({}, use) => {
    // Usually, when connect options are specified (e.g, in the config or in the environment),
    // all launch() calls are turned into connect() calls.
    // However, when running in "reuse browser" mode and connecting to the reusable server,
    // only the default "browser" fixture should turn into reused browser.
    await use(process.env.PW_TEST_REUSE_CONTEXT ? undefined : connectOptionsFromEnv());
  }, { scope: 'worker', option: true }],
  screenshot: ['off', { scope: 'worker', option: true }],
  video: ['off', { scope: 'worker', option: true }],
  trace: ['off', { scope: 'worker', option: true }],

  _artifactsDir: [async ({}, use, workerInfo) => {
    let dir: string | undefined;
    await use(() => {
      if (!dir) {
        dir = path.join(workerInfo.project.outputDir, artifactsFolderName(workerInfo.workerIndex));
        fs.mkdirSync(dir, { recursive: true });
      }
      return dir;
    });
    if (dir)
      await removeFolders([dir]);
  }, { scope: 'worker', _title: 'playwright configuration' } as any],

  _browserOptions: [async ({ playwright, headless, channel, launchOptions, connectOptions, _artifactsDir }, use) => {
    const options: LaunchOptions = {
      handleSIGINT: false,
      ...launchOptions,
    };
    if (headless !== undefined)
      options.headless = headless;
    if (channel !== undefined)
      options.channel = channel;
    options.tracesDir = path.join(_artifactsDir(), 'traces');

    for (const browserType of [playwright.chromium, playwright.firefox, playwright.webkit]) {
      (browserType as any)._defaultLaunchOptions = options;
      (browserType as any)._defaultConnectOptions = connectOptions;
    }
    await use(options);
    for (const browserType of [playwright.chromium, playwright.firefox, playwright.webkit]) {
      (browserType as any)._defaultLaunchOptions = undefined;
      (browserType as any)._defaultConnectOptions = undefined;
    }
  }, { scope: 'worker', auto: true }],

  browser: [async ({ playwright, browserName, _browserOptions }, use, testInfo) => {
    if (!['chromium', 'firefox', 'webkit'].includes(browserName))
      throw new Error(`Unexpected browserName "${browserName}", must be one of "chromium", "firefox" or "webkit"`);

    // Support for "reuse browser" mode.
    const connectOptions = connectOptionsFromEnv();
    if (connectOptions && process.env.PW_TEST_REUSE_CONTEXT) {
      const browser = await playwright[browserName].connect({
        ...connectOptions,
        headers: {
          'x-playwright-reuse-context': '1',
          // HTTP headers are ASCII only (not UTF-8).
          'x-playwright-launch-options': jsonStringifyForceASCII(_browserOptions),
          ...connectOptions.headers,
        },
      });
      await use(browser);
      await (browser as any)._wrapApiCall(async () => {
        await browser.close();
      }, true);
      return;
    }

    const browser = await playwright[browserName].launch();
    await use(browser);
    await (browser as any)._wrapApiCall(async () => {
      await browser.close();
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
  },

  _setupContextOptions: [async ({ playwright, _combinedContextOptions, _artifactsDir, actionTimeout, navigationTimeout, testIdAttribute }, use, testInfo) => {
    if (testIdAttribute)
      playwrightLibrary.selectors.setTestIdAttribute(testIdAttribute);
    testInfo.snapshotSuffix = process.platform;
    if (debugMode())
      testInfo.setTimeout(0);
    for (const browserType of [playwright.chromium, playwright.firefox, playwright.webkit]) {
      (browserType as any)._defaultContextOptions = _combinedContextOptions;
      (browserType as any)._defaultContextTimeout = actionTimeout || 0;
      (browserType as any)._defaultContextNavigationTimeout = navigationTimeout || 0;
    }
    (playwright.request as any)._defaultContextOptions = { ..._combinedContextOptions };
    (playwright.request as any)._defaultContextOptions.tracesDir = path.join(_artifactsDir(), 'traces');
    (playwright.request as any)._defaultContextOptions.timeout = actionTimeout || 0;
    await use();
    (playwright.request as any)._defaultContextOptions = undefined;
    for (const browserType of [playwright.chromium, playwright.firefox, playwright.webkit]) {
      (browserType as any)._defaultContextOptions = undefined;
      (browserType as any)._defaultContextTimeout = undefined;
      (browserType as any)._defaultContextNavigationTimeout = undefined;
    }
  }, { auto: 'all-hooks-included',  _title: 'context configuration' } as any],

  _setupArtifacts: [async ({ playwright, _artifactsDir, trace, screenshot }, use, testInfo) => {
    const artifactsRecorder = new ArtifactsRecorder(playwright, _artifactsDir(), trace, screenshot);
    await artifactsRecorder.willStartTest(testInfo as TestInfoImpl);
    const csiListener: ClientInstrumentationListener = {
      onApiCallBegin: (apiName: string, params: Record<string, any>, stackTrace: ParsedStackTrace | null, wallTime: number, userData: any) => {
        const testInfo = currentTestInfo();
        if (!testInfo || apiName.startsWith('expect.') || apiName.includes('setTestIdAttribute'))
          return { userObject: null };
        const step = testInfo._addStep({
          location: stackTrace?.frames[0] as any,
          category: 'pw:api',
          title: renderApiCall(apiName, params),
          apiName,
          params,
          wallTime,
          laxParent: true,
        });
        userData.userObject = step;
      },
      onApiCallEnd: (userData: any, error?: Error) => {
        const step = userData.userObject;
        step?.complete({ error });
      },
      onWillPause: () => {
        currentTestInfo()?.setTimeout(0);
      },
      onDidCreateBrowserContext: async (context: BrowserContext) => {
        await artifactsRecorder?.didCreateBrowserContext(context);
        const testInfo = currentTestInfo();
        if (testInfo)
          attachConnectedHeaderIfNeeded(testInfo, context.browser());
      },
      onDidCreateRequestContext: async (context: APIRequestContext) => {
        await artifactsRecorder?.didCreateRequestContext(context);
      },
      onWillCloseBrowserContext: async (context: BrowserContext) => {
        await artifactsRecorder?.willCloseBrowserContext(context);
      },
      onWillCloseRequestContext: async (context: APIRequestContext) => {
        await artifactsRecorder?.willCloseRequestContext(context);
      },
    };

    const clientInstrumentation = (playwright as any)._instrumentation as ClientInstrumentation;
    clientInstrumentation.addListener(csiListener);

    await use();

    clientInstrumentation.removeListener(csiListener);
    await artifactsRecorder?.didFinishTest();

  }, { auto: 'all-hooks-included',  _title: 'trace recording' } as any],

  _contextFactory: [async ({ browser, video, _artifactsDir, _reuseContext }, use, testInfo) => {
    const testInfoImpl = testInfo as TestInfoImpl;
    const videoMode = normalizeVideoMode(video);
    const captureVideo = shouldCaptureVideo(videoMode, testInfo) && !_reuseContext;
    const contexts = new Map<BrowserContext, { pagesWithVideo: Page[] }>();

    await use(async options => {
      const hook = hookType(testInfoImpl);
      if (hook) {
        throw new Error([
          `"context" and "page" fixtures are not supported in "${hook}" since they are created on a per-test basis.`,
          `If you would like to reuse a single page between tests, create context manually with browser.newContext(). See https://aka.ms/playwright/reuse-page for details.`,
          `If you would like to configure your page before each test, do that in beforeEach hook instead.`,
        ].join('\n'));
      }
      const videoOptions: BrowserContextOptions = captureVideo ? {
        recordVideo: {
          dir: _artifactsDir(),
          size: typeof video === 'string' ? undefined : video.size,
        }
      } : {};
      const context = await browser.newContext({ ...videoOptions, ...options });
      const contextData: { pagesWithVideo: Page[] } = { pagesWithVideo: [] };
      contexts.set(context, contextData);
      if (captureVideo)
        context.on('page', page => contextData.pagesWithVideo.push(page));
      return context;
    });

    const prependToError = testInfoImpl._didTimeout ?
      formatPendingCalls((browser as any)._connection.pendingProtocolCalls()) : '';

    let counter = 0;
    await Promise.all([...contexts.keys()].map(async context => {
      (context as any)[kStartedContextTearDown] = true;
      await (context as any)._wrapApiCall(async () => {
        await context.close();
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

    if (prependToError)
      testInfo.errors.push({ message: prependToError });
  }, { scope: 'test',  _title: 'context' } as any],

  _contextReuseMode: process.env.PW_TEST_REUSE_CONTEXT === 'when-possible' ? 'when-possible' : (process.env.PW_TEST_REUSE_CONTEXT ? 'force' : 'none'),

  _reuseContext: [async ({ video, _contextReuseMode }, use, testInfo) => {
    const reuse = _contextReuseMode === 'force' || (_contextReuseMode === 'when-possible' && !shouldCaptureVideo(normalizeVideoMode(video), testInfo));
    await use(reuse);
  }, { scope: 'test',  _title: 'context' } as any],

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
    (request as any)[kStartedContextTearDown] = true;
    await request.dispose();
  },
});


function formatPendingCalls(calls: ParsedStackTrace[]) {
  calls = calls.filter(call => !!call.apiName);
  if (!calls.length)
    return '';
  return 'Pending operations:\n' + calls.map(call => {
    const frame = call.frames && call.frames[0] ? ' at ' + formatStackFrame(call.frames[0]) : '';
    return `  - ${call.apiName}${frame}\n`;
  }).join('');
}

function formatStackFrame(frame: StackFrame) {
  const file = path.relative(process.cwd(), frame.file) || path.basename(frame.file);
  return `${file}:${frame.line || 1}:${frame.column || 1}`;
}

function hookType(testInfo: TestInfoImpl): 'beforeAll' | 'afterAll' | undefined {
  const type = testInfo._timeoutManager.currentRunnableType();
  if (type === 'beforeAll' || type === 'afterAll')
    return type;
}

type StackFrame = {
  file: string,
  line?: number,
  column?: number,
  function?: string,
};

type ScreenshotOption = PlaywrightWorkerOptions['screenshot'] | undefined;
type TraceOption =  PlaywrightWorkerOptions['trace'] | undefined;
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

function normalizeTraceMode(trace: TraceOption): TraceMode {
  if (!trace)
    return 'off';
  let traceMode = typeof trace === 'string' ? trace : trace.mode;
  if (traceMode === 'retry-with-trace')
    traceMode = 'on-first-retry';
  return traceMode;
}

function shouldCaptureTrace(traceMode: TraceMode, testInfo: TestInfo) {
  return traceMode === 'on' || traceMode === 'retain-on-failure' || (traceMode === 'on-first-retry' && testInfo.retry === 1) || (traceMode === 'on-all-retries' && testInfo.retry > 0);
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

const kTracingStarted = Symbol('kTracingStarted');
const kIsReusedContext = Symbol('kReusedContext');
const kStartedContextTearDown = Symbol('kStartedContextTearDown');

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
  private _traceMode: TraceMode;
  private _captureTrace = false;
  private _screenshotOptions: { mode: ScreenshotMode } & Pick<playwrightLibrary.PageScreenshotOptions, 'fullPage' | 'omitBackground'> | undefined;
  private _traceOptions: { screenshots: boolean, snapshots: boolean, sources: boolean, attachments: boolean, mode?: TraceMode };
  private _temporaryTraceFiles: string[] = [];
  private _temporaryScreenshots: string[] = [];
  private _reusedContexts = new Set<BrowserContext>();
  private _traceOrdinal = 0;
  private _screenshotOrdinal = 0;
  private _screenshottedSymbol: symbol;
  private _startedCollectingArtifacts: symbol;

  constructor(playwright: Playwright, artifactsDir: string, trace: TraceOption, screenshot: ScreenshotOption) {
    this._playwright = playwright;
    this._artifactsDir = artifactsDir;
    this._screenshotMode = normalizeScreenshotMode(screenshot);
    this._screenshotOptions = typeof screenshot === 'string' ? undefined : screenshot;
    this._traceMode = normalizeTraceMode(trace);
    const defaultTraceOptions = { screenshots: true, snapshots: true, sources: true, attachments: true };
    this._traceOptions = typeof trace === 'string' ? defaultTraceOptions : { ...defaultTraceOptions, ...trace, mode: undefined };
    this._screenshottedSymbol = Symbol('screenshotted');
    this._startedCollectingArtifacts = Symbol('startedCollectingArtifacts');
  }

  async willStartTest(testInfo: TestInfoImpl) {
    this._testInfo = testInfo;
    testInfo._onDidFinishTestFunction = () => this.didFinishTestFunction();
    this._captureTrace = shouldCaptureTrace(this._traceMode, testInfo) && !process.env.PW_TEST_DISABLE_TRACING;

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
    await this._stopTracing(context.tracing, (context as any)[kStartedContextTearDown]);
    if (this._screenshotMode === 'on' || this._screenshotMode === 'only-on-failure') {
      // Capture screenshot for now. We'll know whether we have to preserve them
      // after the test finishes.
      await Promise.all(context.pages().map(page => this._screenshotPage(page)));
    }
  }

  async didCreateRequestContext(context: APIRequestContext) {
    const tracing = (context as any)._tracing as Tracing;
    await this._startTraceChunkOnContextCreation(tracing);
  }

  async willCloseRequestContext(context: APIRequestContext) {
    const tracing = (context as any)._tracing as Tracing;
    await this._stopTracing(tracing, (context as any)[kStartedContextTearDown]);
  }

  async didFinishTestFunction() {
    if (this._testInfo._isFailure() && (this._screenshotMode === 'on' || this._screenshotMode === 'only-on-failure'))
      await this._screenshotOnTestFailure();
  }

  async didFinishTest() {
    const captureScreenshots = this._screenshotMode === 'on' || (this._screenshotMode === 'only-on-failure' && this._testInfo.status !== this._testInfo.expectedStatus);

    const leftoverContexts: BrowserContext[] = [];
    for (const browserType of [this._playwright.chromium, this._playwright.firefox, this._playwright.webkit])
      leftoverContexts.push(...(browserType as any)._contexts);
    const leftoverApiRequests: APIRequestContext[] =  Array.from((this._playwright.request as any)._contexts as Set<APIRequestContext>);

    // Collect traces/screenshots for remaining contexts.
    await Promise.all(leftoverContexts.map(async context => {
      await this._stopTracing(context.tracing, true);
      if (captureScreenshots) {
        await Promise.all(context.pages().map(async page => {
          if ((page as any)[this._screenshottedSymbol])
            return;
          try {
            const screenshotPath = this._createScreenshotAttachmentPath();
            // Pass caret=initial to avoid any evaluations that might slow down the screenshot
            // and let the page modify itself from the problematic state it had at the moment of failure.
            await page.screenshot({ ...this._screenshotOptions, timeout: 5000, path: screenshotPath, caret: 'initial' });
            this._testInfo.attachments.push({ name: 'screenshot', path: screenshotPath, contentType: 'image/png' });
          } catch {
            // Screenshot may fail, just ignore.
          }
        }));
      }
    }).concat(leftoverApiRequests.map(async context => {
      const tracing = (context as any)._tracing as Tracing;
      await this._stopTracing(tracing, true);
    })));

    // Either remove or attach temporary screenshots for contexts closed before
    // collecting the test trace.
    await Promise.all(this._temporaryScreenshots.map(async file => {
      if (!captureScreenshots) {
        await fs.promises.unlink(file).catch(() => {});
        return;
      }
      try {
        const screenshotPath = this._createScreenshotAttachmentPath();
        await fs.promises.rename(file, screenshotPath);
        this._testInfo.attachments.push({ name: 'screenshot', path: screenshotPath, contentType: 'image/png' });
      } catch {
      }
    }));

    // Collect test trace.
    if (this._preserveTrace()) {
      const events = this._testInfo._traceEvents;
      if (events.length) {
        if (!this._traceOptions.attachments) {
          for (const event of events) {
            if (event.type === 'after')
              delete event.attachments;
          }
        }
        const tracePath = path.join(this._artifactsDir, createGuid() + '.zip');
        this._temporaryTraceFiles.push(tracePath);
        await saveTraceFile(tracePath, events, this._traceOptions.sources);
      }
    }

    // Either remove or attach temporary traces for contexts closed before the
    // test has finished.
    if (this._preserveTrace() && this._temporaryTraceFiles.length) {
      const tracePath = this._testInfo.outputPath(`trace.zip`);
      // This could be: beforeHooks, or beforeHooks + test, etc.
      const beforeHooksHadTrace = fs.existsSync(tracePath);
      if (beforeHooksHadTrace) {
        await fs.promises.rename(tracePath, tracePath + '.tmp');
        this._temporaryTraceFiles.unshift(tracePath + '.tmp');
      }
      await mergeTraceFiles(tracePath, this._temporaryTraceFiles);
      // Do not add attachment twice.
      if (!beforeHooksHadTrace)
        this._testInfo.attachments.push({ name: 'trace', path: tracePath, contentType: 'application/zip' });
    }
  }

  private _createScreenshotAttachmentPath() {
    const testFailed = this._testInfo.status !== this._testInfo.expectedStatus;
    const index = this._screenshotOrdinal + 1;
    ++this._screenshotOrdinal;
    const screenshotPath = this._testInfo.outputPath(`test-${testFailed ? 'failed' : 'finished'}-${index}.png`);
    return screenshotPath;
  }

  private async _screenshotPage(page: Page) {
    if ((page as any)[this._screenshottedSymbol])
      return;
    (page as any)[this._screenshottedSymbol] = true;
    try {
      const screenshotPath = path.join(this._artifactsDir, createGuid() + '.png');
      // Pass caret=initial to avoid any evaluations that might slow down the screenshot
      // and let the page modify itself from the problematic state it had at the moment of failure.
      await page.screenshot({ ...this._screenshotOptions, timeout: 5000, path: screenshotPath, caret: 'initial' }).catch(() => {});
      this._temporaryScreenshots.push(screenshotPath);
    } catch {
      // Screenshot may fail, just ignore.
    }
  }

  private async _screenshotOnTestFailure() {
    const contexts: BrowserContext[] = [];
    for (const browserType of [this._playwright.chromium, this._playwright.firefox, this._playwright.webkit])
      contexts.push(...(browserType as any)._contexts);
    await Promise.all(contexts.map(ctx => Promise.all(ctx.pages().map(page => this._screenshotPage(page)))));
  }

  private async _startTraceChunkOnContextCreation(tracing: Tracing) {
    if (this._captureTrace) {
      const title = [path.relative(this._testInfo.project.testDir, this._testInfo.file) + ':' + this._testInfo.line, ...this._testInfo.titlePath.slice(1)].join(' › ');
      const ordinalSuffix = this._traceOrdinal ? `-context${this._traceOrdinal}` : '';
      ++this._traceOrdinal;
      const retrySuffix = this._testInfo.retry ? `-retry${this._testInfo.retry}` : '';
      const name = `${this._testInfo.testId}${retrySuffix}${ordinalSuffix}`;
      if (!(tracing as any)[kTracingStarted]) {
        await tracing.start({ ...this._traceOptions, title, name });
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

  private _preserveTrace() {
    const testFailed = this._testInfo.status !== this._testInfo.expectedStatus;
    return this._captureTrace && (this._traceMode === 'on' || (testFailed && this._traceMode === 'retain-on-failure') || (this._traceMode === 'on-first-retry' && this._testInfo.retry === 1) || (this._traceMode === 'on-all-retries' && this._testInfo.retry > 0));
  }

  private async _stopTracing(tracing: Tracing, contextTearDownStarted: boolean) {
    if ((tracing as any)[this._startedCollectingArtifacts])
      return;
    (tracing as any)[this._startedCollectingArtifacts] = true;
    if (this._captureTrace) {
      let tracePath;
      // Create a trace file if we know that:
      // - it is's going to be used due to the config setting and the test status or
      // - we are inside a test or afterEach and the user manually closed the context.
      if (this._preserveTrace() || !contextTearDownStarted) {
        tracePath = path.join(this._artifactsDir, createGuid() + '.zip');
        this._temporaryTraceFiles.push(tracePath);
      }
      await tracing.stopChunk({ path: tracePath });
    }
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
        const getter = asLocator('javascript', params[name], false, true);
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

export const test = _baseTest.extend<TestFixtures, WorkerFixtures>(playwrightFixtures);

export default test;
