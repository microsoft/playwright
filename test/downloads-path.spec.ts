/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
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

import { fixtures as baseFixtures } from './playwright.fixtures';

import fs from 'fs';
import type { Browser, BrowserContext } from '..';

type TestState = {
  downloadsBrowser: Browser;
  persistentDownloadsContext: BrowserContext;
};
const fixtures = baseFixtures.declareTestFixtures<TestState>();
const { it, expect, defineTestFixture } = fixtures;

defineTestFixture('downloadsBrowser', async ({server, browserType, defaultBrowserOptions, testOutputDir}, test) => {
  server.setRoute('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
    res.end(`Hello world`);
  });
  const browser = await browserType.launch({
    ...defaultBrowserOptions,
    downloadsPath: testOutputDir,
  });
  await test(browser);
  await browser.close();
});

defineTestFixture('persistentDownloadsContext', async ({server, launchPersistent, testOutputDir}, test) => {
  server.setRoute('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
    res.end(`Hello world`);
  });
  const { context, page } = await launchPersistent(
      {
        downloadsPath: testOutputDir,
        acceptDownloads: true
      }
  );
  page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  await test(context);
  await context.close();
});

it('should keep downloadsPath folder', async ({downloadsBrowser, testOutputDir, server})  => {
  const page = await downloadsBrowser.newPage();
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  expect(download.url()).toBe(`${server.PREFIX}/download`);
  expect(download.suggestedFilename()).toBe(`file.txt`);
  await download.path().catch(e => void 0);
  await page.close();
  await downloadsBrowser.close();
  expect(fs.existsSync(testOutputDir)).toBeTruthy();
});

it('should delete downloads when context closes', async ({downloadsBrowser, server}) => {
  const page = await downloadsBrowser.newPage({ acceptDownloads: true });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const path = await download.path();
  expect(fs.existsSync(path)).toBeTruthy();
  await page.close();
  expect(fs.existsSync(path)).toBeFalsy();

});

it('should report downloads in downloadsPath folder', async ({downloadsBrowser, testOutputDir, server}) => {
  const page = await downloadsBrowser.newPage({ acceptDownloads: true });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const path = await download.path();
  expect(path.startsWith(testOutputDir)).toBeTruthy();
  await page.close();
});

it('should accept downloads', async ({persistentDownloadsContext, testOutputDir, server})  => {
  const page = persistentDownloadsContext.pages()[0];
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  expect(download.url()).toBe(`${server.PREFIX}/download`);
  expect(download.suggestedFilename()).toBe(`file.txt`);
  const path = await download.path();
  expect(path.startsWith(testOutputDir)).toBeTruthy();
});

it('should not delete downloads when the context closes', async ({persistentDownloadsContext}) => {
  const page = persistentDownloadsContext.pages()[0];
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const path = await download.path();
  await persistentDownloadsContext.close();
  expect(fs.existsSync(path)).toBeTruthy();
});
