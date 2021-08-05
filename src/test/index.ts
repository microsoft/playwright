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

import expectLibrary from 'expect';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { LaunchOptions, BrowserContextOptions, Page, BrowserContext, BrowserType } from '../../types/types';
import type { TestType, PlaywrightTestArgs, PlaywrightTestOptions, PlaywrightWorkerArgs, PlaywrightWorkerOptions } from '../../types/test';
import { rootTestType } from './testType';
import { createGuid, removeFolders } from '../utils/utils';
export { expect } from './expect';
export const _baseTest: TestType<{}, {}> = rootTestType.test;

const artifactsFolder = path.join(os.tmpdir(), 'pwt-' + createGuid());

type TestFixtures = PlaywrightTestArgs & {
  _setupContextArtifacts: void;
};
type WorkerAndFileFixtures = PlaywrightWorkerArgs & PlaywrightWorkerOptions & PlaywrightTestOptions & {
  _browserType: BrowserType;
  _combinedContextOptions: BrowserContextOptions,
  _setupDefaultContextOptions: void,
};

export const test = _baseTest.extend<TestFixtures, WorkerAndFileFixtures>({
  defaultBrowserType: [ 'chromium', { scope: 'worker' } ],
  browserName: [ ({ defaultBrowserType }, use) => use(defaultBrowserType), { scope: 'worker' } ],
  playwright: [ require('../inprocess'), { scope: 'worker' } ],
  headless: [ undefined, { scope: 'worker' } ],
  channel: [ undefined, { scope: 'worker' } ],
  launchOptions: [ {}, { scope: 'worker' } ],

  _browserType: [async ({ playwright, browserName }, use) => {
    if (!['chromium', 'firefox', 'webkit'].includes(browserName))
      throw new Error(`Unexpected browserName "${browserName}", must be one of "chromium", "firefox" or "webkit"`);
    await use(playwright[browserName]);
  }, { scope: 'worker' }],

  browser: [ async ({ _browserType, headless, channel, launchOptions }, use) => {
    const options: LaunchOptions = {
      handleSIGINT: false,
      timeout: 0,
      ...launchOptions,
    };
    if (headless !== undefined)
      options.headless = headless;
    if (channel !== undefined)
      options.channel = channel;
    const browser = await _browserType.launch(options);
    await use(browser);
    await browser.close();
    await removeFolders([artifactsFolder]);
  }, { scope: 'worker' } ],

  screenshot: ['off', { scope: 'file' }],
  video: ['off', { scope: 'file' }],
  trace: ['off', { scope: 'file' }],
  acceptDownloads: [undefined, { scope: 'file' }],
  bypassCSP: [undefined, { scope: 'file' }],
  colorScheme: [undefined, { scope: 'file' }],
  deviceScaleFactor: [undefined, { scope: 'file' }],
  extraHTTPHeaders: [undefined, { scope: 'file' }],
  geolocation: [undefined, { scope: 'file' }],
  hasTouch: [undefined, { scope: 'file' }],
  httpCredentials: [undefined, { scope: 'file' }],
  ignoreHTTPSErrors: [undefined, { scope: 'file' }],
  isMobile: [undefined, { scope: 'file' }],
  javaScriptEnabled: [undefined, { scope: 'file' }],
  locale: [undefined, { scope: 'file' }],
  offline: [undefined, { scope: 'file' }],
  permissions: [undefined, { scope: 'file' }],
  proxy: [undefined, { scope: 'file' }],
  storageState: [undefined, { scope: 'file' }],
  timezoneId: [undefined, { scope: 'file' }],
  userAgent: [undefined, { scope: 'file' }],
  viewport: [undefined, { scope: 'file' }],
  actionTimeout: [undefined, { scope: 'file' }],
  navigationTimeout: [undefined, { scope: 'file' }],
  baseURL: [async ({ }, use) => {
    await use(process.env.PLAYWRIGHT_TEST_BASE_URL);
  }, { scope: 'file' }],
  contextOptions: [{}, { scope: 'file' }],

  _combinedContextOptions: [async ({
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
  }, { scope: 'file' }],

  _setupDefaultContextOptions: [async ({ _browserType, _combinedContextOptions, trace, actionTimeout }, use) => {
    expectLibrary.setState({ playwrightActionTimeout: actionTimeout } as any);
    (_browserType as any)._defaultContextOptions = _combinedContextOptions;
    if (trace !== 'off') {
      // Start snapshotting right away to not miss resources.
      (_browserType as any)._onDidCreateContext = async (context: BrowserContext) => {
        await context.tracing.start({ snapshots: true });
      };
    }
    await use();
  }, { scope: 'file', auto: true }],

  _setupContextArtifacts: [async ({ _browserType, trace, screenshot, actionTimeout, navigationTimeout }, use, testInfo) => {
    testInfo.snapshotSuffix = process.platform;
    if (process.env.PWDEBUG)
      testInfo.setTimeout(0);
    if (trace === 'retry-with-trace')
      trace = 'on-first-retry';
    const captureTrace = (trace === 'on' || trace === 'retain-on-failure' || (trace === 'on-first-retry' && testInfo.retry === 1));
    const temporaryTraceFiles: string[] = [];

    const onDidCreateContext = async (context: BrowserContext) => {
      context.setDefaultTimeout(actionTimeout || 0);
      context.setDefaultNavigationTimeout(navigationTimeout || actionTimeout || 0);
      if (captureTrace) {
        await context.tracing.start({ screenshots: true, snapshots: true });
      } else {
        // We started tracing just in case for all contexts created in beforeAll.
        // However, we might actually not need it, for example with "on-first-retry" mode,
        // so we stop it here since we know for sure already.
        await context.tracing.stop().catch(() => {});
      }
      (context as any)._csi = {
        onApiCall: (name: string) => {
          return (testInfo as any)._addStep('pw:api', name);
        },
      };
    };

    const onWillCloseContext = async (context: BrowserContext) => {
      if (captureTrace) {
        // Export trace for now. We'll know whether we have to preserve it
        // after the test finishes.
        const tracePath = path.join(artifactsFolder, createGuid() + '.zip');
        temporaryTraceFiles.push(tracePath);
        await (context.tracing as any)._export({ path: tracePath });
      }
    };

    // 1. Setup instrumentation and process existing contexts.
    const oldOnDidCreateContext = (_browserType as any)._onDidCreateContext;
    (_browserType as any)._onDidCreateContext = onDidCreateContext;
    (_browserType as any)._onWillCloseContext = onWillCloseContext;
    const existingContexts = (_browserType as any)._contexts() as BrowserContext[];
    await Promise.all(existingContexts.map(onDidCreateContext));

    // 2. Run the test.
    await use();

    // 3. Determine whether we need the artifacts.
    const testFailed = testInfo.status !== testInfo.expectedStatus;
    const preserveTrace = captureTrace && (trace === 'on' || (testFailed && trace === 'retain-on-failure') || (trace === 'on-first-retry' && testInfo.retry === 1));
    const captureScreenshots = screenshot === 'on' || (screenshot === 'only-on-failure' && testFailed);

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
    const leftoverContexts = (_browserType as any)._contexts() as BrowserContext[];
    (_browserType as any)._onDidCreateContext = oldOnDidCreateContext;
    (_browserType as any)._onWillCloseContext = undefined;
    leftoverContexts.forEach(context => (context as any)._csi = undefined);

    // 5. Collect artifacts from any non-closed contexts.
    await Promise.all(leftoverContexts.map(async context => {
      if (preserveTrace)
        await (context.tracing as any)._export({ path: addTraceAttachment() });
      if (captureScreenshots)
        await Promise.all(context.pages().map(page => page.screenshot({ timeout: 5000, path: addScreenshotAttachment() }).catch(() => {})));
    }));

    // 6. Either remove or attach temporary traces for contexts closed before test finished.
    await Promise.all(temporaryTraceFiles.map(async file => {
      if (preserveTrace)
        await fs.promises.rename(file, addTraceAttachment()).catch(() => {});
      else
        await fs.promises.unlink(file).catch(() => {});
    }));
  }, { auto: true }],

  createContext: async ({ browser, video }, use, testInfo) => {
    let videoMode = typeof video === 'string' ? video : video.mode;
    if (videoMode === 'retry-with-video')
      videoMode = 'on-first-retry';

    const captureVideo = (videoMode === 'on' || videoMode === 'retain-on-failure' || (videoMode === 'on-first-retry' && testInfo.retry === 1));

    const allContexts: BrowserContext[] = [];
    const allPages: Page[] = [];

    await use(async (additionalOptions = {}) => {
      let recordVideoDir: string | null = null;
      const recordVideoSize = typeof video === 'string' ? undefined : video.size;
      if (captureVideo) {
        await fs.promises.mkdir(artifactsFolder, { recursive: true });
        recordVideoDir = artifactsFolder;
      }

      const combinedOptions: BrowserContextOptions = {
        recordVideo: recordVideoDir ? { dir: recordVideoDir, size: recordVideoSize } : undefined,
        ...additionalOptions,
      };
      const context = await browser.newContext(combinedOptions);
      context.on('page', page => allPages.push(page));

      allContexts.push(context);
      return context;
    });

    const prependToError = (testInfo.status === 'timedOut' && allContexts.length) ?
      formatPendingCalls((allContexts[0] as any)._connection.pendingProtocolCalls()) : '';
    await Promise.all(allContexts.map(context => context.close()));
    if (prependToError) {
      if (!testInfo.error) {
        testInfo.error = { value: prependToError };
      } else if (testInfo.error.message) {
        testInfo.error.message = prependToError + testInfo.error.message;
        if (testInfo.error.stack)
          testInfo.error.stack = prependToError + testInfo.error.stack;
      }
    }

    const testFailed = testInfo.status !== testInfo.expectedStatus;
    const preserveVideo = captureVideo && (videoMode === 'on' || (testFailed && videoMode === 'retain-on-failure') || (videoMode === 'on-first-retry' && testInfo.retry === 1));
    if (preserveVideo) {
      await Promise.all(allPages.map(async page => {
        const v = page.video();
        if (!v)
          return;
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
  },

  context: async ({ createContext }, use) => {
    await use(await createContext());
  },

  page: async ({ context }, use) => {
    await use(await context.newPage());
  },
});
export default test;

function formatPendingCalls(calls: ProtocolCall[]) {
  if (!calls.length)
    return '';
  return 'Pending operations:\n' + calls.map(call => {
    const frame = call.stack && call.stack[0] ? formatStackFrame(call.stack[0]) : '<unknown>';
    return `  - ${call.apiName} at ${frame}\n`;
  }).join('') + '\n';
}

function formatStackFrame(frame: StackFrame) {
  const file = path.relative(process.cwd(), frame.file) || path.basename(frame.file);
  return `${file}:${frame.line || 1}:${frame.column || 1}`;
}

type StackFrame = {
  file: string,
  line?: number,
  column?: number,
  function?: string,
};

type ProtocolCall = {
  stack?: StackFrame[],
  apiName?: string,
};
