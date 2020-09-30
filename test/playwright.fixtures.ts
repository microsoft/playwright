/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { config, fixtures as baseFixtures } from '@playwright/test-runner';
import type { Browser, BrowserContext, BrowserContextOptions, BrowserType, LaunchOptions, Page } from '../index';

// Parameter declarations ------------------------------------------------------

type PlaywrightParameters = {
  // Browser name, one of 'chromium', 'webkit' and 'firefox', can be specified via
  // environment BROWSER=webkit or via command line, --browser-name=webkit
  browserName: 'chromium' | 'firefox' | 'webkit';
  // Run tests in a headful mode, can be specified via environment HEADFUL=1 or via
  // command line, --headful. Defaults to false.
  headful: boolean;
  // Slows down Playwright operations by the specified amount of milliseconds.
  // Useful so that you can see what is going on. Defaults to 0.
  slowMo: number;
  // Whether to take screenshots on failure, --screenshot-on-failure. Defaults to false.
  screenshotOnFailure: boolean;
  // Whether to record the execution trace
  trace: boolean;
  // Host platform
  platform: 'win32' | 'linux' | 'darwin';
};


// Worker fixture declarations -------------------------------------------------
// ... these live as long as the worker process.

type PlaywrightWorkerFixtures = {
  // Playwright library.
  playwright: typeof import('../index');
  // Browser type (Chromium / WebKit / Firefox)
  browserType: BrowserType<Browser>;
  // Default browserType.launch() options.
  defaultBrowserOptions: LaunchOptions;
  // Factory for creating a browser with given additional options.
  browserFactory: (options?: LaunchOptions) => Promise<Browser>;
  // Browser instance, shared for the worker.
  browser: Browser;
  // True iff browserName is Chromium
  isChromium: boolean;
  // True iff browserName is Firefox
  isFirefox: boolean;
  // True iff browserName is WebKit
  isWebKit: boolean;
  // True iff running on Windows.
  isWindows: boolean;
  // True iff running on Mac.
  isMac: boolean;
  // True iff running on Linux.
  isLinux: boolean;
};


// Test fixture definitions, those are created for each test ------------------

type PlaywrightTestFixtures = {
  // Default browser.newContext() options.
  defaultContextOptions: BrowserContextOptions;
  // Factory for creating a context with given additional options.
  contextFactory: (options?: BrowserContextOptions) => Promise<BrowserContext>;
  // Context instance for test.
  context: BrowserContext;
  // Page instance for test.
  page: Page;
};

export const fixtures = baseFixtures
    .declareParameters<PlaywrightParameters>()
    .declareWorkerFixtures<PlaywrightWorkerFixtures>()
    .declareTestFixtures<PlaywrightTestFixtures>();

// Parameter and matrix definitions --------------------------------------------

fixtures.defineParameter('browserName', 'Browser type name', process.env.BROWSER || 'chromium' as any);
fixtures.defineParameter('headful', 'Whether to run tests headless or headful', process.env.HEADFUL ? true : false);
fixtures.defineParameter('platform', 'Operating system', process.platform as ('win32' | 'linux' | 'darwin'));
fixtures.defineParameter('screenshotOnFailure', 'Generate screenshot on failure', false);
fixtures.defineParameter('slowMo', 'Slows down Playwright operations by the specified amount of milliseconds', 0);
fixtures.defineParameter('trace', 'Whether to record the execution trace', !!process.env.TRACING || false);

// If browser is not specified, we are running tests against all three browsers.
fixtures.generateParametrizedTests(
    'browserName',
    process.env.BROWSER ? [process.env.BROWSER] as any : ['chromium', 'webkit', 'firefox']);

// Worker fixtures definitions -------------------------------------------------

fixtures.defineWorkerFixture('defaultBrowserOptions', async ({ headful, slowMo }, runTest) => {
  await runTest({
    handleSIGINT: false,
    slowMo,
    headless: !headful,
    artifactsPath: config.outputDir,
  });
});

fixtures.defineWorkerFixture('playwright', async ({}, runTest) => {
  const playwright = require('../index');
  await runTest(playwright);
});

fixtures.defineWorkerFixture('browserType', async ({playwright, browserName}, runTest) => {
  const browserType = playwright[browserName];
  await runTest(browserType);
});

fixtures.defineWorkerFixture('browser', async ({browserType, defaultBrowserOptions}, runTest) => {
  const browser = await browserType.launch(defaultBrowserOptions);
  await runTest(browser);
  await browser.close();
});

fixtures.defineWorkerFixture('isChromium', async ({browserName}, runTest) => {
  await runTest(browserName === 'chromium');
});

fixtures.defineWorkerFixture('isFirefox', async ({browserName}, runTest) => {
  await runTest(browserName === 'firefox');
});

fixtures.defineWorkerFixture('isWebKit', async ({browserName}, runTest) => {
  await runTest(browserName === 'webkit');
});

fixtures.defineWorkerFixture('isWindows', async ({platform}, test) => {
  await test(platform === 'win32');
});

fixtures.defineWorkerFixture('isMac', async ({platform}, test) => {
  await test(platform === 'darwin');
});

fixtures.defineWorkerFixture('isLinux', async ({platform}, test) => {
  await test(platform === 'linux');
});

// Test fixtures definitions ---------------------------------------------------

fixtures.defineTestFixture('defaultContextOptions', async ({ testRelativeArtifactsPath, trace, testInfo }, runTest) => {
  if (trace || testInfo.retry) {
    await runTest({
      relativeArtifactsPath: testRelativeArtifactsPath,
      recordTrace: true,
      recordVideos: true,
    });
  } else {
    await runTest({});
  }
});

fixtures.defineTestFixture('contextFactory', async ({ browser, defaultContextOptions, testInfo, screenshotOnFailure, testOutputPath }, runTest) => {
  const contexts: BrowserContext[] = [];
  async function contextFactory(options: BrowserContextOptions = {}) {
    const context = await browser.newContext({ ...defaultContextOptions, ...options });
    contexts.push(context);
    return context;
  }
  await runTest(contextFactory);

  if (screenshotOnFailure && (testInfo.status !== testInfo.expectedStatus)) {
    let ordinal = 0;
    for (const context of contexts) {
      for (const page of context.pages())
        await page.screenshot({ timeout: 5000, path: testOutputPath + `-test-failed-${++ordinal}.png` });
    }
  }
  for (const context of contexts)
    await context.close();
});

fixtures.defineTestFixture('context', async ({ contextFactory }, runTest) => {
  const context = await contextFactory();
  await runTest(context);
  // Context factory is taking care of closing the context,
  // so that it could capture a screenshot on failure.
});

fixtures.defineTestFixture('page', async ({context}, runTest) => {
  // Always create page off context so that they matched.
  await runTest(await context.newPage());
  // Context fixture is taking care of closing the page.
});

fixtures.overrideTestFixture('testParametersArtifactsPath', async ({ browserName, platform }, runTest) => {
  await runTest(browserName + '-' + platform);
});
