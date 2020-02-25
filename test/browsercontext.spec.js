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

/**
 * @type {BrowserTestSuite}
 */
module.exports.describe = function({testRunner, expect, playwright, CHROMIUM, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('BrowserContext', function() {
    it('should create new context', async function({browser}) {
      expect(browser.contexts().length).toBe(0);
      const context = await browser.newContext();
      expect(browser.contexts().length).toBe(1);
      expect(browser.contexts().indexOf(context) !== -1).toBe(true);
      await context.close();
      expect(browser.contexts().length).toBe(0);
    });
    it('window.open should use parent tab context', async function({browser, server}) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const [popup] = await Promise.all([
        utils.waitEvent(page, 'popup'),
        page.evaluate(url => window.open(url), server.EMPTY_PAGE)
      ]);
      expect(popup.context()).toBe(context);
      await context.close();
    });
    it('should isolate localStorage and cookies', async function({browser, server}) {
      // Create two incognito contexts.
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      expect((await context1.pages()).length).toBe(0);
      expect((await context2.pages()).length).toBe(0);

      // Create a page in first incognito context.
      const page1 = await context1.newPage();
      await page1.goto(server.EMPTY_PAGE);
      await page1.evaluate(() => {
        localStorage.setItem('name', 'page1');
        document.cookie = 'name=page1';
      });

      expect((await context1.pages()).length).toBe(1);
      expect((await context2.pages()).length).toBe(0);

      // Create a page in second incognito context.
      const page2 = await context2.newPage();
      await page2.goto(server.EMPTY_PAGE);
      await page2.evaluate(() => {
        localStorage.setItem('name', 'page2');
        document.cookie = 'name=page2';
      });

      expect((await context1.pages()).length).toBe(1);
      expect((await context2.pages()).length).toBe(1);
      expect((await context1.pages())[0]).toBe(page1);
      expect((await context2.pages())[0]).toBe(page2);

      // Make sure pages don't share localstorage or cookies.
      expect(await page1.evaluate(() => localStorage.getItem('name'))).toBe('page1');
      expect(await page1.evaluate(() => document.cookie)).toBe('name=page1');
      expect(await page2.evaluate(() => localStorage.getItem('name'))).toBe('page2');
      expect(await page2.evaluate(() => document.cookie)).toBe('name=page2');

      // Cleanup contexts.
      await Promise.all([
        context1.close(),
        context2.close()
      ]);
      expect(browser.contexts().length).toBe(0);
    });
    it('should propagate default viewport to the page', async({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 456, height: 789 } });
      const page = await context.newPage();
      expect(page.viewportSize().width).toBe(456);
      expect(page.viewportSize().height).toBe(789);
      expect(await page.evaluate('window.innerWidth')).toBe(456);
      expect(await page.evaluate('window.innerHeight')).toBe(789);
      await context.close();
    });
    it('should make a copy of default viewport', async({ browser }) => {
      const viewport = { width: 456, height: 789 };
      const context = await browser.newContext({ viewport });
      viewport.width = 567;
      const page = await context.newPage();
      expect(page.viewportSize().width).toBe(456);
      expect(page.viewportSize().height).toBe(789);
      expect(await page.evaluate('window.innerWidth')).toBe(456);
      expect(await page.evaluate('window.innerHeight')).toBe(789);
      await context.close();
    });
  });

  describe('BrowserContext({userAgent})', function() {
    it('should work', async({browser, server}) => {
      {
        const context = await browser.newContext();
        const page = await context.newPage();
        expect(await page.evaluate(() => navigator.userAgent)).toContain('Mozilla');
        await context.close();
      }
      {
        const context = await browser.newContext({ userAgent: 'foobar' });
        const page = await context.newPage();
        const [request] = await Promise.all([
          server.waitForRequest('/empty.html'),
          page.goto(server.EMPTY_PAGE),
        ]);
        expect(request.headers['user-agent']).toBe('foobar');
        await context.close();
      }
    });
    it('should work for subframes', async({browser, server}) => {
      {
        const context = await browser.newContext();
        const page = await context.newPage();
        expect(await page.evaluate(() => navigator.userAgent)).toContain('Mozilla');
        await context.close();
      }
      {
        const context = await browser.newContext({ userAgent: 'foobar' });
        const page = await context.newPage();
        const [request] = await Promise.all([
          server.waitForRequest('/empty.html'),
          utils.attachFrame(page, 'frame1', server.EMPTY_PAGE),
        ]);
        expect(request.headers['user-agent']).toBe('foobar');
        await context.close();
      }
    });
    it('should emulate device user-agent', async({browser, server}) => {
      {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(server.PREFIX + '/mobile.html');
        expect(await page.evaluate(() => navigator.userAgent)).not.toContain('iPhone');
        await context.close();
      }
      {
        const context = await browser.newContext({ userAgent: playwright.devices['iPhone 6'].userAgent });
        const page = await context.newPage();
        await page.goto(server.PREFIX + '/mobile.html');
        expect(await page.evaluate(() => navigator.userAgent)).toContain('iPhone');
        await context.close();
      }
    });
    it('should make a copy of default options', async({browser, server}) => {
      const options = { userAgent: 'foobar' };
      const context = await browser.newContext(options);
      options.userAgent = 'wrong';
      const page = await context.newPage();
      const [request] = await Promise.all([
        server.waitForRequest('/empty.html'),
        page.goto(server.EMPTY_PAGE),
      ]);
      expect(request.headers['user-agent']).toBe('foobar');
      await context.close();
    });
  });

  describe('BrowserContext({bypassCSP})', function() {
    it('should bypass CSP meta tag', async({browser, server}) => {
      // Make sure CSP prohibits addScriptTag.
      {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(server.PREFIX + '/csp.html');
        await page.addScriptTag({content: 'window.__injected = 42;'}).catch(e => void e);
        expect(await page.evaluate(() => window.__injected)).toBe(undefined);
        await context.close();
      }

      // By-pass CSP and try one more time.
      {
        const context = await browser.newContext({ bypassCSP: true });
        const page = await context.newPage();
        await page.goto(server.PREFIX + '/csp.html');
        await page.addScriptTag({content: 'window.__injected = 42;'});
        expect(await page.evaluate(() => window.__injected)).toBe(42);
        await context.close();
      }
    });

    it('should bypass CSP header', async({browser, server}) => {
      // Make sure CSP prohibits addScriptTag.
      server.setCSP('/empty.html', 'default-src "self"');

      {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(server.EMPTY_PAGE);
        await page.addScriptTag({content: 'window.__injected = 42;'}).catch(e => void e);
        expect(await page.evaluate(() => window.__injected)).toBe(undefined);
        await context.close();
      }

      // By-pass CSP and try one more time.
      {
        const context = await browser.newContext({ bypassCSP: true });
        const page = await context.newPage();
        await page.goto(server.EMPTY_PAGE);
        await page.addScriptTag({content: 'window.__injected = 42;'});
        expect(await page.evaluate(() => window.__injected)).toBe(42);
        await context.close();
      }
    });

    it('should bypass after cross-process navigation', async({browser, server}) => {
      const context = await browser.newContext({ bypassCSP: true });
      const page = await context.newPage();
      await page.goto(server.PREFIX + '/csp.html');
      await page.addScriptTag({content: 'window.__injected = 42;'});
      expect(await page.evaluate(() => window.__injected)).toBe(42);

      await page.goto(server.CROSS_PROCESS_PREFIX + '/csp.html');
      await page.addScriptTag({content: 'window.__injected = 42;'});
      expect(await page.evaluate(() => window.__injected)).toBe(42);
      await context.close();
    });
    it('should bypass CSP in iframes as well', async({browser, server}) => {
      // Make sure CSP prohibits addScriptTag in an iframe.
      {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(server.EMPTY_PAGE);
        const frame = await utils.attachFrame(page, 'frame1', server.PREFIX + '/csp.html');
        await frame.addScriptTag({content: 'window.__injected = 42;'}).catch(e => void e);
        expect(await frame.evaluate(() => window.__injected)).toBe(undefined);
        await context.close();
      }

      // By-pass CSP and try one more time.
      {
        const context = await browser.newContext({ bypassCSP: true });
        const page = await context.newPage();
        await page.goto(server.EMPTY_PAGE);
        const frame = await utils.attachFrame(page, 'frame1', server.PREFIX + '/csp.html');
        await frame.addScriptTag({content: 'window.__injected = 42;'}).catch(e => void e);
        expect(await frame.evaluate(() => window.__injected)).toBe(42);
        await context.close();
      }
    });
  });

  describe('BrowserContext({javaScriptEnabled})', function() {
    it('should work', async({browser}) => {
      {
        const context = await browser.newContext({ javaScriptEnabled: false });
        const page = await context.newPage();
        await page.goto('data:text/html, <script>var something = "forbidden"</script>');
        let error = null;
        await page.evaluate('something').catch(e => error = e);
        if (WEBKIT)
          expect(error.message).toContain('Can\'t find variable: something');
        else
          expect(error.message).toContain('something is not defined');
        await context.close();
      }

      {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto('data:text/html, <script>var something = "forbidden"</script>');
        expect(await page.evaluate('something')).toBe('forbidden');
        await context.close();
      }
    });
    it('should be able to navigate after disabling javascript', async({browser, server}) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      await context.close();
    });
  });
};
