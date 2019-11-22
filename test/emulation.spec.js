/**
 * Copyright 2018 Google Inc. All rights reserved.
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

module.exports.addTests = function({testRunner, expect, playwright, FFOX, CHROME, WEBKIT}) {
  let {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;
  describe = fdescribe;
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
  });

  describe('Page.emulate', function() {
    it.skip(WEBKIT)('should work', async({page, server}) => {
      await page.goto(server.PREFIX + '/mobile.html');
      await page.emulate(iPhone);
      expect(await page.evaluate(() => window.innerWidth)).toBe(375);
      expect(await page.evaluate(() => navigator.userAgent)).toContain('iPhone');
    });
    it('should support clicking', async({page, server}) => {
      await page.emulate(iPhone);
      await page.goto(server.PREFIX + '/input/button.html');
      const button = await page.$('button');
      await page.evaluate(button => button.style.marginTop = '200px', button);
      await button.click();
      expect(await page.evaluate(() => result)).toBe('Clicked');
    });
  });

  describe.skip(WEBKIT)('Page.emulateMedia type', function() {
    it('should work', async({page, server}) => {
      expect(await page.evaluate(() => matchMedia('screen').matches)).toBe(true);
      expect(await page.evaluate(() => matchMedia('print').matches)).toBe(false);
      await page.emulateMedia({ type: 'print' });
      expect(await page.evaluate(() => matchMedia('screen').matches)).toBe(false);
      expect(await page.evaluate(() => matchMedia('print').matches)).toBe(true);
      await page.emulateMedia({});
      expect(await page.evaluate(() => matchMedia('screen').matches)).toBe(true);
      expect(await page.evaluate(() => matchMedia('print').matches)).toBe(false);
    });
    it('should throw in case of bad type argument', async({page, server}) => {
      let error = null;
      await page.emulateMedia({ type: 'bad' }).catch(e => error = e);
      expect(error.message).toBe('Unsupported media type: bad');
    });
  });

  describe.skip(FFOX || WEBKIT)('Page.emulateMedia features', function() {
    it('should work', async({page, server}) => {
      await page.emulateMedia({ features: [
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ] });
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: no-preference)').matches)).toBe(false);
      await page.emulateMedia({ features: [
        { name: 'prefers-color-scheme', value: 'light' },
      ] });
      expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(true);
      expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
      expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: no-preference)').matches)).toBe(false);
      await page.emulateMedia({ features: [
        { name: 'prefers-color-scheme', value: 'dark' },
      ] });
      expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
      expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(false);
      expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: no-preference)').matches)).toBe(false);
      await page.emulateMedia({ features: [
        { name: 'prefers-reduced-motion', value: 'reduce' },
        { name: 'prefers-color-scheme', value: 'light' },
      ] });
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: no-preference)').matches)).toBe(false);
      expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(true);
      expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
      expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: no-preference)').matches)).toBe(false);
    });
    it('should throw in case of bad argument', async({page, server}) => {
      let error = null;
      await page.emulateMedia({ features: [{ name: 'bad', value: '' }] }).catch(e => error = e);
      expect(error.message).toBe('Unsupported media feature: bad');
    });
  });

  describe.skip(FFOX || WEBKIT)('Page.emulateTimezone', function() {
    it('should work', async({page, server}) => {
      page.evaluate(() => {
        globalThis.date = new Date(1479579154987);
      });
      await page.emulateTimezone('America/Jamaica');
      expect(await page.evaluate(() => date.toString())).toBe('Sat Nov 19 2016 13:12:34 GMT-0500 (Eastern Standard Time)');

      await page.emulateTimezone('Pacific/Honolulu');
      expect(await page.evaluate(() => date.toString())).toBe('Sat Nov 19 2016 08:12:34 GMT-1000 (Hawaii-Aleutian Standard Time)');

      await page.emulateTimezone('America/Buenos_Aires');
      expect(await page.evaluate(() => date.toString())).toBe('Sat Nov 19 2016 15:12:34 GMT-0300 (Argentina Standard Time)');

      await page.emulateTimezone('Europe/Berlin');
      expect(await page.evaluate(() => date.toString())).toBe('Sat Nov 19 2016 19:12:34 GMT+0100 (Central European Standard Time)');
    });

    it('should throw for invalid timezone IDs', async({page, server}) => {
      let error = null;
      await page.emulateTimezone('Foo/Bar').catch(e => error = e);
      expect(error.message).toBe('Invalid timezone ID: Foo/Bar');
      await page.emulateTimezone('Baz/Qux').catch(e => error = e);
      expect(error.message).toBe('Invalid timezone ID: Baz/Qux');
    });
  });

};
