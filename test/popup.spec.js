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
    it.fail(CHROMIUM)('should inherit user agent from browser context', async function({browser, server}) {
      const context = await browser.newContext({
        userAgent: 'hey'
      });
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      await page.setContent('<a target=_blank rel=noopener href="/popup/popup.html">link</a>');
      const requestPromise = server.waitForRequest('/popup/popup.html');
      const [popup] = await Promise.all([
        context.waitForEvent('page').then(pageEvent => pageEvent.page()),
        page.click('a'),
      ]);
      const userAgent = await popup.evaluate(() => window.initialUserAgent);
      const request = await requestPromise;
      await context.close();
      expect(userAgent).toBe('hey');
      expect(request.headers['user-agent']).toBe('hey');
    });
    it.fail(CHROMIUM || FFOX)('should respect routes from browser context', async function({browser, server}) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      await page.setContent('<a target=_blank rel=noopener href="empty.html">link</a>');
      let intercepted = false;
      await context.route('**/empty.html', route => {
        route.continue();
        intercepted = true;
      });
      const [popup] = await Promise.all([
        context.waitForEvent('page').then(pageEvent => pageEvent.page()),
        page.click('a'),
      ]);
      await context.close();
      expect(intercepted).toBe(true);
    });
  });

  describe('window.open', function() {
    it('should inherit user agent from browser context', async function({browser, server}) {
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
    it('should inherit extra headers from browser context', async function({browser, server}) {
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
    it.fail(FFOX)('should inherit offline from browser context', async function({browser, server}) {
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
    it('should inherit http credentials from browser context', async function({browser, server}) {
      server.setAuth('/title.html', 'user', 'pass');
      const context = await browser.newContext({
        httpCredentials: { username: 'user', password: 'pass' }
      });
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const [popup] = await Promise.all([
        page.waitForEvent('popup').then(e => e.page()),
        page.evaluate(url => window._popup = window.open(url), server.PREFIX + '/title.html'),
      ]);
      expect(await popup.title()).toBe('Woof-Woof');
      await context.close();
    });
    it.skip(FFOX)('should inherit touch support from browser context', async function({browser, server}) {
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
    it('should inherit viewport size from browser context', async function({browser, server}) {
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
    it.fail(FFOX)('should respect routes from browser context', async function({browser, server}) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      let intercepted = false;
      await context.route('**/empty.html', route => {
        route.continue();
        intercepted = true;
      });
      await page.evaluate(url => window.__popup = window.open(url), server.EMPTY_PAGE);
      await context.close();
      expect(intercepted).toBe(true);
    });
    it('should apply addInitScript from browser context', async function({browser, server}) {
      const context = await browser.newContext();
      await context.addInitScript(() => window.injected = 123);
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const injected = await page.evaluate(() => {
        const win = window.open('about:blank');
        return win.injected;
      });
      await context.close();
      expect(injected).toBe(123);
    });
    it.fail(FFOX)('should expose function from browser context', async function({browser, server}) {
      const context = await browser.newContext();
      await context.exposeFunction('add', (a, b) => a + b);
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const added = await page.evaluate(async () => {
        const win = window.open('about:blank');
        return win.add(9, 4);
      });
      await context.close();
      expect(added).toBe(13);
    });
  });

  describe('Page.Events.Popup', function() {
    it('should work', async({browser}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const [popup] = await Promise.all([
        page.waitForEvent('popup').then(e => e.page()),
        page.evaluate(() => window.__popup = window.open('about:blank')),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(true);
      await context.close();
    });
    it.fail(FFOX)('should work with window features', async({browser, server}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const [popup] = await Promise.all([
        page.waitForEvent('popup').then(e => e.page()),
        page.evaluate(() => window.__popup = window.open(window.location.href, 'Title', 'toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=780,height=200,top=0,left=0')),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(true);
      await context.close();
    });
    it('should emit for immediately closed popups', async({browser}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const [popupEvent] = await Promise.all([
        page.waitForEvent('popup'),
        page.evaluate(() => {
          const win = window.open('about:blank');
          win.close();
        }),
      ]);
      expect(popupEvent).toBeTruthy();
      await context.close();
    });
    it('should resolve page() after initial navigation', async({browser, server}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      // First popup navigation is about:blank.
      const [popupEvent] = await Promise.all([
        page.waitForEvent('popup'),
        page.evaluate(() => window.popup = window.open('about:blank')),
      ]);
      // Stall the 'load' for second navigation.
      server.setRoute('/one-style.css', (req, res) => {});
      await Promise.all([
        server.waitForRequest('/one-style.css'),
        page.evaluate(url => window.popup.location.href = url, server.PREFIX + '/one-style.html'),
      ]);
      // Second navigation should be committed, but page() should resolve because first navigation is done.
      const popup = await popupEvent.page();
      expect(popup).toBeTruthy();
      await context.close();
    });
    it('should resolve page() after load', async({browser, server}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      // Stall the 'load' by delaying css.
      let cssResponse;
      server.setRoute('/one-style.css', (req, res) => cssResponse = res);
      const [popupEvent] = await Promise.all([
        page.waitForEvent('popup'),
        server.waitForRequest('/one-style.css'),
        page.evaluate(url => window.popup = window.open(url), server.PREFIX + '/one-style.html'),
      ]);
      let resolved = false;
      const popupPromise = popupEvent.page().then(page => { resolved = true; return page; });
      expect(resolved).toBe(false);
      // Round trips!
      for (let i = 0; i < 5; i++)
        await page.evaluate('window');
      expect(resolved).toBe(false);
      cssResponse.end('');
      const popup = await popupPromise;
      expect(resolved).toBe(true);
      expect(popup.url()).toBe(server.PREFIX + '/one-style.html');
      await context.close();
    });
    it('should respect timeout in page()', async({browser, server}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      // Stall the 'load' by delaying css.
      server.setRoute('/one-style.css', (req, res) => {});
      const [popupEvent] = await Promise.all([
        page.waitForEvent('popup'),
        page.evaluate(url => window.popup = window.open(url), server.PREFIX + '/one-style.html'),
      ]);
      const error = await popupEvent.page({ timeout: 1 }).catch(e => e);
      expect(error.message).toBe('waiting for "load" failed: timeout 1ms exceeded');
      await context.close();
    });
    it.fail(FFOX)('should be able to capture alert', async({browser}) => {
      // Firefox:
      // - immediately closes dialog by itself, without protocol call;
      // - waits for Page.addScriptToEvaluateOnNewDocument before resolving page(), which is too late.
      const context = await browser.newContext();
      const page = await context.newPage();
      const evaluatePromise = page.evaluate(() => {
        const win = window.open('about:blank');
        win.alert('hello');
      });
      const popupEvent = await page.waitForEvent('popup');
      const popup = await popupEvent.page();
      const dialog = await popup.waitForEvent('dialog');
      expect(dialog.message()).toBe('hello');
      await dialog.dismiss();
      await evaluatePromise;
      await context.close();
    });
    it.fail(FFOX)('should work with empty url', async({browser}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const [popup] = await Promise.all([
        page.waitForEvent('popup').then(e => e.page()),
        page.evaluate(() => window.__popup = window.open('')),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(true);
      await context.close();
    });
    it('should work with empty url and nowait', async({browser}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const [popup] = await Promise.all([
        page.waitForEvent('popup').then(e => e.page({ waitUntil: 'nowait' })),
        page.evaluate(() => window.__popup = window.open()),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(true);
      await context.close();
    });
    it('should work with noopener', async({browser}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const [popup] = await Promise.all([
        page.waitForEvent('popup').then(e => e.page()),
        page.evaluate(() => window.__popup = window.open('about:blank', null, 'noopener')),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(false);
      await context.close();
    });
    it('should work with noopener and nowait', async({browser}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const [popup] = await Promise.all([
        page.waitForEvent('popup').then(e => e.page({ waitUntil: 'nowait' })),
        page.evaluate(() => window.__popup = window.open('about:blank', null, 'noopener')),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(false);
      await context.close();
    });
    it('should work with noopener and url', async({browser, server}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const [popup] = await Promise.all([
        page.waitForEvent('popup').then(e => e.page()),
        page.evaluate(url => window.__popup = window.open(url, null, 'noopener'), server.EMPTY_PAGE),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(false);
      await context.close();
    });
    it('should work with noopener and url and nowait', async({browser, server}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const [popup] = await Promise.all([
        page.waitForEvent('popup').then(e => e.page({ waitUntil: 'nowait' })),
        page.evaluate(url => window.__popup = window.open(url, null, 'noopener'), server.EMPTY_PAGE),
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
        page.waitForEvent('popup').then(e => e.page()),
        page.click('a'),
      ]);
      expect(await page.evaluate(() => !!window.opener)).toBe(false);
      expect(await popup.evaluate(() => !!window.opener)).toBe(true);
      await context.close();
    });
    it('should work with clicking target=_blank and nowait', async({browser, server}) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      await page.setContent('<a target=_blank rel="opener" href="/one-style.html">yo</a>');
      const [popup] = await Promise.all([
        page.waitForEvent('popup').then(e => e.page({ waitUntil: 'nowait' })),
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
        page.waitForEvent('popup').then(e => e.page()),
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
        page.waitForEvent('popup').then(e => e.page()),
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
        page.waitForEvent('popup').then(e => e.page()),
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
