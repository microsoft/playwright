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

import { browserTest as it, expect } from '../config/browserTest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Download } from 'playwright-core';
import { kTargetClosedErrorMessage } from '../config/errors';

it.describe('download event', () => {
  it.skip(({ mode }) => mode !== 'default', 'download.path() is not available in remote mode');

  it.beforeEach(async ({ server }) => {
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
    server.setRoute('/downloadWithCOOP', (req, res) => {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.end(`Hello world`);
    });
  });

  it('should report download when navigation turns into download @smoke', async ({ browser, server, browserName, mode }) => {
    const page = await browser.newPage();
    const [download, responseOrError] = await Promise.all([
      page.waitForEvent('download'),
      page.goto(server.PREFIX + '/download').catch(e => e)
    ]);
    expect(download.page()).toBe(page);
    expect(download.url()).toBe(`${server.PREFIX}/download`);
    const path = await download.path();
    expect(fs.existsSync(path)).toBeTruthy();
    expect(fs.readFileSync(path).toString()).toBe('Hello world');
    if (browserName === 'chromium') {
      expect(responseOrError instanceof Error).toBeTruthy();
      expect(responseOrError.message).toContain('net::ERR_ABORTED');
      expect(page.url()).toBe('about:blank');
    } else if (browserName === 'webkit') {
      expect(responseOrError instanceof Error).toBeTruthy();
      expect(responseOrError.message).toContain('Download is starting');
      expect(page.url()).toBe('about:blank');
    } else {
      expect(responseOrError instanceof Error).toBeTruthy();
      expect(responseOrError.message).toContain('Download is starting');
    }
    await page.close();
  });

  it('should work with Cross-Origin-Opener-Policy', async ({ browser, server, browserName }) => {
    const page = await browser.newPage();
    const [download, responseOrError] = await Promise.all([
      page.waitForEvent('download'),
      page.goto(server.PREFIX + '/downloadWithCOOP').catch(e => e)
    ]);
    expect(download.page()).toBe(page);
    expect(download.url()).toBe(`${server.PREFIX}/downloadWithCOOP`);
    const path = await download.path();
    expect(fs.existsSync(path)).toBeTruthy();
    expect(fs.readFileSync(path).toString()).toBe('Hello world');
    if (browserName === 'chromium') {
      expect(responseOrError instanceof Error).toBeTruthy();
      expect(responseOrError.message).toContain('net::ERR_ABORTED');
      expect(page.url()).toBe('about:blank');
    } else if (browserName === 'webkit') {
      expect(responseOrError instanceof Error).toBeTruthy();
      expect(responseOrError.message).toContain('Download is starting');
      expect(page.url()).toBe('about:blank');
    } else {
      expect(responseOrError instanceof Error).toBeTruthy();
      expect(responseOrError.message).toContain('Download is starting');
    }
    await page.close();
  });

  it('should report downloads with acceptDownloads: false', async ({ browser, server }) => {
    const page = await browser.newPage({ acceptDownloads: false });
    await page.setContent(`<a href="${server.PREFIX}/downloadWithFilename">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    let error;
    expect(download.page()).toBe(page);
    expect(download.url()).toBe(`${server.PREFIX}/downloadWithFilename`);
    expect(download.suggestedFilename()).toBe(`file.txt`);
    await download.path().catch(e => error = e);
    expect(await download.failure()).toContain('acceptDownloads');
    expect(error!.message).toContain('acceptDownloads: true');
    await page.close();
  });

  it('should report downloads with acceptDownloads: true', async ({ browser, server }) => {
    const page = await browser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const path = await download.path();
    expect(fs.existsSync(path)).toBeTruthy();
    expect(fs.readFileSync(path).toString()).toBe('Hello world');
    await page.close();
  });

  it('should report proper download url when download is from download attribute', async ({ browser, server, browserName }) => {
    const page = await browser.newPage();
    await page.goto(server.PREFIX + '/empty.html');
    await page.setContent(`<a href="${server.PREFIX}/chromium-linux.zip" download="foo.zip">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    expect(download.url()).toBe(`${server.PREFIX}/chromium-linux.zip`);
    await page.close();
  });

  it('should report downloads for download attribute', async ({ browser, server }) => {
    const page = await browser.newPage();
    await page.goto(server.PREFIX + '/empty.html');
    await page.setContent(`<a href="${server.PREFIX}/chromium-linux.zip" download="foo.zip">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    expect(download.suggestedFilename()).toBe(`foo.zip`);
    const path = await download.path();
    expect(fs.existsSync(path)).toBeTruthy();
    await page.close();
  });

  it('should save to user-specified path without updating original path', async ({ browser, server }, testInfo) => {
    const page = await browser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
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

  it('should save to two different paths with multiple saveAs calls', async ({ browser, server }, testInfo) => {
    const page = await browser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
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

  it('should save to overwritten filepath', async ({ browser, server }, testInfo) => {
    const page = await browser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
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

  it('should create subdirectories when saving to non-existent user-specified path', async ({ browser, server }, testInfo) => {
    const page = await browser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const nestedPath = testInfo.outputPath(path.join('these', 'are', 'directories', 'download.txt'));
    await download.saveAs(nestedPath);
    expect(fs.existsSync(nestedPath)).toBeTruthy();
    expect(fs.readFileSync(nestedPath).toString()).toBe('Hello world');
    await page.close();
  });

  it('should error when saving with downloads disabled', async ({ browser, server }, testInfo) => {
    const page = await browser.newPage({ acceptDownloads: false });
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const userPath = testInfo.outputPath('download.txt');
    const { message } = await download.saveAs(userPath).catch(e => e);
    expect(message).toContain('Pass { acceptDownloads: true } when you are creating your browser context');
    await page.close();
  });

  it('should error when saving after deletion', async ({ browser, server }, testInfo) => {
    const page = await browser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const userPath = testInfo.outputPath('download.txt');
    await download.delete();
    const { message } = await download.saveAs(userPath).catch(e => e);
    expect(message).toContain('Target page, context or browser has been closed');
    await page.close();
  });

  it('should report non-navigation downloads', async ({ browser, server }) => {
    // Mac WebKit embedder does not download in this case, although Safari does.
    server.setRoute('/download', (req, res) => {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.end(`Hello world`);
    });

    const page = await browser.newPage();
    await page.goto(server.EMPTY_PAGE);
    await page.setContent(`<a download="file.txt" href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    expect(download.suggestedFilename()).toBe(`file.txt`);
    const path = await download.path();
    expect(fs.existsSync(path)).toBeTruthy();
    expect(fs.readFileSync(path).toString()).toBe('Hello world');
    await page.close();
  });

  it(`should report download path within page.on('download', …) handler for Files`, async ({ browser, server }) => {
    const page = await browser.newPage();
    const onDownloadPath = new Promise<string>(res => {
      page.on('download', dl => {
        void dl.path().then(res);
      });
    });
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    await page.click('a');
    const path = await onDownloadPath;
    expect(fs.readFileSync(path).toString()).toBe('Hello world');
    await page.close();
  });

  it(`should report download path within page.on('download', …) handler for Blobs`, async ({ browser, server }) => {
    const page = await browser.newPage();
    const onDownloadPath = new Promise<string>(res => {
      page.on('download', dl => {
        void dl.path().then(res);
      });
    });
    await page.goto(server.PREFIX + '/download-blob.html');
    await page.click('a');
    const path = await onDownloadPath;
    expect(fs.readFileSync(path).toString()).toBe('Hello world');
    await page.close();
  });

  it('should report alt-click downloads', async ({ browser, server, browserName }) => {
    it.fixme(browserName === 'firefox');

    // Firefox does not download on alt-click by default.
    // Our WebKit embedder does not download on alt-click, although Safari does.
    server.setRoute('/download', (req, res) => {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.end(`Hello world`);
    });

    const page = await browser.newPage();
    await page.goto(server.EMPTY_PAGE);
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a', { modifiers: ['Alt'] })
    ]);
    const path = await download.path();
    expect(fs.existsSync(path)).toBeTruthy();
    expect(fs.readFileSync(path).toString()).toBe('Hello world');
    await page.close();
  });

  it('should report new window downloads', async ({ browser, server }) => {
    const page = await browser.newPage();
    await page.setContent(`<a target=_blank href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const path = await download.path();
    expect(fs.existsSync(path)).toBeTruthy();
    await page.close();
  });

  it('should delete file', async ({ browser, server }) => {
    const page = await browser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const path = await download.path();
    expect(fs.existsSync(path)).toBeTruthy();
    await download.delete();
    expect(fs.existsSync(path)).toBeFalsy();
    await page.close();
  });

  it('should expose stream', async ({ browser, server }) => {
    const page = await browser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
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

  it('should delete downloads on context destruction', async ({ browser, server }) => {
    const page = await browser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download1] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const [download2] = await Promise.all([
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

  it('should delete downloads on browser gone', async ({ server, browserType }) => {
    const browser = await browserType.launch();
    const page = await browser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download1] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const [download2] = await Promise.all([
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

  it('should close the context without awaiting the failed download', async ({ browser, server, httpsServer, browserName, headless }, testInfo) => {
    it.skip(browserName !== 'chromium', 'Only Chromium downloads on alt-click');

    const page = await browser.newPage();
    await page.goto(server.EMPTY_PAGE);
    await page.setContent(`<a href="${httpsServer.PREFIX}/downloadWithFilename" download="file.txt">click me</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      // Use alt-click to force the download. Otherwise browsers might try to navigate first,
      // probably because of http -> https link.
      page.click('a', { modifiers: ['Alt'] })
    ]);
    const [downloadError, saveError] = await Promise.all([
      download.path().catch(e => e),
      download.saveAs(testInfo.outputPath('download.txt')).catch(e => e),
      page.context().close(),
    ]);
    expect(downloadError.message).toBe('download.path: canceled');
    expect([
      'download.saveAs: File not found on disk. Check download.failure() for details.',
      'download.saveAs: canceled',
    ]).toContain(saveError.message);
  });

  it('should close the context without awaiting the download', async ({ browser, server, browserName, platform }, testInfo) => {
    it.skip(browserName === 'webkit' && platform === 'linux', 'WebKit on linux does not convert to the download immediately upon receiving headers');

    server.setRoute('/downloadStall', (req, res) => {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
      res.writeHead(200);
      res.flushHeaders();
      res.write(`Hello world`);
    });

    const page = await browser.newPage();
    await page.goto(server.EMPTY_PAGE);
    await page.setContent(`<a href="${server.PREFIX}/downloadStall" download="file.txt">click me</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const [downloadError, saveError] = await Promise.all([
      download.path().catch(e => e),
      download.saveAs(testInfo.outputPath('download.txt')).catch(e => e),
      page.context().close(),
    ]);
    // The exact error message is racy, because sometimes browser is fast enough
    // to cancel the download.
    expect([
      'download.path: canceled',
      'download.path: ' + kTargetClosedErrorMessage,
    ]).toContain(downloadError.message);
    expect([
      'download.saveAs: canceled',
      'download.saveAs: ' + kTargetClosedErrorMessage,
    ]).toContain(saveError.message);
  });

  it('should throw if browser dies', async ({ server, browserType, browserName, platform }, testInfo) => {
    it.skip(browserName === 'webkit' && platform === 'linux', 'WebKit on linux does not convert to the download immediately upon receiving headers');
    server.setRoute('/downloadStall', (req, res) => {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
      res.writeHead(200);
      res.flushHeaders();
      res.write(`Hello world`);
    });

    const browser = await browserType.launch();
    const page = await browser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/downloadStall">click me</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const [downloadError, saveError] = await Promise.all([
      download.path().catch(e => e),
      download.saveAs(testInfo.outputPath('download.txt')).catch(e => e),
      (browser as any)._channel.killForTests(),
    ]);
    expect(downloadError.message).toBe('download.path: ' + kTargetClosedErrorMessage);
    expect(saveError.message).toContain('download.saveAs: ' + kTargetClosedErrorMessage);
    await browser.close();
  });

  it('should download large binary.zip', async ({ browser, server, browserName }, testInfo) => {
    const zipFile = testInfo.outputPath('binary.zip');
    const content = crypto.randomBytes(1 << 20);
    fs.writeFileSync(zipFile, content);
    server.setRoute('/binary.zip', (req, res) => server.serveFile(req, res, zipFile));

    const page = await browser.newPage();
    await page.goto(server.PREFIX + '/empty.html');
    await page.setContent(`<a href="${server.PREFIX}/binary.zip" download="binary.zip">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath);
    expect(fileContent.byteLength).toBe(content.byteLength);
    expect(fileContent.equals(content)).toBe(true);

    const stream = await download.createReadStream();
    const data = await new Promise<Buffer>((fulfill, reject) => {
      const buffs: Buffer[] = [];
      stream.on('data', d => buffs.push(d));
      stream.on('error', reject);
      stream.on('end', () => fulfill(Buffer.concat(buffs)));
    });
    expect(data.byteLength).toBe(content.byteLength);
    expect(data.equals(content)).toBe(true);
    await page.close();
  });

  it('should be able to cancel pending downloads', async ({ browser, server, browserName, browserVersion }) => {
    const page = await browser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/downloadWithDelay">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    await download.cancel();
    const failure = await download.failure();
    expect(failure).toBe('canceled');
    await page.close();
  });

  it('should not fail explicitly to cancel a download even if that is already finished', async ({ browser, server, browserName, browserVersion }) => {
    const page = await browser.newPage();
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const path = await download.path();
    expect(fs.existsSync(path)).toBeTruthy();
    expect(fs.readFileSync(path).toString()).toBe('Hello world');
    await download.cancel();
    const failure = await download.failure();
    expect(failure).toBe(null);
    await page.close();
  });

  it('should report downloads with interception', async ({ browser, server }) => {
    const page = await browser.newPage();
    await page.route(/.*/, r => r.continue());
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const path = await download.path();
    expect(fs.existsSync(path)).toBeTruthy();
    expect(fs.readFileSync(path).toString()).toBe('Hello world');
    await page.close();
  });

  it('should emit download event from nested iframes', async ({ server, browser, browserName }, testInfo) => {
    const page = await browser.newPage();
    server.setRoute('/1', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<iframe src="${server.PREFIX}/2"></iframe>`);
    });
    server.setRoute('/2', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<iframe src="${server.PREFIX}/3"></iframe>`);
    });
    server.setRoute('/3', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(` <a href="${server.PREFIX}/download">download</a>`);
    });
    await page.goto(server.PREFIX + '/1');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.frame({
        url: server.PREFIX + '/3'
      })!.click('text=download')
    ]);
    const userPath = testInfo.outputPath('download.txt');
    await download.saveAs(userPath);
    expect(fs.existsSync(userPath)).toBeTruthy();
    expect(fs.readFileSync(userPath).toString()).toBe('Hello world');
    await page.close();
  });
});

it('should be able to download a PDF file', async ({ browser, server, asset }) => {
  const page = await browser.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <a href="/empty.pdf" download>download</a>
  `);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a'),
  ]);
  await assertDownloadToPDF(download, asset('empty.pdf'));
  await page.close();
});

it('should be able to download a inline PDF file via response interception', async ({ browser, server, asset, browserName }) => {
  it.fixme(browserName === 'webkit');
  const page = await browser.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.route('**/empty.pdf', async route => {
    const response = await page.context().request.fetch(route.request());
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'Content-Disposition': 'attachment',
      }
    });
  });
  await page.setContent(`
    <a href="/empty.pdf">open</a>
  `);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a'),
  ]);
  await assertDownloadToPDF(download, asset('empty.pdf'));
  await page.close();
});

it('should be able to download a inline PDF file via navigation', async ({ browser, server, asset, browserName, headless }) => {
  it.fixme(((!headless || !!process.env.PLAYWRIGHT_CHROMIUM_USE_HEADLESS_NEW) && browserName === 'chromium'));
  const page = await browser.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <a href="/empty.pdf">open</a>
  `);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a'),
  ]);
  await assertDownloadToPDF(download, asset('empty.pdf'));
  await page.close();
});

it('should save to user-specified path', async ({ browser, server, mode }, testInfo) => {
  server.setRoute('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment');
    res.end(`Hello world`);
  });

  const page = await browser.newPage();
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  if (mode.startsWith('service')) {
    const error = await download.path().catch(e => e);
    expect(error.message).toContain('Path is not available when connecting remotely. Use saveAs() to save a local copy.');
  }
  const userPath = testInfo.outputPath('download.txt');
  await download.saveAs(userPath);
  expect(fs.existsSync(userPath)).toBeTruthy();
  expect(fs.readFileSync(userPath).toString()).toBe('Hello world');
  await page.close();
});

it('should download even if there is no "attachment" value', async ({ browser, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/19939' });
  server.setRoute('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    // Do not set the "attachment" value.
    res.setHeader('Content-Disposition', 'filename=foo.txt');
    res.end(`Hello world`);
  });

  const page = await browser.newPage();
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  await page.close();
});

it('should convert navigation to a resource with unsupported mime type into download', async ({ browser, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/19939' });
  server.setRoute('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.end(`Hello world`);
  });
  const page = await browser.newPage();
  await Promise.all([
    page.waitForEvent('download'),
    page.goto(`${server.PREFIX}/download`).catch(() => {})
  ]);
  await page.close();
});

it('should download links with data url', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/21892' });
  await page.setContent('<a download="SomeFile.txt" href="data:text/plain;charset=utf8;,hello world">Download!</a>');
  const downloadPromise = page.waitForEvent('download');
  await page.getByText('Download').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('SomeFile.txt');
});

it('should download successfully when routing', async ({ browser, server }) => {
  const page = await browser.newPage();
  await page.context().route('**/*', route => route.continue());
  await page.goto(server.PREFIX + '/empty.html');
  await page.setContent(`<a href="${server.PREFIX}/chromium-linux.zip" download="foo.zip">download</a>`);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  expect(download.suggestedFilename()).toBe('foo.zip');
  expect(download.url()).toBe(`${server.PREFIX}/chromium-linux.zip`);
  expect(await download.failure()).toBe(null);
  await page.close();
});

async function assertDownloadToPDF(download: Download, filePath: string) {
  expect(download.suggestedFilename()).toBe(path.basename(filePath));
  const stream = await download.createReadStream();
  const data = await new Promise<Buffer>((fulfill, reject) => {
    const buffs: Buffer[] = [];
    stream.on('data', d => buffs.push(d));
    stream.on('error', reject);
    stream.on('end', () => fulfill(Buffer.concat(buffs)));
  });
  expect(download.url().endsWith('/' + path.basename(filePath))).toBeTruthy();
  const expectedPrefix = '%PDF';
  for (let i = 0; i < expectedPrefix.length; i++)
    expect(data[i]).toBe(expectedPrefix.charCodeAt(i));
  assertBuffer(data, fs.readFileSync(filePath));
}

function assertBuffer(expected: Buffer, actual: Buffer) {
  expect(expected.byteLength).toBe(actual.byteLength);
  for (let i = 0; i < expected.byteLength; i++)
    expect(expected[i]).toBe(actual[i]);
}
