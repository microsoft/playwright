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

/**
 * @type {PageTestSuite}
 */
module.exports.describe = function({testRunner, expect, playwright, headless, FFOX, CHROMIUM, WEBKIT, MAC, WIN}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;
  const iPhone = playwright.devices['iPhone 6'];
  const iPhoneLandscape = playwright.devices['iPhone 6 landscape'];

  describe('Page.viewport', function() {
    it('should get the proper viewport size', async({page, server}) => {
      expect(page.viewportSize()).toEqual({width: 800, height: 600});
      await page.setViewportSize({width: 123, height: 456});
      expect(page.viewportSize()).toEqual({width: 123, height: 456});
    });
    it('should support mobile emulation', async({newContext, server}) => {
      const context = await newContext({ viewport: iPhone.viewport });
      const page = await context.newPage();
      await page.goto(server.PREFIX + '/mobile.html');
      expect(await page.evaluate(() => window.innerWidth)).toBe(375);
      await page.setViewportSize({width: 400, height: 300});
      expect(await page.evaluate(() => window.innerWidth)).toBe(400);
    });
    it('should not have touch by default', async({page, server}) => {
      await page.goto(server.PREFIX + '/mobile.html');
      expect(await page.evaluate(() => 'ontouchstart' in window)).toBe(false);
      await page.goto(server.PREFIX + '/detect-touch.html');
      expect(await page.evaluate(() => document.body.textContent.trim())).toBe('NO');
    });
    it('should support touch emulation', async({newContext, server}) => {
      const context = await newContext({ viewport: iPhone.viewport });
      const page = await context.newPage();
      await page.goto(server.PREFIX + '/mobile.html');
      expect(await page.evaluate(() => 'ontouchstart' in window)).toBe(true);
      expect(await page.evaluate(dispatchTouch)).toBe('Received touch');

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
    it('should be detectable by Modernizr', async({newContext, server}) => {
      const context = await newContext({ viewport: iPhone.viewport });
      const page = await context.newPage();
      await page.goto(server.PREFIX + '/detect-touch.html');
      expect(await page.evaluate(() => document.body.textContent.trim())).toBe('YES');
    });
    it('should detect touch when applying viewport with touches', async({newContext, server}) => {
      const context = await newContext({ viewport: { width: 800, height: 600, isMobile: true } });
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      await page.addScriptTag({url: server.PREFIX + '/modernizr.js'});
      expect(await page.evaluate(() => Modernizr.touchevents)).toBe(true);
    });
    it.skip(FFOX)('should support landscape emulation', async({newContext, server}) => {
      const context1 = await newContext({ viewport: iPhone.viewport });
      const page1 = await context1.newPage();
      await page1.goto(server.PREFIX + '/mobile.html');
      expect(await page1.evaluate(() => matchMedia('(orientation: landscape)').matches)).toBe(false);
      const context2 = await newContext({ viewport: iPhoneLandscape.viewport });
      const page2 = await context2.newPage();
      expect(await page2.evaluate(() => matchMedia('(orientation: landscape)').matches)).toBe(true);
    });
    it.skip(FFOX || WEBKIT)('should fire orientationchange event', async({newContext, server}) => {
      const context = await newContext({ viewport: { width: 300, height: 400, isMobile: true } });
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
    });
    it.skip(FFOX)('default mobile viewports to 980 width', async({newContext, server}) => {
      const context = await newContext({ viewport: {width: 320, height: 480, isMobile: true} });
      const page = await context.newPage();
      await page.goto(server.PREFIX + '/empty.html');
      expect(await page.evaluate(() => window.innerWidth)).toBe(980);
    });
    it.skip(FFOX)('respect meta viewport tag', async({newContext, server}) => {
      const context = await newContext({ viewport: {width: 320, height: 480, isMobile: true} });
      const page = await context.newPage();
      await page.goto(server.PREFIX + '/mobile.html');
      expect(await page.evaluate(() => window.innerWidth)).toBe(320);
    });
  });

  describe('Page.emulate', function() {
    it('should work', async({newPage, server}) => {
      const page = await newPage({ viewport: iPhone.viewport, userAgent: iPhone.userAgent });
      await page.goto(server.PREFIX + '/mobile.html');
      expect(await page.evaluate(() => window.innerWidth)).toBe(375);
      expect(await page.evaluate(() => navigator.userAgent)).toContain('iPhone');
    });
    it('should support clicking', async({newPage, server}) => {
      const page = await newPage({ viewport: iPhone.viewport, userAgent: iPhone.userAgent });
      await page.goto(server.PREFIX + '/input/button.html');
      const button = await page.$('button');
      await page.evaluate(button => button.style.marginTop = '200px', button);
      await button.click();
      expect(await page.evaluate(() => result)).toBe('Clicked');
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
    it('should throw in case of bad argument', async({page, server}) => {
      let error = null;
      await page.emulateMedia({ colorScheme: 'bad' }).catch(e => error = e);
      expect(error.message).toBe('Unsupported color scheme: bad');
    });
    it.skip(FFOX)('should work during navigation', async({page, server}) => {
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
  });

  describe.skip(FFOX)('BrowserContext({timezoneId})', function() {
    it('should work', async ({ newPage }) => {
      const func = () => new Date(1479579154987).toString();
      {
        const page = await newPage({ timezoneId: 'America/Jamaica' });
        expect(await page.evaluate(func)).toBe('Sat Nov 19 2016 13:12:34 GMT-0500 (Eastern Standard Time)');
      }
      {
        const page = await newPage({ timezoneId: 'Pacific/Honolulu' });
        expect(await page.evaluate(func)).toBe('Sat Nov 19 2016 08:12:34 GMT-1000 (Hawaii-Aleutian Standard Time)');
      }
      {
        const page = await newPage({ timezoneId: 'America/Buenos_Aires' });
        expect(await page.evaluate(func)).toBe('Sat Nov 19 2016 15:12:34 GMT-0300 (Argentina Standard Time)');
      }
      {
        const page = await newPage({ timezoneId: 'Europe/Berlin' });
        expect(await page.evaluate(func)).toBe('Sat Nov 19 2016 19:12:34 GMT+0100 (Central European Standard Time)');
      }
    });

    it('should throw for invalid timezone IDs', async({newPage}) => {
      let error = null;
      await newPage({ timezoneId: 'Foo/Bar' }).catch(e => error = e);
      expect(error.message).toBe('Invalid timezone ID: Foo/Bar');
      await newPage({ timezoneId: 'Baz/Qux' }).catch(e => error = e);
      expect(error.message).toBe('Invalid timezone ID: Baz/Qux');
    });
  });

  describe.skip(CHROMIUM || FFOX)('BrowserContext({locale})', function() {
    it('should affect accept-language header', async({newPage, server}) => {
      const page = await newPage({ locale: 'fr-CH' });
      const [request] = await Promise.all([
        server.waitForRequest('/empty.html'),
        page.goto(server.EMPTY_PAGE),
      ]);
      expect(request.headers['accept-language'].substr(0, 5)).toBe('fr-CH');
    });
    it('should affect navigator.language', async({newPage, server}) => {
      const page = await newPage({ locale: 'fr-CH' });
      expect(await page.evaluate(() => navigator.language)).toBe('fr-CH');
    });
    it('should format number', async({newPage, server}) => {
      {
        const page = await newPage({ locale: 'en-US' });
        await page.goto(server.EMPTY_PAGE);
        expect(await page.evaluate(() => (1000000.50).toLocaleString())).toBe('1,000,000.5');
      }
      {
        const page = await newPage({ locale: 'fr-CH' });
        await page.goto(server.EMPTY_PAGE);
        expect(await page.evaluate(() => (1000000.50).toLocaleString().replace(/\s/g, ' '))).toBe('1 000 000,5');
      }
    });
    it('should format date', async({newPage, server}) => {
      {
        const page = await newPage({ locale: 'en-US', timezoneId: 'America/Los_Angeles' });
        await page.goto(server.EMPTY_PAGE);
        const formatted = 'Sat Nov 19 2016 10:12:34 GMT-0800 (Pacific Standard Time)';
        expect(await page.evaluate(() => new Date(1479579154987).toString())).toBe(formatted);
      }
      {
        const page = await newPage({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
        await page.goto(server.EMPTY_PAGE);
        expect(await page.evaluate(() => new Date(1479579154987).toString())).toBe(
            'Sat Nov 19 2016 19:12:34 GMT+0100 (Mitteleuropäische Normalzeit)');
      }
    });
  });

  describe('focus', function() {
    it.skip(!headless)('should think that it is focused by default', async({page}) => {
      expect(await page.evaluate('document.hasFocus()')).toBe(true);
    });
  });
};
