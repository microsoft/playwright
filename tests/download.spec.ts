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

import { browserTest as it, expect } from './config/browserTest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

it.describe('download event', () => {
  it.beforeEach(async ({server}) => {
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
    server.setRoute('/downloadWithDelay', (req, res) => {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
      // Chromium requires a large enough payload to trigger the download event soon enough
      res.write('a'.repeat(4096));
      res.write('foo');
      res.uncork();
    });
  });

  it('should report downloads with acceptDownloads: false', async ({browser, server}) => {
    const page = await browser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/downloadWithFilename">download</a>`);
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    let error;
    expect(download.page()).toBe(page);
    expect(download.url()).toBe(`${server.PREFIX}/downloadWithFilename`);
    expect(download.suggestedFilename()).toBe(`file.txt`);
    await download.path().catch(e => error = e);
    expect(await download.failure()).toContain('acceptDownloads');
    expect(error.message).toContain('acceptDownloads: true');
    await page.close();
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

  it('should report proper download url when download is from download attribute', async ({browser, server, browserName}) => {
    const page = await browser.newPage({ acceptDownloads: true });
    await page.goto(server.PREFIX + '/empty.html');
    await page.setContent(`<a href="${server.PREFIX}/chromium-linux.zip" download="foo.zip">download</a>`);
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    expect(download.url()).toBe(`${server.PREFIX}/chromium-linux.zip`);
    await page.close();
  });

  it('should report downloads for download attribute', async ({browser, server}) => {
    const page = await browser.newPage({ acceptDownloads: true });
    await page.goto(server.PREFIX + '/empty.html');
    await page.setContent(`<a href="${server.PREFIX}/chromium-linux.zip" download="foo.zip">download</a>`);
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    expect(download.suggestedFilename()).toBe(`foo.zip`);
    const path = await download.path();
    expect(fs.existsSync(path)).toBeTruthy();
    await page.close();
  });

  it('should save to user-specified path', async ({browser, server}, testInfo) => {
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

  it('should save to user-specified path without updating original path', async ({browser, server}, testInfo) => {
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

  it('should save to two different paths with multiple saveAs calls', async ({browser, server}, testInfo) => {
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

  it('should save to overwritten filepath', async ({browser, server}, testInfo) => {
    const page = await browser.newPage({ acceptDownloads: true });
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const dir = testInfo.outputPath('downloads');
    const userPath = path.join(dir, 'download.txt');
    await download.saveAs(userPath);
    expect((await fs.promises.readdir(dir)).length).toBe(1);
    await download.saveAs(userPath);
    expect((await fs.promises.readdir(dir)).length).toBe(1);
    expect(fs.existsSync(userPath)).toBeTruthy();
    expect(fs.readFileSync(userPath).toString()).toBe('Hello world');
    await page.close();
  });

  it('should create subdirectories when saving to non-existent user-specified path', async ({browser, server}, testInfo) => {
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

  it('should error when saving with downloads disabled', async ({browser, server}, testInfo) => {
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

  it('should error when saving after deletion', async ({browser, server}, testInfo) => {
    const page = await browser.newPage({ acceptDownloads: true });
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const userPath = testInfo.outputPath('download.txt');
    await download.delete();
    const { message } = await download.saveAs(userPath).catch(e => e);
    expect(message).toContain('Target page, context or browser has been closed');
    await page.close();
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

  it('should report alt-click downloads', async ({browser, server, browserName}) => {
    it.fixme(browserName === 'firefox' || browserName === 'webkit');

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

  it('should report new window downloads', async ({browser, server}) => {
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

  it('should delete downloads on browser gone', async ({ server, browserType, browserOptions }) => {
    const browser = await browserType.launch(browserOptions);
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

  it('should close the context without awaiting the failed download', async ({browser, server, httpsServer, browserName, headless}, testInfo) => {
    it.skip(browserName !== 'chromium', 'Only Chromium downloads on alt-click');

    const page = await browser.newPage({ acceptDownloads: true });
    await page.goto(server.EMPTY_PAGE);
    await page.setContent(`<a href="${httpsServer.PREFIX}/downloadWithFilename" download="file.txt">click me</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      // Use alt-click to force the download. Otherwise browsers might try to navigate first,
      // probably because of http -> https link.
      page.click('a', { modifiers: ['Alt']})
    ]);
    const [downloadPath, saveError] = await Promise.all([
      download.path(),
      download.saveAs(testInfo.outputPath('download.txt')).catch(e => e),
      page.context().close(),
    ]);
    expect(downloadPath).toBe(null);
    expect(saveError.message).toContain('File not found on disk. Check download.failure() for details.');
  });

  it('should close the context without awaiting the download', async ({browser, server, browserName, platform}, testInfo) => {
    it.skip(browserName === 'webkit' && platform === 'linux', 'WebKit on linux does not convert to the download immediately upon receiving headers');

    server.setRoute('/downloadStall', (req, res) => {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
      res.writeHead(200);
      res.flushHeaders();
      res.write(`Hello world`);
    });

    const page = await browser.newPage({ acceptDownloads: true });
    await page.goto(server.EMPTY_PAGE);
    await page.setContent(`<a href="${server.PREFIX}/downloadStall" download="file.txt">click me</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const [downloadPath, saveError] = await Promise.all([
      download.path(),
      download.saveAs(testInfo.outputPath('download.txt')).catch(e => e),
      page.context().close(),
    ]);
    expect(downloadPath).toBe(null);
    // The exact error message is racy, because sometimes browser is fast enough
    // to cancel the download.
    expect([
      'download.saveAs: canceled',
      'download.saveAs: File deleted upon browser context closure.',
    ]).toContain(saveError.message);
  });

  it('should throw if browser dies', async ({ server, browserType, browserName, browserOptions, platform}, testInfo) => {
    it.skip(browserName === 'webkit' && platform === 'linux', 'WebKit on linux does not convert to the download immediately upon receiving headers');
    server.setRoute('/downloadStall', (req, res) => {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
      res.writeHead(200);
      res.flushHeaders();
      res.write(`Hello world`);
    });

    const browser = await browserType.launch(browserOptions);
    const page = await browser.newPage({ acceptDownloads: true });
    await page.setContent(`<a href="${server.PREFIX}/downloadStall">click me</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const [downloadPath, saveError] = await Promise.all([
      download.path(),
      download.saveAs(testInfo.outputPath('download.txt')).catch(e => e),
      (browser as any)._channel.killForTests(),
    ]);
    expect(downloadPath).toBe(null);
    expect(saveError.message).toContain('File deleted upon browser context closure.');
  });

  it('should download large binary.zip', async ({browser, server, browserName}, testInfo) => {
    const zipFile = testInfo.outputPath('binary.zip');
    const content = crypto.randomBytes(1 << 20);
    fs.writeFileSync(zipFile, content);
    server.setRoute('/binary.zip', (req, res) => server.serveFile(req, res, zipFile));

    const page = await browser.newPage({ acceptDownloads: true });
    await page.goto(server.PREFIX + '/empty.html');
    await page.setContent(`<a href="${server.PREFIX}/binary.zip" download="binary.zip">download</a>`);
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath);
    expect(fileContent.byteLength).toBe(content.byteLength);
    expect(fileContent.equals(content)).toBe(true);

    const stream = await download.createReadStream();
    const data = await new Promise<Buffer>((fulfill, reject) => {
      const bufs = [];
      stream.on('data', d => bufs.push(d));
      stream.on('error', reject);
      stream.on('end', () => fulfill(Buffer.concat(bufs)));
    });
    expect(data.byteLength).toBe(content.byteLength);
    expect(data.equals(content)).toBe(true);
    await page.close();
  });

  it('should be able to cancel pending downloads', async ({browser, server, browserName, browserVersion}) => {
    // The exact upstream change is in b449b5c, which still does not appear in the first few 91.* tags until 91.0.4437.0.
    it.fixme(browserName === 'chromium' && Number(browserVersion.split('.')[0]) < 91, 'The upstream Browser.cancelDownload command is not available before Chrome 91');
    it.fixme(browserName !== 'chromium', 'Download cancellation currently implemented for only Chromium');
    const page = await browser.newPage({ acceptDownloads: true });
    await page.setContent(`<a href="${server.PREFIX}/downloadWithDelay">download</a>`);
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    await download._cancel();
    const failure = await download.failure();
    expect(failure).toBe('canceled');
    await page.close();
  });

  it('should not fail explicitly to cancel a download even if that is already finished', async ({browser, server, browserName, browserVersion}) => {
    // The exact upstream change is in b449b5c, which still does not appear in the first few 91.* tags until 91.0.4437.0.
    it.fixme(browserName === 'chromium' && Number(browserVersion.split('.')[0]) < 91, 'The upstream Browser.cancelDownload command is not available before Chrome 91');
    it.fixme(browserName !== 'chromium', 'Download cancellation currently implemented for only Chromium');
    const page = await browser.newPage({ acceptDownloads: true });
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const path = await download.path();
    expect(fs.existsSync(path)).toBeTruthy();
    expect(fs.readFileSync(path).toString()).toBe('Hello world');
    await download._cancel();
    const failure = await download.failure();
    expect(failure).toBe(null);
    await page.close();
  });

  it('should report downloads with interception', async ({browser, server}) => {
    const page = await browser.newPage({ acceptDownloads: true });
    await page.route(/.*/, r => r.continue());
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
});
