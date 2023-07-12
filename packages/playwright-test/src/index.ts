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

import { jsonStringifyForceASCII } from 'playwright-core/lib/utils';
import type { BrowserContext, BrowserContextOptions, Page, Video } from 'playwright-core';
import type { TestInfoImpl } from './worker/testInfo';
import type { ContextReuseMode } from './common/config';
export { expect } from './matchers/expect';
export { store as _store } from './store';
export { _baseTest } from './playwrightFixtures';

import { attachConnectedHeaderIfNeeded, connectOptionsFromEnv, test as base, formatPendingCalls, markContextAsReused, markContextAsStartedTearDown, normalizeVideoMode, shouldCaptureVideo } from './playwrightFixtures';

type TestFixtures = {
  _contextReuseMode: ContextReuseMode,
  _reuseContext: boolean,
  _contextFactory: (options?: BrowserContextOptions) => Promise<BrowserContext>;
};

export const test = base.extend<TestFixtures, {}>({
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

  _contextFactory: [async ({ browser, video, _artifactsDir, _reuseContext }, use, testInfo) => {
    const testInfoImpl = testInfo as TestInfoImpl;
    const videoMode = normalizeVideoMode(video);
    const captureVideo = shouldCaptureVideo(videoMode, testInfo) && !_reuseContext;
    const contexts = new Map<BrowserContext, { pages: Page[] }>();

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
      const contextData: { pages: Page[] } = { pages: [] };
      contexts.set(context, contextData);
      context.on('page', page => contextData.pages.push(page));
      return context;
    });

    const prependToError = testInfoImpl._didTimeout ?
      formatPendingCalls((browser as any)._connection.pendingProtocolCalls()) : '';

    let counter = 0;
    await Promise.all([...contexts.keys()].map(async context => {
      markContextAsStartedTearDown(context);
      await (context as any)._wrapApiCall(async () => {
        await context.close();
      }, true);
      const testFailed = testInfo.status !== testInfo.expectedStatus;
      const preserveVideo = captureVideo && (videoMode === 'on' || (testFailed && videoMode === 'retain-on-failure') || (videoMode === 'on-first-retry' && testInfo.retry === 1));
      if (preserveVideo) {
        const { pages } = contexts.get(context)!;
        const videos = pages.map(p => p.video()).filter(Boolean) as Video[];
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
    markContextAsReused(context);
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
});

function hookType(testInfo: TestInfoImpl): 'beforeAll' | 'afterAll' | undefined {
  const type = testInfo._timeoutManager.currentRunnableType();
  if (type === 'beforeAll' || type === 'afterAll')
    return type;
}

export default test;
