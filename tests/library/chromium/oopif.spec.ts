/**
 * Copyright 2017 Google Inc. All rights reserved.
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

import { contextTest as it, expect } from '../../config/browserTest';
import type { Frame, Browser } from '@playwright/test';

it.use({
  launchOptions: async ({ launchOptions }, use) => {
    await use({ ...launchOptions, args: ['--site-per-process'] });
  }
});

it('should report oopif frames', async function({ page, browser, server }) {
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  await assertOOPIFCount(browser, 1);
  expect(page.frames().length).toBe(2);
  expect(await page.frames()[1].evaluate(() => '' + location.href)).toBe(server.CROSS_PROCESS_PREFIX + '/grid.html');
});

it('should handle oopif detach', async function({ page, browser, server }) {
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  await assertOOPIFCount(browser, 1);
  expect(page.frames().length).toBe(2);
  const frame = page.frames()[1];
  expect(await frame.evaluate(() => '' + location.href)).toBe(server.CROSS_PROCESS_PREFIX + '/grid.html');
  const [detachedFrame] = await Promise.all([
    page.waitForEvent('framedetached'),
    page.evaluate(() => document.querySelector('iframe')!.remove()),
  ]);
  expect(detachedFrame).toBe(frame);
});

it('should handle remote -> local -> remote transitions', async function({ page, browser, server }) {
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  expect(page.frames().length).toBe(2);
  await assertOOPIFCount(browser, 1);
  expect(await page.frames()[1].evaluate(() => '' + location.href)).toBe(server.CROSS_PROCESS_PREFIX + '/grid.html');
  await Promise.all([
    page.frames()[1].waitForNavigation(),
    page.evaluate('goLocal()'),
  ]);
  expect(await page.frames()[1].evaluate(() => '' + location.href)).toBe(server.PREFIX + '/grid.html');
  await assertOOPIFCount(browser, 0);
  await Promise.all([
    page.frames()[1].waitForNavigation(),
    page.evaluate('goRemote()'),
  ]);
  expect(await page.frames()[1].evaluate(() => '' + location.href)).toBe(server.CROSS_PROCESS_PREFIX + '/grid.html');
  await assertOOPIFCount(browser, 1);
});

it('should get the proper viewport', async ({ page, browser, server }) => {
  it.fixme();

  expect(page.viewportSize()).toEqual({ width: 1280, height: 720 });
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  expect(page.frames().length).toBe(2);
  await assertOOPIFCount(browser, 1);
  const oopif = page.frames()[1];
  expect(await oopif.evaluate(() => screen.width)).toBe(1280);
  expect(await oopif.evaluate(() => screen.height)).toBe(720);
  expect(await oopif.evaluate(() => matchMedia('(device-width: 1280px)').matches)).toBe(true);
  expect(await oopif.evaluate(() => matchMedia('(device-height: 720px)').matches)).toBe(true);
  expect(await oopif.evaluate(() => 'ontouchstart' in window)).toBe(false);
  await page.setViewportSize({ width: 123, height: 456 });
  expect(await oopif.evaluate(() => screen.width)).toBe(123);
  expect(await oopif.evaluate(() => screen.height)).toBe(456);
  expect(await oopif.evaluate(() => matchMedia('(device-width: 123px)').matches)).toBe(true);
  expect(await oopif.evaluate(() => matchMedia('(device-height: 456px)').matches)).toBe(true);
  expect(await oopif.evaluate(() => 'ontouchstart' in window)).toBe(false);
});

it('should expose function', async ({ page, browser, server }) => {
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  expect(page.frames().length).toBe(2);
  await assertOOPIFCount(browser, 1);
  const oopif = page.frames()[1];
  await page.exposeFunction('mul', (a: number, b: number) => a * b);
  const result = await oopif.evaluate(async function() {
    return await (window as any)['mul'](9, 4);
  });
  expect(result).toBe(36);
});

it('should emulate media', async ({ page, browser, server }) => {
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  expect(page.frames().length).toBe(2);
  await assertOOPIFCount(browser, 1);
  const oopif = page.frames()[1];
  expect(await oopif.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await oopif.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
});

it('should emulate offline', async ({ page, browser, server }) => {
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  expect(page.frames().length).toBe(2);
  await assertOOPIFCount(browser, 1);
  const oopif = page.frames()[1];
  expect(await oopif.evaluate(() => navigator.onLine)).toBe(true);
  await page.context().setOffline(true);
  expect(await oopif.evaluate(() => navigator.onLine)).toBe(false);
});

it('should support context options', async ({ browser, server, playwright }) => {
  const iPhone = playwright.devices['iPhone 6'];
  const context = await browser.newContext({ ...iPhone, timezoneId: 'America/Jamaica', locale: 'fr-CH', userAgent: 'UA' });
  const page = await context.newPage();

  const [request] = await Promise.all([
    server.waitForRequest('/grid.html'),
    page.goto(server.PREFIX + '/dynamic-oopif.html'),
  ]);
  expect(page.frames().length).toBe(2);
  await assertOOPIFCount(browser, 1);
  const oopif = page.frames()[1];

  expect(await oopif.evaluate(() => 'ontouchstart' in window)).toBe(true);
  expect(await oopif.evaluate(() => new Date(1479579154987).toString())).toBe('Sat Nov 19 2016 13:12:34 GMT-0500 (heure normale de l’Est nord-américain)');
  expect(await oopif.evaluate(() => navigator.language)).toBe('fr-CH');
  expect(await oopif.evaluate(() => navigator.userAgent)).toBe('UA');
  expect(request.headers['user-agent']).toBe('UA');

  await context.close();
});

it('should respect route', async ({ page, browser, server }) => {
  let intercepted = false;
  await page.route('**/digits/0.png', route => {
    intercepted = true;
    void route.continue();
  });
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  expect(page.frames().length).toBe(2);
  await assertOOPIFCount(browser, 1);
  expect(intercepted).toBe(true);
});

it('should take screenshot', async ({ page, browser, server }) => {
  await page.setViewportSize({ width: 500, height: 500 });
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  expect(page.frames().length).toBe(2);
  await assertOOPIFCount(browser, 1);
  expect(await page.screenshot()).toMatchSnapshot('screenshot-oopif.png');
});

it('should load oopif iframes with subresources and route', async function({ page, browser, server }) {
  await page.route('**/*', route => route.continue());
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  await assertOOPIFCount(browser, 1);
});

it('should report main requests', async function({ page, browser, server }) {
  const requestFrames: Frame[] = [];
  page.on('request', r => requestFrames.push(r.frame()));
  const finishedFrames: Frame[] = [];
  page.on('requestfinished', r => finishedFrames.push(r.frame()));

  await page.goto(server.PREFIX + '/empty.html');
  const main = page.mainFrame();

  await main.evaluate(url => {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    document.body.appendChild(iframe);
    return new Promise(f => iframe.onload = f);
  }, server.CROSS_PROCESS_PREFIX + '/empty.html');
  expect(page.frames().length).toBe(2);
  const child = main.childFrames()[0];
  await child.waitForLoadState('domcontentloaded');

  await child.evaluate(url => {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    document.body.appendChild(iframe);
    return new Promise(f => iframe.onload = f);
  }, server.PREFIX + '/empty.html');
  expect(page.frames().length).toBe(3);
  const grandChild = child.childFrames()[0];
  await grandChild.waitForLoadState('domcontentloaded');

  await assertOOPIFCount(browser, 2);
  expect(requestFrames[0]).toBe(main);
  expect(finishedFrames[0]).toBe(main);
  expect(requestFrames[1]).toBe(child);
  expect(finishedFrames[1]).toBe(child);
  expect(requestFrames[2]).toBe(grandChild);
  expect(finishedFrames[2]).toBe(grandChild);
});

it('should support exposeFunction', async function({ page, browser, server }) {
  await page.context().exposeFunction('dec', (a: number) => a - 1);
  await page.exposeFunction('inc', (a: number) => a + 1);
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  await assertOOPIFCount(browser, 1);
  expect(page.frames().length).toBe(2);
  expect(await page.frames()[0].evaluate(() => (window as any)['inc'](3))).toBe(4);
  expect(await page.frames()[1].evaluate(() => (window as any)['inc'](4))).toBe(5);
  expect(await page.frames()[0].evaluate(() => (window as any)['dec'](3))).toBe(2);
  expect(await page.frames()[1].evaluate(() => (window as any)['dec'](4))).toBe(3);
});

it('should support addInitScript', async function({ page, browser, server }) {
  await page.context().addInitScript(() => (window as any)['bar'] = 17);
  await page.addInitScript(() => (window as any)['foo'] = 42);
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  await assertOOPIFCount(browser, 1);
  expect(page.frames().length).toBe(2);
  expect(await page.frames()[0].evaluate(() => (window as any)['foo'])).toBe(42);
  expect(await page.frames()[1].evaluate(() => (window as any)['foo'])).toBe(42);
  expect(await page.frames()[0].evaluate(() => (window as any)['bar'])).toBe(17);
  expect(await page.frames()[1].evaluate(() => (window as any)['bar'])).toBe(17);
});
// @see https://github.com/microsoft/playwright/issues/1240
it('should click a button when it overlays oopif', async function({ page, browser, server }) {
  await page.goto(server.PREFIX + '/button-overlay-oopif.html');
  await assertOOPIFCount(browser, 1);
  await page.click('button');
  expect(await page.evaluate(() => (window as any)['BUTTON_CLICKED'])).toBe(true);
});

it('should report google.com frame with headed', async ({ browserType, server }) => {
  // @see https://github.com/GoogleChrome/puppeteer/issues/2548
  // https://google.com is isolated by default in Chromium embedder.
  const browser = await browserType.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.route('**/*', route => {
    void route.fulfill({ body: 'YO, GOOGLE.COM' });
  });
  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.setAttribute('src', 'https://google.com/');
    document.body.appendChild(frame);
    return new Promise(x => frame.onload = x);
  });
  await page.waitForSelector('iframe[src="https://google.com/"]');
  await assertOOPIFCount(browser, 1);
  const urls = page.frames().map(frame => frame.url());
  expect(urls).toEqual([
    server.EMPTY_PAGE,
    'https://google.com/'
  ]);
  await browser.close();
});

it('ElementHandle.boundingBox() should work', async function({ page, browser, server }) {
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  await page.$eval('iframe', iframe => {
    iframe.style.width = '520px';
    iframe.style.height = '520px';
    iframe.style.marginLeft = '42px';
    iframe.style.marginTop = '17px';
  });
  await page.frames()[1].goto(page.frames()[1].url());

  await assertOOPIFCount(browser, 1);
  const handle1 = await page.frames()[1].$('.box:nth-of-type(13)');
  await expect.poll(() => handle1!.boundingBox()).toEqual({ x: 100 + 42, y: 50 + 17, width: 50, height: 50 });

  await Promise.all([
    page.frames()[1].waitForNavigation(),
    page.evaluate('goLocal()'),
  ]);
  await assertOOPIFCount(browser, 0);
  const handle2 = await page.frames()[1].$('.box:nth-of-type(13)');
  await expect.poll(() => handle2!.boundingBox()).toEqual({ x: 100 + 42, y: 50 + 17, width: 50, height: 50 });
});

it('should click', async function({ page, browser, server }) {
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  await page.$eval('iframe', iframe => {
    iframe.style.width = '500px';
    iframe.style.height = '500px';
    iframe.style.marginLeft = '102px';
    iframe.style.marginTop = '117px';
  });
  await page.frames()[1].goto(page.frames()[1].url());

  await assertOOPIFCount(browser, 1);
  const handle1 = (await page.frames()[1].$('.box:nth-of-type(13)'))!;
  await handle1.evaluate(div => div.addEventListener('click', () => (window as any)['_clicked'] = true, false));
  await handle1.click();
  expect(await handle1.evaluate(() => (window as any)['_clicked'])).toBe(true);
});

it('contentFrame should work', async ({ page, browser, server }) => {
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  expect(page.frames().length).toBe(2);
  await assertOOPIFCount(browser, 1);
  expect(await page.locator('iframe').contentFrame().locator('div').count()).toBe(200);
  const oopif = await page.$('iframe');
  const content = await oopif.contentFrame();
  expect(await content.locator('div').count()).toBe(200);
});

it('should allow cdp sessions on oopifs', async function({ page, browser, server }) {
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  await assertOOPIFCount(browser, 1);
  expect(page.frames().length).toBe(2);
  expect(await page.frames()[1].evaluate(() => '' + location.href)).toBe(server.CROSS_PROCESS_PREFIX + '/grid.html');

  const parentCDP = await page.context().newCDPSession(page.frames()[0]);
  const parent = await parentCDP.send('DOM.getDocument', { pierce: true, depth: -1 });
  expect(JSON.stringify(parent)).not.toContain('./digits/1.png');

  const oopifCDP = await page.context().newCDPSession(page.frames()[1]);
  const oopif = await oopifCDP.send('DOM.getDocument', { pierce: true, depth: -1 });
  expect(JSON.stringify(oopif)).toContain('./digits/1.png');
});

it('should emit filechooser event for iframe', async ({ page, server, browser }) => {
  // Add listener before OOPIF is created.
  const chooserPromise = page.waitForEvent('filechooser');
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  await assertOOPIFCount(browser, 1);
  expect(page.frames().length).toBe(2);
  const frame = page.frames()[1];
  await frame.setContent(`<input type=file>`);
  const [chooser] = await Promise.all([
    chooserPromise,
    frame.click('input'),
  ]);
  expect(chooser).toBeTruthy();
});

it('should be able to click in iframe', async ({ page, server, browser }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/28023' });
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  await assertOOPIFCount(browser, 1);
  expect(page.frames().length).toBe(2);
  const frame = page.frames()[1];
  await frame.setContent(`<button onclick="console.log('clicked')">OK</button>`);
  const [message] = await Promise.all([
    page.waitForEvent('console'),
    frame.click('button'),
  ]);
  expect(message.text()).toBe('clicked');
});

it('should not throw on exposeFunction when oopif detaches', async ({ page, browser, server }) => {
  await page.goto(server.PREFIX + '/dynamic-oopif.html');
  await assertOOPIFCount(browser, 1);
  await Promise.all([
    page.exposeFunction('myFunc', () => 2022),
    page.evaluate(() => document.querySelector('iframe')!.remove()),
  ]);
  expect(await page.evaluate(() => (window as any).myFunc())).toBe(2022);
});

it('should intercept response body from oopif', async function({ page, browser, server }) {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/20809' });
  const [response] = await Promise.all([
    page.waitForResponse('**/grid.html'),
    page.goto(server.PREFIX + '/dynamic-oopif.html')
  ]);
  expect(await response.text()).toBeTruthy();
});

async function assertOOPIFCount(browser: Browser, count: number) {
  if (browser.browserType().name() !== 'chromium')
    return;
  expect(await countOOPIFs(browser)).toBe(count);
}

async function countOOPIFs(browser: Browser) {
  const browserSession = await browser.newBrowserCDPSession();
  const oopifs = [];
  browserSession.on('Target.targetCreated', async ({ targetInfo }) => {
    if (targetInfo.type === 'iframe')
      oopifs.push(targetInfo);
  });
  await browserSession.send('Target.setDiscoverTargets', { discover: true });
  await browserSession.detach();
  return oopifs.length;
}
