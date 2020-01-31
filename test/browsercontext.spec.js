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
    it('should create new context', async function({browser, newContext}) {
      expect(browser.contexts().length).toBe(0);
      const context = await newContext();
      expect(browser.contexts().length).toBe(1);
      expect(browser.contexts().indexOf(context) !== -1).toBe(true);
      await context.close();
      expect(browser.contexts().length).toBe(0);
    });
    it('window.open should use parent tab context', async function({newContext, server}) {
      const context = await newContext();
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const [popupTarget] = await Promise.all([
        utils.waitEvent(page, 'popup'),
        page.evaluate(url => window.open(url), server.EMPTY_PAGE)
      ]);
      expect(popupTarget.context()).toBe(context);
    });
    it('should isolate localStorage and cookies', async function({browser, newContext, server}) {
      // Create two incognito contexts.
      const context1 = await newContext();
      const context2 = await newContext();
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
    it('should propagate default viewport to the page', async({ newPage }) => {
      const page = await newPage({ viewport: { width: 456, height: 789 } });
      expect(page.viewportSize().width).toBe(456);
      expect(page.viewportSize().height).toBe(789);
      expect(await page.evaluate('window.innerWidth')).toBe(456);
      expect(await page.evaluate('window.innerHeight')).toBe(789);
    });
    it('should make a copy of default viewport', async({ newContext }) => {
      const viewport = { width: 456, height: 789 };
      const context = await newContext({ viewport });
      viewport.width = 567;
      const page = await context.newPage();
      expect(page.viewportSize().width).toBe(456);
      expect(page.viewportSize().height).toBe(789);
      expect(await page.evaluate('window.innerWidth')).toBe(456);
      expect(await page.evaluate('window.innerHeight')).toBe(789);
    });
  });

  describe('BrowserContext({userAgent})', function() {
    it('should work', async({newPage, server}) => {
      {
        const page = await newPage();
        expect(await page.evaluate(() => navigator.userAgent)).toContain('Mozilla');
      }
      {
        const page = await newPage({ userAgent: 'foobar' });
        const [request] = await Promise.all([
          server.waitForRequest('/empty.html'),
          page.goto(server.EMPTY_PAGE),
        ]);
        expect(request.headers['user-agent']).toBe('foobar');
      }
    });
    it('should work for subframes', async({newPage, server}) => {
      {
        const page = await newPage();
        expect(await page.evaluate(() => navigator.userAgent)).toContain('Mozilla');
      }
      {
        const page = await newPage({ userAgent: 'foobar' });
        const [request] = await Promise.all([
          server.waitForRequest('/empty.html'),
          utils.attachFrame(page, 'frame1', server.EMPTY_PAGE),
        ]);
        expect(request.headers['user-agent']).toBe('foobar');
      }
    });
    it('should emulate device user-agent', async({newPage, server}) => {
      {
        const page = await newPage();
        await page.goto(server.PREFIX + '/mobile.html');
        expect(await page.evaluate(() => navigator.userAgent)).not.toContain('iPhone');
      }
      {
        const page = await newPage({ userAgent: playwright.devices['iPhone 6'].userAgent });
        await page.goto(server.PREFIX + '/mobile.html');
        expect(await page.evaluate(() => navigator.userAgent)).toContain('iPhone');
      }
    });
    it('should make a copy of default options', async({newContext, server}) => {
      const options = { userAgent: 'foobar' };
      const context = await newContext(options);
      options.userAgent = 'wrong';
      const page = await context.newPage();
      const [request] = await Promise.all([
        server.waitForRequest('/empty.html'),
        page.goto(server.EMPTY_PAGE),
      ]);
      expect(request.headers['user-agent']).toBe('foobar');
    });
  });

  describe('BrowserContext({bypassCSP})', function() {
    it('should bypass CSP meta tag', async({newPage, server}) => {
      // Make sure CSP prohibits addScriptTag.
      {
        const page = await newPage();
        await page.goto(server.PREFIX + '/csp.html');
        await page.addScriptTag({content: 'window.__injected = 42;'}).catch(e => void e);
        expect(await page.evaluate(() => window.__injected)).toBe(undefined);
      }

      // By-pass CSP and try one more time.
      {
        const page = await newPage({ bypassCSP: true });
        await page.goto(server.PREFIX + '/csp.html');
        await page.addScriptTag({content: 'window.__injected = 42;'});
        expect(await page.evaluate(() => window.__injected)).toBe(42);
      }
    });

    it('should bypass CSP header', async({newPage, server}) => {
      // Make sure CSP prohibits addScriptTag.
      server.setCSP('/empty.html', 'default-src "self"');

      {
        const page = await newPage();
        await page.goto(server.EMPTY_PAGE);
        await page.addScriptTag({content: 'window.__injected = 42;'}).catch(e => void e);
        expect(await page.evaluate(() => window.__injected)).toBe(undefined);
      }

      // By-pass CSP and try one more time.
      {
        const page = await newPage({ bypassCSP: true });
        await page.goto(server.EMPTY_PAGE);
        await page.addScriptTag({content: 'window.__injected = 42;'});
        expect(await page.evaluate(() => window.__injected)).toBe(42);
      }
    });

    it('should bypass after cross-process navigation', async({newPage, server}) => {
      const page = await newPage({ bypassCSP: true });
      await page.goto(server.PREFIX + '/csp.html');
      await page.addScriptTag({content: 'window.__injected = 42;'});
      expect(await page.evaluate(() => window.__injected)).toBe(42);

      await page.goto(server.CROSS_PROCESS_PREFIX + '/csp.html');
      await page.addScriptTag({content: 'window.__injected = 42;'});
      expect(await page.evaluate(() => window.__injected)).toBe(42);
    });
    it('should bypass CSP in iframes as well', async({newPage, server}) => {
      // Make sure CSP prohibits addScriptTag in an iframe.
      {
        const page = await newPage();
        await page.goto(server.EMPTY_PAGE);
        const frame = await utils.attachFrame(page, 'frame1', server.PREFIX + '/csp.html');
        await frame.addScriptTag({content: 'window.__injected = 42;'}).catch(e => void e);
        expect(await frame.evaluate(() => window.__injected)).toBe(undefined);
      }

      // By-pass CSP and try one more time.
      {
        const page = await newPage({ bypassCSP: true });
        await page.goto(server.EMPTY_PAGE);
        const frame = await utils.attachFrame(page, 'frame1', server.PREFIX + '/csp.html');
        await frame.addScriptTag({content: 'window.__injected = 42;'}).catch(e => void e);
        expect(await frame.evaluate(() => window.__injected)).toBe(42);
      }
    });
  });

  describe('BrowserContext({javaScriptEnabled})', function() {
    it('should work', async({newPage}) => {
      {
        const page = await newPage({ javaScriptEnabled: false });
        await page.goto('data:text/html, <script>var something = "forbidden"</script>');
        let error = null;
        await page.evaluate('something').catch(e => error = e);
        if (WEBKIT)
          expect(error.message).toContain('Can\'t find variable: something');
        else
          expect(error.message).toContain('something is not defined');
      }

      {
        const page = await newPage();
        await page.goto('data:text/html, <script>var something = "forbidden"</script>');
        expect(await page.evaluate('something')).toBe('forbidden');
      }
    });
    it('should be able to navigate after disabling javascript', async({newPage, server}) => {
      const page = await newPage({ javaScriptEnabled: false });
      await page.goto(server.EMPTY_PAGE);
    });
  });
};
