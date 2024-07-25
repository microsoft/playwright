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

import fs from 'fs';
import os from 'os';
import type http from 'http';
import type net from 'net';
import * as path from 'path';
import { getUserAgent, getPlaywrightVersion } from '../../packages/playwright-core/lib/utils/userAgent';
import WebSocket from 'ws';
import { expect, playwrightTest } from '../config/browserTest';
import { parseTrace, suppressCertificateWarning } from '../config/utils';
import formidable from 'formidable';
import type { Browser, ConnectOptions } from 'playwright-core';
import { createHttpServer } from '../../packages/playwright-core/lib/utils/network';
import { kTargetClosedErrorMessage } from '../config/errors';
import { RunServer } from '../config/remoteServer';

type ExtraFixtures = {
  connect: (wsEndpoint: string, options?: ConnectOptions, redirectPortForTest?: number) => Promise<Browser>,
  dummyServerPort: number,
  ipV6ServerPort: number,
};
const test = playwrightTest.extend<ExtraFixtures>({
  connect: async ({ browserType }, use) => {
    let browser: Browser | undefined;
    await use(async (wsEndpoint, options = {}, redirectPortForTest): Promise<Browser> => {
      (options as any).__testHookRedirectPortForwarding = redirectPortForTest;
      options.headers = {
        'x-playwright-launch-options': JSON.stringify((browserType as any)._defaultLaunchOptions || {}),
        ...options.headers,
      };
      browser = await browserType.connect(wsEndpoint, options);
      return browser;
    });
    await browser?.close();
  },

  dummyServerPort: async ({}, use) => {
    const server = createHttpServer((req: http.IncomingMessage, res: http.ServerResponse) => {
      res.end('<html><body>from-dummy-server</body></html>');
    });
    await new Promise<void>(resolve => server.listen(0, resolve));
    await use((server.address() as net.AddressInfo).port);
    await new Promise<Error>(resolve => server.close(resolve));
  },

  ipV6ServerPort: async ({}, use) => {
    test.skip(!!process.env.INSIDE_DOCKER, 'docker does not support IPv6 by default');
    const server = createHttpServer((req: http.IncomingMessage, res: http.ServerResponse) => {
      res.end('<html><body>from-ipv6-server</body></html>');
    });
    await new Promise<void>(resolve => server.listen(0, '::1', resolve));
    const address = server.address() as net.AddressInfo;
    await use(address.port);
    await new Promise<Error>(resolve => server.close(resolve));
  },
});

test.slow(true, 'All connect tests are slow');
test.skip(({ mode }) => mode.startsWith('service'));

for (const kind of ['launchServer', 'run-server'] as const) {
  test.describe(kind, () => {

    test('should connect over wss', async ({ connect, startRemoteServer, httpsServer, mode }) => {
      test.skip(mode !== 'default'); // Out of process transport does not allow us to set env vars dynamically.
      const remoteServer = await startRemoteServer(kind);

      const oldValue = process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
      // https://stackoverflow.com/a/21961005/552185
      process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
      suppressCertificateWarning();
      try {
        httpsServer.onceWebSocketConnection((ws, request) => {
          const headers = Object.fromEntries(Object.entries(request.headers).filter(entry => entry[0].startsWith('x-playwright')));
          const remote = new WebSocket(remoteServer.wsEndpoint(), [], {
            perMessageDeflate: false,
            maxPayload: 256 * 1024 * 1024, // 256Mb,
            headers,
          });
          const remoteReadyPromise = new Promise<void>((f, r) => {
            remote.once('open', f);
            remote.once('error', r);
          });
          remote.on('close', () => ws.close());
          remote.on('error', error => ws.close());
          remote.on('message', message => ws.send(message));
          ws.on('message', async message => {
            await remoteReadyPromise;
            remote.send(message);
          });
          ws.on('close', () => remote.close());
          ws.on('error', () => remote.close());
        });
        const browser = await connect(`wss://localhost:${httpsServer.PORT}/ws`);
        expect(browser.version()).toBeTruthy();
        await browser.close();
      } finally {
        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = oldValue;
      }
    });

    test('should print HTTP error', async ({ connect, server }) => {
      const error = await connect(`ws://localhost:${server.PORT}/ws-401`).catch(e => e);
      expect(error.message).toContain('401');
      expect(error.message).toContain('Unauthorized body');
    });

    test('should print ws error', async ({ connect, server }) => {
      const error = await connect(`ws://does-not-exist.problem-domain:10987?secret=MYSECRET`).catch(e => e);
      expect(error.message).toContain('<ws connecting> ws://does-not-exist.problem-domain:10987/');
      expect(error.message).toContain('<ws error>');
      expect(error.message).toContain('getaddrinfo');
      expect(error.message).not.toContain('secret=MYSECRET');
    });

    test('should print custom ws close error', async ({ connect, server }) => {
      server.onceWebSocketConnection((ws, request) => {
        ws.on('message', message => {
          ws.close(4123, 'Oh my!');
        });
      });
      const error = await connect(`ws://localhost:${server.PORT}/ws`).catch(e => e);
      expect(error.message).toContain('browserType.connect: Oh my!');
    });

    test('should be able to reconnect to a browser', async ({ connect, startRemoteServer, server }) => {
      const remoteServer = await startRemoteServer(kind);
      {
        const browser = await connect(remoteServer.wsEndpoint());
        const browserContext = await browser.newContext();
        expect(browserContext.pages().length).toBe(0);
        const page = await browserContext.newPage();
        expect(await page.evaluate('11 * 11')).toBe(121);
        await page.goto(server.EMPTY_PAGE);
        await browser.close();
      }
      {
        const browser = await connect(remoteServer.wsEndpoint());
        const browserContext = await browser.newContext();
        const page = await browserContext.newPage();
        await page.goto(server.EMPTY_PAGE);
        await browser.close();
      }
    });

    test('should be able to visit ipv6', async ({ connect, startRemoteServer, ipV6ServerPort }) => {
      test.fail(!!process.env.INSIDE_DOCKER, 'docker does not support IPv6 by default');
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
      const page = await browser.newPage();
      const ipV6Url = 'http://[::1]:' + ipV6ServerPort;
      await page.goto(ipV6Url);
      expect(await page.content()).toContain('from-ipv6-server');
      await browser.close();
    });

    test('should ignore page.pause when headed', async ({ connect, startRemoteServer, browserType }) => {
      const headless = (browserType as any)._defaultLaunchOptions.headless;
      (browserType as any)._defaultLaunchOptions.headless = false;
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
      const browserContext = await browser.newContext();
      const page = await browserContext.newPage();
      await page.pause();
      await browser.close();
      (browserType as any)._defaultLaunchOptions.headless = headless;
    });

    test('should be able to visit ipv6 through localhost', async ({ connect, startRemoteServer, ipV6ServerPort }) => {
      test.fail(!!process.env.INSIDE_DOCKER, 'docker does not support IPv6 by default');
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
      const page = await browser.newPage();
      const ipV6Url = 'http://localhost:' + ipV6ServerPort;
      await page.goto(ipV6Url);
      expect(await page.content()).toContain('from-ipv6-server');
      await browser.close();
    });

    test('should be able to connect two browsers at the same time', async ({ connect, startRemoteServer }) => {
      const remoteServer = await startRemoteServer(kind);

      const browser1 = await connect(remoteServer.wsEndpoint());
      expect(browser1.contexts().length).toBe(0);
      await browser1.newContext();
      expect(browser1.contexts().length).toBe(1);

      const browser2 = await connect(remoteServer.wsEndpoint());
      expect(browser2.contexts().length).toBe(0);
      await browser2.newContext();
      expect(browser2.contexts().length).toBe(1);
      expect(browser1.contexts().length).toBe(1);

      await browser1.close();
      expect(browser2.contexts().length).toBe(1);
      const page2 = await browser2.newPage();
      expect(await page2.evaluate(() => 7 * 6)).toBe(42); // original browser should still work

      await browser2.close();
    });

    test('should timeout in socket while connecting', async ({ connect, server }) => {
      const e = await connect(`ws://localhost:${server.PORT}/ws-slow`, {
        timeout: 1000,
      }).catch(e => e);
      expect(e.message).toContain('browserType.connect: Timeout 1000ms exceeded');
    });

    test('should timeout in connect while connecting', async ({ connect, server }) => {
      const e = await connect(`ws://localhost:${server.PORT}/ws`, {
        timeout: 100,
      }).catch(e => e);
      expect(e.message).toContain('browserType.connect: Timeout 100ms exceeded');
    });

    test('should send extra headers with connect request', async ({ connect, server }) => {
      const [request] = await Promise.all([
        server.waitForWebSocketConnectionRequest(),
        connect(`ws://localhost:${server.PORT}/ws`, {
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

    test('should send default User-Agent and X-Playwright-Browser headers with connect request', async ({ connect, browserName, server }) => {
      const [request] = await Promise.all([
        server.waitForWebSocketConnectionRequest(),
        connect(`ws://localhost:${server.PORT}/ws`, {
          headers: {
            'foo': 'bar',
          },
          timeout: 100,
        }).catch(() => {})
      ]);
      expect(request.headers['user-agent']).toBe(getUserAgent());
      expect(request.headers['x-playwright-browser']).toBe(browserName);
      expect(request.headers['foo']).toBe('bar');
    });

    test('should support slowmo option', async ({ connect, startRemoteServer }) => {
      const remoteServer = await startRemoteServer(kind);

      const browser1 = await connect(remoteServer.wsEndpoint(), { slowMo: 200 });
      const start = Date.now();
      await browser1.newContext();
      await browser1.close();
      expect(Date.now() - start).toBeGreaterThan(199);
    });

    test('disconnected event should be emitted when browser is closed or server is closed', async ({ connect, startRemoteServer }) => {
      const remoteServer = await startRemoteServer(kind);

      const browser1 = await connect(remoteServer.wsEndpoint());
      await browser1.newPage();

      const browser2 = await connect(remoteServer.wsEndpoint());
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

    test('disconnected event should have browser as argument', async ({ connect, startRemoteServer }) => {
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
      const [disconnected] = await Promise.all([
        new Promise(f => browser.on('disconnected', f)),
        browser.close(),
      ]);
      expect(disconnected).toBe(browser);
    });

    test('should handle exceptions during connect', async ({ connect, startRemoteServer, mode }) => {
      test.skip(mode !== 'default');

      const remoteServer = await startRemoteServer(kind);
      const __testHookBeforeCreateBrowser = () => { throw new Error('Dummy'); };
      const error = await connect(remoteServer.wsEndpoint(), { __testHookBeforeCreateBrowser } as any).catch(e => e);
      expect(error.message).toContain('Dummy');
    });

    test('should set the browser connected state', async ({ connect, startRemoteServer }) => {
      const remoteServer = await startRemoteServer(kind);
      const remote = await connect(remoteServer.wsEndpoint());
      expect(remote.isConnected()).toBe(true);
      await remote.close();
      expect(remote.isConnected()).toBe(false);
    });

    test('should throw when used after isConnected returns false', async ({ connect, startRemoteServer }) => {
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
      const page = await browser.newPage();
      await Promise.all([
        remoteServer.close(),
        new Promise(f => browser.once('disconnected', f)),
      ]);
      expect(browser.isConnected()).toBe(false);
      const error = await page.evaluate('1 + 1').catch(e => e) as Error;
      expect(error.message).toContain('closed');
    });

    test('should throw when calling waitForNavigation after disconnect', async ({ connect, startRemoteServer }) => {
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
      const page = await browser.newPage();
      await Promise.all([
        remoteServer.close(),
        new Promise(f => browser.once('disconnected', f)),
      ]);
      expect(browser.isConnected()).toBe(false);
      const error = await page.waitForNavigation().catch(e => e);
      expect(error.message).toContain(kTargetClosedErrorMessage);
    });

    test('should reject navigation when browser closes', async ({ connect, startRemoteServer, server }) => {
      const remoteServer = await startRemoteServer(kind);
      server.setRoute('/one-style.css', () => {});
      const browser = await connect(remoteServer.wsEndpoint());
      const page = await browser.newPage();
      const navigationPromise = page.goto(server.PREFIX + '/one-style.html', { timeout: 60000 }).catch(e => e);
      await server.waitForRequest('/one-style.css');
      await browser.close();
      const error = await navigationPromise;
      expect(error.message).toContain('has been closed');
    });

    test('should reject waitForSelector when browser closes', async ({ connect, startRemoteServer, server }) => {
      const remoteServer = await startRemoteServer(kind);
      server.setRoute('/empty.html', () => {});
      const browser = await connect(remoteServer.wsEndpoint());
      const page = await browser.newPage();
      const watchdog = page.waitForSelector('div', { state: 'attached', timeout: 60000 }).catch(e => e);

      // Make sure the previous waitForSelector has time to make it to the browser before we disconnect.
      await page.waitForSelector('body', { state: 'attached' });

      await browser.close();
      const error = await watchdog;
      expect(error.message).toContain('has been closed');
    });

    test('should emit close events on pages and contexts', async ({ connect, startRemoteServer }) => {
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
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

    test('should terminate network waiters', async ({ connect, startRemoteServer, server }) => {
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
      const newPage = await browser.newPage();
      const results = await Promise.all([
        newPage.waitForRequest(server.EMPTY_PAGE).catch(e => e),
        newPage.waitForResponse(server.EMPTY_PAGE).catch(e => e),
        remoteServer.close(),
      ]);
      for (let i = 0; i < 2; i++) {
        const message = results[i].message;
        expect(message).toContain(kTargetClosedErrorMessage);
        expect(message).not.toContain('Timeout');
      }
    });

    test('should reject waitForEvent before browser.close finishes', async ({ connect, startRemoteServer, server }) => {
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
      const newPage = await browser.newPage();
      let rejected = false;
      const promise = newPage.waitForEvent('download').catch(() => rejected = true);
      await browser.close();
      expect(rejected).toBe(true);
      await promise;
    });

    test('should reject waitForEvent before browser.onDisconnect fires', async ({ connect, startRemoteServer, server }) => {
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
      const newPage = await browser.newPage();
      const log: string[] = [];
      const promise = newPage.waitForEvent('download').catch(() => log.push('rejected'));
      browser.on('disconnected', () => log.push('disconnected'));
      await remoteServer.close();
      await promise;
      await expect.poll(() => log).toEqual(['rejected', 'disconnected']);
    });

    test('should respect selectors', async ({ playwright, connect, startRemoteServer }) => {
      const remoteServer = await startRemoteServer(kind);

      const mycss1 = 'mycss1-' + kind;
      const mycss2 = 'mycss2-' + kind;
      const mycss3 = 'mycss3-' + kind;

      const mycss = () => ({
        query(root, selector) {
          return root.querySelector(selector);
        },
        queryAll(root: HTMLElement, selector: string) {
          return Array.from(root.querySelectorAll(selector));
        }
      });
      // Register one engine before connecting.
      await playwright.selectors.register(mycss1, mycss);

      const browser1 = await connect(remoteServer.wsEndpoint());
      const context1 = await browser1.newContext();

      // Register another engine after creating context.
      await playwright.selectors.register(mycss2, mycss);

      const page1 = await context1.newPage();
      await page1.setContent(`<div>hello</div>`);
      expect(await page1.innerHTML('css=div')).toBe('hello');
      expect(await page1.innerHTML(`${mycss1}=div`)).toBe('hello');
      expect(await page1.innerHTML(`${mycss2}=div`)).toBe('hello');

      const browser2 = await connect(remoteServer.wsEndpoint());

      // Register third engine after second connect.
      await playwright.selectors.register(mycss3, mycss);

      const page2 = await browser2.newPage();
      await page2.setContent(`<div>hello</div>`);
      expect(await page2.innerHTML('css=div')).toBe('hello');
      expect(await page2.innerHTML(`${mycss1}=div`)).toBe('hello');
      expect(await page2.innerHTML(`${mycss2}=div`)).toBe('hello');
      expect(await page2.innerHTML(`${mycss3}=div`)).toBe('hello');

      await browser1.close();
    });

    test('should not throw on close after disconnect', async ({ connect, startRemoteServer }) => {
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
      await browser.newPage();
      await Promise.all([
        new Promise(f => browser.on('disconnected', f)),
        remoteServer.close()
      ]);
      await browser.close();
    });

    test('should saveAs videos from remote browser', async ({ connect, startRemoteServer }, testInfo) => {
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
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
      expect(error.message).toContain('Path is not available when connecting remotely. Use saveAs() to save a local copy.');
    });

    test('should be able to connect 20 times to a single server without warnings', async ({ connect, startRemoteServer, platform }) => {
      test.skip(platform !== 'linux', 'Testing non-platform specific code');

      const remoteServer = await startRemoteServer(kind);

      let warning = null;
      const warningHandler = w => warning = w;
      process.on('warning', warningHandler);

      const browsers = [];
      for (let i = 0; i < 20; i++)
        browsers.push(await connect(remoteServer.wsEndpoint()));
      await Promise.all([browsers.map(browser => browser.close())]);

      process.off('warning', warningHandler);
      expect(warning).toBe(null);
    });

    test('should save download', async ({ server, connect, startRemoteServer }, testInfo) => {
      server.setRoute('/download', (req, res) => {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment');
        res.end(`Hello world`);
      });

      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
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
      const error = await download.path().catch(e => e);
      expect(error.message).toContain('Path is not available when connecting remotely. Use saveAs() to save a local copy.');
      await browser.close();
    });

    test('should error when saving download after deletion', async ({ server, connect, startRemoteServer }, testInfo) => {
      server.setRoute('/download', (req, res) => {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment');
        res.end(`Hello world`);
      });

      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
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
      await browser.close();
    });

    test('should properly disconnect when connection closes from the client side', async ({ connect, startRemoteServer, server }) => {
      server.setRoute('/one-style.css', () => {});
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
      const page = await browser.newPage();
      const navigationPromise = page.goto(server.PREFIX + '/one-style.html', { timeout: 60000 }).catch(e => e);
      const waitForNavigationPromise = page.waitForNavigation().catch(e => e);

      const disconnectedPromise = new Promise(f => browser.once('disconnected', f));
      // This closes the websocket.
      (browser as any)._connection.close();
      await disconnectedPromise;
      expect(browser.isConnected()).toBe(false);

      const navError = await navigationPromise;
      expect(navError.message).toContain(kTargetClosedErrorMessage);
      expect((await waitForNavigationPromise).message).toContain(kTargetClosedErrorMessage);
      expect((await page.goto(server.EMPTY_PAGE).catch(e => e)).message).toContain('has been closed');
      expect((await page.waitForNavigation().catch(e => e)).message).toContain(kTargetClosedErrorMessage);
    });

    test('should be able to connect when the wsEndpoint is passed as an option', async ({ browserType, startRemoteServer }) => {
      const remoteServer = await startRemoteServer(kind);
      const browser = await browserType.connect({
        wsEndpoint: remoteServer.wsEndpoint(),
        headers: {
          'x-playwright-launch-options': JSON.stringify((browserType as any)._defaultLaunchOptions || {}),
        },
      });
      const page = await browser.newPage();
      expect(await page.evaluate('1 + 2')).toBe(3);
      await browser.close();
    });

    test('should save har', async ({ connect, startRemoteServer, server }, testInfo) => {
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
      const harPath = testInfo.outputPath('test.har');
      const context = await browser.newContext({
        recordHar: {
          path: harPath,
        }
      });
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      await context.close();
      await browser.close();

      const log = JSON.parse(fs.readFileSync(harPath).toString())['log'];
      expect(log.entries.length).toBe(1);
      const entry = log.entries[0];
      expect(entry.pageref).toBe(log.pages[0].id);
      expect(entry.request.url).toBe(server.EMPTY_PAGE);
    });

    test('should filter launch options', async ({ connect, startRemoteServer, server, browserType }, testInfo) => {
      const tracesDir = testInfo.outputPath('traces');
      const oldTracesDir = (browserType as any)._defaultLaunchOptions.tracesDir;
      (browserType as any)._defaultLaunchOptions.tracesDir = tracesDir;
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
      const page = await browser.newPage();
      await page.goto(server.EMPTY_PAGE);
      await browser.close();
      (browserType as any)._defaultLaunchOptions.tracesDir = oldTracesDir;
      expect(fs.existsSync(tracesDir)).toBe(false);
    });

    test('should record trace with sources', async ({ connect, startRemoteServer, server, trace }, testInfo) => {
      test.skip(trace === 'on');
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
      const context = await browser.newContext();
      const page = await context.newPage();

      await context.tracing.start({ sources: true });
      await page.goto(server.EMPTY_PAGE);
      await page.setContent('<button>Click</button>');
      await page.click('"Click"');
      await context.tracing.stop({ path: testInfo.outputPath('trace1.zip') });

      await context.close();
      await browser.close();

      const { resources } = await parseTrace(testInfo.outputPath('trace1.zip'));
      const sourceNames = Array.from(resources.keys()).filter(k => k.endsWith('.txt'));
      expect(sourceNames.length).toBe(1);
      const sourceFile = resources.get(sourceNames[0]);
      const thisFile = await fs.promises.readFile(__filename);
      expect(sourceFile).toEqual(thisFile);
    });

    test('should fulfill with global fetch result', async ({ connect, startRemoteServer, playwright, server }) => {
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.route('**/*', async route => {
        const request = await playwright.request.newContext();
        const response = await request.get(server.PREFIX + '/simple.json');
        await route.fulfill({ response });
      });
      const response = await page.goto(server.EMPTY_PAGE);
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ 'foo': 'bar' });
    });

    test('should upload large file', async ({ connect, startRemoteServer, server, browserName, isMac, mode }, testInfo) => {
      test.skip(mode.startsWith('service'), 'Take it easy on service');
      test.skip(browserName === 'webkit' && isMac && parseInt(os.release(), 10) < 20, 'WebKit for macOS 10.15 is frozen and does not have corresponding protocol features.');
      test.slow();
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(server.PREFIX + '/input/fileupload.html');
      const uploadFile = testInfo.outputPath('200MB.zip');
      const str = 'A'.repeat(4 * 1024);
      const stream = fs.createWriteStream(uploadFile);
      for (let i = 0; i < 50 * 1024; i++) {
        await new Promise<void>((fulfill, reject) => {
          stream.write(str, err => {
            if (err)
              reject(err);
            else
              fulfill();
          });
        });
      }
      await new Promise(f => stream.end(f));
      const input = page.locator('input[type="file"]');
      const events = await input.evaluateHandle(e => {
        const events = [];
        e.addEventListener('input', () => events.push('input'));
        e.addEventListener('change', () => events.push('change'));
        return events;
      });
      await input.setInputFiles(uploadFile);
      expect(await input.evaluate(e => (e as HTMLInputElement).files[0].name)).toBe('200MB.zip');
      expect(await events.evaluate(e => e)).toEqual(['input', 'change']);
      const serverFilePromise = new Promise<formidable.File>(fulfill => {
        server.setRoute('/upload', async (req, res) => {
          const form = new formidable.IncomingForm({ uploadDir: testInfo.outputPath() });
          form.parse(req, function(err, fields, f) {
            res.end();
            const files = f as Record<string, formidable.File>;
            fulfill(files.file1);
          });
        });
      });
      const [file1] = await Promise.all([
        serverFilePromise,
        page.click('input[type=submit]')
      ]);
      expect(file1.originalFilename).toBe('200MB.zip');
      expect(file1.size).toBe(200 * 1024 * 1024);
      await Promise.all([uploadFile, file1.filepath].map(fs.promises.unlink));
    });

    test('setInputFiles should preserve lastModified timestamp', async ({ connect, startRemoteServer, asset }) => {
      test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/27452' });
      const remoteServer = await startRemoteServer(kind);
      const browser = await connect(remoteServer.wsEndpoint());
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.setContent(`<input type=file multiple=true/>`);
      const input = page.locator('input');
      const files = ['file-to-upload.txt', 'file-to-upload-2.txt'];
      await input.setInputFiles(files.map(f => asset(f)));
      expect(await input.evaluate(e => [...(e as HTMLInputElement).files].map(f => f.name))).toEqual(files);
      const timestamps = await input.evaluate(e => [...(e as HTMLInputElement).files].map(f => f.lastModified));
      const expectedTimestamps = files.map(file => Math.round(fs.statSync(asset(file)).mtimeMs));
      // On Linux browser sometimes reduces the timestamp by 1ms: 1696272058110.0715  -> 1696272058109 or even
      // rounds it to seconds in WebKit: 1696272058110 -> 1696272058000.
      for (let i = 0; i < timestamps.length; i++)
        expect(Math.abs(timestamps[i] - expectedTimestamps[i]), `expected: ${expectedTimestamps}; actual: ${timestamps}`).toBeLessThan(1000);
    });

    test('should connect over http', async ({ connect, startRemoteServer, mode }) => {
      test.skip(mode !== 'default');
      const remoteServer = await startRemoteServer(kind);

      const url = new URL(remoteServer.wsEndpoint());
      const browser = await connect(`http://localhost:${url.port}`);
      expect(browser.version()).toBeTruthy();
      await browser.close();
    });

    test.describe('socks proxy', () => {
      test.fixme(({ platform, browserName }) => browserName === 'webkit' && platform === 'win32');
      test.skip(({ mode }) => mode !== 'default');
      test.skip(kind === 'launchServer', 'not supported yet');

      test('should forward non-forwarded requests', async ({ server, startRemoteServer, connect }) => {
        let reachedOriginalTarget = false;
        server.setRoute('/foo.html', async (req, res) => {
          reachedOriginalTarget = true;
          res.end('<html><body>original-target</body></html>');
        });
        const remoteServer = await startRemoteServer(kind);
        const browser = await connect(remoteServer.wsEndpoint(), { exposeNetwork: '*' });
        const page = await browser.newPage();
        await page.goto(server.PREFIX + '/foo.html');
        expect(await page.content()).toContain('original-target');
        expect(reachedOriginalTarget).toBe(true);
      });

      test('should proxy localhost requests @smoke', async ({ startRemoteServer, server, browserName, connect, platform, dummyServerPort }, testInfo) => {
        test.skip(browserName === 'webkit' && platform === 'darwin', 'no localhost proxying');

        let reachedOriginalTarget = false;
        server.setRoute('/foo.html', async (req, res) => {
          reachedOriginalTarget = true;
          res.end('<html><body></body></html>');
        });
        const examplePort = 20_000 + testInfo.workerIndex * 3;
        const remoteServer = await startRemoteServer(kind);
        const browser = await connect(remoteServer.wsEndpoint(), { _exposeNetwork: '*' } as any, dummyServerPort);
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${examplePort}/foo.html`);
        expect(await page.content()).toContain('from-dummy-server');
        expect(reachedOriginalTarget).toBe(false);
      });

      test('should proxy ipv6 localhost requests @smoke', async ({ startRemoteServer, server, browserName, connect, platform, ipV6ServerPort }, testInfo) => {
        test.skip(browserName === 'webkit' && platform === 'darwin', 'no localhost proxying');

        let reachedOriginalTarget = false;
        server.setRoute('/foo.html', async (req, res) => {
          reachedOriginalTarget = true;
          res.end('<html><body></body></html>');
        });
        const examplePort = 20_000 + testInfo.workerIndex * 3;
        const remoteServer = await startRemoteServer(kind);
        const browser = await connect(remoteServer.wsEndpoint(), { exposeNetwork: '*' }, ipV6ServerPort);
        const page = await browser.newPage();
        await page.goto(`http://[::1]:${examplePort}/foo.html`);
        expect(await page.content()).toContain('from-ipv6-server');
        const page2 = await browser.newPage();
        await page2.goto(`http://localhost:${examplePort}/foo.html`);
        expect(await page2.content()).toContain('from-ipv6-server');
        expect(reachedOriginalTarget).toBe(false);
      });

      test('should proxy localhost requests from fetch api', async ({ startRemoteServer, server, browserName, connect, channel, platform, dummyServerPort }, workerInfo) => {
        test.skip(browserName === 'webkit' && platform === 'darwin', 'no localhost proxying');

        let reachedOriginalTarget = false;
        server.setRoute('/foo.html', async (req, res) => {
          reachedOriginalTarget = true;
          res.end('<html><body></body></html>');
        });
        const examplePort = 20_000 + workerInfo.workerIndex * 3;
        const remoteServer = await startRemoteServer(kind);
        const browser = await connect(remoteServer.wsEndpoint(), { exposeNetwork: '*' }, dummyServerPort);
        const page = await browser.newPage();
        const response = await page.request.get(`http://127.0.0.1:${examplePort}/foo.html`);
        expect(response.status()).toBe(200);
        expect(await response.text()).toContain('from-dummy-server');
        expect(reachedOriginalTarget).toBe(false);
      });

      test('should proxy local.playwright requests', async ({ connect, server, dummyServerPort, startRemoteServer }, workerInfo) => {
        let reachedOriginalTarget = false;
        server.setRoute('/foo.html', async (req, res) => {
          reachedOriginalTarget = true;
          res.end('<html><body></body></html>');
        });
        const examplePort = 20_000 + workerInfo.workerIndex * 3;
        const remoteServer = await startRemoteServer(kind);
        const browser = await connect(remoteServer.wsEndpoint(), { exposeNetwork: '*' }, dummyServerPort);
        const page = await browser.newPage();
        await page.goto(`http://local.playwright:${examplePort}/foo.html`);
        expect(await page.content()).toContain('from-dummy-server');
        expect(reachedOriginalTarget).toBe(false);
      });

      test('should lead to the error page for forwarded requests when the connection is refused', async ({ connect, startRemoteServer, browserName }, workerInfo) => {
        const examplePort = 20_000 + workerInfo.workerIndex * 3;
        const remoteServer = await startRemoteServer(kind);
        const browser = await connect(remoteServer.wsEndpoint(), { exposeNetwork: '*' });
        const page = await browser.newPage();
        const error = await page.goto(`http://127.0.0.1:${examplePort}`).catch(e => e);
        if (browserName === 'chromium')
          expect(error.message).toContain('net::ERR_SOCKS_CONNECTION_FAILED at http://127.0.0.1:20');
        else if (browserName === 'webkit')
          expect(error.message).toBeTruthy();
        else if (browserName === 'firefox')
          expect(error.message.includes('NS_ERROR_NET_RESET') || error.message.includes('NS_ERROR_CONNECTION_REFUSED')).toBe(true);
      });

      test('should proxy based on the pattern', async ({ connect, startRemoteServer, server, browserName, platform, dummyServerPort }, workerInfo) => {
        test.skip(browserName === 'webkit' && platform === 'darwin', 'no localhost proxying');

        let reachedOriginalTarget = false;
        server.setRoute('/foo.html', async (req, res) => {
          reachedOriginalTarget = true;
          res.end('<html><body>from-original-server</body></html>');
        });
        const examplePort = 20_000 + workerInfo.workerIndex * 3;
        const remoteServer = await startRemoteServer(kind);
        const browser = await connect(remoteServer.wsEndpoint(), { exposeNetwork: 'localhost' }, dummyServerPort);
        const page = await browser.newPage();

        // localhost should be proxied.
        await page.goto(`http://localhost:${examplePort}/foo.html`);
        expect(await page.content()).toContain('from-dummy-server');
        expect(reachedOriginalTarget).toBe(false);

        // 127.0.0.1 should be served directly.
        await page.goto(`http://127.0.0.1:${server.PORT}/foo.html`);
        expect(await page.content()).toContain('from-original-server');
        expect(reachedOriginalTarget).toBe(true);

        // Random domain should be served directly and fail.
        let failed = false;
        await page.goto(`http://does-not-exist-bad-domain.oh-no-should-not-work`).catch(e => {
          failed = true;
        });
        expect(failed).toBe(true);
      });

      test('should check proxy pattern on the client', async ({ connect, startRemoteServer, server, browserName, platform, dummyServerPort }, workerInfo) => {
        let reachedOriginalTarget = false;
        server.setRoute('/foo.html', async (req, res) => {
          reachedOriginalTarget = true;
          res.end('<html><body>from-original-server</body></html>');
        });
        const remoteServer = await startRemoteServer(kind);
        const browser = await connect(remoteServer.wsEndpoint(), {
          exposeNetwork: '127.0.0.1',
          headers: {
            'x-playwright-proxy': '*',
          },
        }, dummyServerPort);
        const page = await browser.newPage();

        // local.playwright should fail on the client side.
        let failed = false;
        await page.goto(`http://local.playwright:${server.PORT}/foo.html`).catch(e => {
          failed = true;
        });
        expect(failed).toBe(true);
        expect(reachedOriginalTarget).toBe(false);
      });
    });
  });
}

test.describe('launchServer only', () => {
  test('should work with cluster', async ({ connect, startRemoteServer }) => {
    const remoteServer = await startRemoteServer('launchServer', { inCluster: true });
    const browser = await connect(remoteServer.wsEndpoint());
    const page = await browser.newPage();
    expect(await page.evaluate('1 + 2')).toBe(3);
  });

  test('should properly disconnect when connection closes from the server side', async ({ connect, startRemoteServer, server, platform }) => {
    test.skip(platform === 'win32', 'Cannot send signals');

    server.setRoute('/one-style.css', () => {});
    const remoteServer = await startRemoteServer('launchServer', { disconnectOnSIGHUP: true });
    const browser = await connect(remoteServer.wsEndpoint());
    const page = await browser.newPage();
    const navigationPromise = page.goto(server.PREFIX + '/one-style.html', { timeout: 60000 }).catch(e => e);
    const waitForNavigationPromise = page.waitForNavigation().catch(e => e);

    const disconnectedPromise = new Promise(f => browser.once('disconnected', f));
    // This closes the websocket server.
    process.kill(remoteServer.child().pid, 'SIGHUP');
    await disconnectedPromise;
    expect(browser.isConnected()).toBe(false);

    expect((await navigationPromise).message).toContain('has been closed');
    expect((await waitForNavigationPromise).message).toContain(kTargetClosedErrorMessage);
    expect((await page.goto(server.EMPTY_PAGE).catch(e => e)).message).toContain('has been closed');
    expect((await page.waitForNavigation().catch(e => e)).message).toContain(kTargetClosedErrorMessage);
  });

  test('should be able to reconnect to a browser 12 times without warnings', async ({ connect, startRemoteServer, server }) => {
    test.slow();
    const remoteServer = await startRemoteServer('launchServer', { exitOnWarning: true });
    for (let i = 0; i < 12; i++) {
      await test.step('connect #' + i, async () => {
        const browser = await connect(remoteServer.wsEndpoint());
        const browserContext = await browser.newContext();
        expect(browserContext.pages().length).toBe(0);
        const page = await browserContext.newPage();
        expect(await page.evaluate('11 * 11')).toBe(121);
        await page.goto(server.EMPTY_PAGE);
        await browser.close();
      });
    }
  });
});

test('should refuse connecting when versions do not match', async ({ connect, childProcess }) => {
  const server = new RunServer();
  await server.start(childProcess, 'default', { PW_VERSION_OVERRIDE: '1.2.3' });
  const error = await connect(server.wsEndpoint()).catch(e => e);
  await server.close();
  expect(error.message).toContain('Playwright version mismatch');
  expect(error.message).toContain('server version: v1.2');
  expect(error.message).toContain('client version: v' + getPlaywrightVersion(true));
});
