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

import type { BrowserContextOptions, Video } from 'playwright-core';
import type { TestInfoImpl } from './worker/testInfo';
export { expect } from './matchers/expect';
export { store as _store } from './store';
export { _baseTest } from './playwrightFixtures';

import { test as base, formatPendingCalls, markContextAsStartedTearDown, normalizeVideoMode, shouldCaptureVideo } from './playwrightFixtures';

export const test = base.extend<{}, {}>({
  browser: [async ({}, use, testInfo) => {
    throw new Error(`Browser fixture is not available in persistent mode. Use context or page fixtures.`);
  }, { scope: 'worker', timeout: 0 }],

  context: [async ({ playwright, browserName, video, _artifactsDir }, use, testInfo) => {
    if (!['chromium', 'firefox', 'webkit'].includes(browserName))
      throw new Error(`Unexpected browserName "${browserName}", must be one of "chromium", "firefox" or "webkit"`);

    const testInfoImpl = testInfo as TestInfoImpl;
    const videoMode = normalizeVideoMode(video);
    const captureVideo = shouldCaptureVideo(videoMode, testInfo);

    const hook = hookType(testInfoImpl);
    if (hook) {
      throw new Error([
        `"context" and "page" fixtures are not supported in "${hook}" since they are created on a per-test basis.`,
        `If you would like to reuse a single page between tests, import @playwright/test instead and create the page manually.`,
        `If you would like to configure your page before each test, do that in beforeEach hook instead.`,
      ].join('\n'));
    }
    const videoOptions: BrowserContextOptions = captureVideo ? {
      recordVideo: {
        dir: _artifactsDir(),
        size: typeof video === 'string' ? undefined : video.size,
      }
    } : {};

    const context = await playwright[browserName].launchPersistentContext('', videoOptions);
    const pages = [...context.pages()];
    context.on('page', page => pages.push(page));

    await use(context);

    const prependToError = testInfoImpl._didTimeout ?
      formatPendingCalls((context as any)._connection.pendingProtocolCalls()) : '';

    let counter = 0;
    markContextAsStartedTearDown(context);
    await (context as any)._wrapApiCall(async () => {
      await context.close();
    }, true);

    const testFailed = testInfo.status !== testInfo.expectedStatus;
    const preserveVideo = captureVideo && (videoMode === 'on' || (testFailed && videoMode === 'retain-on-failure') || (videoMode === 'on-first-retry' && testInfo.retry === 1));
    if (preserveVideo) {
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

    if (prependToError)
      testInfo.errors.push({ message: prependToError });
  }, { scope: 'test',  _title: 'context' } as any],

  page: async ({ context }, use) => {
    await use(context.pages()[0]);
  },
});

function hookType(testInfo: TestInfoImpl): 'beforeAll' | 'afterAll' | undefined {
  const type = testInfo._timeoutManager.currentRunnableType();
  if (type === 'beforeAll' || type === 'afterAll')
    return type;
}

export default test;
