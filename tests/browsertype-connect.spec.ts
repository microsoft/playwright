/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { playwrightTest as test, expect } from './config/browserTest';
import fs from 'fs';
import * as path from 'path';
import { getUserAgent } from '../lib/utils/utils';

test.slow(true, 'All connect tests are slow');

test('should be able to reconnect to a browser', async ({browserType, startRemoteServer, server}) => {
  const remoteServer = await startRemoteServer();
  {
    const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
    const browserContext = await browser.newContext();
    expect(browserContext.pages().length).toBe(0);
    const page = await browserContext.newPage();
    expect(await page.evaluate('11 * 11')).toBe(121);
    await page.goto(server.EMPTY_PAGE);
    await browser.close();
  }
  {
    const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
    const browserContext = await browser.newContext();
    const page = await browserContext.newPage();
    await page.goto(server.EMPTY_PAGE);
    await browser.close();
  }
});

test('should be able to connect two browsers at the same time', async ({browserType, startRemoteServer}) => {
  const remoteServer = await startRemoteServer();

  const browser1 = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  expect(browser1.contexts().length).toBe(0);
  await browser1.newContext();
  expect(browser1.contexts().length).toBe(1);

  const browser2 = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  expect(browser2.contexts().length).toBe(0);
  await browser2.newContext();
  expect(browser2.contexts().length).toBe(1);
  expect(browser1.contexts().length).toBe(1);

  await browser1.close();
  const page2 = await browser2.newPage();
  expect(await page2.evaluate(() => 7 * 6)).toBe(42); // original browser should still work

  await browser2.close();
});

test('should timeout while connecting', async ({browserType, startRemoteServer, server}) => {
  const e = await browserType.connect({
    wsEndpoint: `ws://localhost:${server.PORT}/ws`,
    timeout: 100,
  }).catch(e => e);
  expect(e.message).toContain('browserType.connect: Timeout 100ms exceeded.');
});

test('should send extra headers with connect request', async ({browserType, startRemoteServer, server}) => {
  const [request] = await Promise.all([
    server.waitForWebSocketConnectionRequest(),
    browserType.connect({
      wsEndpoint: `ws://localhost:${server.PORT}/ws`,
      headers: {
        'User-Agent': 'Playwright',
        'foo': 'bar',
      },
      timeout: 100,
    }).catch(() => {})
  ]);
  expect(request.headers['user-agent']).toBe('Playwright');
  expect(request.headers['foo']).toBe('bar');
});

test('should send default User-Agent header with connect request', async ({browserType, startRemoteServer, server}) => {
  const [request] = await Promise.all([
    server.waitForWebSocketConnectionRequest(),
    browserType.connect({
      wsEndpoint: `ws://localhost:${server.PORT}/ws`,
      headers: {
        'foo': 'bar',
      },
      timeout: 100,
    }).catch(() => {})
  ]);
  expect(request.headers['user-agent']).toBe(getUserAgent());
  expect(request.headers['foo']).toBe('bar');
});

test('disconnected event should be emitted when browser is closed or server is closed', async ({browserType, startRemoteServer}) => {
  const remoteServer = await startRemoteServer();

  const browser1 = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  await browser1.newPage();

  const browser2 = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  await browser2.newPage();

  let disconnected1 = 0;
  let disconnected2 = 0;
  browser1.on('disconnected', () => ++disconnected1);
  browser2.on('disconnected', () => ++disconnected2);

  await Promise.all([
    new Promise(f => browser1.on('disconnected', f)),
    browser1.close(),
  ]);
  expect(disconnected1).toBe(1);
  expect(disconnected2).toBe(0);

  await Promise.all([
    new Promise(f => browser2.on('disconnected', f)),
    remoteServer.close(),
  ]);
  expect(disconnected1).toBe(1);
  expect(disconnected2).toBe(1);
});

test('disconnected event should have browser as argument', async ({browserType, startRemoteServer}) => {
  const remoteServer = await startRemoteServer();
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const [disconnected] = await Promise.all([
    new Promise(f => browser.on('disconnected', f)),
    browser.close(),
  ]);
  expect(disconnected).toBe(browser);
});

test('should handle exceptions during connect', async ({browserType, startRemoteServer, mode}) => {
  test.skip(mode !== 'default');

  const remoteServer = await startRemoteServer();
  const __testHookBeforeCreateBrowser = () => { throw new Error('Dummy'); };
  const error = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint(), __testHookBeforeCreateBrowser } as any).catch(e => e);
  expect(error.message).toContain('Dummy');
});

test('should set the browser connected state', async ({browserType, startRemoteServer}) => {
  const remoteServer = await startRemoteServer();
  const remote = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  expect(remote.isConnected()).toBe(true);
  await remote.close();
  expect(remote.isConnected()).toBe(false);
});

test('should throw when used after isConnected returns false', async ({browserType, startRemoteServer}) => {
  const remoteServer = await startRemoteServer();
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const page = await browser.newPage();
  await Promise.all([
    remoteServer.close(),
    new Promise(f => browser.once('disconnected', f)),
  ]);
  expect(browser.isConnected()).toBe(false);
  const error = await page.evaluate('1 + 1').catch(e => e) as Error;
  expect(error.message).toContain('has been closed');
});

test('should throw when calling waitForNavigation after disconnect', async ({browserType, startRemoteServer}) => {
  const remoteServer = await startRemoteServer();
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const page = await browser.newPage();
  await Promise.all([
    remoteServer.close(),
    new Promise(f => browser.once('disconnected', f)),
  ]);
  expect(browser.isConnected()).toBe(false);
  const error = await page.waitForNavigation().catch(e => e);
  expect(error.message).toContain('Navigation failed because page was closed');
});

test('should reject navigation when browser closes', async ({browserType, startRemoteServer, server}) => {
  const remoteServer = await startRemoteServer();
  server.setRoute('/one-style.css', () => {});
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const page = await browser.newPage();
  const navigationPromise = page.goto(server.PREFIX + '/one-style.html', {timeout: 60000}).catch(e => e);
  await server.waitForRequest('/one-style.css');
  await browser.close();
  const error = await navigationPromise;
  expect(error.message).toContain('has been closed');
});

test('should reject waitForSelector when browser closes', async ({browserType, startRemoteServer, server}) => {
  const remoteServer = await startRemoteServer();
  server.setRoute('/empty.html', () => {});
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const page = await browser.newPage();
  const watchdog = page.waitForSelector('div', { state: 'attached', timeout: 60000 }).catch(e => e);

  // Make sure the previous waitForSelector has time to make it to the browser before we disconnect.
  await page.waitForSelector('body', { state: 'attached' });

  await browser.close();
  const error = await watchdog;
  expect(error.message).toContain('has been closed');
});

test('should emit close events on pages and contexts', async ({browserType, startRemoteServer}) => {
  const remoteServer = await startRemoteServer();
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const context = await browser.newContext();
  const page = await context.newPage();
  let pageClosed = false;
  page.on('close', () => pageClosed = true);
  await Promise.all([
    new Promise(f => context.on('close', f)),
    remoteServer.close()
  ]);
  expect(pageClosed).toBeTruthy();
});

test('should terminate network waiters', async ({browserType, startRemoteServer, server}) => {
  const remoteServer = await startRemoteServer();
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const newPage = await browser.newPage();
  const results = await Promise.all([
    newPage.waitForRequest(server.EMPTY_PAGE).catch(e => e),
    newPage.waitForResponse(server.EMPTY_PAGE).catch(e => e),
    remoteServer.close(),
  ]);
  for (let i = 0; i < 2; i++) {
    const message = results[i].message;
    expect(message).toContain('Page closed');
    expect(message).not.toContain('Timeout');
  }
});

test('should respect selectors', async ({ playwright, browserType, startRemoteServer }) => {
  const remoteServer = await startRemoteServer();

  const mycss = () => ({
    query(root, selector) {
      return root.querySelector(selector);
    },
    queryAll(root: HTMLElement, selector: string) {
      return Array.from(root.querySelectorAll(selector));
    }
  });
  // Register one engine before connecting.
  await playwright.selectors.register('mycss1', mycss);

  const browser1 = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const context1 = await browser1.newContext();

  // Register another engine after creating context.
  await playwright.selectors.register('mycss2', mycss);

  const page1 = await context1.newPage();
  await page1.setContent(`<div>hello</div>`);
  expect(await page1.innerHTML('css=div')).toBe('hello');
  expect(await page1.innerHTML('mycss1=div')).toBe('hello');
  expect(await page1.innerHTML('mycss2=div')).toBe('hello');

  const browser2 = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });

  // Register third engine after second connect.
  await playwright.selectors.register('mycss3', mycss);

  const page2 = await browser2.newPage();
  await page2.setContent(`<div>hello</div>`);
  expect(await page2.innerHTML('css=div')).toBe('hello');
  expect(await page2.innerHTML('mycss1=div')).toBe('hello');
  expect(await page2.innerHTML('mycss2=div')).toBe('hello');
  expect(await page2.innerHTML('mycss3=div')).toBe('hello');

  await browser1.close();
});

test('should not throw on close after disconnect', async ({browserType, startRemoteServer}) => {
  const remoteServer = await startRemoteServer();
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  await browser.newPage();
  await Promise.all([
    new Promise(f => browser.on('disconnected', f)),
    remoteServer.close()
  ]);
  await browser.close();
});

test('should not throw on context.close after disconnect', async ({browserType, startRemoteServer}) => {
  const remoteServer = await startRemoteServer();
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const context = await browser.newContext();
  await context.newPage();
  await Promise.all([
    new Promise(f => browser.on('disconnected', f)),
    remoteServer.close()
  ]);
  await context.close();
});

test('should not throw on page.close after disconnect', async ({browserType, startRemoteServer}) => {
  const remoteServer = await startRemoteServer();
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const page = await browser.newPage();
  await Promise.all([
    new Promise(f => browser.on('disconnected', f)),
    remoteServer.close()
  ]);
  await page.close();
});

test('should saveAs videos from remote browser', async ({browserType, startRemoteServer}, testInfo) => {
  const remoteServer = await startRemoteServer();
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const videosPath = testInfo.outputPath();
  const context = await browser.newContext({
    recordVideo: { dir: videosPath, size: { width: 320, height: 240 } },
  });
  const page = await context.newPage();
  await page.evaluate(() => document.body.style.backgroundColor = 'red');
  await new Promise(r => setTimeout(r, 1000));
  await context.close();

  const savedAsPath = testInfo.outputPath('my-video.webm');
  await page.video().saveAs(savedAsPath);
  expect(fs.existsSync(savedAsPath)).toBeTruthy();
  const error = await page.video().path().catch(e => e);
  expect(error.message).toContain('Path is not available when using browserType.connect(). Use saveAs() to save a local copy.');
});

test('should be able to connect 20 times to a single server without warnings', async ({browserType, startRemoteServer}) => {
  const remoteServer = await startRemoteServer();

  let warning = null;
  const warningHandler = w => warning = w;
  process.on('warning', warningHandler);

  const browsers = [];
  for (let i = 0; i < 20; i++)
    browsers.push(await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() }));
  await Promise.all([browsers.map(browser => browser.close())]);

  process.off('warning', warningHandler);
  expect(warning).toBe(null);
});

test('should save download', async ({server, browserType, startRemoteServer}, testInfo) => {
  server.setRoute('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment');
    res.end(`Hello world`);
  });

  const remoteServer = await startRemoteServer();
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
  expect(error.message).toContain('Path is not available when using browserType.connect(). Use saveAs() to save a local copy.');
  await browser.close();
});

test('should error when saving download after deletion', async ({server, browserType, startRemoteServer}, testInfo) => {
  server.setRoute('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment');
    res.end(`Hello world`);
  });

  const remoteServer = await startRemoteServer();
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
  expect(message).toContain('Target page, context or browser has been closed');
  await browser.close();
});

test('should work with cluster', async ({browserType, startRemoteServer}) => {
  const remoteServer = await startRemoteServer({ inCluster: true });
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const page = await browser.newPage();
  expect(await page.evaluate('1 + 2')).toBe(3);
});

test('should properly disconnect when connection closes from the client side', async ({browserType, startRemoteServer, server}) => {
  server.setRoute('/one-style.css', () => {});
  const remoteServer = await startRemoteServer();
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const page = await browser.newPage();
  const navigationPromise = page.goto(server.PREFIX + '/one-style.html', {timeout: 60000}).catch(e => e);
  const waitForNavigationPromise = page.waitForNavigation().catch(e => e);

  const disconnectedPromise = new Promise(f => browser.once('disconnected', f));
  // This closes the websocket.
  (browser as any)._connection.close();
  await disconnectedPromise;
  expect(browser.isConnected()).toBe(false);

  expect((await navigationPromise).message).toContain('has been closed');
  expect((await waitForNavigationPromise).message).toContain('Navigation failed because page was closed');
  expect((await page.goto(server.EMPTY_PAGE).catch(e => e)).message).toContain('has been closed');
  expect((await page.waitForNavigation().catch(e => e)).message).toContain('Navigation failed because page was closed');
});

test('should properly disconnect when connection closes from the server side', async ({browserType, startRemoteServer, server, platform}) => {
  test.skip(platform === 'win32', 'Cannot send signals');

  server.setRoute('/one-style.css', () => {});
  const remoteServer = await startRemoteServer({ disconnectOnSIGHUP: true });
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const page = await browser.newPage();
  const navigationPromise = page.goto(server.PREFIX + '/one-style.html', {timeout: 60000}).catch(e => e);
  const waitForNavigationPromise = page.waitForNavigation().catch(e => e);

  const disconnectedPromise = new Promise(f => browser.once('disconnected', f));
  // This closes the websocket server.
  process.kill(remoteServer.child().pid, 'SIGHUP');
  await disconnectedPromise;
  expect(browser.isConnected()).toBe(false);

  expect((await navigationPromise).message).toContain('has been closed');
  expect((await waitForNavigationPromise).message).toContain('Navigation failed because page was closed');
  expect((await page.goto(server.EMPTY_PAGE).catch(e => e)).message).toContain('has been closed');
  expect((await page.waitForNavigation().catch(e => e)).message).toContain('Navigation failed because page was closed');
});
