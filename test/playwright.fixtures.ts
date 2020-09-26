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
import fs from 'fs';
import os from 'os';
import path from 'path';
import util from 'util';
import type { Browser, BrowserContext, BrowserContextOptions, BrowserType, LaunchOptions, Page } from '../index';

const mkdtempAsync = util.promisify(fs.mkdtemp);
const removeFolderAsync = util.promisify(require('rimraf'));

type PlaywrightParameters = {
  browserName: string;
};

type PlaywrightWorkerFixtures = {
  defaultBrowserOptions: LaunchOptions;
  playwright: typeof import('../index');
  browserType: BrowserType<Browser>;
  browser: Browser;
  isChromium: boolean;
  isFirefox: boolean;
  isWebKit: boolean;
};

type PlaywrightTestFixtures = {
  context: BrowserContext;
  page: Page;
  testOutputDir: string;
  tmpDir: string;
};

export const fixtures = baseFixtures
    .declareParameters<PlaywrightParameters>()
    .declareWorkerFixtures<PlaywrightWorkerFixtures>()
    .declareTestFixtures<PlaywrightTestFixtures>();

const { defineTestFixture, defineWorkerFixture, defineParameter, generateParametrizedTests } = fixtures;

export const options = {
  CHROMIUM: (parameters: PlaywrightParameters) => parameters.browserName === 'chromium',
  FIREFOX: (parameters: PlaywrightParameters) => parameters.browserName === 'firefox',
  WEBKIT: (parameters: PlaywrightParameters) => parameters.browserName === 'webkit',
  HEADLESS: !!valueFromEnv('HEADLESS', true),
  SLOW_MO: valueFromEnv('SLOW_MO', 0),
  TRACING: valueFromEnv('TRACING', false),
};

defineWorkerFixture('defaultBrowserOptions', async ({}, runTest) => {
  await runTest({
    handleSIGINT: false,
    slowMo: options.SLOW_MO,
    headless: options.HEADLESS,
    artifactsPath: config.outputDir,
  });
});

defineWorkerFixture('playwright', async ({}, test) => {
  const playwright = require('../index');
  await test(playwright);
});

defineWorkerFixture('browserType', async ({playwright, browserName}, test) => {
  const browserType = playwright[browserName];
  await test(browserType);
});

defineParameter('browserName', 'Browser type name', '');

generateParametrizedTests(
    'browserName',
    process.env.BROWSER ? [process.env.BROWSER] : ['chromium', 'webkit', 'firefox']);

defineWorkerFixture('isChromium', async ({browserName}, test) => {
  await test(browserName === 'chromium');
});

defineWorkerFixture('isFirefox', async ({browserName}, test) => {
  await test(browserName === 'firefox');
});

defineWorkerFixture('isWebKit', async ({browserName}, test) => {
  await test(browserName === 'webkit');
});

defineWorkerFixture('browser', async ({browserType, defaultBrowserOptions}, test) => {
  const browser = await browserType.launch(defaultBrowserOptions);
  await test(browser);
  if (browser.contexts().length !== 0) {
    console.warn(`\nWARNING: test did not close all created contexts! ${new Error().stack}\n`);
    await Promise.all(browser.contexts().map(context => context.close())).catch(e => void 0);
  }
  await browser.close();
});

defineTestFixture('testOutputDir', async ({ testInfo }, runTest) => {
  const relativePath = path.relative(config.testDir, testInfo.file).replace(/\.spec\.[jt]s/, '');
  const sanitizedTitle = testInfo.title.replace(/[^\w\d]+/g, '_');
  const testOutputDir = path.join(config.outputDir, relativePath, sanitizedTitle);
  await fs.promises.mkdir(testOutputDir, { recursive: true });
  await runTest(testOutputDir);
  const files = await fs.promises.readdir(testOutputDir);
  if (!files.length) {
    // Do not leave an empty useless directory.
    // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
    await removeFolderAsync(testOutputDir).catch(e => {});
  }
});

defineTestFixture('context', async ({ browser, testOutputDir }, runTest) => {
  const contextOptions: BrowserContextOptions = {
    relativeArtifactsPath: path.relative(config.outputDir, testOutputDir),
    recordTrace: !!options.TRACING,
    recordVideos: !!options.TRACING,
  };
  const context = await browser.newContext(contextOptions);
  await runTest(context);
  await context.close();
});

defineTestFixture('page', async ({ context, testOutputDir, testInfo }, runTest) => {
  const page = await context.newPage();
  await runTest(page);
  if (testInfo.status === 'failed' || testInfo.status === 'timedOut')
    await page.screenshot({ timeout: 5000, path: path.join(testOutputDir, 'test-failed.png') });
});

defineTestFixture('tmpDir', async ({}, test) => {
  const tmpDir = await mkdtempAsync(path.join(os.tmpdir(), 'playwright-test-'));
  await test(tmpDir);
  await removeFolderAsync(tmpDir).catch(e => {});
});

function valueFromEnv(name, defaultValue) {
  if (!(name in process.env))
    return defaultValue;
  return JSON.parse(process.env[name]);
}
