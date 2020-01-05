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

module.exports.describe = function({testRunner, expect, playwright, FFOX, CHROME, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;
  const iPhone = playwright.devices['iPhone 6'];
  const iPhoneLandscape = playwright.devices['iPhone 6 landscape'];

  describe('Page.viewport', function() {
    it('should get the proper viewport size', async({page, server}) => {
      expect(page.viewport()).toEqual({width: 800, height: 600});
      await page.setViewport({width: 123, height: 456});
      expect(page.viewport()).toEqual({width: 123, height: 456});
    });
    it.skip(WEBKIT)('should support mobile emulation', async({page, server}) => {
      await page.goto(server.PREFIX + '/mobile.html');
      expect(await page.evaluate(() => window.innerWidth)).toBe(800);
      await page.setViewport(iPhone.viewport);
      expect(await page.evaluate(() => window.innerWidth)).toBe(375);
      await page.setViewport({width: 400, height: 300});
      expect(await page.evaluate(() => window.innerWidth)).toBe(400);
    });
    it.skip(WEBKIT)('should support touch emulation', async({page, server}) => {
      await page.goto(server.PREFIX + '/mobile.html');
      expect(await page.evaluate(() => 'ontouchstart' in window)).toBe(false);
      await page.setViewport(iPhone.viewport);
      expect(await page.evaluate(() => 'ontouchstart' in window)).toBe(true);
      expect(await page.evaluate(dispatchTouch)).toBe('Received touch');
      await page.setViewport({width: 100, height: 100});
      expect(await page.evaluate(() => 'ontouchstart' in window)).toBe(false);

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
    it.skip(WEBKIT)('should be detectable by Modernizr', async({page, server}) => {
      await page.goto(server.PREFIX + '/detect-touch.html');
      expect(await page.evaluate(() => document.body.textContent.trim())).toBe('NO');
      await page.setViewport(iPhone.viewport);
      await page.goto(server.PREFIX + '/detect-touch.html');
      expect(await page.evaluate(() => document.body.textContent.trim())).toBe('YES');
    });
    it.skip(WEBKIT)('should detect touch when applying viewport with touches', async({page, server}) => {
      await page.setViewport({ width: 800, height: 600, hasTouch: true });
      await page.addScriptTag({url: server.PREFIX + '/modernizr.js'});
      expect(await page.evaluate(() => Modernizr.touchevents)).toBe(true);
    });
    it.skip(FFOX || WEBKIT)('should support landscape emulation', async({page, server}) => {
      await page.goto(server.PREFIX + '/mobile.html');
      expect(await page.evaluate(() => screen.orientation.type)).toBe('portrait-primary');
      await page.setViewport(iPhoneLandscape.viewport);
      expect(await page.evaluate(() => screen.orientation.type)).toBe('landscape-primary');
      await page.setViewport({width: 100, height: 100});
      expect(await page.evaluate(() => screen.orientation.type)).toBe('portrait-primary');
    });
    it.skip(FFOX || WEBKIT)('should fire orientationchange event', async({page, server}) => {
      await page.goto(server.PREFIX + '/mobile.html');
      await page.setViewport(iPhone.viewport);
      await page.evaluate(() => {
        window.counter = 0;
        window.addEventListener('orientationchange', () => console.log(++window.counter));
      });

      const event1 = page.waitForEvent('console');
      await page.setViewport(iPhoneLandscape.viewport);
      expect((await event1).text()).toBe('1');

      const event2 = page.waitForEvent('console');
      await page.setViewport(iPhone.viewport);
      expect((await event2).text()).toBe('2');
    });
  });

  describe('Page.emulate', function() {
    it.skip(WEBKIT)('should work', async({newPage, server}) => {
      const page = await newPage({ viewport: iPhone.viewport, userAgent: iPhone.userAgent });
      await page.goto(server.PREFIX + '/mobile.html');
      expect(await page.evaluate(() => window.innerWidth)).toBe(375);
      expect(await page.evaluate(() => navigator.userAgent)).toContain('iPhone');
    });
    it.skip(WEBKIT)('should support clicking', async({newPage, server}) => {
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
  });

  describe.skip(FFOX || WEBKIT)('BrowserContext({timezoneId})', function() {
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

};
