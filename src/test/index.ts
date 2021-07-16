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
import * as os from 'os';
import type { LaunchOptions, BrowserContextOptions, Page } from '../../types/types';
import type { TestType, PlaywrightTestArgs, PlaywrightTestOptions, PlaywrightWorkerArgs, PlaywrightWorkerOptions, FullConfig, TestInfo } from '../../types/test';
import { rootTestType } from './testType';
import { createGuid, removeFolders } from '../utils/utils';
export { expect } from './expect';
export const _baseTest: TestType<{}, {}> = rootTestType.test;

const artifactsFolder = path.join(os.tmpdir(), 'pwt-' + createGuid());

export const test = _baseTest.extend<PlaywrightTestArgs & PlaywrightTestOptions, PlaywrightWorkerArgs & PlaywrightWorkerOptions>({
  defaultBrowserType: [ 'chromium', { scope: 'worker' } ],
  browserName: [ ({ defaultBrowserType }, use) => use(defaultBrowserType), { scope: 'worker' } ],
  playwright: [ require('../inprocess'), { scope: 'worker' } ],
  headless: [ undefined, { scope: 'worker' } ],
  channel: [ undefined, { scope: 'worker' } ],
  launchOptions: [ {}, { scope: 'worker' } ],

  browser: [ async ({ playwright, browserName, headless, channel, launchOptions }, use) => {
    if (!['chromium', 'firefox', 'webkit'].includes(browserName))
      throw new Error(`Unexpected browserName "${browserName}", must be one of "chromium", "firefox" or "webkit"`);
    const options: LaunchOptions = {
      handleSIGINT: false,
      timeout: 0,
      ...launchOptions,
    };
    if (headless !== undefined)
      options.headless = headless;
    if (channel !== undefined)
      options.channel = channel;
    const browser = await playwright[browserName].launch(options);
    await use(browser);
    await browser.close();
    await removeFolders([artifactsFolder]);
  }, { scope: 'worker' } ],

  screenshot: 'off',
  video: 'off',
  trace: 'off',
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
  baseURL: async ({ }, use) => {
    await use(process.env.PLAYWRIGHT_TEST_BASE_URL);
  },
  contextOptions: {},

  context: async ({ browser, screenshot, trace, video, acceptDownloads, bypassCSP, colorScheme, deviceScaleFactor, extraHTTPHeaders, hasTouch, geolocation, httpCredentials, ignoreHTTPSErrors, isMobile, javaScriptEnabled, locale, offline, permissions, proxy, storageState, viewport, timezoneId, userAgent, baseURL, contextOptions }, use, testInfo) => {
    testInfo.snapshotSuffix = process.platform;
    if (process.env.PWDEBUG)
      testInfo.setTimeout(0);

    let videoMode = typeof video === 'string' ? video : video.mode;
    if (videoMode === 'retry-with-video')
      videoMode = 'on-first-retry';
    if (trace === 'retry-with-trace')
      trace = 'on-first-retry';

    const captureVideo = (videoMode === 'on' || videoMode === 'retain-on-failure' || (videoMode === 'on-first-retry' && testInfo.retry === 1));
    const captureTrace = (trace === 'on' || trace === 'retain-on-failure' || (trace === 'on-first-retry' && testInfo.retry === 1));

    let recordVideoDir: string | null = null;
    const recordVideoSize = typeof video === 'string' ? undefined : video.size;
    if (captureVideo) {
      await fs.promises.mkdir(artifactsFolder, { recursive: true });
      recordVideoDir = artifactsFolder;
    }

    const options: BrowserContextOptions = {
      recordVideo: recordVideoDir ? { dir: recordVideoDir, size: recordVideoSize } : undefined,
      ...contextOptions,
    };
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

    const context = await browser.newContext(options);
    context.setDefaultTimeout(0);
    const allPages: Page[] = [];
    context.on('page', page => allPages.push(page));

    if (captureTrace) {
      const name = path.relative(testInfo.project.outputDir, testInfo.outputDir).replace(/[\/\\]/g, '-');
      await context.tracing.start({ name, screenshots: true, snapshots: true });
    }

    await use(context);

    const testFailed = testInfo.status !== testInfo.expectedStatus;

    const preserveTrace = captureTrace && (trace === 'on' || (testFailed && trace === 'retain-on-failure') || (trace === 'on-first-retry' && testInfo.retry === 1));
    if (preserveTrace) {
      const tracePath = testInfo.outputPath(`trace.zip`);
      await context.tracing.stop({ path: tracePath });
      testInfo.attachments.push({ name: 'trace', path: tracePath, contentType: 'application/zip' });
    } else if (captureTrace) {
      await context.tracing.stop();
    }

    const captureScreenshots = (screenshot === 'on' || (screenshot === 'only-on-failure' && testFailed));
    if (captureScreenshots) {
      await Promise.all(allPages.map(async (page, index) => {
        const screenshotPath = testInfo.outputPath(`test-${testFailed ? 'failed' : 'finished'}-${++index}.png`);
        try {
          await page.screenshot({ timeout: 5000, path: screenshotPath });
          testInfo.attachments.push({ name: 'screenshot', path: screenshotPath, contentType: 'image/png' });
        } catch {
        }
      }));
    }

    const prependToError = testInfo.status ===  'timedOut' ? formatPendingCalls((context as any)._connection.pendingProtocolCalls(), testInfo) : '';
    await context.close();
    if (prependToError) {
      if (!testInfo.error) {
        testInfo.error = { value: prependToError };
      } else if (testInfo.error.message) {
        testInfo.error.message = prependToError + testInfo.error.message;
        if (testInfo.error.stack)
          testInfo.error.stack = prependToError + testInfo.error.stack;
      }
    }

    const preserveVideo = captureVideo && (videoMode === 'on' || (testFailed && videoMode === 'retain-on-failure') || (videoMode === 'on-first-retry' && testInfo.retry === 1));
    if (preserveVideo) {
      await Promise.all(allPages.map(async page => {
        const v = page.video();
        if (!v)
          return;
        try {
          const videoPath = await v.path();
          const fileName = path.basename(videoPath);
          await v.saveAs(testInfo.outputPath(fileName));
        } catch (e) {
          // Silent catch empty videos.
        }
      }));
    }
  },

  page: async ({ context }, use) => {
    await use(await context.newPage());
  },
});
export default test;

function formatPendingCalls(calls: ProtocolCall[], testInfo: TestInfo) {
  if (!calls.length)
    return '';
  return 'Pending operations:\n' + calls.map(call => {
    const frame = call.stack && call.stack[0] ? formatStackFrame(testInfo.config, call.stack[0]) : '<unknown>';
    return `  - ${call.apiName} at ${frame}\n`;
  }).join('') + '\n';
}

function formatStackFrame(config: FullConfig, frame: StackFrame) {
  const file = path.relative(config.rootDir, frame.file) || path.basename(frame.file);
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
