/**
 * Copyright 2017 Google Inc. All rights reserved.
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

const utils = require('../utils');

module.exports.describe = function({testRunner, expect, defaultBrowserOptions, playwright, FFOX, CHROME, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Playwright.connect', function() {
    it('should be able to connect multiple times to the same browser', async({server}) => {
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const local = await browserServer.connect();
      const remote = await playwright.connect({
        ...defaultBrowserOptions,
        browserWSEndpoint: browserServer.wsEndpoint()
      });
      const page = await remote.defaultContext().newPage();
      expect(await page.evaluate(() => 7 * 8)).toBe(56);
      remote.disconnect();

      const secondPage = await local.defaultContext().newPage();
      expect(await secondPage.evaluate(() => 7 * 6)).toBe(42, 'original browser should still work');
      await browserServer.close();
    });
    it('should be able to close remote browser', async({server}) => {
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const local = await browserServer.connect();
      const remote = await playwright.connect({
        ...defaultBrowserOptions,
        browserWSEndpoint: browserServer.wsEndpoint()
      });
      await Promise.all([
        utils.waitEvent(local, 'disconnected'),
        remote.close(),
      ]);
    });
    it('should be able to reconnect to a browser', async({server}) => {
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const browser = await browserServer.connect();
      const browserWSEndpoint = browserServer.wsEndpoint();
      const page = await browser.defaultContext().newPage();
      await page.goto(server.PREFIX + '/frames/nested-frames.html');

      const remote = await playwright.connect({...defaultBrowserOptions, browserWSEndpoint});
      const pages = await remote.defaultContext().pages();
      const restoredPage = pages.find(page => page.url() === server.PREFIX + '/frames/nested-frames.html');
      expect(utils.dumpFrames(restoredPage.mainFrame())).toEqual([
        'http://localhost:<PORT>/frames/nested-frames.html',
        '    http://localhost:<PORT>/frames/frame.html (aframe)',
        '    http://localhost:<PORT>/frames/two-frames.html (2frames)',
        '        http://localhost:<PORT>/frames/frame.html (dos)',
        '        http://localhost:<PORT>/frames/frame.html (uno)',
      ]);
      expect(await restoredPage.evaluate(() => 7 * 8)).toBe(56);
      await remote.close();
    });
    // @see https://github.com/GoogleChrome/puppeteer/issues/4197#issuecomment-481793410
    it('should be able to connect to the same page simultaneously', async({server}) => {
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const local = await browserServer.connect();
      const remote = await playwright.connect({ ...defaultBrowserOptions, browserWSEndpoint: browserServer.wsEndpoint() });
      const [page1, page2] = await Promise.all([
        new Promise(x => local.once('targetcreated', target => x(target.page()))),
        remote.defaultContext().newPage(),
      ]);
      expect(await page1.evaluate(() => 7 * 8)).toBe(56);
      expect(await page2.evaluate(() => 7 * 6)).toBe(42);
      await local.close();
    });
  });

  describe('Browser.disconnect', function() {
    it('should reject navigation when browser closes', async({server}) => {
      server.setRoute('/one-style.css', () => {});
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const local = await browserServer.connect();
      const remote = await playwright.connect({...defaultBrowserOptions, browserWSEndpoint: browserServer.wsEndpoint()});
      const page = await remote.defaultContext().newPage();
      const navigationPromise = page.goto(server.PREFIX + '/one-style.html', {timeout: 60000}).catch(e => e);
      await server.waitForRequest('/one-style.css');
      remote.disconnect();
      const error = await navigationPromise;
      expect(error.message).toBe('Navigation failed because browser has disconnected!');
      await local.close();
    });
    it('should reject waitForSelector when browser closes', async({server}) => {
      server.setRoute('/empty.html', () => {});
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const local = await browserServer.connect();
      const remote = await playwright.connect({...defaultBrowserOptions, browserWSEndpoint: browserServer.wsEndpoint()});
      const page = await remote.defaultContext().newPage();
      const watchdog = page.waitForSelector('div', { timeout: 60000 }).catch(e => e);
      remote.disconnect();
      const error = await watchdog;
      expect(error.message).toContain('Protocol error');
      await local.close();
    });
  });

  describe('Browser.close', function() {
    it('should terminate network waiters', async({context, server}) => {
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const local = await browserServer.connect();
      const remote = await playwright.connect({...defaultBrowserOptions, browserWSEndpoint: browserServer.wsEndpoint()});
      const newPage = await remote.defaultContext().newPage();
      const results = await Promise.all([
        newPage.waitForRequest(server.EMPTY_PAGE).catch(e => e),
        newPage.waitForResponse(server.EMPTY_PAGE).catch(e => e),
        local.close()
      ]);
      for (let i = 0; i < 2; i++) {
        const message = results[i].message;
        expect(message).toContain('Target closed');
        expect(message).not.toContain('Timeout');
      }
    });
  });

  describe('Browser.isConnected', () => {
    it('should set the browser connected state', async () => {
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const local = await browserServer.connect();
      const browserWSEndpoint = browserServer.wsEndpoint();
      const newBrowser = await playwright.connect({browserWSEndpoint});
      expect(newBrowser.isConnected()).toBe(true);
      newBrowser.disconnect();
      expect(newBrowser.isConnected()).toBe(false);
      await browserServer.close();
    });
  });

};
