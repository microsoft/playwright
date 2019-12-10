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
const fs = require('fs');
const os = require('os');
const path = require('path');
const {helper} = require('../../lib/helper');
const utils = require('../utils');

module.exports.addTests = function({testRunner, expect, defaultBrowserOptions, playwright, FFOX, CHROME, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Playwright.connect', function() {
    it('should be able to connect multiple times to the same browser', async({server}) => {
      const originalBrowser = await playwright.launch(defaultBrowserOptions);
      const browser = await playwright.connect({
        ...defaultBrowserOptions,
        browserWSEndpoint: originalBrowser.chromium.wsEndpoint()
      });
      const page = await browser.newPage();
      expect(await page.evaluate(() => 7 * 8)).toBe(56);
      browser.disconnect();

      const secondPage = await originalBrowser.newPage();
      expect(await secondPage.evaluate(() => 7 * 6)).toBe(42, 'original browser should still work');
      await originalBrowser.close();
    });
    it('should be able to close remote browser', async({server}) => {
      const originalBrowser = await playwright.launch(defaultBrowserOptions);
      const remoteBrowser = await playwright.connect({
        ...defaultBrowserOptions,
        browserWSEndpoint: originalBrowser.chromium.wsEndpoint()
      });
      await Promise.all([
        utils.waitEvent(originalBrowser, 'disconnected'),
        remoteBrowser.close(),
      ]);
    });
    it('should support ignoreHTTPSErrors option', async({httpsServer}) => {
      const originalBrowser = await playwright.launch(defaultBrowserOptions);
      const browserWSEndpoint = originalBrowser.chromium.wsEndpoint();

      const browser = await playwright.connect({...defaultBrowserOptions, browserWSEndpoint, ignoreHTTPSErrors: true});
      const page = await browser.newPage();
      let error = null;
      const [serverRequest, response] = await Promise.all([
        httpsServer.waitForRequest('/empty.html'),
        page.goto(httpsServer.EMPTY_PAGE).catch(e => error = e)
      ]);
      expect(error).toBe(null);
      expect(response.ok()).toBe(true);
      await page.close();
      await browser.close();
    });
    it('should be able to reconnect to a disconnected browser', async({server}) => {
      const originalBrowser = await playwright.launch(defaultBrowserOptions);
      const browserWSEndpoint = originalBrowser.chromium.wsEndpoint();
      const page = await originalBrowser.newPage();
      await page.goto(server.PREFIX + '/frames/nested-frames.html');
      originalBrowser.disconnect();

      const browser = await playwright.connect({...defaultBrowserOptions, browserWSEndpoint});
      const pages = await browser.pages();
      const restoredPage = pages.find(page => page.url() === server.PREFIX + '/frames/nested-frames.html');
      expect(utils.dumpFrames(restoredPage.mainFrame())).toEqual([
        'http://localhost:<PORT>/frames/nested-frames.html',
        '    http://localhost:<PORT>/frames/frame.html (aframe)',
        '    http://localhost:<PORT>/frames/two-frames.html (2frames)',
        '        http://localhost:<PORT>/frames/frame.html (dos)',
        '        http://localhost:<PORT>/frames/frame.html (uno)',
      ]);
      expect(await restoredPage.evaluate(() => 7 * 8)).toBe(56);
      await browser.close();
    });
    // @see https://github.com/GoogleChrome/puppeteer/issues/4197#issuecomment-481793410
    it('should be able to connect to the same page simultaneously', async({server}) => {
      const browserOne = await playwright.launch(defaultBrowserOptions);
      const browserTwo = await playwright.connect({ ...defaultBrowserOptions, browserWSEndpoint: browserOne.chromium.wsEndpoint() });
      const [page1, page2] = await Promise.all([
        new Promise(x => browserOne.chromium.once('targetcreated', target => x(target.page()))),
        browserTwo.newPage(),
      ]);
      expect(await page1.evaluate(() => 7 * 8)).toBe(56);
      expect(await page2.evaluate(() => 7 * 6)).toBe(42);
      await browserOne.close();
    });
  });

  describe('Browser.disconnect', function() {
    it('should reject navigation when browser closes', async({server}) => {
      server.setRoute('/one-style.css', () => {});
      const browser = await playwright.launch(defaultBrowserOptions);
      const remote = await playwright.connect({...defaultBrowserOptions, browserWSEndpoint: browser.chromium.wsEndpoint()});
      const page = await remote.newPage();
      const navigationPromise = page.goto(server.PREFIX + '/one-style.html', {timeout: 60000}).catch(e => e);
      await server.waitForRequest('/one-style.css');
      remote.disconnect();
      const error = await navigationPromise;
      expect(error.message).toBe('Navigation failed because browser has disconnected!');
      await browser.close();
    });
    it('should reject waitForSelector when browser closes', async({server}) => {
      server.setRoute('/empty.html', () => {});
      const browser = await playwright.launch(defaultBrowserOptions);
      const remote = await playwright.connect({...defaultBrowserOptions, browserWSEndpoint: browser.chromium.wsEndpoint()});
      const page = await remote.newPage();
      const watchdog = page.waitForSelector('div', {timeout: 60000}).catch(e => e);
      remote.disconnect();
      const error = await watchdog;
      expect(error.message).toContain('Protocol error');
      await browser.close();
    });
  });

  describe('Browser.close', function() {
    it('should terminate network waiters', async({context, server}) => {
      const browser = await playwright.launch(defaultBrowserOptions);
      const remote = await playwright.connect({...defaultBrowserOptions, browserWSEndpoint: browser.chromium.wsEndpoint()});
      const newPage = await remote.newPage();
      const results = await Promise.all([
        newPage.waitForRequest(server.EMPTY_PAGE).catch(e => e),
        newPage.waitForResponse(server.EMPTY_PAGE).catch(e => e),
        browser.close()
      ]);
      for (let i = 0; i < 2; i++) {
        const message = results[i].message;
        expect(message).toContain('Target closed');
        expect(message).not.toContain('Timeout');
      }
    });
  });

};
