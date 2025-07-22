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

import fs from 'fs';
import path from 'path';

import * as playwrightLibrary from 'playwright-core';
import { setBoxedStackPrefixes, createGuid, currentZone, debugMode, jsonStringifyForceASCII, asLocatorDescription, renderTitleForCall } from 'playwright-core/lib/utils';

import { currentTestInfo } from './common/globals';
import { rootTestType } from './common/testType';
import { stepTitle } from './util';

import type { Fixtures, PlaywrightTestArgs, PlaywrightTestOptions, PlaywrightWorkerArgs, PlaywrightWorkerOptions, ScreenshotMode, TestInfo, TestType, VideoMode } from '../types/test';
import type { ContextReuseMode } from './common/config';
import type { TestInfoImpl, TestStepInternal } from './worker/testInfo';
import type { ClientInstrumentationListener } from '../../playwright-core/src/client/clientInstrumentation';
import type { Playwright as PlaywrightImpl } from '../../playwright-core/src/client/playwright';
import type { Browser as BrowserImpl } from '../../playwright-core/src/client/browser';
import type { BrowserContext as BrowserContextImpl } from '../../playwright-core/src/client/browserContext';
import type { Page as PageImpl } from '../../playwright-core/src/client/page';
import type { APIRequestContext, Browser, BrowserContext, BrowserContextOptions, LaunchOptions, Page, Tracing, Video } from 'playwright-core';

export { expect } from './matchers/expect';
export const _baseTest: TestType<{}, {}> = rootTestType.test;

setBoxedStackPrefixes([path.dirname(require.resolve('../package.json'))]);

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
  playwright: PlaywrightImpl;
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
      tracesDir: tracing().tracesDir(),
    };
    if (headless !== undefined)
      options.headless = headless;
    if (channel !== undefined)
      options.channel = channel;

    playwright._defaultLaunchOptions = options;
    await use(options);
    playwright._defaultLaunchOptions = undefined;
  }, { scope: 'worker', auto: true, box: true }],

  browser: [async ({ playwright, browserName, _browserOptions, connectOptions }, use, testInfo) => {
    if (!['chromium', 'firefox', 'webkit', '_bidiChromium', '_bidiFirefox'].includes(browserName))
      throw new Error(`Unexpected browserName "${browserName}", must be one of "chromium", "firefox" or "webkit"`);

    if (connectOptions) {
      const browser = await playwright[browserName].connect({
        ...connectOptions,
        exposeNetwork: connectOptions.exposeNetwork ?? (connectOptions as any)._exposeNetwork,
        headers: {
          // HTTP headers are ASCII only (not UTF-8).
          'x-playwright-launch-options': jsonStringifyForceASCII(_browserOptions),
          ...connectOptions.headers,
        },
      });
      await use(browser);
      await (browser as BrowserImpl)._wrapApiCall(async () => {
        await browser.close({ reason: 'Test ended.' });
      }, { internal: true });
      return;
    }

    const browser = await playwright[browserName].launch();
    await use(browser);
    await (browser as BrowserImpl)._wrapApiCall(async () => {
      await browser.close({ reason: 'Test ended.' });
    }, { internal: true });
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

    playwright._defaultContextOptions = _combinedContextOptions;
    playwright._defaultContextTimeout = actionTimeout || 0;
    playwright._defaultContextNavigationTimeout = navigationTimeout || 0;
    await use();
    playwright._defaultContextOptions = undefined;
    playwright._defaultContextTimeout = undefined;
    playwright._defaultContextNavigationTimeout = undefined;
  }, { auto: 'all-hooks-included',  title: 'context configuration', box: true } as any],

  _setupArtifacts: [async ({ playwright, screenshot }, use, testInfo) => {
    // This fixture has a separate zero-timeout slot to ensure that artifact collection
    // happens even after some fixtures or hooks time out.
    // Now that default test timeout is known, we can replace zero with an actual value.
    testInfo.setTimeout(testInfo.project.timeout);

    const artifactsRecorder = new ArtifactsRecorder(playwright, tracing().artifactsDir(), screenshot);
    await artifactsRecorder.willStartTest(testInfo as TestInfoImpl);

    const tracingGroupSteps: TestStepInternal[] = [];
    const csiListener: ClientInstrumentationListener = {
      onApiCallBegin: (data, channel) => {
        const testInfo = currentTestInfo();
        // Some special calls do not get into steps.
        if (!testInfo || data.apiName.includes('setTestIdAttribute') || data.apiName === 'tracing.groupEnd')
          return;
        const zone = currentZone().data<TestStepInternal>('stepZone');
        if (zone && zone.category === 'expect') {
          // Display the internal locator._expect call under the name of the enclosing expect call,
          // and connect it to the existing expect step.
          if (zone.apiName)
            data.apiName = zone.apiName;
          if (zone.title)
            data.title = stepTitle(zone.category, zone.title);
          data.stepId = zone.stepId;
          return;
        }

        // In the general case, create a step for each api call and connect them through the stepId.
        const step = testInfo._addStep({
          location: data.frames[0],
          category: 'pw:api',
          title: renderTitle(channel.type, channel.method, channel.params, data.title),
          apiName: data.apiName,
          params: channel.params,
        }, tracingGroupSteps[tracingGroupSteps.length - 1]);
        data.userData = step;
        data.stepId = step.stepId;
        if (data.apiName === 'tracing.group')
          tracingGroupSteps.push(step);
      },
      onApiCallEnd: data => {
        // "tracing.group" step will end later, when "tracing.groupEnd" finishes.
        if (data.apiName === 'tracing.group')
          return;
        if (data.apiName === 'tracing.groupEnd') {
          const step = tracingGroupSteps.pop();
          step?.complete({ error: data.error });
          return;
        }
        const step = data.userData;
        step?.complete({ error: data.error });
      },
      onWillPause: ({ keepTestTimeout }) => {
        if (!keepTestTimeout)
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

    const clientInstrumentation = (playwright as PlaywrightImpl)._instrumentation;
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
        await (context as BrowserContextImpl)._wrapApiCall(async () => {
          await context.clock.install({ time: 0 });
          await context.clock.pauseAt(1000);
        }, { internal: true });
      } else if (process.env.PW_CLOCK === 'realtime') {
        await (context as BrowserContextImpl)._wrapApiCall(async () => {
          await context.clock.install({ time: 0 });
        }, { internal: true });
      }

      return context;
    });

    let counter = 0;
    const closeReason = testInfo.status === 'timedOut' ? 'Test timeout of ' + testInfo.timeout + 'ms exceeded.' : 'Test ended.';
    await Promise.all([...contexts.keys()].map(async context => {
      await (context as BrowserContextImpl)._wrapApiCall(async () => {
        await context.close({ reason: closeReason });
      }, { internal: true });
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
    const context = await (browser as BrowserImpl)._newContextForReuse(defaultContextOptions);
    await use(context);
    const closeReason = testInfo.status === 'timedOut' ? 'Test timeout of ' + testInfo.timeout + 'ms exceeded.' : 'Test ended.';
    await (browser as BrowserImpl)._disconnectFromReusedContext(closeReason);
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

type ScreenshotOption = PlaywrightWorkerOptions['screenshot'] | undefined;

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
  const connectHeaders: { name: string, value: string }[] | undefined = (browser as BrowserImpl | null)?._connection.headers;
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

type SnapshotRecorderMode = 'on' | 'off' | 'only-on-failure' | 'on-first-failure';

class SnapshotRecorder {
  private _ordinal = 0;
  private _temporary: string[] = [];

  constructor(
    private _artifactsRecorder: ArtifactsRecorder,
    private _mode: SnapshotRecorderMode,
    private _name: string,
    private _contentType: string,
    private _extension: string,
    private _doSnapshot: (page: Page, path: string) => Promise<void>) {
  }

  fixOrdinal() {
    // Since beforeAll(s), test and afterAll(s) reuse the same TestInfo, make sure we do not
    // overwrite previous screenshots.
    this._ordinal = this.testInfo.attachments.filter(a => a.name === this._name).length;
  }

  private shouldCaptureUponFinish() {
    return this._mode === 'on' ||
        (this._mode === 'only-on-failure' && this.testInfo._isFailure()) ||
        (this._mode === 'on-first-failure' && this.testInfo._isFailure() && this.testInfo.retry === 0);
  }

  async maybeCapture() {
    if (!this.shouldCaptureUponFinish())
      return;

    await Promise.all(this._artifactsRecorder._playwright._allPages().map(page => this._snapshotPage(page, false)));
  }

  async persistTemporary() {
    if (this.shouldCaptureUponFinish()) {
      await Promise.all(this._temporary.map(async file => {
        try {
          const path = this._createAttachmentPath();
          await fs.promises.rename(file, path);
          this._attach(path);
        } catch {
        }
      }));
    }
  }

  async captureTemporary(context: BrowserContext) {
    if (this._mode === 'on' || this._mode === 'only-on-failure' || (this._mode === 'on-first-failure' && this.testInfo.retry === 0))
      await Promise.all(context.pages().map(page => this._snapshotPage(page, true)));
  }

  private _attach(screenshotPath: string) {
    this.testInfo.attachments.push({ name: this._name, path: screenshotPath, contentType: this._contentType });
  }

  private _createAttachmentPath() {
    const testFailed = this.testInfo._isFailure();
    const index = this._ordinal + 1;
    ++this._ordinal;
    const path = this.testInfo.outputPath(`test-${testFailed ? 'failed' : 'finished'}-${index}${this._extension}`);
    return path;
  }

  private _createTemporaryArtifact(...name: string[]) {
    const file = path.join(this._artifactsRecorder._artifactsDir, ...name);
    return file;
  }

  private async _snapshotPage(page: Page, temporary: boolean) {
    // Make sure we do not snapshot the same page twice for a single TestInfo,
    // which is reused between beforeAll(s), test and afterAll(s).
    if ((page as any)[this.testInfo._uniqueSymbol])
      return;
    (page as any)[this.testInfo._uniqueSymbol] = true;
    try {
      const path = temporary ? this._createTemporaryArtifact(createGuid() + this._extension) : this._createAttachmentPath();
      await this._doSnapshot(page, path);
      if (temporary)
        this._temporary.push(path);
      else
        this._attach(path);
    } catch {
      // snapshot may fail, just ignore.
    }
  }

  private get testInfo(): TestInfoImpl {
    return this._artifactsRecorder._testInfo;
  }
}

class ArtifactsRecorder {
  _testInfo!: TestInfoImpl;
  _playwright: PlaywrightImpl;
  _artifactsDir: string;
  private _startedCollectingArtifacts: symbol;

  private _screenshotRecorder: SnapshotRecorder;
  private _pageSnapshot: string | undefined;

  constructor(playwright: PlaywrightImpl, artifactsDir: string, screenshot: ScreenshotOption) {
    this._playwright = playwright;
    this._artifactsDir = artifactsDir;
    const screenshotOptions = typeof screenshot === 'string' ? undefined : screenshot;
    this._startedCollectingArtifacts = Symbol('startedCollectingArtifacts');

    this._screenshotRecorder = new SnapshotRecorder(this, normalizeScreenshotMode(screenshot), 'screenshot', 'image/png', '.png', async (page, path) => {
      await page.screenshot({ ...screenshotOptions, timeout: 5000, path, caret: 'initial' });
    });
  }

  async willStartTest(testInfo: TestInfoImpl) {
    this._testInfo = testInfo;
    testInfo._onDidFinishTestFunction = () => this.didFinishTestFunction();

    this._screenshotRecorder.fixOrdinal();

    // Process existing contexts.
    await Promise.all(this._playwright._allContexts().map(context => this.didCreateBrowserContext(context)));
    const existingApiRequests = Array.from((this._playwright.request as any)._contexts as Set<APIRequestContext>);
    await Promise.all(existingApiRequests.map(c => this.didCreateRequestContext(c)));
  }

  async didCreateBrowserContext(context: BrowserContext) {
    await this._startTraceChunkOnContextCreation(context.tracing);
  }

  async willCloseBrowserContext(context: BrowserContext) {
    await this._stopTracing(context.tracing);
    await this._screenshotRecorder.captureTemporary(context);
    await this._takePageSnapshot(context);
  }

  private async _takePageSnapshot(context: BrowserContext) {
    if (process.env.PLAYWRIGHT_NO_COPY_PROMPT)
      return;
    if (this._testInfo.errors.length === 0)
      return;
    if (this._pageSnapshot)
      return;
    const page = context.pages()[0];
    if (!page)
      return;

    try {
      // TODO: maybe capture snapshot when the error is created, so it's from the right page and right time
      this._pageSnapshot = await (page as PageImpl)._snapshotForAI({ timeout: 5000 });
    } catch {}
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
    await this._screenshotRecorder.maybeCapture();
  }

  async didFinishTest() {
    await this.didFinishTestFunction();

    const leftoverContexts = this._playwright._allContexts();
    const leftoverApiRequests = Array.from((this._playwright.request as any)._contexts as Set<APIRequestContext>);

    // Collect traces/screenshots for remaining contexts.
    await Promise.all(leftoverContexts.map(async context => {
      await this._stopTracing(context.tracing);
    }).concat(leftoverApiRequests.map(async context => {
      const tracing = (context as any)._tracing as Tracing;
      await this._stopTracing(tracing);
    })));

    await this._screenshotRecorder.persistTemporary();

    const context = leftoverContexts[0];
    if (context)
      await this._takePageSnapshot(context);

    if (this._pageSnapshot && this._testInfo.errors.length > 0 && !this._testInfo.attachments.some(a => a.name === 'error-context')) {
      const lines = [
        '# Page snapshot',
        '',
        '```yaml',
        this._pageSnapshot,
        '```',
      ];
      const filePath = this._testInfo.outputPath('error-context.md');
      await fs.promises.writeFile(filePath, lines.join('\n'), 'utf8');

      this._testInfo._attach({
        name: 'error-context',
        contentType: 'text/markdown',
        path: filePath,
      }, undefined);
    }
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
      await tracing.stopChunk({ path: this._testInfo._tracing.maybeGenerateNextTraceRecordingPath() });
  }
}

function renderTitle(type: string, method: string, params: Record<string, string> | undefined, title?: string) {
  const prefix = renderTitleForCall({ title, type, method, params });
  let selector;
  if (params?.['selector'] && typeof params.selector === 'string')
    selector = asLocatorDescription('javascript', params.selector);
  return prefix + (selector ? ` ${selector}` : '');
}

function tracing() {
  return (test.info() as TestInfoImpl)._tracing;
}

export const test = _baseTest.extend<TestFixtures, WorkerFixtures>(playwrightFixtures);

export { defineConfig } from './common/configLoader';
export { mergeTests } from './common/testType';
export { mergeExpects } from './matchers/expect';
