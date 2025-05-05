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
import type { Page } from 'playwright-core';

it('should inherit user agent from browser context @smoke', async function({ browser, server }) {
  const context = await browser.newContext({
    userAgent: 'hey'
  });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<a target=_blank rel=noopener href="/popup/popup.html">link</a>');
  const requestPromise = server.waitForRequest('/popup/popup.html');
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.click('a'),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  const userAgent = await popup.evaluate(() => window['initialUserAgent']);
  const request = await requestPromise;
  await context.close();
  expect(userAgent).toBe('hey');
  expect(request.headers['user-agent']).toBe('hey');
});

it('should respect routes from browser context', async function({ browser, server }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<a target=_blank rel=noopener href="empty.html">link</a>');
  let intercepted = false;
  await context.route('**/empty.html', route => {
    void route.continue();
    intercepted = true;
  });
  await Promise.all([
    context.waitForEvent('page'),
    page.click('a'),
  ]);
  await context.close();
  expect(intercepted).toBe(true);
});

it('should inherit extra headers from browser context', async function({ browser, server }) {
  const context = await browser.newContext({
    extraHTTPHeaders: { 'foo': 'bar' },
  });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const requestPromise = server.waitForRequest('/dummy.html');
  await page.evaluate(url => window['_popup'] = window.open(url), server.PREFIX + '/dummy.html');
  const request = await requestPromise;
  await context.close();
  expect(request.headers['foo']).toBe('bar');
});

it('should inherit offline from browser context', async function({ browser, server }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await context.setOffline(true);
  const online = await page.evaluate(url => {
    const win = window.open(url);
    return win.navigator.onLine;
  }, server.PREFIX + '/dummy.html');
  await context.close();
  expect(online).toBe(false);
});

it('should inherit http credentials from browser context', async function({ browser, server }) {
  server.setAuth('/title.html', 'user', 'pass');
  const context = await browser.newContext({
    httpCredentials: { username: 'user', password: 'pass' }
  });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => window['_popup'] = window.open(url), server.PREFIX + '/title.html'),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  expect(await popup.title()).toBe('Woof-Woof');
  await context.close();
});

it('should inherit touch support from browser context', async function({ browser, server }) {
  const context = await browser.newContext({
    viewport: { width: 400, height: 500 },
    hasTouch: true
  });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const hasTouch = await page.evaluate(() => {
    const win = window.open('');
    return 'ontouchstart' in win;
  });
  await context.close();
  expect(hasTouch).toBe(true);
});

it('should inherit viewport size from browser context', async function({ browser, server }) {
  const context = await browser.newContext({
    viewport: { width: 400, height: 500 }
  });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const size = await page.evaluate(() => {
    const win = window.open('about:blank');
    return { width: win.innerWidth, height: win.innerHeight };
  });
  await context.close();
  expect(size).toEqual({ width: 400, height: 500 });
});

it('should use viewport size from window features', async function({ browser, server, browserName }) {
  const context = await browser.newContext({
    viewport: { width: 700, height: 700 }
  });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const [size, popup] = await Promise.all([
    page.evaluate(async () => {
      const win = window.open(window.location.href, 'Title', 'toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=600,height=300,top=0,left=0');
      await new Promise<void>(resolve => {
        const interval = window.builtins.setInterval(() => {
          if (win.innerWidth === 600 && win.innerHeight === 300) {
            window.builtins.clearInterval(interval);
            resolve();
          }
        }, 10);
      });
      return { width: win.innerWidth, height: win.innerHeight };
    }),
    page.waitForEvent('popup'),
  ]);
  await popup.setViewportSize({ width: 500, height: 400 });
  await popup.waitForLoadState();
  const resized = await popup.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  await context.close();
  expect(size).toEqual({ width: 600, height: 300 });
  expect(resized).toEqual({ width: 500, height: 400 });
});

it('should respect routes from browser context when using window.open', async function({ browser, server }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  let intercepted = false;
  await context.route('**/empty.html', route => {
    void route.continue();
    intercepted = true;
  });
  await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => window['__popup'] = window.open(url), server.EMPTY_PAGE),
  ]);
  expect(intercepted).toBe(true);
  await context.close();
});

it('BrowserContext.addInitScript should apply to an in-process popup', async function({ browser, server }) {
  const context = await browser.newContext();
  await context.addInitScript(() => window['injected'] = 123);
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const injected = await page.evaluate(() => {
    const win = window.open('about:blank');
    return win['injected'];
  });
  await context.close();
  expect(injected).toBe(123);
});

it('BrowserContext.addInitScript should apply to a cross-process popup', async function({ browser, server }) {
  const context = await browser.newContext();
  await context.addInitScript(() => window['injected'] = 123);
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => window.open(url), server.CROSS_PROCESS_PREFIX + '/title.html'),
  ]);
  expect(await popup.evaluate('injected')).toBe(123);
  await popup.reload();
  expect(await popup.evaluate('injected')).toBe(123);
  await context.close();
});

it('should expose function from browser context', async function({ browser, server }) {
  const context = await browser.newContext();
  const messages = [];
  await context.exposeFunction('add', (a, b) => {
    messages.push('binding');
    return a + b;
  });
  const page = await context.newPage();
  context.on('page', () => messages.push('page'));
  await page.goto(server.EMPTY_PAGE);
  const added = await page.evaluate(async () => {
    const win = window.open('about:blank');
    return win['add'](9, 4);
  });
  await context.close();
  expect(added).toBe(13);
  expect(messages.join('|')).toBe('page|binding');
});

it('should not dispatch binding on a closed page', async function({ browser, server, browserName }) {
  const context = await browser.newContext();
  let wasClosed: boolean | undefined;
  await context.exposeBinding('add', (source, a, b) => {
    wasClosed = source.page.isClosed();
    return a + b;
  });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(async () => {
      const win = window.open('about:blank');
      win['add'](9, 4);
      win.close();
    }),
  ]);
  // Give it a chance to dispatch the binding on the closed page.
  await page.waitForTimeout(1000);
  await context.close();
  expect(wasClosed).not.toBeTruthy();
});

it('should not throttle rAF in the opener page', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/14557' });
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => { window.open('about:blank'); }),
  ]);
  await Promise.all([
    waitForRafs(page, 30),
    waitForRafs(popup, 30)
  ]);
});

it('should not throw when click closes popup', async ({ browserName, page, server }) => {
  it.fixme(browserName === 'firefox', 'locator.click: Target page, context or browser has been closed');

  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(async browserName => {
      const w = window.open('about:blank');
      if (browserName === 'firefox')
        await new Promise(x => w.onload = x);
      w.document.body.innerHTML = `<button onclick="window.close()">close</button>`;
    }, browserName),
  ]);
  await popup.getByRole('button').click();
});

async function waitForRafs(page: Page, count: number): Promise<void> {
  await page.evaluate(count => new Promise<void>(resolve => {
    const onRaf = () => {
      --count;
      if (!count)
        resolve();
      else
        window.builtins.requestAnimationFrame(onRaf);
    };
    window.builtins.requestAnimationFrame(onRaf);
  }), count);
}
