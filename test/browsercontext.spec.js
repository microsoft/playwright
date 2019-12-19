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

module.exports.describe = function({testRunner, expect, playwright, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('BrowserContext', function() {
    it('should have default context', async function({browser, server}) {
      expect(browser.browserContexts().length).toBe(1);
      const defaultContext = browser.browserContexts()[0];
      let error = null;
      await defaultContext.close().catch(e => error = e);
      expect(browser.defaultContext()).toBe(defaultContext);
      expect(error.message).toContain('cannot be closed');
    });
    it('should create new incognito context', async function({browser, newContext}) {
      expect(browser.browserContexts().length).toBe(1);
      const context = await newContext();
      expect(browser.browserContexts().length).toBe(2);
      expect(browser.browserContexts().indexOf(context) !== -1).toBe(true);
      await context.close();
      expect(browser.browserContexts().length).toBe(1);
    });
    it('should close all belonging targets once closing context', async function({browser, newContext, server}) {
      expect((await browser.pages()).length).toBe(1);

      const context = await newContext();
      await context.newPage();
      expect((await browser.pages()).length).toBe(2);
      expect((await context.pages()).length).toBe(1);

      await context.close();
      expect((await browser.pages()).length).toBe(1);
    });
    it('window.open should use parent tab context', async function({browser, newContext, server}) {
      const context = await newContext();
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const [popupTarget] = await Promise.all([
        utils.waitEvent(page, 'popup'),
        page.evaluate(url => window.open(url), server.EMPTY_PAGE)
      ]);
      expect(popupTarget.browserContext()).toBe(context);
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
      expect(browser.browserContexts().length).toBe(1);
    });
    it('should set the default viewport', async({ newPage }) => {
      const page = await newPage({ viewport: { width: 456, height: 789 } });
      expect(await page.evaluate('window.innerWidth')).toBe(456);
      expect(await page.evaluate('window.innerHeight')).toBe(789);
    });
    it('should take fullPage screenshots when default viewport is null', async({server, newPage}) => {
      const page = await newPage({ viewport: null });
      await page.goto(server.PREFIX + '/grid.html');
      const sizeBefore = await page.evaluate(() => ({ width: document.body.offsetWidth, height: document.body.offsetHeight }));
      const screenshot = await page.screenshot({
        fullPage: true
      });
      expect(screenshot).toBeInstanceOf(Buffer);

      const sizeAfter = await page.evaluate(() => ({ width: document.body.offsetWidth, height: document.body.offsetHeight }));
      expect(sizeBefore.width).toBe(sizeAfter.width);
      expect(sizeBefore.height).toBe(sizeAfter.height);
    });
  });

  describe('BrowserContext({setUserAgent})', function() {
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
