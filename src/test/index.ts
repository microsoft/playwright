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
import type { LaunchOptions, BrowserContextOptions, Page, BrowserContext, Browser } from '../../types/types';
import { TestType, PlaywrightTestArgs, PlaywrightTestOptions, PlaywrightWorkerArgs, PlaywrightWorkerOptions, TestInfo } from '../../types/test';
import { rootTestType } from './testType';
import { expect } from './expect';
export { expect } from './expect';

export const _baseTest: TestType<{}, {}> = rootTestType.test;

let debuggingContext: BrowserContext | null = null;
let debuggingContextOptions: BrowserContextOptions | null = null;

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
      ...launchOptions,
    };
    if (headless !== undefined)
      options.headless = headless;
    if (channel !== undefined)
      options.channel = channel;
    const browser = await playwright[browserName].launch(options);
    await use(browser);
    await browser.close();
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
  contextOptions: {},

  context: async ({ browser, screenshot, trace, video, acceptDownloads, bypassCSP, colorScheme, deviceScaleFactor, extraHTTPHeaders, hasTouch, geolocation, httpCredentials, ignoreHTTPSErrors, isMobile, javaScriptEnabled, locale, offline, permissions, proxy, storageState, viewport, timezoneId, userAgent, contextOptions }, use, testInfo) => {
    const params = { browser, screenshot, trace, video, acceptDownloads, bypassCSP, colorScheme, deviceScaleFactor, extraHTTPHeaders, hasTouch, geolocation, httpCredentials, ignoreHTTPSErrors, isMobile, javaScriptEnabled, locale, offline, permissions, proxy, storageState, viewport, timezoneId, userAgent, contextOptions };
    testInfo.snapshotSuffix = process.platform;
    if (process.env.PWTDEBUG)
      await withDebuggingContext(browser, params, testInfo, use);
    else
      await withProductionContext(browser, params, testInfo, use);
  },

  page: async ({ context }, use, testInfo) => {
    if (process.env.PWTDEBUG) {
      // Reuse first page, close other pages.
      let [page] = context.pages();
      if (page)
        await page.goto('about:blank');
      else
        page = await context.newPage();
      for (const page of context.pages().slice(1))
        await page.close();

      // Run test.
      await use(page);

      // Stall on failure.
      const testFailed = testInfo.status !== testInfo.expectedStatus;
      if (testFailed) {
        console.error(testInfo.error.message);
        await new Promise(() => {});
      }
    } else {
      await use(await context.newPage());
    }
  },
});

async function withProductionContext(browser: Browser, params: PlaywrightTestOptions, testInfo: TestInfo, use: (context: BrowserContext) => Promise<void>) {
  const options = mergeContextOptions(params);
  const { trace, video, screenshot } = params;

  const recordVideo = params.video === 'on' ||
      params.video === 'retain-on-failure' ||
      (params.video === 'retry-with-video' && !!testInfo.retry);
  options.recordVideo = recordVideo ? { dir: testInfo.outputPath('') } : undefined;

  const context = await browser.newContext(options);
  const allPages: Page[] = [];
  context.on('page', page => allPages.push(page));

  const collectingTrace = trace === 'on' || trace === 'retain-on-failure' || (trace === 'retry-with-trace' && testInfo.retry);
  if (collectingTrace) {
    const name = path.relative(testInfo.project.outputDir, testInfo.outputDir).replace(/[\/\\]/g, '-');
    await context.tracing.start({ name, screenshots: true, snapshots: true });
  }

  await use(context);

  const testFailed = testInfo.status !== testInfo.expectedStatus;

  const saveTrace = trace === 'on' || (testFailed && trace === 'retain-on-failure') || (trace === 'retry-with-trace' && testInfo.retry);
  if (saveTrace) {
    const tracePath = testInfo.outputPath(`trace.zip`);
    await context.tracing.stop({ path: tracePath });
  } else if (collectingTrace) {
    await context.tracing.stop();
  }

  if (screenshot === 'on' || (screenshot === 'only-on-failure' && testFailed)) {
    await Promise.all(allPages.map((page, index) => {
      const screenshotPath = testInfo.outputPath(`test-${testFailed ? 'failed' : 'finished'}-${++index}.png`);
      return page.screenshot({ timeout: 5000, path: screenshotPath }).catch(e => {});
    }));
  }
  await context.close();

  const deleteVideos = video === 'retain-on-failure' && !testFailed;
  if (deleteVideos) {
    await Promise.all(allPages.map(async page => {
      const video = page.video();
      if (!video)
        return;
      try {
        const videoPath = await video.path();
        await fs.promises.unlink(videoPath);
      } catch (e) {
        // Silent catch.
      }
    }));
  }
}

async function withDebuggingContext(browser: Browser, params: PlaywrightTestOptions, testInfo: TestInfo, use: (context: BrowserContext) => Promise<void>) {
  testInfo.setTimeout(0);
  const options = mergeContextOptions(params);

  if (!debuggingContext) {
    const options = mergeContextOptions(params);
    debuggingContextOptions = options;
    debuggingContext = await browser.newContext(options);
  } else {
    expect(options).toEqual(debuggingContextOptions);
  }

  await debuggingContext.clearCookies();
  await debuggingContext.clearPermissions();
  await use(debuggingContext);
}

function mergeContextOptions(testOptions: PlaywrightTestOptions): BrowserContextOptions {
  const topLevelContextOptions: BrowserContextOptions = {
    acceptDownloads: testOptions.acceptDownloads,
    bypassCSP: testOptions.bypassCSP,
    colorScheme: testOptions.colorScheme,
    deviceScaleFactor: testOptions.deviceScaleFactor,
    extraHTTPHeaders: testOptions.extraHTTPHeaders,
    geolocation: testOptions.geolocation,
    hasTouch: testOptions.hasTouch,
    httpCredentials: testOptions.httpCredentials,
    ignoreHTTPSErrors: testOptions.ignoreHTTPSErrors,
    isMobile: testOptions.isMobile,
    javaScriptEnabled: testOptions.javaScriptEnabled,
    locale: testOptions.locale,
    offline: testOptions.offline,
    permissions: testOptions.permissions,
    proxy: testOptions.proxy,
    storageState: testOptions.storageState,
    timezoneId: testOptions.timezoneId,
    userAgent: testOptions.userAgent,
    viewport: testOptions.viewport,
  };
  return { ...testOptions.contextOptions, ...topLevelContextOptions };
}

export default test;
