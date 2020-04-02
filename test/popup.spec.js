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

  describe('Link navigation', function() {
    it.browser('should inherit user agent from browser context', async function({browser, server}) {
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
      const userAgent = await popup.evaluate(() => window.initialUserAgent);
      const request = await requestPromise;
      await context.close();
      expect(userAgent).toBe('hey');
      expect(request.headers['user-agent']).toBe('hey');
    });
    it.context('should respect routes from browser context', async function({context, server}) {
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      await page.setContent('<a target=_blank rel=noopener href="empty.html">link</a>');
      let intercepted = false;
      await context.route('**/empty.html', route => {
        route.continue();
        intercepted = true;
      });
      await Promise.all([
        context.waitForEvent('page'),
        page.click('a'),
      ]);
      expect(intercepted).toBe(true);
    });
  });

  describe('window.open', function() {
    it.browser('should inherit user agent from browser context', async function({browser, server}) {
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
    it.browser('should inherit extra headers from browser context', async function({browser, server}) {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'foo': 'bar' },
      });
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const requestPromise = server.waitForRequest('/dummy.html');
      await page.evaluate(url => window._popup = window.open(url), server.PREFIX + '/dummy.html');
      const request = await requestPromise;
      await context.close();
      expect(request.headers['foo']).toBe('bar');
    });
    it('should inherit offline from browser context', async function({page, context, server}) {
      await page.goto(server.EMPTY_PAGE);
      await context.setOffline(true);
      const online = await page.evaluate(url => {
        const win = window.open(url);
        return win.navigator.onLine;
      }, server.PREFIX + '/dummy.html');
      expect(online).toBe(false);
    });
    it.browser('should inherit http credentials from browser context', async function({browser, server}) {
      server.setAuth('/title.html', 'user', 'pass');
      const context = await browser.newContext({
        httpCredentials: { username: 'user', password: 'pass' }
      });
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.evaluate(url => window._popup = window.open(url), server.PREFIX + '/title.html'),
      ]);
      await popup.waitForLoadState('domcontentloaded');
      expect(await popup.title()).toBe('Woof-Woof');
      await context.close();
    });
    it.browser('should inherit touch support from browser context', async function({browser, server}) {
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
    it.browser('should inherit viewport size from browser context', async function({browser, server}) {
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
      expect(size).toEqual({width: 400, height: 500});
    });
    it('should respect routes from browser context', async function({page, context, server}) {
      await page.goto(server.EMPTY_PAGE);
      let intercepted = false;
      await context.route('**/empty.html', route => {
        route.continue();
        intercepted = true;
      });
      await Promise.all([
        page.waitForEvent('popup'),
        page.evaluate(url => window.__popup = window.open(url), server.EMPTY_PAGE),
      ]);
      expect(intercepted).toBe(true);
    });
    it.context('should apply addInitScript from browser context', async function({context, server}) {
      await context.addInitScript(() => window.injected = 123);
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const injected = await page.evaluate(() => {
        const win = window.open('about:blank');
        return win.injected;
      });
      expect(injected).toBe(123);
    });
    it.context('should expose function from browser context', async function({context, server}) {
      await context.exposeFunction('add', (a, b) => a + b);
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const added = await page.evaluate(async () => {
        const win = window.open('about:blank');
        return win.add(9, 4);
      });
      expect(added).toBe(13);
    });
  });

  describe('Page.Events.Popup', function() {
    it('should work', async({page}) => {
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.evaluate(() => window.__popup = window.open('about:blank')),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(true);
    });
    it.fail(FFOX)('should work with window features', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.evaluate(() => window.__popup = window.open(window.location.href, 'Title', 'toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=780,height=200,top=0,left=0')),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(true);
    });
    it('should emit for immediately closed popups', async({page}) => {
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.evaluate(() => {
          const win = window.open('about:blank');
          win.close();
        }),
      ]);
      expect(popup).toBeTruthy();
    });
    it('should be able to capture alert', async({page}) => {
      const evaluatePromise = page.evaluate(() => {
        const win = window.open('');
        win.alert('hello');
      });
      const popup = await page.waitForEvent('popup');
      const dialog = await popup.waitForEvent('dialog');
      expect(dialog.message()).toBe('hello');
      await dialog.dismiss();
      await evaluatePromise;
    });
    it('should work with empty url', async({page}) => {
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.evaluate(() => window.__popup = window.open('')),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(true);
    });
    it('should work with noopener and no url', async({page}) => {
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.evaluate(() => window.__popup = window.open(undefined, null, 'noopener')),
      ]);
      expect(popup.url()).toBe('about:blank');
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(false);
    });
    it('should work with noopener and about:blank', async({page}) => {
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.evaluate(() => window.__popup = window.open('about:blank', null, 'noopener')),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(false);
    });
    it('should work with noopener and url', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.evaluate(url => window.__popup = window.open(url, null, 'noopener'), server.EMPTY_PAGE),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(false);
    });
    it('should work with clicking target=_blank', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.setContent('<a target=_blank rel="opener" href="/one-style.html">yo</a>');
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.click('a'),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(true);
    });
    it('should work with fake-clicking target=_blank and rel=noopener', async({page, server}) => {
      // TODO: FFOX sends events for "one-style.html" request to both pages.
      await page.goto(server.EMPTY_PAGE);
      await page.setContent('<a target=_blank rel=noopener href="/one-style.html">yo</a>');
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.$eval('a', a => a.click()),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(false);
    });
    it('should work with clicking target=_blank and rel=noopener', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.setContent('<a target=_blank rel=noopener href="/one-style.html">yo</a>');
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.click('a'),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(false);
    });
    it('should not treat navigations as new popups', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.setContent('<a target=_blank rel=noopener href="/one-style.html">yo</a>');
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.click('a'),
      ]);
      let badSecondPopup = false;
      page.on('popup', () => badSecondPopup = true);
      await popup.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
      expect(badSecondPopup).toBe(false);
    });
  });

};
