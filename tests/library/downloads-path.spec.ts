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

import { playwrightTest as it, expect } from '../config/browserTest';
import fs from 'fs';
import path from 'path';

it.describe('downloads path', () => {
  it.skip(({ mode }) => mode !== 'default', 'download.path() is not available in remote mode');

  it.beforeEach(async ({ server }) => {
    server.setRoute('/download', (req, res) => {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
      res.end(`Hello world`);
    });
  });

  it('should keep downloadsPath folder', async ({ browserType, server }, testInfo)  => {
    const downloadsBrowser = await browserType.launch({ downloadsPath: testInfo.outputPath('') });
    const page = await downloadsBrowser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
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

  it('should delete downloads when context closes', async ({ browserType, server }, testInfo) => {
    const downloadsBrowser = await browserType.launch({ downloadsPath: testInfo.outputPath('') });
    const page = await downloadsBrowser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const path = await download.path();
    expect(fs.existsSync(path)).toBeTruthy();
    await page.close();
    expect(fs.existsSync(path)).toBeFalsy();
    await downloadsBrowser.close();
  });

  it('should report downloads in downloadsPath folder', async ({ browserType, server }, testInfo) => {
    const downloadsBrowser = await browserType.launch({ downloadsPath: testInfo.outputPath('') });
    const page = await downloadsBrowser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const path = await download.path();
    expect(path.startsWith(testInfo.outputPath(''))).toBeTruthy();
    await page.close();
    await downloadsBrowser.close();
  });

  it('should report downloads in downloadsPath folder with a relative path', async ({ browserType, server }, testInfo) => {
    const downloadsBrowser = await browserType.launch({ downloadsPath: path.relative(process.cwd(), testInfo.outputPath('')) });
    const page = await downloadsBrowser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const downloadPath = await download.path();
    expect(downloadPath.startsWith(testInfo.outputPath(''))).toBeTruthy();
    await page.close();
    await downloadsBrowser.close();
  });

  it('should accept downloads in persistent context', async ({ launchPersistent, server }, testInfo)  => {
    const { context, page } = await launchPersistent({ downloadsPath: testInfo.outputPath('') });
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a'),
    ]);
    expect(download.url()).toBe(`${server.PREFIX}/download`);
    expect(download.suggestedFilename()).toBe(`file.txt`);
    const path = await download.path();
    expect(path.startsWith(testInfo.outputPath(''))).toBeTruthy();
    await context.close();
  });

  it('should delete downloads when persistent context closes', async ({ launchPersistent, server }, testInfo) => {
    const { context, page } = await launchPersistent({ downloadsPath: testInfo.outputPath('') });
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a'),
    ]);
    const path = await download.path();
    expect(fs.existsSync(path)).toBeTruthy();
    await context.close();
    expect(fs.existsSync(path)).toBeFalsy();
  });
});
