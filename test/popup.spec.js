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

module.exports.describe = function({testRunner, expect, playwright, CHROMIUM, WEBKIT, FFOX}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('window.open', function() {
    it.skip(CHROMIUM || WEBKIT)('should inherit user agent from browser context', async function({browser, server}) {
      const context = await browser.newContext({
        userAgent: 'hey'
      });
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const requestPromise = server.waitForRequest('/dummy.html');
      const userAgent = await page.evaluate(url => {
        const win = window.open(url);
        return win.navigator.userAgent;
      }, server.PREFIX + '/dummy.html');
      const request = await requestPromise;
      await context.close();
      expect(userAgent).toBe('hey');
      expect(request.headers['user-agent']).toBe('hey');
    });
    it.skip(CHROMIUM)('should inherit touch support from browser context', async function({browser, server}) {
      const context = await browser.newContext({
        viewport: { width: 400, height: 500, isMobile: true }
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
    it.skip(CHROMIUM || WEBKIT)('should inherit viewport size from browser context', async function({browser, server}) {
      const context = await browser.newContext({
        viewport: { width: 400, height: 500, isMobile: true }
      });
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const size = await page.evaluate(() => {
        const win = window.open('about:blank');
        return { width: win.innerWidth, height: win.innerHeight };
      });
      await context.close();
      expect(size).toEqual({width: 400, height: 500});
    });
  });

  describe('Page.Events.Popup', function() {
    it('should work', async({browser}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const [popup] = await Promise.all([
        new Promise(x => page.once('popup', x)),
        page.evaluate(() => window.__popup = window.open('about:blank')),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(true);
      await context.close();
    });
    it.skip(CHROMIUM)('should work with empty url', async({browser}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const [popup] = await Promise.all([
        new Promise(x => page.once('popup', x)),
        page.evaluate(() => window.__popup = window.open('')),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(true);
      await context.close();
    });
    it('should work with noopener', async({browser}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const [popup] = await Promise.all([
        new Promise(x => page.once('popup', x)),
        page.evaluate(() => window.__popup = window.open('about:blank', null, 'noopener')),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(false);
      await context.close();
    });
    it('should work with clicking target=_blank', async({browser, server}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      await page.setContent('<a target=_blank rel="opener" href="/one-style.html">yo</a>');
      const [popup] = await Promise.all([
        page.waitForEvent('popup').then(async popup => { await popup.waitForLoadState(); return popup; }),
        page.click('a'),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(true);
      await context.close();
    });
    it('should work with fake-clicking target=_blank and rel=noopener', async({browser, server}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      // TODO: FFOX sends events for "one-style.html" request to both pages.
      await page.goto(server.EMPTY_PAGE);
      await page.setContent('<a target=_blank rel=noopener href="/one-style.html">yo</a>');
      const [popup] = await Promise.all([
        page.waitForEvent('popup').then(async popup => { await popup.waitForLoadState(); return popup; }),
        page.$eval('a', a => a.click()),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      // TODO: At this point popup might still have about:blank as the current document.
      // FFOX is slow enough to trigger this. We should do something about popups api.
      expect(await popup.evaluate(() => !!window.opener)).toBe(false);
      await context.close();
    });
    it('should work with clicking target=_blank and rel=noopener', async({browser, server}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      await page.setContent('<a target=_blank rel=noopener href="/one-style.html">yo</a>');
      const [popup] = await Promise.all([
        page.waitForEvent('popup').then(async popup => { await popup.waitForLoadState(); return popup; }),
        page.click('a'),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(false);
      await context.close();
    });
    it('should not treat navigations as new popups', async({browser, server}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      await page.setContent('<a target=_blank rel=noopener href="/one-style.html">yo</a>');
      const [popup] = await Promise.all([
        page.waitForEvent('popup').then(async popup => { await popup.waitForLoadState(); return popup; }),
        page.click('a'),
      ]);
      let badSecondPopup = false;
      page.on('popup', () => badSecondPopup = true);
      await popup.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
      await context.close();
      expect(badSecondPopup).toBe(false);
    });
  });

};
