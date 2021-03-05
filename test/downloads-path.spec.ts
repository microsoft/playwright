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
  logOnCI('--- launching persistent context ---');
  const { context, page } = await launchPersistent(
      {
        downloadsPath: testInfo.outputPath(''),
        acceptDownloads: true
      }
  );
  logOnCI('--- setting content for the page ---');
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  logOnCI('--- launching test ---');
  await test(context);
  logOnCI('--- closing context ---');
  await context.close();
  logOnCI('--- DONE ---');
});

function logOnCI(...args) {
  if (!process.env.CI)
    return;
  console.log(...args);
}

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
  logOnCI('----- 1.1');
  const page = persistentDownloadsContext.pages()[0];
  logOnCI('----- 1.2');
  const [ download ] = await Promise.all([
    page.waitForEvent('download').then(d => {
      logOnCI('----- 1.3');
      return d;
    }),
    page.click('a').then(d => {
      logOnCI('----- 1.4');
    }),
  ]);
  logOnCI('----- 1.5');
  expect(download.url()).toBe(`${server.PREFIX}/download`);
  logOnCI('----- 1.6');
  expect(download.suggestedFilename()).toBe(`file.txt`);
  logOnCI('----- 1.7');
  const path = await download.path();
  logOnCI('----- 1.8');
  expect(path.startsWith(testInfo.outputPath(''))).toBeTruthy();
  logOnCI('----- 1.9');
});

it('should delete downloads when persistent context closes', async ({persistentDownloadsContext}) => {
  logOnCI('----- 2.1');
  const page = persistentDownloadsContext.pages()[0];
  logOnCI('----- 2.2');
  const [ download ] = await Promise.all([
    page.waitForEvent('download').then(d => {
      logOnCI('----- 2.3');
      return d;
    }),
    page.click('a').then(() => {
      logOnCI('----- 2.4');
    }),
  ]);
  logOnCI('----- 2.5');
  const path = await download.path();
  logOnCI('----- 2.6');
  expect(fs.existsSync(path)).toBeTruthy();
  logOnCI('----- 2.7');
  await persistentDownloadsContext.close();
  logOnCI('----- 2.8');
  expect(fs.existsSync(path)).toBeFalsy();
  logOnCI('----- 2.9');
});
