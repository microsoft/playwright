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

module.exports.addTests = function({testRunner, expect, playwright, FFOX, CHROME, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Chromium', function() {
    it('should work across sessions', async function({browser, server}) {
      expect(browser.browserContexts().length).toBe(2);
      const context = await browser.newContext();
      expect(browser.browserContexts().length).toBe(3);
      const remoteBrowser = await playwright.connect({
        browserWSEndpoint: browser.chromium.wsEndpoint()
      });
      const contexts = remoteBrowser.browserContexts();
      expect(contexts.length).toBe(3);
      remoteBrowser.disconnect();
      await context.close();
    });
	});

	describe('Target', function() {
    it('Chromium.targets should return all of the targets', async({page, server, browser}) => {
      // The pages will be the testing page and the original newtab page
      const targets = browser.chromium.targets();
      expect(targets.some(target => target.type() === 'page' &&
        target.url() === 'about:blank')).toBeTruthy('Missing blank page');
      expect(targets.some(target => target.type() === 'browser')).toBeTruthy('Missing browser target');
    });
    it('Browser.pages should return all of the pages', async({page, server, context}) => {
      // The pages will be the testing page
      const allPages = await context.pages();
      expect(allPages.length).toBe(1);
      expect(allPages).toContain(page);
      expect(allPages[0]).not.toBe(allPages[1]);
    });
    it('should contain browser target', async({browser}) => {
      const targets = browser.chromium.targets();
      const browserTarget = targets.find(target => target.type() === 'browser');
      expect(browserTarget).toBeTruthy();
    });
    it('should be able to use the default page in the browser', async({page, server, browser}) => {
      // The pages will be the testing page and the original newtab page
      const allPages = await browser.pages();
      const originalPage = allPages.find(p => p !== page);
      expect(await originalPage.evaluate(() => ['Hello', 'world'].join(' '))).toBe('Hello world');
      expect(await originalPage.$('body')).toBeTruthy();
    });
    it('should report when a new page is created and closed', async({browser, page, server, context}) => {
      const [otherPage] = await Promise.all([
        browser.chromium.waitForTarget(target => target.url() === server.CROSS_PROCESS_PREFIX + '/empty.html').then(target => target.page()),
        page.evaluate(url => window.open(url), server.CROSS_PROCESS_PREFIX + '/empty.html'),
      ]);
      expect(otherPage.url()).toContain(server.CROSS_PROCESS_PREFIX);
      expect(await otherPage.evaluate(() => ['Hello', 'world'].join(' '))).toBe('Hello world');
      expect(await otherPage.$('body')).toBeTruthy();

      let allPages = await context.pages();
      expect(allPages).toContain(page);
      expect(allPages).toContain(otherPage);

      const closePagePromise = new Promise(fulfill => browser.chromium.once('targetdestroyed', target => fulfill(target.page())));
      await otherPage.close();
      expect(await closePagePromise).toBe(otherPage);

      allPages = await Promise.all(browser.chromium.targets().map(target => target.page()));
      expect(allPages).toContain(page);
      expect(allPages).not.toContain(otherPage);
    });
    it('should report when a service worker is created and destroyed', async({browser, page, server, context}) => {
      await page.goto(server.EMPTY_PAGE);
      const createdTarget = new Promise(fulfill => browser.chromium.once('targetcreated', target => fulfill(target)));

      await page.goto(server.PREFIX + '/serviceworkers/empty/sw.html');

      expect((await createdTarget).type()).toBe('service_worker');
      expect((await createdTarget).url()).toBe(server.PREFIX + '/serviceworkers/empty/sw.js');

      const destroyedTarget = new Promise(fulfill => browser.chromium.once('targetdestroyed', target => fulfill(target)));
      await page.evaluate(() => window.registrationPromise.then(registration => registration.unregister()));
      expect(await destroyedTarget).toBe(await createdTarget);
    });
    it('should create a worker from a service worker', async({browser, page, server, context}) => {
      await page.goto(server.PREFIX + '/serviceworkers/empty/sw.html');

      const target = await browser.chromium.waitForTarget(target => target.type() === 'service_worker');
      const worker = await browser.chromium.serviceWorker(target);
      expect(await worker.evaluate(() => self.toString())).toBe('[object ServiceWorkerGlobalScope]');
    });
    it('should create a worker from a shared worker', async({browser, page, server, context}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.evaluate(() => {
        new SharedWorker('data:text/javascript,console.log("hi")');
      });
      const target = await browser.chromium.waitForTarget(target => target.type() === 'shared_worker');
      const worker = await browser.chromium.serviceWorker(target);
      expect(await worker.evaluate(() => self.toString())).toBe('[object SharedWorkerGlobalScope]');
    });
    it('should report when a target url changes', async({browser, page, server, context}) => {
      await page.goto(server.EMPTY_PAGE);
      let changedTarget = new Promise(fulfill => browser.chromium.once('targetchanged', target => fulfill(target)));
      await page.goto(server.CROSS_PROCESS_PREFIX + '/');
      expect((await changedTarget).url()).toBe(server.CROSS_PROCESS_PREFIX + '/');

      changedTarget = new Promise(fulfill => browser.chromium.once('targetchanged', target => fulfill(target)));
      await page.goto(server.EMPTY_PAGE);
      expect((await changedTarget).url()).toBe(server.EMPTY_PAGE);
    });
    it('should not report uninitialized pages', async({browser, page, server, context}) => {
      let targetChanged = false;
      const listener = () => targetChanged = true;
      browser.chromium.on('targetchanged', listener);
      const targetPromise = new Promise(fulfill => browser.chromium.once('targetcreated', target => fulfill(target)));
      const newPagePromise = context.newPage();
      const target = await targetPromise;
      expect(target.url()).toBe('about:blank');

      const newPage = await newPagePromise;
      const targetPromise2 = new Promise(fulfill => browser.chromium.once('targetcreated', target => fulfill(target)));
      const evaluatePromise = newPage.evaluate(() => window.open('about:blank'));
      const target2 = await targetPromise2;
      expect(target2.url()).toBe('about:blank');
      await evaluatePromise;
      await newPage.close();
      expect(targetChanged).toBe(false, 'target should not be reported as changed');
      browser.chromium.removeListener('targetchanged', listener);
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
      const target = await browser.chromium.waitForTarget(target => target.url().includes('one-style.html'));
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
        new Promise(fulfill => browser.chromium.once('targetcreated', target => fulfill(target))),
        page.goto(server.PREFIX + '/popup/window-open.html')
      ]);
      expect((await createdTarget.page()).url()).toBe(server.PREFIX + '/popup/popup.html');
      expect(createdTarget.opener()).toBe(browser.chromium.pageTarget(page));
      expect(browser.chromium.pageTarget(page).opener()).toBe(null);
    });
  });

  describe('Chromium.waitForTarget', () => {
    it('should wait for a target', async function({browser, server}) {
      const context = await browser.newContext();
      let resolved = false;
      const targetPromise = browser.chromium.waitForTarget(target => target.browserContext() === context && target.url() === server.EMPTY_PAGE);
      targetPromise.then(() => resolved = true);
      const page = await context.newPage();
      expect(resolved).toBe(false);
      await page.goto(server.EMPTY_PAGE);
      const target = await targetPromise;
      expect(await target.page()).toBe(page);
      await context.close();
    });
    it('should timeout waiting for a non-existent target', async function({browser, server}) {
      const context = await browser.newContext();
      const error = await browser.chromium.waitForTarget(target => target.browserContext() === context && target.url() === server.EMPTY_PAGE, {timeout: 1}).catch(e => e);
      expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
      await context.close();
    });
    it('should wait for a target', async function({browser, server}) {
      let resolved = false;
      const targetPromise = browser.chromium.waitForTarget(target => target.url() === server.EMPTY_PAGE);
      targetPromise.then(() => resolved = true);
      const page = await browser.newPage();
      expect(resolved).toBe(false);
      await page.goto(server.EMPTY_PAGE);
      const target = await targetPromise;
      expect(await target.page()).toBe(page);
      await page.close();
    });
    it('should timeout waiting for a non-existent target', async function({browser, server}) {
      let error = null;
      await browser.chromium.waitForTarget(target => target.url() === server.EMPTY_PAGE, {
        timeout: 1
      }).catch(e => error = e);
      expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
    });
    it('should fire target events', async function({browser, server}) {
      const context = await browser.newContext();
      const events = [];
      browser.chromium.on('targetcreated', target => events.push('CREATED: ' + target.url()));
      browser.chromium.on('targetchanged', target => events.push('CHANGED: ' + target.url()));
      browser.chromium.on('targetdestroyed', target => events.push('DESTROYED: ' + target.url()));
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
    it('Page.setRequestInterception should work with intervention headers', async({server, page}) => {
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

      await page.interception.enable();
      page.on('request', request => page.interception.continue(request));
      await page.goto(server.PREFIX + '/intervention');
      // Check for feature URL substring rather than https://www.chromestatus.com to
      // make it work with Edgium.
      expect(serverRequest.headers.intervention).toContain('feature/5718547946799104');
    });
  });

};
