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

const path = require('path');
const fs = require('fs');
const util = require('util');
const utils = require('./utils');
const os = require('os');
const removeFolder = require('rimraf');
const mkdtempAsync = util.promisify(fs.mkdtemp);
const removeFolderAsync = util.promisify(removeFolder);

const {CHANNEL} = utils;

const {FIREFOX, CHROMIUM, WEBKIT, HEADLESS, pageEnv, launchEnv} = require('playwright-runner');
const {serverEnv} = require('./environments/server');

describe('browserType.launch({downloadsPath})', function() {
  const {it} = launchEnv.mixin(serverEnv).extend({
    async beforeEach({server, launcher}) {
      const downloadsPath = await mkdtempAsync(path.join(os.tmpdir(), 'playwright-test-'));
      server.setRoute('/download', (req, res) => {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
        res.end(`Hello world`);
      });
      const browser = await launcher.launch({
        downloadsPath,
      });
      return {downloadsPath, browser};
    },
    async afterEach({browser, downloadsPath}) {
      await browser.close();
      await removeFolderAsync(downloadsPath);
    }
  });

  it('should keep downloadsPath folder', async ({browser, downloadsPath, server})  => {
    const page = await browser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    expect(download.url()).toBe(`${server.PREFIX}/download`);
    expect(download.suggestedFilename()).toBe(`file.txt`);
    await download.path().catch(e => error = e);
    await page.close();
    await browser.close();
    expect(fs.existsSync(downloadsPath)).toBeTruthy();
  });
  it('should delete downloads when context closes', async ({browser, downloadsPath, server}) => {
    const page = await browser.newPage({ acceptDownloads: true });
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
  it('should report downloads in downloadsPath folder', async ({browser, downloadsPath, server}) => {
    const page = await browser.newPage({ acceptDownloads: true });
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const path = await download.path();
    expect(path.startsWith(downloadsPath)).toBeTruthy();
    await page.close();
  });
});

describe('browserType.launchPersistent({acceptDownloads})', function() {
  const {it} = launchEnv.mixin(serverEnv).extend({
    async beforeEach({server, launcher}) {
      const userDataDir = await mkdtempAsync(path.join(os.tmpdir(), 'playwright-test-'));
      const downloadsPath = await mkdtempAsync(path.join(os.tmpdir(), 'playwright-test-'));
      server.setRoute('/download', (req, res) => {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
        res.end(`Hello world`);
      });
      const context = await launcher.launchPersistentContext(
          userDataDir,
          {
            downloadsPath,
            acceptDownloads: true
          });
      const page = context.pages()[0];
      await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
      return {page, context, userDataDir, downloadsPath};
    },
    async afterEach({context, downloadsPath, userDataDir}) {
      await context.close();
      await removeFolderAsync(userDataDir);
      await removeFolderAsync(downloadsPath);
    }
  });


  it('should accept downloads', async ({context, page, downloadsPath, server})  => {
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    expect(download.url()).toBe(`${server.PREFIX}/download`);
    expect(download.suggestedFilename()).toBe(`file.txt`);
    const path = await download.path();
    expect(path.startsWith(downloadsPath)).toBeTruthy();
  });

  it('should not delete downloads when the context closes', async ({page, context}) => {
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const path = await download.path();
    await context.close();
    expect(fs.existsSync(path)).toBeTruthy();
  });
});
