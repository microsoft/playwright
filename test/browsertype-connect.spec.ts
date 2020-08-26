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

import { options } from './playwright.fixtures';
import utils from './utils';
import './remoteServer.fixture';

it.skip(options.WIRE).slow()('should be able to reconnect to a browser', async({browserType, remoteServer, server}) => {
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

it.skip(options.WIRE).slow()('should be able to connect two browsers at the same time', async ({browserType, remoteServer}) => {
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

it.skip(options.WIRE).slow()('disconnected event should be emitted when browser is closed or server is closed', async ({browserType, remoteServer}) => {
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

it.skip(options.WIRE).fail(options.CHROMIUM && WIN).slow()('should handle exceptions during connect', async({browserType, remoteServer}) => {
  const __testHookBeforeCreateBrowser = () => { throw new Error('Dummy') };
  const error = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint(), __testHookBeforeCreateBrowser } as any).catch(e => e);
  expect(error.message).toContain('Dummy');
});

it.skip(options.WIRE).slow()('should set the browser connected state', async ({browserType, remoteServer}) => {
  const remote = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  expect(remote.isConnected()).toBe(true);
  await remote.close();
  expect(remote.isConnected()).toBe(false);
});

it.skip(options.WIRE).slow()('should throw when used after isConnected returns false', async({browserType, remoteServer}) => {
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

it.skip(options.WIRE).slow()('should reject navigation when browser closes', async({browserType, remoteServer, server}) => {
  server.setRoute('/one-style.css', () => {});
  const remote = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const page = await remote.newPage();
  const navigationPromise = page.goto(server.PREFIX + '/one-style.html', {timeout: 60000}).catch(e => e);
  await server.waitForRequest('/one-style.css');
  await remote.close();
  const error = await navigationPromise;
  expect(error.message).toContain('Navigation failed because page was closed!');
});

it.skip(options.WIRE).slow()('should reject waitForSelector when browser closes', async({browserType, remoteServer, server}) => {
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

it.skip(options.WIRE).slow()('should emit close events on pages and contexts', async({browserType, remoteServer}) => {
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

it.skip(options.WIRE).slow()('should terminate network waiters', async({browserType, remoteServer, server}) => {
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

it.skip(options.WIRE).fail(true).slow()('should respect selectors', async({ playwright, browserType, remoteServer }) => {
  const mycss = () => ({
    create(root, target) {},
    query(root, selector) {
      return root.querySelector(selector);
    },
    queryAll(root: HTMLElement, selector: string) {
      return Array.from(root.querySelectorAll(selector));
    }
  });
  await utils.registerEngine(playwright, 'mycss', mycss);

  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const page = await browser.newPage();
  await page.setContent(`<div>hello</div>`);
  expect(await page.innerHTML('css=div')).toBe('hello');
  expect(await page.innerHTML('mycss=div')).toBe('hello');
  await browser.close();
});
