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

import { serverFixtures } from './remoteServer.fixture';
const { it, expect, beforeEach } = serverFixtures;

import fs from 'fs';
import path from 'path';
import util from 'util';

beforeEach(async ({server}) => {
  server.setRoute('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment');
    res.end(`Hello world`);
  });
  server.setRoute('/downloadWithFilename', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
    res.end(`Hello world`);
  });
});

it('should report downloads with acceptDownloads: false', async ({page, server}) => {
  await page.setContent(`<a href="${server.PREFIX}/downloadWithFilename">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  let error;
  expect(download.url()).toBe(`${server.PREFIX}/downloadWithFilename`);
  expect(download.suggestedFilename()).toBe(`file.txt`);
  await download.path().catch(e => error = e);
  expect(await download.failure()).toContain('acceptDownloads');
  expect(error.message).toContain('acceptDownloads: true');
});

it('should report downloads with acceptDownloads: true', async ({browser, server}) => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const path = await download.path();
  expect(fs.existsSync(path)).toBeTruthy();
  expect(fs.readFileSync(path).toString()).toBe('Hello world');
  await page.close();
});

it('should save to user-specified path', async ({testInfo, browser, server}) => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const userPath = testInfo.outputPath('download.txt');
  await download.saveAs(userPath);
  expect(fs.existsSync(userPath)).toBeTruthy();
  expect(fs.readFileSync(userPath).toString()).toBe('Hello world');
  await page.close();
});

it('should save to user-specified path without updating original path', async ({testInfo, browser, server}) => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const userPath = testInfo.outputPath('download.txt');
  await download.saveAs(userPath);
  expect(fs.existsSync(userPath)).toBeTruthy();
  expect(fs.readFileSync(userPath).toString()).toBe('Hello world');

  const originalPath = await download.path();
  expect(fs.existsSync(originalPath)).toBeTruthy();
  expect(fs.readFileSync(originalPath).toString()).toBe('Hello world');
  await page.close();
});

it('should save to two different paths with multiple saveAs calls', async ({testInfo, browser, server}) => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const userPath = testInfo.outputPath('download.txt');
  await download.saveAs(userPath);
  expect(fs.existsSync(userPath)).toBeTruthy();
  expect(fs.readFileSync(userPath).toString()).toBe('Hello world');

  const anotherUserPath = testInfo.outputPath('download (2).txt');
  await download.saveAs(anotherUserPath);
  expect(fs.existsSync(anotherUserPath)).toBeTruthy();
  expect(fs.readFileSync(anotherUserPath).toString()).toBe('Hello world');
  await page.close();
});

it('should save to overwritten filepath', async ({testInfo, browser, server}) => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const dir = testInfo.outputPath('downloads');
  const userPath = path.join(dir, 'download.txt');
  await download.saveAs(userPath);
  expect((await util.promisify(fs.readdir)(dir)).length).toBe(1);
  await download.saveAs(userPath);
  expect((await util.promisify(fs.readdir)(dir)).length).toBe(1);
  expect(fs.existsSync(userPath)).toBeTruthy();
  expect(fs.readFileSync(userPath).toString()).toBe('Hello world');
  await page.close();
});

it('should create subdirectories when saving to non-existent user-specified path', async ({testInfo, browser, server}) => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const nestedPath = testInfo.outputPath(path.join('these', 'are', 'directories', 'download.txt'));
  await download.saveAs(nestedPath);
  expect(fs.existsSync(nestedPath)).toBeTruthy();
  expect(fs.readFileSync(nestedPath).toString()).toBe('Hello world');
  await page.close();
});

it('should save when connected remotely', (test, { wire }) => {
  test.skip(wire);
}, async ({testInfo, server, browserType, remoteServer}) => {
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const page = await browser.newPage({ acceptDownloads: true });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const nestedPath = testInfo.outputPath(path.join('these', 'are', 'directories', 'download.txt'));
  await download.saveAs(nestedPath);
  expect(fs.existsSync(nestedPath)).toBeTruthy();
  expect(fs.readFileSync(nestedPath).toString()).toBe('Hello world');
  const error = await download.path().catch(e => e);
  expect(error.message).toContain('Path is not available when using browserType.connect(). Use download.saveAs() to save a local copy.');
  await browser.close();
});

it('should error when saving with downloads disabled', async ({testInfo, browser, server}) => {
  const page = await browser.newPage({ acceptDownloads: false });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const userPath = testInfo.outputPath('download.txt');
  const { message } = await download.saveAs(userPath).catch(e => e);
  expect(message).toContain('Pass { acceptDownloads: true } when you are creating your browser context');
  await page.close();
});

it('should error when saving after deletion', async ({testInfo, browser, server}) => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const userPath = testInfo.outputPath('download.txt');
  await download.delete();
  const { message } = await download.saveAs(userPath).catch(e => e);
  expect(message).toContain('Download already deleted. Save before deleting.');
  await page.close();
});

it('should error when saving after deletion when connected remotely', (test, { wire }) => {
  test.skip(wire);
}, async ({testInfo, server, browserType, remoteServer}) => {
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const page = await browser.newPage({ acceptDownloads: true });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const userPath = testInfo.outputPath('download.txt');
  await download.delete();
  const { message } = await download.saveAs(userPath).catch(e => e);
  expect(message).toContain('Download already deleted. Save before deleting.');
  await browser.close();
});

it('should report non-navigation downloads', async ({browser, server}) => {
  // Mac WebKit embedder does not download in this case, although Safari does.
  server.setRoute('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.end(`Hello world`);
  });

  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<a download="file.txt" href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  expect(download.suggestedFilename()).toBe(`file.txt`);
  const path = await download.path();
  expect(fs.existsSync(path)).toBeTruthy();
  expect(fs.readFileSync(path).toString()).toBe('Hello world');
  await page.close();
});

it(`should report download path within page.on('download', …) handler for Files`, async ({browser, server}) => {
  const page = await browser.newPage({ acceptDownloads: true });
  const onDownloadPath = new Promise<string>(res => {
    page.on('download', dl => {
      dl.path().then(res);
    });
  });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  await page.click('a');
  const path = await onDownloadPath;
  expect(fs.readFileSync(path).toString()).toBe('Hello world');
  await page.close();
});
it(`should report download path within page.on('download', …) handler for Blobs`, async ({browser, server}) => {
  const page = await browser.newPage({ acceptDownloads: true });
  const onDownloadPath = new Promise<string>(res => {
    page.on('download', dl => {
      dl.path().then(res);
    });
  });
  await page.goto(server.PREFIX + '/download-blob.html');
  await page.click('a');
  const path = await onDownloadPath;
  expect(fs.readFileSync(path).toString()).toBe('Hello world');
  await page.close();
});
it('should report alt-click downloads', (test, { browserName }) => {
  test.fixme(browserName === 'firefox' || browserName === 'webkit');
}, async ({browser, server}) => {
  // Firefox does not download on alt-click by default.
  // Our WebKit embedder does not download on alt-click, although Safari does.
  server.setRoute('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.end(`Hello world`);
  });

  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a', { modifiers: ['Alt']})
  ]);
  const path = await download.path();
  expect(fs.existsSync(path)).toBeTruthy();
  expect(fs.readFileSync(path).toString()).toBe('Hello world');
  await page.close();
});

it('should report new window downloads', (test, { browserName, headful }) => {
  test.fixme(browserName === 'chromium' && headful);
}, async ({browser, server}) => {
  // TODO: - the test fails in headful Chromium as the popup page gets closed along
  // with the session before download completed event arrives.
  // - WebKit doesn't close the popup page
  const page = await browser.newPage({ acceptDownloads: true });
  await page.setContent(`<a target=_blank href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const path = await download.path();
  expect(fs.existsSync(path)).toBeTruthy();
  await page.close();
});

it('should delete file', async ({browser, server}) => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const path = await download.path();
  expect(fs.existsSync(path)).toBeTruthy();
  await download.delete();
  expect(fs.existsSync(path)).toBeFalsy();
  await page.close();
});

it('should expose stream', async ({browser, server}) => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const stream = await download.createReadStream();
  let content = '';
  stream.on('data', data => content += data.toString());
  await new Promise(f => stream.on('end', f));
  expect(content).toBe('Hello world');
  await page.close();
});

it('should delete downloads on context destruction', async ({browser, server}) => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download1 ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const [ download2 ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const path1 = await download1.path();
  const path2 = await download2.path();
  expect(fs.existsSync(path1)).toBeTruthy();
  expect(fs.existsSync(path2)).toBeTruthy();
  await page.context().close();
  expect(fs.existsSync(path1)).toBeFalsy();
  expect(fs.existsSync(path2)).toBeFalsy();
});

it('should delete downloads on browser gone', async ({ server, browserType, defaultBrowserOptions }) => {
  const browser = await browserType.launch(defaultBrowserOptions);
  const page = await browser.newPage({ acceptDownloads: true });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [ download1 ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const [ download2 ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const path1 = await download1.path();
  const path2 = await download2.path();
  expect(fs.existsSync(path1)).toBeTruthy();
  expect(fs.existsSync(path2)).toBeTruthy();
  await browser.close();
  expect(fs.existsSync(path1)).toBeFalsy();
  expect(fs.existsSync(path2)).toBeFalsy();
  expect(fs.existsSync(path.join(path1, '..'))).toBeFalsy();
});
