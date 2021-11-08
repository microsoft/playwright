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
import type { LaunchOptions, BrowserContextOptions, Page, BrowserContext, BrowserType, Video } from 'playwright-core';
import type { TestType, PlaywrightTestArgs, PlaywrightTestOptions, PlaywrightWorkerArgs, PlaywrightWorkerOptions, TestInfo } from '../types/test';
import { rootTestType } from './testType';
import { createGuid, removeFolders } from 'playwright-core/lib/utils/utils';
import { GridClient } from 'playwright-core/lib/grid/gridClient';
import { Browser } from 'playwright-core';
export { expect } from './expect';
export const _baseTest: TestType<{}, {}> = rootTestType.test;

type TestFixtures = PlaywrightTestArgs & PlaywrightTestOptions & {
  _combinedContextOptions: BrowserContextOptions,
  _setupContextOptionsAndArtifacts: void;
  _contextFactory: (options?: BrowserContextOptions) => Promise<BrowserContext>;
};
type WorkerAndFileFixtures = PlaywrightWorkerArgs & PlaywrightWorkerOptions & {
  _browserType: BrowserType;
  _browserOptions: LaunchOptions;
  _artifactsDir: () => string;
  _snapshotSuffix: string;
};

export const test = _baseTest.extend<TestFixtures, WorkerAndFileFixtures>({
  defaultBrowserType: [ 'chromium', { scope: 'worker' } ],
  browserName: [ ({ defaultBrowserType }, use) => use(defaultBrowserType), { scope: 'worker' } ],
  playwright: [async ({}, use, workerInfo) => {
    if (process.env.PW_GRID) {
      const gridClient = await GridClient.connect(process.env.PW_GRID);
      await use(gridClient.playwright() as any);
      await gridClient.close();
    } else {
      await use(require('playwright-core'));
    }
  }, { scope: 'worker' } ],
  headless: [ undefined, { scope: 'worker' } ],
  channel: [ undefined, { scope: 'worker' } ],
  launchOptions: [ {}, { scope: 'worker' } ],
  screenshot: [ 'off', { scope: 'worker' } ],
  video: [ 'off', { scope: 'worker' } ],
  trace: [ 'off', { scope: 'worker' } ],

  _artifactsDir: [async ({}, use, workerInfo) => {
    let dir: string | undefined;
    await use(() => {
      if (!dir) {
        dir = path.join(workerInfo.project.outputDir, '.playwright-artifacts-' + workerInfo.workerIndex);
        fs.mkdirSync(dir, { recursive: true });
      }
      return dir;
    });
    if (dir)
      await removeFolders([dir]);
  }, { scope: 'worker' }],

  _browserOptions: [browserOptionsWorkerFixture, { scope: 'worker' }],
  _browserType: [browserTypeWorkerFixture, { scope: 'worker' }],
  browser: [browserWorkerFixture, { scope: 'worker' } ],

  acceptDownloads: undefined,
  bypassCSP: undefined,
  colorScheme: undefined,
  deviceScaleFactor: undefined,
  extraHTTPHeaders: undefined,
  geolocation: undefined,
  hasTouch: undefined,
  httpCredentials: undefined,
  ignoreHTTPSErrors: undefined,
  isMobile: undefined,
  javaScriptEnabled: undefined,
  locale: undefined,
  offline: undefined,
  permissions: undefined,
  proxy: undefined,
  storageState: undefined,
  timezoneId: undefined,
  userAgent: undefined,
  viewport: undefined,
  actionTimeout: undefined,
  navigationTimeout: undefined,
  baseURL: async ({ }, use) => {
    await use(process.env.PLAYWRIGHT_TEST_BASE_URL);
  },
  contextOptions: {},

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
    await use({
      ...contextOptions,
      ...options,
    });
  },

  _snapshotSuffix: [process.env.PLAYWRIGHT_DOCKER ? 'docker' : process.platform, { scope: 'worker' }],

  _setupContextOptionsAndArtifacts: [async ({ _snapshotSuffix, _browserType, _combinedContextOptions, _artifactsDir, trace, screenshot, actionTimeout, navigationTimeout }, use, testInfo) => {
    testInfo.snapshotSuffix = _snapshotSuffix;
    if (process.env.PWDEBUG)
      testInfo.setTimeout(0);

    let traceMode = typeof trace === 'string' ? trace : trace.mode;
    if (traceMode as any === 'retry-with-trace')
      traceMode = 'on-first-retry';
    const defaultTraceOptions = { screenshots: true, snapshots: true, sources: true };
    const traceOptions = typeof trace === 'string' ? defaultTraceOptions : { ...defaultTraceOptions, ...trace, mode: undefined };

    const captureTrace = (traceMode === 'on' || traceMode === 'retain-on-failure' || (traceMode === 'on-first-retry' && testInfo.retry === 1));
    const temporaryTraceFiles: string[] = [];
    const temporaryScreenshots: string[] = [];

    const onDidCreateContext = async (context: BrowserContext) => {
      context.setDefaultTimeout(actionTimeout || 0);
      context.setDefaultNavigationTimeout(navigationTimeout || actionTimeout || 0);
      if (captureTrace) {
        const title = [path.relative(testInfo.project.testDir, testInfo.file) + ':' + testInfo.line, ...testInfo.titlePath.slice(1)].join(' › ');
        if (!(context.tracing as any)[kTracingStarted]) {
          await context.tracing.start({ ...traceOptions, title });
          (context.tracing as any)[kTracingStarted] = true;
        } else {
          await context.tracing.startChunk({ title });
        }
      } else {
        (context.tracing as any)[kTracingStarted] = false;
        await context.tracing.stop();
      }
      (context as any)._instrumentation.addListener({
        onApiCallBegin: (apiCall: string, stackTrace: ParsedStackTrace | null, userData: any) => {
          if (apiCall.startsWith('expect.'))
            return { userObject: null };
          const testInfoImpl = testInfo as any;
          const step = testInfoImpl._addStep({
            location: stackTrace?.frames[0],
            category: 'pw:api',
            title: apiCall,
            canHaveChildren: false,
            forceNoParent: false
          });
          userData.userObject = step;
        },
        onApiCallEnd: (userData: any, error?: Error) => {
          const step = userData.userObject;
          step?.complete(error);
        },
      });
    };

    const startedCollectingArtifacts = Symbol('startedCollectingArtifacts');

    const onWillCloseContext = async (context: BrowserContext) => {
      (context as any)[startedCollectingArtifacts] = true;
      if (captureTrace) {
        // Export trace for now. We'll know whether we have to preserve it
        // after the test finishes.
        const tracePath = path.join(_artifactsDir(), createGuid() + '.zip');
        temporaryTraceFiles.push(tracePath);
        await context.tracing.stopChunk({ path: tracePath });
      }
      if (screenshot === 'on' || screenshot === 'only-on-failure') {
        // Capture screenshot for now. We'll know whether we have to preserve them
        // after the test finishes.
        await Promise.all(context.pages().map(async page => {
          const screenshotPath = path.join(_artifactsDir(), createGuid() + '.png');
          temporaryScreenshots.push(screenshotPath);
          await page.screenshot({ timeout: 5000, path: screenshotPath }).catch(() => {});
        }));
      }
    };

    // 1. Setup instrumentation and process existing contexts.
    (_browserType as any)._onDidCreateContext = onDidCreateContext;
    (_browserType as any)._onWillCloseContext = onWillCloseContext;
    (_browserType as any)._defaultContextOptions = _combinedContextOptions;
    const existingContexts = Array.from((_browserType as any)._contexts) as BrowserContext[];
    await Promise.all(existingContexts.map(onDidCreateContext));

    // 2. Run the test.
    await use();

    // 3. Determine whether we need the artifacts.
    const testFailed = testInfo.status !== testInfo.expectedStatus;
    const isHook = !!hookType(testInfo);
    const preserveTrace = captureTrace && !isHook && (traceMode === 'on' || (testFailed && traceMode === 'retain-on-failure') || (traceMode === 'on-first-retry' && testInfo.retry === 1));
    const captureScreenshots = !isHook && (screenshot === 'on' || (screenshot === 'only-on-failure' && testFailed));

    const traceAttachments: string[] = [];
    const addTraceAttachment = () => {
      const tracePath = testInfo.outputPath(`trace${traceAttachments.length ? '-' + traceAttachments.length : ''}.zip`);
      traceAttachments.push(tracePath);
      testInfo.attachments.push({ name: 'trace', path: tracePath, contentType: 'application/zip' });
      return tracePath;
    };

    const screenshotAttachments: string[] = [];
    const addScreenshotAttachment = () => {
      const screenshotPath = testInfo.outputPath(`test-${testFailed ? 'failed' : 'finished'}-${screenshotAttachments.length + 1}.png`);
      screenshotAttachments.push(screenshotPath);
      testInfo.attachments.push({ name: 'screenshot', path: screenshotPath, contentType: 'image/png' });
      return screenshotPath;
    };

    // 4. Cleanup instrumentation.
    const leftoverContexts = Array.from((_browserType as any)._contexts) as BrowserContext[];
    (_browserType as any)._onDidCreateContext = undefined;
    (_browserType as any)._onWillCloseContext = undefined;
    (_browserType as any)._defaultContextOptions = undefined;
    leftoverContexts.forEach(context => (context as any)._instrumentation.removeAllListeners());

    // 5. Collect artifacts from any non-closed contexts.
    await Promise.all(leftoverContexts.map(async context => {
      // When we timeout during context.close(), we might end up with context still alive
      // but artifacts being already collected. In this case, do not collect artifacts
      // for the second time.
      if ((context as any)[startedCollectingArtifacts])
        return;

      if (preserveTrace)
        await context.tracing.stopChunk({ path: addTraceAttachment() });
      else if (captureTrace)
        await context.tracing.stopChunk();
      if (captureScreenshots)
        await Promise.all(context.pages().map(page => page.screenshot({ timeout: 5000, path: addScreenshotAttachment() }).catch(() => {})));
    }));

    // 6. Either remove or attach temporary traces and screenshots for contexts closed
    // before the test has finished.
    await Promise.all(temporaryTraceFiles.map(async file => {
      if (preserveTrace)
        await fs.promises.rename(file, addTraceAttachment()).catch(() => {});
      else
        await fs.promises.unlink(file).catch(() => {});
    }));
    await Promise.all(temporaryScreenshots.map(async file => {
      if (captureScreenshots)
        await fs.promises.rename(file, addScreenshotAttachment()).catch(() => {});
      else
        await fs.promises.unlink(file).catch(() => {});
    }));
  }, { auto: true }],

  _contextFactory: async ({ browser, video, _artifactsDir }, use, testInfo) => {
    let videoMode = typeof video === 'string' ? video : video.mode;
    if (videoMode === 'retry-with-video')
      videoMode = 'on-first-retry';

    const captureVideo = (videoMode === 'on' || videoMode === 'retain-on-failure' || (videoMode === 'on-first-retry' && testInfo.retry === 1));
    const contexts = new Map<BrowserContext, { pages: Page[] }>();

    await use(async options => {
      const hook = hookType(testInfo);
      if (hook)
        throw new Error(`"context" and "page" fixtures are not supported in ${hook}. Use browser.newContext() instead.`);
      const videoOptions: BrowserContextOptions = captureVideo ? {
        recordVideo: {
          dir: _artifactsDir(),
          size: typeof video === 'string' ? undefined : video.size,
        }
      } : {};
      const context = await browser.newContext({ ...videoOptions, ...options });
      const contextData: { pages: Page[] } = { pages: [] };
      contexts.set(context, contextData);
      context.on('page', page => contextData.pages.push(page));
      return context;
    });

    const prependToError = testInfo.status === 'timedOut' ?
      formatPendingCalls((browser as any)._connection.pendingProtocolCalls()) : '';

    await Promise.all([...contexts.keys()].map(async context => {
      await context.close();

      const testFailed = testInfo.status !== testInfo.expectedStatus;
      const preserveVideo = captureVideo && (videoMode === 'on' || (testFailed && videoMode === 'retain-on-failure') || (videoMode === 'on-first-retry' && testInfo.retry === 1));
      if (preserveVideo) {
        const { pages } = contexts.get(context)!;
        const videos = pages.map(p => p.video()).filter(Boolean) as Video[];
        await Promise.all(videos.map(async v => {
          try {
            const videoPath = await v.path();
            const savedPath = testInfo.outputPath(path.basename(videoPath));
            await v.saveAs(savedPath);
            testInfo.attachments.push({ name: 'video', path: savedPath, contentType: 'video/webm' });
          } catch (e) {
            // Silent catch empty videos.
          }
        }));
      }
    }));

    if (prependToError) {
      if (!testInfo.error) {
        testInfo.error = { value: prependToError };
      } else if (testInfo.error.message) {
        testInfo.error.message = prependToError + testInfo.error.message;
        if (testInfo.error.stack)
          testInfo.error.stack = prependToError + testInfo.error.stack;
      }
    }
  },

  context: async ({ _contextFactory }, use) => {
    await use(await _contextFactory());
  },

  page: async ({ context }, use) => {
    await use(await context.newPage());
  },

  request: async ({ playwright, _combinedContextOptions }, use) => {
    const request = await playwright.request.newContext(_combinedContextOptions);
    await use(request);
    await request.dispose();
  }

});

export async function browserOptionsWorkerFixture(
  {
    headless,
    channel,
    launchOptions
  }: {
    headless: boolean | undefined,
    channel: string | undefined,
    launchOptions: LaunchOptions
  }, use: (options: LaunchOptions) => Promise<void>) {
  const options: LaunchOptions = {
    handleSIGINT: false,
    timeout: 0,
    ...launchOptions,
  };
  if (headless !== undefined)
    options.headless = headless;
  if (channel !== undefined)
    options.channel = channel;
  await use(options);
}

export async function browserTypeWorkerFixture(
  {
    playwright,
    browserName,
    _browserOptions
  }: {
    playwright: any,
    browserName: string,
    _browserOptions: LaunchOptions
  }, use: (browserType: BrowserType) => Promise<void>) {
  if (!['chromium', 'firefox', 'webkit'].includes(browserName))
    throw new Error(`Unexpected browserName "${browserName}", must be one of "chromium", "firefox" or "webkit"`);
  const browserType = playwright[browserName];
  (browserType as any)._defaultLaunchOptions = _browserOptions;
  await use(browserType);
  (browserType as any)._defaultLaunchOptions = undefined;
}

export async function browserWorkerFixture(
  { _browserType }: { _browserType: BrowserType },
  use: (browser: Browser) => Promise<void>) {
  const browser = await _browserType.launch();
  await use(browser);
  await browser.close();
}


function formatPendingCalls(calls: ParsedStackTrace[]) {
  if (!calls.length)
    return '';
  return 'Pending operations:\n' + calls.map(call => {
    const frame = call.frames && call.frames[0] ? formatStackFrame(call.frames[0]) : '<unknown>';
    return `  - ${call.apiName} at ${frame}\n`;
  }).join('') + '\n';
}

function formatStackFrame(frame: StackFrame) {
  const file = path.relative(process.cwd(), frame.file) || path.basename(frame.file);
  return `${file}:${frame.line || 1}:${frame.column || 1}`;
}

function hookType(testInfo: TestInfo): 'beforeAll' | 'afterAll' | undefined {
  if (testInfo.title.startsWith('beforeAll'))
    return 'beforeAll';
  if (testInfo.title.startsWith('afterAll'))
    return 'afterAll';
}

type StackFrame = {
  file: string,
  line?: number,
  column?: number,
  function?: string,
};

type ParsedStackTrace = {
  frames: StackFrame[];
  frameTexts: string[];
  apiName: string;
};

const kTracingStarted = Symbol('kTracingStarted');

export default test;
