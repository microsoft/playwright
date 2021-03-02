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

import { folio } from './fixtures';

import fs from 'fs';
import type { Browser, BrowserContext } from '..';

type TestState = {
  downloadsBrowser: Browser;
  persistentDownloadsContext: BrowserContext;
};
const fixtures = folio.extend<TestState>();

fixtures.downloadsBrowser.init(async ({ server, browserType, browserOptions, testInfo }, test) => {
  server.setRoute('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
    res.end(`Hello world`);
  });
  const browser = await browserType.launch({
    ...browserOptions,
    downloadsPath: testInfo.outputPath(''),
  });
  await test(browser);
  await browser.close();
});

fixtures.persistentDownloadsContext.init(async ({ server, launchPersistent, testInfo }, test) => {
  server.setRoute('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
    res.end(`Hello world`);
  });
  console.log('--- launching persistent context ---');
  const { context, page } = await launchPersistent(
      {
        downloadsPath: testInfo.outputPath(''),
        acceptDownloads: true
      }
  );
  console.log('--- setting content for the page ---');
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  console.log('--- launching test ---');
  await test(context);
  console.log('--- closing context ---');
  await context.close();
  console.log('--- DONE ---');
});

const { it, expect } = fixtures.build();

it('should keep downloadsPath folder', async ({downloadsBrowser, testInfo, server})  => {
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
  expect(fs.existsSync(testInfo.outputPath(''))).toBeTruthy();
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

it('should report downloads in downloadsPath folder', async ({downloadsBrowser, testInfo, server}) => {
  const page = await downloadsBrowser.newPage({ acceptDownloads: true });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const path = await download.path();
  expect(path.startsWith(testInfo.outputPath(''))).toBeTruthy();
  await page.close();
});

it('should accept downloads in persistent context', async ({persistentDownloadsContext, testInfo, server})  => {
  console.log('----- 1.1');
  const page = persistentDownloadsContext.pages()[0];
  console.log('----- 1.2');
  const [ download ] = await Promise.all([
    page.waitForEvent('download').then(d => {
      console.log('----- 1.3');
      return d;
    }),
    page.click('a').then(d => {
      console.log('----- 1.4');
    }),
  ]);
  console.log('----- 1.5');
  expect(download.url()).toBe(`${server.PREFIX}/download`);
  console.log('----- 1.6');
  expect(download.suggestedFilename()).toBe(`file.txt`);
  console.log('----- 1.7');
  const path = await download.path();
  console.log('----- 1.8');
  expect(path.startsWith(testInfo.outputPath(''))).toBeTruthy();
  console.log('----- 1.9');
});

it('should delete downloads when persistent context closes', async ({persistentDownloadsContext}) => {
  console.log('----- 2.1');
  const page = persistentDownloadsContext.pages()[0];
  console.log('----- 2.2');
  const [ download ] = await Promise.all([
    page.waitForEvent('download').then(d => {
      console.log('----- 2.3');
      return d;
    }),
    page.click('a').then(() => {
      console.log('----- 2.4');
    }),
  ]);
  console.log('----- 2.5');
  const path = await download.path();
  console.log('----- 2.6');
  expect(fs.existsSync(path)).toBeTruthy();
  console.log('----- 2.7');
  await persistentDownloadsContext.close();
  console.log('----- 2.8');
  expect(fs.existsSync(path)).toBeFalsy();
  console.log('----- 2.9');
});
