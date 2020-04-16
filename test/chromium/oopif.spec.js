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

const {FFOX, CHROMIUM, WEBKIT} = require('../utils').testOptions(browserType);

describe('OOPIF', function() {
  beforeAll(async function(state) {
    state.browser = await state.browserType.launch(Object.assign({}, state.defaultBrowserOptions, {
      args: (state.defaultBrowserOptions.args || []).concat(['--site-per-process']),
    }));
  });
  beforeEach(async function(state) {
    state.context = await state.browser.newContext();
    state.page = await state.context.newPage();
  });
  afterEach(async function(state) {
    await state.context.close();
    state.page = null;
    state.context = null;
  });
  afterAll(async function(state) {
    await state.browser.close();
    state.browser = null;
  });
  it('should report oopif frames', async function({browser, page, server, context}) {
    await page.goto(server.PREFIX + '/dynamic-oopif.html');
    expect(await countOOPIFs(browser)).toBe(1);
    expect(page.frames().length).toBe(2);
    expect(await page.frames()[1].evaluate(() => '' + location.href)).toBe(server.CROSS_PROCESS_PREFIX + '/grid.html');
  });
  it('should handle remote -> local -> remote transitions', async function({browser, page, server, context}) {
    await page.goto(server.PREFIX + '/dynamic-oopif.html');
    expect(page.frames().length).toBe(2);
    expect(await countOOPIFs(browser)).toBe(1);
    expect(await page.frames()[1].evaluate(() => '' + location.href)).toBe(server.CROSS_PROCESS_PREFIX + '/grid.html');
    await Promise.all([
      page.frames()[1].waitForNavigation(),
      page.evaluate(() => goLocal()),
    ]);
    expect(await page.frames()[1].evaluate(() => '' + location.href)).toBe(server.PREFIX + '/grid.html');
    expect(await countOOPIFs(browser)).toBe(0);
    await Promise.all([
      page.frames()[1].waitForNavigation(),
      page.evaluate(() => goRemote()),
    ]);
    expect(await page.frames()[1].evaluate(() => '' + location.href)).toBe(server.CROSS_PROCESS_PREFIX + '/grid.html');
    expect(await countOOPIFs(browser)).toBe(1);
  });
  it.fail(CHROMIUM)('should get the proper viewport', async({browser, page, server}) => {
    expect(page.viewportSize()).toEqual({width: 1280, height: 720});
    await page.goto(server.PREFIX + '/dynamic-oopif.html');
    expect(page.frames().length).toBe(2);
    expect(await countOOPIFs(browser)).toBe(1);
    const oopif = page.frames()[1];
    expect(await oopif.evaluate(() => screen.width)).toBe(1280);
    expect(await oopif.evaluate(() => screen.height)).toBe(720);
    expect(await oopif.evaluate(() => matchMedia('(device-width: 1280px)').matches)).toBe(true);
    expect(await oopif.evaluate(() => matchMedia('(device-height: 720px)').matches)).toBe(true);
    expect(await oopif.evaluate(() => 'ontouchstart' in window)).toBe(false);
    await page.setViewportSize({width: 123, height: 456});
    expect(await oopif.evaluate(() => screen.width)).toBe(123);
    expect(await oopif.evaluate(() => screen.height)).toBe(456);
    expect(await oopif.evaluate(() => matchMedia('(device-width: 123px)').matches)).toBe(true);
    expect(await oopif.evaluate(() => matchMedia('(device-height: 456px)').matches)).toBe(true);
    expect(await oopif.evaluate(() => 'ontouchstart' in window)).toBe(false);
  });
  it('should expose function', async({browser, page, server}) => {
    await page.goto(server.PREFIX + '/dynamic-oopif.html');
    expect(page.frames().length).toBe(2);
    expect(await countOOPIFs(browser)).toBe(1);
    const oopif = page.frames()[1];
    await page.exposeFunction('mul', (a, b) => a * b);
    const result = await oopif.evaluate(async function() {
      return await mul(9, 4);
    });
    expect(result).toBe(36);
  });
  it('should emulate media', async({browser, page, server}) => {
    await page.goto(server.PREFIX + '/dynamic-oopif.html');
    expect(page.frames().length).toBe(2);
    expect(await countOOPIFs(browser)).toBe(1);
    const oopif = page.frames()[1];
    expect(await oopif.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await oopif.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
  });
  it('should emulate offline', async({browser, page, context, server}) => {
    await page.goto(server.PREFIX + '/dynamic-oopif.html');
    expect(page.frames().length).toBe(2);
    expect(await countOOPIFs(browser)).toBe(1);
    const oopif = page.frames()[1];
    expect(await oopif.evaluate(() => navigator.onLine)).toBe(true);
    await context.setOffline(true);
    expect(await oopif.evaluate(() => navigator.onLine)).toBe(false);
  });
  it('should support context options', async({browser, server}) => {
    const iPhone = playwright.devices['iPhone 6']
    const context = await browser.newContext({ ...iPhone, timezoneId: 'America/Jamaica', locale: 'fr-CH', userAgent: 'UA' });
    const page = await context.newPage();

    const [request] = await Promise.all([
      server.waitForRequest('/grid.html'),
      page.goto(server.PREFIX + '/dynamic-oopif.html'),
    ]);
    expect(page.frames().length).toBe(2);
    expect(await countOOPIFs(browser)).toBe(1);
    const oopif = page.frames()[1];

    expect(await oopif.evaluate(() => 'ontouchstart' in window)).toBe(true);
    expect(await oopif.evaluate(() => new Date(1479579154987).toString())).toBe('Sat Nov 19 2016 13:12:34 GMT-0500 (heure normale de l’Est nord-américain)');
    expect(await oopif.evaluate(() => navigator.language)).toBe('fr-CH');
    expect(await oopif.evaluate(() => navigator.userAgent)).toBe('UA');
    expect(request.headers['user-agent']).toBe('UA');

    await context.close();
  });
  it('should respect route', async({browser, page, server}) => {
    let intercepted = false;
    await page.route('**/digits/0.png', route => {
      intercepted = true;
      route.continue();
    });
    await page.goto(server.PREFIX + '/dynamic-oopif.html');
    expect(page.frames().length).toBe(2);
    expect(await countOOPIFs(browser)).toBe(1);
    expect(intercepted).toBe(true);
  });
  it.fail(CHROMIUM)('should take screenshot', async({browser, page, server}) => {
    // Screenshot differs on the bots, needs debugging.
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/dynamic-oopif.html');
    expect(page.frames().length).toBe(2);
    expect(await countOOPIFs(browser)).toBe(1);
    expect(await page.screenshot()).toBeGolden('screenshot-iframe.png');
  });
  it('should load oopif iframes with subresources and request interception', async function({browser, page, server, context}) {
    await page.route('**/*', route => route.continue());
    await page.goto(server.PREFIX + '/dynamic-oopif.html');
    expect(await countOOPIFs(browser)).toBe(1);
  });
  // @see https://github.com/microsoft/playwright/issues/1240
  it('should click a button when it overlays oopif', async function({browser, page, server, context}) {
    await page.goto(server.PREFIX + '/button-overlay-oopif.html');
    expect(await countOOPIFs(browser)).toBe(1);
    await page.click('button');
    expect(await page.evaluate(() => window.BUTTON_CLICKED)).toBe(true);
  });
  it('should report google.com frame with headful', async({browserType, defaultBrowserOptions, server}) => {
    // @see https://github.com/GoogleChrome/puppeteer/issues/2548
    // https://google.com is isolated by default in Chromium embedder.
    const browser = await browserType.launch({...defaultBrowserOptions, headless: false});
    const page = await browser.newPage();
    await page.goto(server.EMPTY_PAGE);
    await page.route('**/*', route => {
      route.fulfill({body: 'YO, GOOGLE.COM'});
    });
    await page.evaluate(() => {
      const frame = document.createElement('iframe');
      frame.setAttribute('src', 'https://google.com/');
      document.body.appendChild(frame);
      return new Promise(x => frame.onload = x);
    });
    await page.waitForSelector('iframe[src="https://google.com/"]');
    expect(await countOOPIFs(browser)).toBe(1);
    const urls = page.frames().map(frame => frame.url());
    expect(urls).toEqual([
      server.EMPTY_PAGE,
      'https://google.com/'
    ]);
    await browser.close();
  });
});

async function countOOPIFs(browser) {
  const browserSession = await browser.newBrowserCDPSession();
  const oopifs = [];
  browserSession.on('Target.targetCreated', async ({targetInfo}) => {
    if (targetInfo.type === 'iframe')
       oopifs.push(targetInfo);
  });
  await browserSession.send('Target.setDiscoverTargets', { discover: true });
  await browserSession.detach();
  return oopifs.length;
}
