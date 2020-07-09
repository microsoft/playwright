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

const {FFOX, CHROMIUM, WEBKIT, CHANNEL} = utils.testOptions(browserType);

describe('browserType.launch({downloadsPath})', function() {
  beforeEach(async(state) => {
    state.downloadsPath = await mkdtempAsync(path.join(os.tmpdir(), 'playwright-test-'));
    state.server.setRoute('/download', (req, res) => {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
      res.end(`Hello world`);
    });
    state.browser = await state.browserType.launch({
      ...state.defaultBrowserOptions,
      downloadsPath: state.downloadsPath,
    });
  });
  afterEach(async(state) => {
    await state.browser.close();
    await removeFolderAsync(state.downloadsPath);
  });

  it('should keep downloadsPath folder', async({browser, downloadsPath, server})  => {
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
  it('should delete downloads when context closes', async({browser, downloadsPath, server}) => {
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
  it('should report downloads in downloadsPath folder', async({browser, downloadsPath, server}) => {
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
  beforeEach(async(state) => {
    state.userDataDir = await mkdtempAsync(path.join(os.tmpdir(), 'playwright-test-'));
    state.downloadsPath = await mkdtempAsync(path.join(os.tmpdir(), 'playwright-test-'));
    state.server.setRoute('/download', (req, res) => {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
      res.end(`Hello world`);
    });
    state.context = await state.browserType.launchPersistentContext(
      state.userDataDir,
      {
        ...state.defaultBrowserOptions,
        downloadsPath: state.downloadsPath,
        acceptDownloads: true
      });
    state.page = state.context.pages()[0];
    state.page.setContent(`<a href="${state.server.PREFIX}/download">download</a>`);
  });
  afterEach(async(state) => {
    await state.context.close();
    await removeFolderAsync(state.userDataDir);
    await removeFolderAsync(state.downloadsPath);
  });

  it('should accept downloads', async({context, page, downloadsPath, server})  => {
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    expect(download.url()).toBe(`${server.PREFIX}/download`);
    expect(download.suggestedFilename()).toBe(`file.txt`);
    const path = await download.path();
    expect(path.startsWith(downloadsPath)).toBeTruthy();
  });

  it('should not delete downloads when the context closes', async({page, context}) => {
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const path = await download.path();
    await context.close();
    expect(fs.existsSync(path)).toBeTruthy();
  });
});
