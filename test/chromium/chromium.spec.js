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

const { waitEvent } = require('../utils');

/**
 * @type {ChromiumTestSuite}
 */
module.exports.describe = function({testRunner, expect, playwright, FFOX, CHROMIUM, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

	describe('BrowserContext', function() {
    it('pages() should return all of the pages', async({page, server, context}) => {
      const second = await page.context().newPage();
      const allPages = await context.pages();
      expect(allPages.length).toBe(2);
      expect(allPages).toContain(page);
      expect(allPages).toContain(second);
      await second.close();
    });
    it('should report when a new page is created and closed', async({browser, page, server, context}) => {
      const [otherPage] = await Promise.all([
        new Promise(r => context.once('pageevent', async event => r(await event.page()))),
        page.evaluate(url => window.open(url), server.CROSS_PROCESS_PREFIX + '/empty.html'),
      ]);
      expect(otherPage.url()).toContain(server.CROSS_PROCESS_PREFIX);
      expect(await otherPage.evaluate(() => ['Hello', 'world'].join(' '))).toBe('Hello world');
      expect(await otherPage.$('body')).toBeTruthy();

      let allPages = await context.pages();
      expect(allPages).toContain(page);
      expect(allPages).toContain(otherPage);

      let closeEventReceived;
      otherPage.once('close', () => closeEventReceived = true);
      await otherPage.close();
      expect(closeEventReceived).toBeTruthy();

      allPages = await context.pages();
      expect(allPages).toContain(page);
      expect(allPages).not.toContain(otherPage);
    });
    it('should create a worker from a service worker', async({browser, page, server, context}) => {
      const [worker] = await Promise.all([
        new Promise(fulfill => context.once('serviceworker', fulfill)),
        page.goto(server.PREFIX + '/serviceworkers/empty/sw.html')
      ]);
      expect(await worker.evaluate(() => self.toString())).toBe('[object ServiceWorkerGlobalScope]');
    });
    it('should not create a worker from a shared worker', async({browser, page, server, context}) => {
      await page.goto(server.EMPTY_PAGE);
      let serviceWorkerCreated;
      context.once('serviceworker', () => serviceWorkerCreated = true);
      await page.evaluate(() => {
        new SharedWorker('data:text/javascript,console.log("hi")');
      });
      expect(serviceWorkerCreated).not.toBeTruthy();
    });
    it('should not report uninitialized pages', async({browser, context}) => {
      const pagePromise = new Promise(fulfill => context.once('pageevent', async event => fulfill(await event.page())));
      context.newPage();
      const newPage = await pagePromise;
      expect(newPage.url()).toBe('about:blank');

      const popupPromise = new Promise(fulfill => context.once('pageevent', async event => fulfill(await event.page())));
      const evaluatePromise = newPage.evaluate(() => window.open('about:blank'));
      const popup = await popupPromise;
      expect(popup.url()).toBe('about:blank');
      await evaluatePromise;
      await newPage.close();
    });
    it('should not crash while redirecting if original request was missed', async({browser, page, server, context}) => {
      let serverResponse = null;
      server.setRoute('/one-style.css', (req, res) => serverResponse = res);
      // Open a new page. Use window.open to connect to the page later.
      const [newPage] = await Promise.all([
        new Promise(fulfill => context.once('pageevent', async event => fulfill(await event.page()))),
        page.evaluate(url => window.open(url), server.PREFIX + '/one-style.html'),
        server.waitForRequest('/one-style.css')
      ]);
      // Connect to the opened page.
      expect(newPage.url()).toBe(server.PREFIX + '/one-style.html');
      // Issue a redirect.
      serverResponse.writeHead(302, { location: '/injectedstyle.css' });
      serverResponse.end();
      // Wait for the new page to load.
      await waitEvent(newPage, 'load');
      // Cleanup.
      await newPage.close();
    });
    it('should have an opener', async({browser, page, server, context}) => {
      await page.goto(server.EMPTY_PAGE);
      const [popup] = await Promise.all([
        new Promise(fulfill => context.once('pageevent', async event => fulfill(await event.page()))),
        page.goto(server.PREFIX + '/popup/window-open.html')
      ]);
      await popup.waitForLoadState();
      expect(popup.url()).toBe(server.PREFIX + '/popup/popup.html');
      expect(await popup.opener()).toBe(page);
      expect(await page.opener()).toBe(null);
    });
    it('should close all belonging targets once closing context', async function({browser}) {
      const context = await browser.newContext();
      await context.newPage();
      expect((await context.pages()).length).toBe(1);

      await context.close();
      expect((await context.pages()).length).toBe(0);
    });
    it('should fire page lifecycle events', async function({browser, server}) {
      const context = await browser.newContext();
      const events = [];
      context.on('pageevent', async event => {
        const page = await event.page();
        events.push('CREATED: ' + page.url());
        page.on('close', () => events.push('DESTROYED: ' + page.url()))
      });
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      await page.close();
      expect(events).toEqual([
        'CREATED: about:blank',
        `DESTROYED: ${server.EMPTY_PAGE}`
      ]);
      await context.close();
    });
  });

  describe('Chromium-Specific Page Tests', function() {
    it('Page.route should work with intervention headers', async({server, page}) => {
      server.setRoute('/intervention', (req, res) => res.end(`
        <script>
          document.write('<script src="${server.CROSS_PROCESS_PREFIX}/intervention.js">' + '</scr' + 'ipt>');
        </script>
      `));
      server.setRedirect('/intervention.js', '/redirect.js');
      let serverRequest = null;
      server.setRoute('/redirect.js', (req, res) => {
        serverRequest = req;
        res.end('console.log(1);');
      });

      await page.route('*', request => request.continue());
      await page.goto(server.PREFIX + '/intervention');
      // Check for feature URL substring rather than https://www.chromestatus.com to
      // make it work with Edgium.
      expect(serverRequest.headers.intervention).toContain('feature/5718547946799104');
    });
  });

};
