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

import { serverFixtures } from './remoteServer.fixture';
import * as fs from 'fs';
const { it, expect, describe } = serverFixtures;

describe('connect', (suite, { wire }) => {
  suite.skip(wire);
  suite.slow();
}, () => {
  it('should be able to reconnect to a browser', async ({browserType, remoteServer, server}) => {
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

  it('should be able to connect two browsers at the same time', async ({browserType, remoteServer}) => {
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

  it('disconnected event should be emitted when browser is closed or server is closed', async ({browserType, remoteServer}) => {
    const browser1 = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
    const browser2 = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });

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

  it('should handle exceptions during connect', async ({browserType, remoteServer}) => {
    const __testHookBeforeCreateBrowser = () => { throw new Error('Dummy'); };
    const error = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint(), __testHookBeforeCreateBrowser } as any).catch(e => e);
    expect(error.message).toContain('Dummy');
  });

  it('should set the browser connected state', async ({browserType, remoteServer}) => {
    const remote = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
    expect(remote.isConnected()).toBe(true);
    await remote.close();
    expect(remote.isConnected()).toBe(false);
  });

  it('should throw when used after isConnected returns false', async ({browserType, remoteServer}) => {
    const remote = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
    const page = await remote.newPage();
    await Promise.all([
      remoteServer.close(),
      new Promise(f => remote.once('disconnected', f)),
    ]);
    expect(remote.isConnected()).toBe(false);
    const error = await page.evaluate('1 + 1').catch(e => e) as Error;
    expect(error.message).toContain('has been closed');
  });

  it('should reject navigation when browser closes', async ({browserType, remoteServer, server}) => {
    server.setRoute('/one-style.css', () => {});
    const remote = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
    const page = await remote.newPage();
    const navigationPromise = page.goto(server.PREFIX + '/one-style.html', {timeout: 60000}).catch(e => e);
    await server.waitForRequest('/one-style.css');
    await remote.close();
    const error = await navigationPromise;
    expect(error.message).toContain('Navigation failed because page was closed!');
  });

  it('should reject waitForSelector when browser closes', async ({browserType, remoteServer, server}) => {
    server.setRoute('/empty.html', () => {});
    const remote = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
    const page = await remote.newPage();
    const watchdog = page.waitForSelector('div', { state: 'attached', timeout: 60000 }).catch(e => e);

    // Make sure the previous waitForSelector has time to make it to the browser before we disconnect.
    await page.waitForSelector('body', { state: 'attached' });

    await remote.close();
    const error = await watchdog;
    expect(error.message).toContain('Protocol error');
  });

  it('should emit close events on pages and contexts', async ({browserType, remoteServer}) => {
    const remote = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
    const context = await remote.newContext();
    const page = await context.newPage();
    let pageClosed = false;
    page.on('close', () => pageClosed = true);
    await Promise.all([
      new Promise(f => context.on('close', f)),
      remoteServer.close()
    ]);
    expect(pageClosed).toBeTruthy();
  });

  it('should terminate network waiters', async ({browserType, remoteServer, server}) => {
    const remote = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
    const newPage = await remote.newPage();
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

  it('should respect selectors', async ({ playwright, browserType, remoteServer }) => {
    const mycss = () => ({
      create(root, target) {},
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

  it('should not throw on close after disconnect', async ({browserType, remoteServer, server}) => {
    const remote = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
    await remote.newPage();
    await Promise.all([
      new Promise(f => remote.on('disconnected', f)),
      remoteServer.close()
    ]);
    await remote.close();
  });

  it('should not throw on context.close after disconnect', async ({browserType, remoteServer, server}) => {
    const remote = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
    const context = await remote.newContext();
    await context.newPage();
    await Promise.all([
      new Promise(f => remote.on('disconnected', f)),
      remoteServer.close()
    ]);
    await context.close();
  });

  it('should not throw on page.close after disconnect', async ({browserType, remoteServer, server}) => {
    const remote = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
    const page = await remote.newPage();
    await Promise.all([
      new Promise(f => remote.on('disconnected', f)),
      remoteServer.close()
    ]);
    await page.close();
  });

  it('should save videos from remote browser', (test, {browserName, platform}) => {
    test.flaky(browserName === 'firefox' && platform === 'win32');
  }, async ({browserType, remoteServer, testInfo}) => {
    const remote = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
    const videosPath = testInfo.outputPath();
    const context = await remote.newContext({
      videosPath,
      videoSize: { width: 320, height: 240 },
    });
    const page = await context.newPage();
    await page.evaluate(() => document.body.style.backgroundColor = 'red');
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const files = fs.readdirSync(videosPath);
    expect(files.some(file => file.endsWith('webm'))).toBe(true);
  });
});
