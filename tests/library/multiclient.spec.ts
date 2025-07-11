/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import { kTargetClosedErrorMessage } from '../config/errors';
import { expect, playwrightTest } from '../config/browserTest';
import type { Browser, BrowserServer, ConnectOptions, Page } from 'playwright-core';

type ExtraFixtures = {
  remoteServer: BrowserServer;
  connect: (wsEndpoint: string, options?: ConnectOptions) => Promise<Browser>,
  twoPages: { pageA: Page, pageB: Page },
};
const test = playwrightTest.extend<ExtraFixtures>({
  remoteServer: async ({ browserType }, use) => {
    const server = await browserType.launchServer({ _sharedBrowser: true } as any);
    await use(server);
    await server.close();
  },
  connect: async ({ browserType }, use) => {
    const browsers: Browser[] = [];
    await use(async (wsEndpoint, options = {}) => {
      const browser = await browserType.connect(wsEndpoint, options);
      browsers.push(browser);
      return browser;
    });
    await Promise.all(browsers.map(b => b.close()));
  },
  twoPages: async ({ remoteServer, connect }, use) => {
    const browserA = await connect(remoteServer.wsEndpoint());
    const contextA = await browserA.newContext();
    const pageA = await contextA.newPage();

    const browserB = await connect(remoteServer.wsEndpoint());
    const contextB = browserB.contexts()[0];
    const pageB = contextB.pages()[0];

    await use({ pageA, pageB });
  },
});

test.slow(true, 'All connect tests are slow');
test.skip(({ mode }) => mode !== 'default');

async function disconnect(page: Page) {
  await page.context().browser().close();
  // Give disconnect some time to cleanup.
  await new Promise(f => setTimeout(f, 1000));
}

test('should connect two clients', async ({ connect, remoteServer, server }) => {
  const browserA = await connect(remoteServer.wsEndpoint());
  expect(browserA.contexts().length).toBe(0);
  const contextA1 = await browserA.newContext();
  const pageA1 = await contextA1.newPage();
  await pageA1.goto(server.EMPTY_PAGE);

  const browserB = await connect(remoteServer.wsEndpoint());
  expect(browserB.contexts().length).toBe(1);
  const contextB1 = browserB.contexts()[0];
  expect(contextB1.pages().length).toBe(1);
  const pageB1 = contextB1.pages()[0];
  await expect(pageB1).toHaveURL(server.EMPTY_PAGE);

  const contextB2 = await browserB.newContext({ baseURL: server.PREFIX });
  expect(browserB.contexts()).toEqual([contextB1, contextB2]);
  await expect.poll(() => browserA.contexts().length).toBe(2);
  const contextA2 = browserA.contexts()[1];
  expect(browserA.contexts()).toEqual([contextA1, contextA2]);

  const pageEventPromise = new Promise<Page>(f => contextB2.on('page', f));
  const pageA2 = await contextA2.newPage();
  const pageB2 = await pageEventPromise;
  await pageA2.goto('/frames/frame.html');
  await expect(pageB2).toHaveURL('/frames/frame.html');

  // Both contexts and pages should be still operational after any client disconnects.
  await disconnect(pageA1);

  await expect(pageB1).toHaveURL(server.EMPTY_PAGE);
  await expect(pageB2).toHaveURL(server.PREFIX + '/frames/frame.html');
});

test('should have separate default timeouts', async ({ twoPages }) => {
  const { pageA, pageB } = twoPages;
  pageA.setDefaultTimeout(500);
  pageB.setDefaultTimeout(600);

  const [errorA, errorB] = await Promise.all([
    pageA.click('div').catch(e => e),
    pageB.click('div').catch(e => e),
  ]);
  expect(errorA.message).toContain('Timeout 500ms exceeded');
  expect(errorB.message).toContain('Timeout 600ms exceeded');
});

test('should receive viewport size changes', async ({ twoPages }) => {
  const { pageA, pageB } = twoPages;

  await pageA.setViewportSize({ width: 567, height: 456 });
  expect(pageA.viewportSize()).toEqual({ width: 567, height: 456 });
  await expect.poll(() => pageB.viewportSize()).toEqual({ width: 567, height: 456 });

  await pageB.setViewportSize({ width: 456, height: 567 });
  expect(pageB.viewportSize()).toEqual({ width: 456, height: 567 });
  await expect.poll(() => pageA.viewportSize()).toEqual({ width: 456, height: 567 });
});

test('should not allow parallel js coverage and cleanup upon disconnect', async ({ twoPages, browserName }) => {
  test.skip(browserName !== 'chromium');

  const { pageA, pageB } = twoPages;
  await pageA.coverage.startJSCoverage();
  const error = await pageB.coverage.startJSCoverage().catch(e => e);
  expect(error.message).toContain('JSCoverage is already enabled');

  // Should cleanup coverage on disconnect and allow another client to start it.
  await disconnect(pageA);
  await pageB.coverage.startJSCoverage();
});

test('should not allow parallel css coverage', async ({ twoPages, browserName }) => {
  test.skip(browserName !== 'chromium');

  const { pageA, pageB } = twoPages;
  await pageA.coverage.startCSSCoverage();
  const error = await pageB.coverage.startCSSCoverage().catch(e => e);
  expect(error.message).toContain('CSSCoverage is already enabled');

  // Should cleanup coverage on disconnect and allow another client to start it.
  await disconnect(pageA);
  await pageB.coverage.startCSSCoverage();
});

test('should unpause clock', async ({ twoPages }) => {
  const { pageA, pageB } = twoPages;
  await pageA.clock.install({ time: 1000 });
  await pageA.clock.pauseAt(2000);
  const promise = pageB.evaluate(() => new Promise(f => setTimeout(f, 1000)));
  await disconnect(pageA);
  await promise;
});

test('last emulateMedia wins', async ({ twoPages }) => {
  const { pageA, pageB } = twoPages;
  await pageA.emulateMedia({ media: 'print' });
  expect(await pageB.evaluate(() => window.matchMedia('screen').matches)).toBe(false);
  expect(await pageA.evaluate(() => window.matchMedia('print').matches)).toBe(true);
  await pageB.emulateMedia({ media: 'screen' });
  expect(await pageB.evaluate(() => window.matchMedia('screen').matches)).toBe(true);
  expect(await pageA.evaluate(() => window.matchMedia('print').matches)).toBe(false);
});

test('should chain routes', async ({ twoPages, server }) => {
  const { pageA, pageB } = twoPages;

  server.setRoute('/foo', (req, res) => res.writeHead(200, { 'Content-Type': 'text/html' }).end('<div>server-foo</div>'));
  server.setRoute('/bar', (req, res) => res.writeHead(200, { 'Content-Type': 'text/html' }).end('<div>server-bar</div>'));
  server.setRoute('/qux', (req, res) => res.writeHead(200, { 'Content-Type': 'text/html' }).end('<div>server-qux</div>'));

  let stall = false;
  let stallCallback;
  const stallPromise = new Promise(f => stallCallback = f);
  await pageA.route('**/foo', async route => {
    if (stall)
      stallCallback();
    else
      await route.fallback();
  });
  await pageA.route('**/bar', async route => {
    await route.fulfill({ body: '<div>intercepted-bar</div>', contentType: 'text/html' });
  });

  await pageB.route('**/foo', async route => {
    await route.fulfill({ body: '<div>intercepted2-foo</div>', contentType: 'text/html' });
  });
  await pageB.route('**/bar', async route => {
    await route.fulfill({ body: '<div>intercepted2-bar</div>', contentType: 'text/html' });
  });
  await pageB.route('**/qux', async route => {
    await route.fulfill({ body: '<div>intercepted2-qux</div>', contentType: 'text/html' });
  });

  await pageA.goto(server.PREFIX + '/foo');
  await expect(pageB.locator('div')).toHaveText('intercepted2-foo');

  await pageA.goto(server.PREFIX + '/bar');
  await expect(pageB.locator('div')).toHaveText('intercepted-bar');

  await pageA.goto(server.PREFIX + '/qux');
  await expect(pageB.locator('div')).toHaveText('intercepted2-qux');

  stall = true;
  const gotoPromise = pageB.goto(server.PREFIX + '/foo');
  await stallPromise;
  await pageA.context().browser().close();

  await gotoPromise;
  await expect(pageB.locator('div')).toHaveText('intercepted2-foo');

  await pageB.goto(server.PREFIX + '/bar');
  await expect(pageB.locator('div')).toHaveText('intercepted2-bar');
});

test.fixme('should chain routes with changed url', async ({ twoPages, server }) => {
  const { pageA, pageB } = twoPages;

  server.setRoute('/foo', (req, res) => res.writeHead(200, { 'Content-Type': 'text/html' }).end('<div>server-foo</div>'));
  server.setRoute('/baz', (req, res) => res.writeHead(200, { 'Content-Type': 'text/html' }).end('<div>server-baz</div>'));

  await pageA.route('**/foo', async route => {
    await route.fallback({ url: server.PREFIX + '/baz' });
  });
  await pageB.route('**/baz', async route => {
    await route.fulfill({ body: '<div>intercepted2-baz</div>', contentType: 'text/html' });
  });

  await pageA.goto(server.PREFIX + '/foo');
  await expect(pageB.locator('div')).toHaveText('intercepted2-baz');
});

test('should remove exposed bindings upon disconnect', async ({ twoPages }) => {
  const { pageA, pageB } = twoPages;

  await pageA.exposeBinding('pageBindingA', () => 'pageBindingAResult');
  await pageA.evaluate(() => {
    (window as any).pageBindingACopy = (window as any).pageBindingA;
  });
  expect(await pageB.evaluate(() => (window as any).pageBindingA())).toBe('pageBindingAResult');
  expect(await pageB.evaluate(() => !!(window as any).pageBindingACopy)).toBe(true);

  await pageA.context().exposeBinding('contextBindingA', () => 'contextBindingAResult');
  expect(await pageB.evaluate(() => (window as any).contextBindingA())).toBe('contextBindingAResult');

  await pageB.exposeBinding('pageBindingB', () => 'pageBindingBResult');
  expect(await pageA.evaluate(() => (window as any).pageBindingB())).toBe('pageBindingBResult');
  await pageB.context().exposeBinding('contextBindingB', () => 'contextBindingBResult');
  expect(await pageA.evaluate(() => (window as any).contextBindingB())).toBe('contextBindingBResult');

  await disconnect(pageA);

  expect(await pageB.evaluate(() => (window as any).pageBindingA)).toBe(undefined);
  expect(await pageB.evaluate(() => (window as any).contextBindingA)).toBe(undefined);
  const error = await pageB.evaluate(() => (window as any).pageBindingACopy()).catch(e => e);
  expect(error.message).toContain('binding "pageBindingA" has been removed');

  expect(await pageB.evaluate(() => (window as any).pageBindingB())).toBe('pageBindingBResult');
});

test('should unroute websockets', async ({ twoPages, server }) => {
  const { pageA, pageB } = twoPages;

  await pageA.goto(server.EMPTY_PAGE);
  await pageA.routeWebSocket(/.*/, () => {});
  await pageA.routeWebSocket(/.*/, () => {});
  await pageA.routeWebSocket(/.*/, () => {});

  const error = await pageB.routeWebSocket(/.*/, () => {}).catch(e => e);
  expect(error.message).toContain('Another client is already routing WebSockets');

  await disconnect(pageA);

  let resolve;
  const promise = new Promise(f => resolve = f);
  await pageB.routeWebSocket(/.*/, resolve);
  await pageB.goto(server.EMPTY_PAGE);
  await pageB.evaluate(host => (window as any).ws = new WebSocket('ws://' + host + '/ws'), server.HOST);
  await promise;
});

test('should remove init scripts upon disconnect', async ({ twoPages, server }) => {
  const { pageA, pageB } = twoPages;

  await pageA.addInitScript(() => (window as any).pageValueA = 'pageValueA');
  await pageA.context().addInitScript(() => (window as any).contextValueA = 'contextValueA');
  await pageB.goto(server.EMPTY_PAGE);
  expect(await pageB.evaluate(() => (window as any).pageValueA)).toBe('pageValueA');
  expect(await pageB.evaluate(() => (window as any).contextValueA)).toBe('contextValueA');

  await pageB.addInitScript(() => (window as any).pageValueB = 'pageValueB');
  await pageB.context().addInitScript(() => (window as any).contextValueB = 'contextValueB');
  await pageA.goto(server.EMPTY_PAGE);
  expect(await pageA.evaluate(() => (window as any).pageValueB)).toBe('pageValueB');
  expect(await pageA.evaluate(() => (window as any).contextValueB)).toBe('contextValueB');

  await disconnect(pageB);

  await pageA.goto(server.EMPTY_PAGE);
  expect(await pageA.evaluate(() => (window as any).pageValueB)).toBe(undefined);
  expect(await pageA.evaluate(() => (window as any).contextValueB)).toBe(undefined);
  expect(await pageA.evaluate(() => (window as any).pageValueA)).toBe('pageValueA');
  expect(await pageA.evaluate(() => (window as any).contextValueA)).toBe('contextValueA');
});

test('should remove locator handlers upon disconnect', async ({ twoPages, server }) => {
  const { pageA, pageB } = twoPages;

  await pageA.goto(server.PREFIX + '/input/handle-locator.html');

  let count = 0;
  await pageA.addLocatorHandler(pageA.getByText('This interstitial covers the button'), async () => {
    ++count;
    await pageA.locator('#close').click();
  });

  await pageA.locator('#aside').hover();
  await pageA.evaluate(() => {
    (window as any).clicked = 0;
    (window as any).setupAnnoyingInterstitial('mouseover', 1);
  });
  await pageA.locator('#target').click();
  expect(count).toBe(1);
  expect(await pageB.evaluate('window.clicked')).toBe(1);
  await expect(pageB.locator('#interstitial')).not.toBeVisible();

  await pageA.locator('#aside').hover();
  await pageA.evaluate(() => {
    (window as any).clicked = 0;
    (window as any).setupAnnoyingInterstitial('mouseover', 1);
  });

  await disconnect(pageA);

  const error = await pageB.locator('#target').click({ timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('Timeout 3000ms exceeded');
  expect(error.message).toContain('intercepts pointer events');
  expect(error.message).not.toContain('locator handler');
});

test('should launch persistent', async ({ browserType }) => {
  const browserServer = await browserType.launchServer({ _userDataDir: '', _sharedBrowser: true } as any);
  const browser = await browserType.connect(browserServer.wsEndpoint());
  expect(browser.contexts().length).toBe(1);
  await browser.close();
  await browserServer.close();
});

test('should avoid side effects upon disconnect', async ({ twoPages, server }) => {
  const { pageA, pageB } = twoPages;

  let counter = 0;
  pageB.on('console', () => ++counter);

  const promise = pageA.waitForFunction(() => {
    window['counter'] = (window['counter'] || 0) + 1;
    console.log(window['counter']);
  }, {}, { polling: 1, timeout: 10000 }).catch(e => e);

  await disconnect(pageA);
  const error = await promise;
  const savedCounter = counter;

  await pageB.waitForTimeout(2000); // Give it some time to produce more logs.

  expect(error.message).toContain(kTargetClosedErrorMessage);
  expect(counter).toBe(savedCounter);
});

test('should stop tracing upon disconnect', async ({ twoPages, trace }) => {
  test.skip(trace === 'on');

  const { pageA, pageB } = twoPages;

  await pageA.context().tracing.start();
  const error = await pageB.context().tracing.start().catch(e => e);
  expect(error.message).toContain('Tracing has been already started');

  await disconnect(pageA);

  await pageB.context().tracing.start();
});
