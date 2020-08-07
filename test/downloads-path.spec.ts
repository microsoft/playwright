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
import './base.fixture';

import path from 'path';
import fs from 'fs';
import os from 'os';
import {mkdtempAsync, removeFolderAsync} from './utils';
import { Browser, BrowserContext } from '..';

declare global {
  interface FixtureState {
    downloadsPath: string;
    downloadsBrowser: Browser;
    persistentDownloadsContext: BrowserContext;
  }
}
registerFixture('downloadsPath', async ({}, test) => {
  const downloadsPath = await mkdtempAsync(path.join(os.tmpdir(), 'playwright-test-'));
  try {
    await test(downloadsPath);
  } finally {
    await removeFolderAsync(downloadsPath);
  }
});

registerFixture('downloadsBrowser', async ({server, browserType, defaultBrowserOptions, downloadsPath}, test) => {
  server.setRoute('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
    res.end(`Hello world`);
  });
  const browser = await browserType.launch({
    ...defaultBrowserOptions,
    downloadsPath: downloadsPath,
  });
  try {
    await test(browser);
  } finally {
    await browser.close();
  }
});

registerFixture('persistentDownloadsContext', async ({server, browserType, defaultBrowserOptions, downloadsPath}, test) => {
  const userDataDir = await mkdtempAsync(path.join(os.tmpdir(), 'playwright-test-'));
  server.setRoute('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
    res.end(`Hello world`);
  });
  const context = await browserType.launchPersistentContext(
    userDataDir,
    {
      ...defaultBrowserOptions,
      downloadsPath,
      acceptDownloads: true
    }
  );
  const page = context.pages()[0];
  page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  try {
    await test(context);
  } finally {
    await context.close();
    await removeFolderAsync(userDataDir);
  }
});

it('should keep downloadsPath folder', async({downloadsBrowser, downloadsPath, server})  => {
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
  expect(fs.existsSync(downloadsPath)).toBeTruthy();
});

it('should delete downloads when context closes', async({downloadsBrowser, downloadsPath, server}) => {
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

it('should report downloads in downloadsPath folder', async({downloadsBrowser, downloadsPath, server}) => {
  const page = await downloadsBrowser.newPage({ acceptDownloads: true });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const path = await download.path();
  expect(path.startsWith(downloadsPath)).toBeTruthy();
  await page.close();
});

it('should accept downloads', async({persistentDownloadsContext, downloadsPath, server})  => {
  const page = persistentDownloadsContext.pages()[0];
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  expect(download.url()).toBe(`${server.PREFIX}/download`);
  expect(download.suggestedFilename()).toBe(`file.txt`);
  const path = await download.path();
  expect(path.startsWith(downloadsPath)).toBeTruthy();
});

it('should not delete downloads when the context closes', async({persistentDownloadsContext}) => {
  const page = persistentDownloadsContext.pages()[0];
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const path = await download.path();
  await persistentDownloadsContext.close();
  expect(fs.existsSync(path)).toBeTruthy();
});
