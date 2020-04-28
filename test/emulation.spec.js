/**
 * Copyright 2018 Google Inc. All rights reserved.
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

const utils = require('./utils');
const {FFOX, CHROMIUM, WEBKIT} = utils.testOptions(browserType);
const iPhone = playwright.devices['iPhone 6'];
const iPhoneLandscape = playwright.devices['iPhone 6 landscape'];

describe('BrowserContext({viewport})', function() {
  it('should get the proper viewport size', async({page, server}) => {
    expect(page.viewportSize()).toEqual({width: 1280, height: 720});
    expect(await page.evaluate(() => window.innerWidth)).toBe(1280);
    expect(await page.evaluate(() => window.innerHeight)).toBe(720);
  });
  it('should set the proper viewport size', async({page, server}) => {
    expect(page.viewportSize()).toEqual({width: 1280, height: 720});
    await page.setViewportSize({width: 123, height: 456});
    expect(page.viewportSize()).toEqual({width: 123, height: 456});
    expect(await page.evaluate(() => window.innerWidth)).toBe(123);
    expect(await page.evaluate(() => window.innerHeight)).toBe(456);
  });
  it('should emulate device width', async({page, server}) => {
    expect(page.viewportSize()).toEqual({width: 1280, height: 720});
    await page.setViewportSize({width: 200, height: 200});
    expect(await page.evaluate(() => window.screen.width)).toBe(200);
    expect(await page.evaluate(() => matchMedia('(min-device-width: 100px)').matches)).toBe(true);
    expect(await page.evaluate(() => matchMedia('(min-device-width: 300px)').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('(max-device-width: 100px)').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('(max-device-width: 300px)').matches)).toBe(true);
    expect(await page.evaluate(() => matchMedia('(device-width: 500px)').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('(device-width: 200px)').matches)).toBe(true);
    await page.setViewportSize({width: 500, height: 500});
    expect(await page.evaluate(() => window.screen.width)).toBe(500);
    expect(await page.evaluate(() => matchMedia('(min-device-width: 400px)').matches)).toBe(true);
    expect(await page.evaluate(() => matchMedia('(min-device-width: 600px)').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('(max-device-width: 400px)').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('(max-device-width: 600px)').matches)).toBe(true);
    expect(await page.evaluate(() => matchMedia('(device-width: 200px)').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('(device-width: 500px)').matches)).toBe(true);
  });
  it('should emulate device height', async({page, server}) => {
    expect(page.viewportSize()).toEqual({width: 1280, height: 720});
    await page.setViewportSize({width: 200, height: 200});
    expect(await page.evaluate(() => window.screen.height)).toBe(200);
    expect(await page.evaluate(() => matchMedia('(min-device-height: 100px)').matches)).toBe(true);
    expect(await page.evaluate(() => matchMedia('(min-device-height: 300px)').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('(max-device-height: 100px)').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('(max-device-height: 300px)').matches)).toBe(true);
    expect(await page.evaluate(() => matchMedia('(device-height: 500px)').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('(device-height: 200px)').matches)).toBe(true);
    await page.setViewportSize({width: 500, height: 500});
    expect(await page.evaluate(() => window.screen.height)).toBe(500);
    expect(await page.evaluate(() => matchMedia('(min-device-height: 400px)').matches)).toBe(true);
    expect(await page.evaluate(() => matchMedia('(min-device-height: 600px)').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('(max-device-height: 400px)').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('(max-device-height: 600px)').matches)).toBe(true);
    expect(await page.evaluate(() => matchMedia('(device-height: 200px)').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('(device-height: 500px)').matches)).toBe(true);
  });
  it('should not have touch by default', async({page, server}) => {
    await page.goto(server.PREFIX + '/mobile.html');
    expect(await page.evaluate(() => 'ontouchstart' in window)).toBe(false);
    await page.goto(server.PREFIX + '/detect-touch.html');
    expect(await page.evaluate(() => document.body.textContent.trim())).toBe('NO');
  });
});

describe.skip(FFOX)('viewport.isMobile', () => {
  // Firefox does not support isMobile.
  it('should support mobile emulation', async({browser, server}) => {
    const context = await browser.newContext({ ...iPhone });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/mobile.html');
    expect(await page.evaluate(() => window.innerWidth)).toBe(375);
    await page.setViewportSize({width: 400, height: 300});
    expect(await page.evaluate(() => window.innerWidth)).toBe(400);
    await context.close();
  });
  it('should support touch emulation', async({browser, server}) => {
    const context = await browser.newContext({ ...iPhone });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/mobile.html');
    expect(await page.evaluate(() => 'ontouchstart' in window)).toBe(true);
    expect(await page.evaluate(dispatchTouch)).toBe('Received touch');
    await context.close();

    function dispatchTouch() {
      let fulfill;
      const promise = new Promise(x => fulfill = x);
      window.ontouchstart = function(e) {
        fulfill('Received touch');
      };
      window.dispatchEvent(new Event('touchstart'));

      fulfill('Did not receive touch');

      return promise;
    }
  });
  it('should be detectable by Modernizr', async({browser, server}) => {
    const context = await browser.newContext({ ...iPhone });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/detect-touch.html');
    expect(await page.evaluate(() => document.body.textContent.trim())).toBe('YES');
    await context.close();
  });
  it('should detect touch when applying viewport with touches', async({browser, server}) => {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 }, hasTouch: true });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    await page.addScriptTag({url: server.PREFIX + '/modernizr.js'});
    expect(await page.evaluate(() => Modernizr.touchevents)).toBe(true);
    await context.close();
  });
  it('should support landscape emulation', async({browser, server}) => {
    const context1 = await browser.newContext({ ...iPhone });
    const page1 = await context1.newPage();
    await page1.goto(server.PREFIX + '/mobile.html');
    expect(await page1.evaluate(() => matchMedia('(orientation: landscape)').matches)).toBe(false);
    const context2 = await browser.newContext({ ...iPhoneLandscape });
    const page2 = await context2.newPage();
    expect(await page2.evaluate(() => matchMedia('(orientation: landscape)').matches)).toBe(true);
    await context1.close();
    await context2.close();
  });
  it('should support window.orientation emulation', async({browser, server}) => {
    const context = await browser.newContext({ viewport: { width: 300, height: 400 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/mobile.html');
    expect(await page.evaluate(() => window.orientation)).toBe(0);
    await page.setViewportSize({width: 400, height: 300});
    expect(await page.evaluate(() => window.orientation)).toBe(90);
    await context.close();
  });
  it('should fire orientationchange event', async({browser, server}) => {
    const context = await browser.newContext({ viewport: { width: 300, height: 400 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/mobile.html');
    await page.evaluate(() => {
      window.counter = 0;
      window.addEventListener('orientationchange', () => console.log(++window.counter));
    });

    const event1 = page.waitForEvent('console');
    await page.setViewportSize({width: 400, height: 300});
    expect((await event1).text()).toBe('1');

    const event2 = page.waitForEvent('console');
    await page.setViewportSize({width: 300, height: 400});
    expect((await event2).text()).toBe('2');
    await context.close();
  });
  it('default mobile viewports to 980 width', async({browser, server}) => {
    const context = await browser.newContext({ viewport: {width: 320, height: 480 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/empty.html');
    expect(await page.evaluate(() => window.innerWidth)).toBe(980);
    await context.close();
  });
  it('respect meta viewport tag', async({browser, server}) => {
    const context = await browser.newContext({ viewport: {width: 320, height: 480 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/mobile.html');
    expect(await page.evaluate(() => window.innerWidth)).toBe(320);
    await context.close();
  });
});

describe.skip(FFOX)('Page.emulate', function() {
  it('should work', async({browser, server}) => {
    const context = await browser.newContext({ ...iPhone });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/mobile.html');
    expect(await page.evaluate(() => window.innerWidth)).toBe(375);
    expect(await page.evaluate(() => navigator.userAgent)).toContain('iPhone');
    await context.close();
  });
  it('should support clicking', async({browser, server}) => {
    const context = await browser.newContext({ ...iPhone });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/input/button.html');
    const button = await page.$('button');
    await page.evaluate(button => button.style.marginTop = '200px', button);
    await button.click();
    expect(await page.evaluate(() => result)).toBe('Clicked');
    await context.close();
  });
});

describe('Page.emulateMedia type', function() {
  it('should work', async({page, server}) => {
    expect(await page.evaluate(() => matchMedia('screen').matches)).toBe(true);
    expect(await page.evaluate(() => matchMedia('print').matches)).toBe(false);
    await page.emulateMedia({ media: 'print' });
    expect(await page.evaluate(() => matchMedia('screen').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('print').matches)).toBe(true);
    await page.emulateMedia({});
    expect(await page.evaluate(() => matchMedia('screen').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('print').matches)).toBe(true);
    await page.emulateMedia({ media: '' });
    expect(await page.evaluate(() => matchMedia('screen').matches)).toBe(true);
    expect(await page.evaluate(() => matchMedia('print').matches)).toBe(false);
  });
  it('should throw in case of bad type argument', async({page, server}) => {
    let error = null;
    await page.emulateMedia({ media: 'bad' }).catch(e => error = e);
    expect(error.message).toBe('Unsupported media: bad');
  });
});

describe('Page.emulateMedia colorScheme', function() {
  it('should work', async({page, server}) => {
    await page.emulateMedia({ colorScheme: 'light' });
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(true);
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: no-preference)').matches)).toBe(false);
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: no-preference)').matches)).toBe(false);
    if (!WEBKIT) {
      // WebKit will always provide the value.
      await page.emulateMedia({ colorScheme: 'no-preference' });
      expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
      expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(false);
      expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: no-preference)').matches)).toBe(true);
    }
  });
  it('should default to light', async({page, server}) => {
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(true);
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: no-preference)').matches)).toBe(false);

    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: no-preference)').matches)).toBe(false);

    await page.emulateMedia({ colorScheme: null });
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(true);
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: no-preference)').matches)).toBe(false);
  });
  it('should throw in case of bad argument', async({page, server}) => {
    let error = null;
    await page.emulateMedia({ colorScheme: 'bad' }).catch(e => error = e);
    expect(error.message).toBe('Unsupported color scheme: bad');
  });
  it('should work during navigation', async({page, server}) => {
    await page.emulateMedia({ colorScheme: 'light' });
    const navigated = page.goto(server.EMPTY_PAGE);
    for (let i = 0; i < 9; i++) {
      await Promise.all([
        page.emulateMedia({ colorScheme: ['dark', 'light'][i & 1] }),
        new Promise(f => setTimeout(f, 1)),
      ]);
    }
    await navigated;
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
  });
  it('should work in popup', async({browser, server}) => {
    {
      const context = await browser.newContext({ colorScheme: 'dark' });
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.evaluate(url => { window.open(url); }, server.EMPTY_PAGE),
      ]);
      expect(await popup.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(false);
      expect(await popup.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
      await context.close();
    }
    {
      const page = await browser.newPage({ colorScheme: 'light' });
      await page.goto(server.EMPTY_PAGE);
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.evaluate(url => { window.open(url); }, server.EMPTY_PAGE),
      ]);
      expect(await popup.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(true);
      expect(await popup.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
      await page.close();
    }
  });
  it('should work in cross-process iframe', async({browser, server}) => {
    const page = await browser.newPage({ colorScheme: 'dark' });
    await page.goto(server.EMPTY_PAGE);
    await utils.attachFrame(page, 'frame1', server.CROSS_PROCESS_PREFIX + '/empty.html');
    const frame = page.frames()[1];
    expect(await frame.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
    await page.close();
  });
});

describe('BrowserContext({timezoneId})', function() {
  it('should work', async ({ browser }) => {
    const func = () => new Date(1479579154987).toString();
    {
      const context = await browser.newContext({ timezoneId: 'America/Jamaica' });
      const page = await context.newPage();
      expect(await page.evaluate(func)).toBe('Sat Nov 19 2016 13:12:34 GMT-0500 (Eastern Standard Time)');
      await context.close();
    }
    {
      const context = await browser.newContext({ timezoneId: 'Pacific/Honolulu' });
      const page = await context.newPage();
      expect(await page.evaluate(func)).toBe('Sat Nov 19 2016 08:12:34 GMT-1000 (Hawaii-Aleutian Standard Time)');
      await context.close();
    }
    {
      const context = await browser.newContext({ timezoneId: 'America/Buenos_Aires' });
      const page = await context.newPage();
      expect(await page.evaluate(func)).toBe('Sat Nov 19 2016 15:12:34 GMT-0300 (Argentina Standard Time)');
      await context.close();
    }
    {
      const context = await browser.newContext({ timezoneId: 'Europe/Berlin' });
      const page = await context.newPage();
      expect(await page.evaluate(func)).toBe('Sat Nov 19 2016 19:12:34 GMT+0100 (Central European Standard Time)');
      await context.close();
    }
  });

  it('should throw for invalid timezone IDs when creating pages', async({browser}) => {
    for (const timezoneId of ['Foo/Bar', 'Baz/Qux']) {
      let error = null;
      const context = await browser.newContext({ timezoneId });
      const page = await context.newPage().catch(e => error = e);
      expect(error.message).toBe(`Invalid timezone ID: ${timezoneId}`);
      await context.close();
    }
  });
  it('should work for multiple pages sharing same process', async({browser, server}) => {
    const context = await browser.newContext({ timezoneId: 'Europe/Moscow' });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    let [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(url => { window.open(url); }, server.EMPTY_PAGE),
    ]);
    [popup] = await Promise.all([
      popup.waitForEvent('popup'),
      popup.evaluate(url => { window.open(url); }, server.EMPTY_PAGE),
    ]);
    await context.close();
  });
});

describe('BrowserContext({locale})', function() {
  it('should affect accept-language header', async({browser, server}) => {
    const context = await browser.newContext({ locale: 'fr-CH' });
    const page = await context.newPage();
    const [request] = await Promise.all([
      server.waitForRequest('/empty.html'),
      page.goto(server.EMPTY_PAGE),
    ]);
    expect(request.headers['accept-language'].substr(0, 5)).toBe('fr-CH');
    await context.close();
  });
  it('should affect navigator.language', async({browser, server}) => {
    const context = await browser.newContext({ locale: 'fr-CH' });
    const page = await context.newPage();
    expect(await page.evaluate(() => navigator.language)).toBe('fr-CH');
    await context.close();
  });
  it('should format number', async({browser, server}) => {
    {
      const context = await browser.newContext({ locale: 'en-US' });
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      expect(await page.evaluate(() => (1000000.50).toLocaleString())).toBe('1,000,000.5');
      await context.close();
    }
    {
      const context = await browser.newContext({ locale: 'fr-CH' });
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      expect(await page.evaluate(() => (1000000.50).toLocaleString().replace(/\s/g, ' '))).toBe('1 000 000,5');
      await context.close();
    }
  });
  it('should format date', async({browser, server}) => {
    {
      const context = await browser.newContext({ locale: 'en-US', timezoneId: 'America/Los_Angeles' });
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const formatted = 'Sat Nov 19 2016 10:12:34 GMT-0800 (Pacific Standard Time)';
      expect(await page.evaluate(() => new Date(1479579154987).toString())).toBe(formatted);
      await context.close();
    }
    {
      const context = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      expect(await page.evaluate(() => new Date(1479579154987).toString())).toBe(
          'Sat Nov 19 2016 19:12:34 GMT+0100 (Mitteleuropäische Normalzeit)');
      await context.close();
    }
  });
  it('should format number in popups', async({browser, server}) => {
    const context = await browser.newContext({ locale: 'fr-CH' });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(url => window._popup = window.open(url), server.PREFIX + '/formatted-number.html'),
    ]);
    await popup.waitForLoadState('domcontentloaded');
    const result = await popup.evaluate(() => window.result);
    expect(result).toBe('1 000 000,5');
    await context.close();
  });
  it('should affect navigator.language in popups', async({browser, server}) => {
    const context = await browser.newContext({ locale: 'fr-CH' });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(url => window._popup = window.open(url), server.PREFIX + '/formatted-number.html'),
    ]);
    await popup.waitForLoadState('domcontentloaded');
    const result = await popup.evaluate(() => window.initialNavigatorLanguage);
    expect(result).toBe('fr-CH');
    await context.close();
  });
  it('should work for multiple pages sharing same process', async({browser, server}) => {
    const context = await browser.newContext({ locale: 'ru-RU' });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    let [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(url => { window.open(url); }, server.EMPTY_PAGE),
    ]);
    [popup] = await Promise.all([
      popup.waitForEvent('popup'),
      popup.evaluate(url => { window.open(url); }, server.EMPTY_PAGE),
    ]);
    await context.close();
  });
  it('should be isolated between contexts', async({browser, server}) => {
    const context1 = await browser.newContext({ locale: 'en-US' });
    const promises = [];
    // By default firefox limits number of child web processes to 8.
    for (let i = 0; i< 8; i++)
      promises.push(context1.newPage());
    await Promise.all(promises);

    const context2 = await browser.newContext({ locale: 'ru-RU' });
    const page2 = await context2.newPage();

    const localeNumber = () => (1000000.50).toLocaleString();
    const numbers = await Promise.all(context1.pages().map(page => page.evaluate(localeNumber)));

    numbers.forEach(value => expect(value).toBe('1,000,000.5'));
    expect(await page2.evaluate(localeNumber)).toBe('1 000 000,5');

    await Promise.all([
      context1.close(),
      context2.close()
    ]);
  });
});

describe('focus', function() {
  it('should think that it is focused by default', async({page}) => {
    expect(await page.evaluate('document.hasFocus()')).toBe(true);
  });
  it('should think that all pages are focused', async({page}) => {
    const page2 = await page.context().newPage();
    expect(await page.evaluate('document.hasFocus()')).toBe(true);
    expect(await page2.evaluate('document.hasFocus()')).toBe(true);
    await page2.close();
  });
  it('should focus popups by default', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(url => { window.open(url); }, server.EMPTY_PAGE),
    ]);
    expect(await popup.evaluate('document.hasFocus()')).toBe(true);
    expect(await page.evaluate('document.hasFocus()')).toBe(true);
  });
  it('should provide target for keyboard events', async({page, server}) => {
    const page2 = await page.context().newPage();
    await Promise.all([
      page.goto(server.PREFIX + '/input/textarea.html'),
      page2.goto(server.PREFIX + '/input/textarea.html'),
    ]);
    await Promise.all([
      page.focus('input'),
      page2.focus('input'),
    ]);
    const text = 'first';
    const text2 = 'second';
    await Promise.all([
      page.keyboard.type(text),
      page2.keyboard.type(text2),
    ]);
    const results = await Promise.all([
      page.evaluate('result'),
      page2.evaluate('result'),
    ]);
    expect(results).toEqual([text, text2]);
  });
  it('should not affect mouse event target page', async({page, server}) => {
    const page2 = await page.context().newPage();
    function clickCounter() {
      document.onclick = () => window.clickCount  = (window.clickCount || 0) + 1;
    }
    await Promise.all([
      page.evaluate(clickCounter),
      page2.evaluate(clickCounter),
      page.focus('body'),
      page2.focus('body'),
    ]);
    await Promise.all([
      page.mouse.click(1, 1),
      page2.mouse.click(1, 1),
    ]);
    const counters = await Promise.all([
      page.evaluate('window.clickCount'),
      page2.evaluate('window.clickCount'),
    ]);
    expect(counters ).toEqual([1,1]);
  });
  it('should change document.activeElement', async({page, server}) => {
    const page2 = await page.context().newPage();
    await Promise.all([
      page.goto(server.PREFIX + '/input/textarea.html'),
      page2.goto(server.PREFIX + '/input/textarea.html'),
    ]);
    await Promise.all([
      page.focus('input'),
      page2.focus('textarea'),
    ]);
    const active = await Promise.all([
      page.evaluate('document.activeElement.tagName'),
      page2.evaluate('document.activeElement.tagName'),
    ]);
    expect(active).toEqual(['INPUT', 'TEXTAREA']);
  });
  it('should not affect screenshots', async({page, server, golden}) => {
    const page2 = await page.context().newPage();
    await Promise.all([
      page.setViewportSize({width: 500, height: 500}),
      page.goto(server.PREFIX + '/grid.html'),
      page2.setViewportSize({width: 50, height: 50}),
      page2.goto(server.PREFIX + '/grid.html'),
    ]);
    await Promise.all([
      page.focus('body'),
      page2.focus('body'),
    ]);
    const screenshots = await Promise.all([
      page.screenshot(),
      page2.screenshot(),
    ]);
    expect(screenshots[0]).toBeGolden(golden('screenshot-sanity.png'));
    expect(screenshots[1]).toBeGolden(golden('grid-cell-0.png'));
  });
  it('should change focused iframe', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const [frame1, frame2] = await Promise.all([
      utils.attachFrame(page, 'frame1', server.PREFIX + '/input/textarea.html'),
      utils.attachFrame(page, 'frame2', server.PREFIX + '/input/textarea.html'),
    ]);
    function logger() {
      self._events = [];
      const element = document.querySelector('input');
      element.onfocus = element.onblur = (e) => self._events.push(e.type);
    }
    await Promise.all([
      frame1.evaluate(logger),
      frame2.evaluate(logger),
    ]);
    const focused = await Promise.all([
      frame1.evaluate('document.hasFocus()'),
      frame2.evaluate('document.hasFocus()'),
    ]);
    expect(focused).toEqual([false, false]);
    {
      await frame1.focus('input');
      const events = await Promise.all([
        frame1.evaluate('self._events'),
        frame2.evaluate('self._events'),
      ]);
      expect(events).toEqual([['focus'], []]);
      const focused = await Promise.all([
        frame1.evaluate('document.hasFocus()'),
        frame2.evaluate('document.hasFocus()'),
      ]);
      expect(focused).toEqual([true, false]);
    }
    {
      await frame2.focus('input');
      const events = await Promise.all([
        frame1.evaluate('self._events'),
        frame2.evaluate('self._events'),
      ]);
      expect(events).toEqual([['focus', 'blur'], ['focus']]);
      const focused = await Promise.all([
        frame1.evaluate('document.hasFocus()'),
        frame2.evaluate('document.hasFocus()'),
      ]);
      expect(focused).toEqual([false, true]);
    }
  });

});
