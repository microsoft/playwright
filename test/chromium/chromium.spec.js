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

	describe('Target', function() {
    it('ChromiumBrowserContext.targets should return all of the targets', async({page, server, browser}) => {
      const second = await page.context().newPage();
      await second.goto(server.EMPTY_PAGE);
      const targets = page.context().targets();
      // The pages will be the testing page from the harness and the one created here.
      expect(targets.length).toBe(2);
      expect(targets.some(target => target.type() !== 'page')).toBe(false);
      expect(targets.some(target => target.url() === 'about:blank')).toBeTruthy('Missing blank page');
      expect(targets.some(target => target.url() === server.EMPTY_PAGE)).toBeTruthy('Missing new page');
      await second.close();
    });
    it('BrowserContext.pages should return all of the pages', async({page, server, context}) => {
      const second = await page.context().newPage();
      const allPages = await context.pages();
      expect(allPages.length).toBe(2);
      expect(allPages).toContain(page);
      expect(allPages).toContain(second);
      await second.close();
    });
    it('should report browser target', async({browser}) => {
      expect(browser.browserTarget()).toBeTruthy();
    });
    it('should report when a new page is created and closed', async({browser, page, server, context}) => {
      const [otherPage] = await Promise.all([
        page.context().waitForTarget(target => target.url() === server.CROSS_PROCESS_PREFIX + '/empty.html').then(target => target.page()),
        page.evaluate(url => window.open(url), server.CROSS_PROCESS_PREFIX + '/empty.html'),
      ]);
      expect(otherPage.url()).toContain(server.CROSS_PROCESS_PREFIX);
      expect(await otherPage.evaluate(() => ['Hello', 'world'].join(' '))).toBe('Hello world');
      expect(await otherPage.$('body')).toBeTruthy();

      let allPages = await context.pages();
      expect(allPages).toContain(page);
      expect(allPages).toContain(otherPage);

      const closePagePromise = new Promise(fulfill => page.context().once('targetdestroyed', target => fulfill(target.page())));
      await otherPage.close();
      expect(await closePagePromise).toBe(otherPage);

      allPages = await Promise.all(page.context().targets().map(target => target.page()));
      expect(allPages).toContain(page);
      expect(allPages).not.toContain(otherPage);
    });
    it('should report when a service worker is created and destroyed', async({browser, page, server, context}) => {
      await page.goto(server.EMPTY_PAGE);
      const createdTarget = new Promise(fulfill => page.context().once('targetcreated', target => fulfill(target)));

      await page.goto(server.PREFIX + '/serviceworkers/empty/sw.html');

      expect((await createdTarget).type()).toBe('service_worker');
      expect((await createdTarget).url()).toBe(server.PREFIX + '/serviceworkers/empty/sw.js');

      const destroyedTarget = new Promise(fulfill => page.context().once('targetdestroyed', target => fulfill(target)));
      await page.evaluate(() => window.registrationPromise.then(registration => registration.unregister()));
      expect(await destroyedTarget).toBe(await createdTarget);
    });
    it('should create a worker from a service worker', async({browser, page, server, context}) => {
      await page.goto(server.PREFIX + '/serviceworkers/empty/sw.html');

      const target = await page.context().waitForTarget(target => target.type() === 'service_worker');
      const worker = await target.serviceWorker();
      expect(await worker.evaluate(() => self.toString())).toBe('[object ServiceWorkerGlobalScope]');
    });
    it('should not create a worker from a shared worker', async({browser, page, server, context}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.evaluate(() => {
        new SharedWorker('data:text/javascript,console.log("hi")');
      });
      const target = await page.context().waitForTarget(target => target.type() === 'shared_worker');
      const worker = await target.serviceWorker();
      expect(worker).toBe(null);
    });
    it('should report when a target url changes', async({browser, page, server, context}) => {
      await page.goto(server.EMPTY_PAGE);
      let changedTarget = new Promise(fulfill => page.context().once('targetchanged', target => fulfill(target)));
      await page.goto(server.CROSS_PROCESS_PREFIX + '/');
      expect((await changedTarget).url()).toBe(server.CROSS_PROCESS_PREFIX + '/');

      changedTarget = new Promise(fulfill => page.context().once('targetchanged', target => fulfill(target)));
      await page.goto(server.EMPTY_PAGE);
      expect((await changedTarget).url()).toBe(server.EMPTY_PAGE);
    });
    it('should not report uninitialized pages', async({browser, page, server, context}) => {
      let targetChanged = false;
      const listener = () => targetChanged = true;
      browser.on('targetchanged', listener);
      const targetPromise = new Promise(fulfill => context.once('targetcreated', target => fulfill(target)));
      const newPagePromise = context.newPage();
      const target = await targetPromise;
      expect(target.url()).toBe('about:blank');

      const newPage = await newPagePromise;
      const targetPromise2 = new Promise(fulfill => context.once('targetcreated', target => fulfill(target)));
      const evaluatePromise = newPage.evaluate(() => window.open('about:blank'));
      const target2 = await targetPromise2;
      expect(target2.url()).toBe('about:blank');
      await evaluatePromise;
      await newPage.close();
      expect(targetChanged).toBe(false, 'target should not be reported as changed');
      browser.removeListener('targetchanged', listener);
    });
    it('should not crash while redirecting if original request was missed', async({browser, page, server, context}) => {
      let serverResponse = null;
      server.setRoute('/one-style.css', (req, res) => serverResponse = res);
      // Open a new page. Use window.open to connect to the page later.
      await Promise.all([
        page.evaluate(url => window.open(url), server.PREFIX + '/one-style.html'),
        server.waitForRequest('/one-style.css')
      ]);
      // Connect to the opened page.
      const target = await page.context().waitForTarget(target => target.url().includes('one-style.html'));
      const newPage = await target.page();
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
      const [createdTarget] = await Promise.all([
        new Promise(fulfill => page.context().once('targetcreated', target => fulfill(target))),
        page.goto(server.PREFIX + '/popup/window-open.html')
      ]);
      expect((await createdTarget.page()).url()).toBe(server.PREFIX + '/popup/popup.html');
      expect(createdTarget.opener()).toBe(page.context().pageTarget(page));
      expect(page.context().pageTarget(page).opener()).toBe(null);
    });
    it('should close all belonging targets once closing context', async function({browser}) {
      const context = await browser.newContext();
      await context.newPage();
      expect((await context.targets()).length).toBe(1);
      expect((await context.pages()).length).toBe(1);

      await context.close();
      expect((await context.targets()).length).toBe(0);
    });
  });

  describe('Chromium.waitForTarget', () => {
    it('should wait for a target', async function({server, browser}) {
      const context = await browser.newContext();
      let resolved = false;
      const targetPromise = context.waitForTarget(target => target.url() === server.EMPTY_PAGE);
      targetPromise.then(() => resolved = true);
      const page = await context.newPage();
      expect(resolved).toBe(false);
      await page.goto(server.EMPTY_PAGE);
      const target = await targetPromise;
      expect(await target.page()).toBe(page);
      await context.close();
    });
    it('should timeout waiting for a non-existent target', async function({browser, context, server}) {
      const error = await context.waitForTarget(target => target.url() === server.EMPTY_PAGE, {timeout: 1}).catch(e => e);
      expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
    });
    it('should wait for a target', async function({browser, server}) {
      const context = await browser.newContext();
      let resolved = false;
      const targetPromise = context.waitForTarget(target => target.url() === server.EMPTY_PAGE);
      targetPromise.then(() => resolved = true);
      const page = await context.newPage();
      expect(resolved).toBe(false);
      await page.goto(server.EMPTY_PAGE);
      const target = await targetPromise;
      expect(await target.page()).toBe(page);
      await context.close();
    });
    it('should fire target events', async function({browser, server}) {
      const context = await browser.newContext();
      const events = [];
      context.on('targetcreated', target => events.push('CREATED: ' + target.url()));
      context.on('targetchanged', target => events.push('CHANGED: ' + target.url()));
      context.on('targetdestroyed', target => events.push('DESTROYED: ' + target.url()));
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      await page.close();
      expect(events).toEqual([
        'CREATED: about:blank',
        `CHANGED: ${server.EMPTY_PAGE}`,
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
