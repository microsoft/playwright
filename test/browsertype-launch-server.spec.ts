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

it.skip(options.WIRE)('should work', async({browserType, defaultBrowserOptions}) => {
  const browserServer = await browserType.launchServer(defaultBrowserOptions);
  const browser = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
  const browserContext = await browser.newContext();
  expect(browserContext.pages().length).toBe(0);
  expect(browserServer.wsEndpoint()).not.toBe(null);
  const page = await browserContext.newPage();
  expect(await page.evaluate('11 * 11')).toBe(121);
  await page.close();
  await browser.close();
  await browserServer.close();
});

it.skip(options.WIRE)('should fire "disconnected" when closing the server', async({browserType, defaultBrowserOptions}) => {
  const browserServer = await browserType.launchServer(defaultBrowserOptions);
  const browser = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
  const disconnectedEventPromise = new Promise(resolve => browser.once('disconnected', resolve));
  const closedPromise = new Promise(f => browserServer.on('close', f));
  browserServer.kill();
  await Promise.all([
    disconnectedEventPromise,
    closedPromise,
  ]);
});

it.skip(options.WIRE)('should fire "close" event during kill', async({browserType, defaultBrowserOptions}) => {
  const order = [];
  const browserServer = await browserType.launchServer(defaultBrowserOptions);
  const closedPromise = new Promise(f => browserServer.on('close', () => {
    order.push('closed');
    f();
  }));
  await Promise.all([
    browserServer.kill().then(() => order.push('killed')),
    closedPromise,
  ]);
  expect(order).toEqual(['closed', 'killed']);
});

it.skip(options.WIRE)('should return child_process instance', async ({browserType, defaultBrowserOptions}) => {
  const browserServer = await browserType.launchServer(defaultBrowserOptions);
  expect(browserServer.process().pid).toBeGreaterThan(0);
  await browserServer.close();
});

it.skip(options.WIRE)('should fire close event', async ({browserType, defaultBrowserOptions}) => {
  const browserServer = await browserType.launchServer(defaultBrowserOptions);
  const [result] = await Promise.all([
    new Promise(f => (browserServer as any).on('close', (exitCode, signal) => f({ exitCode, signal }))),
    browserServer.close(),
  ]);
  expect(result['exitCode']).toBe(0);
  expect(result['signal']).toBe(null);
});

it.skip(options.WIRE)('should reject navigation when browser closes', async({browserType, defaultBrowserOptions, server}) => {
  server.setRoute('/one-style.css', () => {});
  const browserServer = await browserType.launchServer(defaultBrowserOptions);
  const remote = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
  const page = await remote.newPage();
  const navigationPromise = page.goto(server.PREFIX + '/one-style.html', {timeout: 60000}).catch(e => e);
  await server.waitForRequest('/one-style.css');
  await remote.close();
  const error = await navigationPromise;
  expect(error.message).toContain('Navigation failed because page was closed!');
  await browserServer.close();
});

it.skip(options.WIRE)('should reject waitForSelector when browser closes', async({browserType, defaultBrowserOptions, server}) => {
  server.setRoute('/empty.html', () => {});
  const browserServer = await browserType.launchServer(defaultBrowserOptions);
  const remote = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
  const page = await remote.newPage();
  const watchdog = page.waitForSelector('div', { state: 'attached', timeout: 60000 }).catch(e => e);

  // Make sure the previous waitForSelector has time to make it to the browser before we disconnect.
  await page.waitForSelector('body', { state: 'attached' });

  await remote.close();
  const error = await watchdog;
  expect(error.message).toContain('Protocol error');
  await browserServer.close();
});

it.skip(options.WIRE)('should throw if used after disconnect', async({browserType, defaultBrowserOptions}) => {
  const browserServer = await browserType.launchServer(defaultBrowserOptions);
  const remote = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
  const page = await remote.newPage();
  await remote.close();
  const error = await page.evaluate('1 + 1').catch(e => e);
  expect((error as Error).message).toContain('has been closed');
  await browserServer.close();
});

it.skip(options.WIRE)('should emit close events on pages and contexts', async({browserType, defaultBrowserOptions}) => {
  const browserServer = await browserType.launchServer(defaultBrowserOptions);
  const remote = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
  const context = await remote.newContext();
  const page = await context.newPage();
  let pageClosed = false;
  page.on('close', () => pageClosed = true);
  await Promise.all([
    new Promise(f => context.on('close', f)),
    browserServer.close()
  ]);
  expect(pageClosed).toBeTruthy();
});

it.skip(options.WIRE)('should terminate network waiters', async({browserType, defaultBrowserOptions, server}) => {
  const browserServer = await browserType.launchServer(defaultBrowserOptions);
  const remote = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
  const newPage = await remote.newPage();
  const results = await Promise.all([
    newPage.waitForRequest(server.EMPTY_PAGE).catch(e => e),
    newPage.waitForResponse(server.EMPTY_PAGE).catch(e => e),
    browserServer.close()
  ]);
  for (let i = 0; i < 2; i++) {
    const message = results[i].message;
    expect(message).toContain('Page closed');
    expect(message).not.toContain('Timeout');
  }
});
