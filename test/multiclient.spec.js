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

const utils = require('./utils');

module.exports.describe = function({testRunner, expect, defaultBrowserOptions, playwright, FFOX, CHROMIUM, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('BrowserContext', function() {
    it('should work across sessions', async () => {
      const browserApp = await playwright.launchBrowserApp({...defaultBrowserOptions });
      const browser = await playwright.connect({ wsEndpoint: browserApp.wsEndpoint() });
      expect(browser.browserContexts().length).toBe(1);
      await browser.newContext();
      expect(browser.browserContexts().length).toBe(2);
      const remoteBrowser = await playwright.connect({ wsEndpoint: browserApp.wsEndpoint() });
      const contexts = remoteBrowser.browserContexts();
      expect(contexts.length).toBe(2);
      await browserApp.close();
    });
  });

  describe('Browser.Events.disconnected', function() {
    it('should be emitted when: browser gets closed, disconnected or underlying websocket gets closed', async () => {
      const browserApp = await playwright.launchBrowserApp({ ...defaultBrowserOptions });
      const originalBrowser = await playwright.connect({ wsEndpoint: browserApp.wsEndpoint() });
      const wsEndpoint = browserApp.wsEndpoint();
      const remoteBrowser1 = await playwright.connect({ wsEndpoint });
      const remoteBrowser2 = await playwright.connect({ wsEndpoint });

      let disconnectedOriginal = 0;
      let disconnectedRemote1 = 0;
      let disconnectedRemote2 = 0;
      originalBrowser.on('disconnected', () => ++disconnectedOriginal);
      remoteBrowser1.on('disconnected', () => ++disconnectedRemote1);
      remoteBrowser2.on('disconnected', () => ++disconnectedRemote2);

      await Promise.all([
        utils.waitEvent(remoteBrowser2, 'disconnected'),
        remoteBrowser2.disconnect(),
      ]);

      expect(disconnectedOriginal).toBe(0);
      expect(disconnectedRemote1).toBe(0);
      expect(disconnectedRemote2).toBe(1);

      await Promise.all([
        utils.waitEvent(remoteBrowser1, 'disconnected'),
        utils.waitEvent(originalBrowser, 'disconnected'),
        browserApp.close(),
      ]);

      expect(disconnectedOriginal).toBe(1);
      expect(disconnectedRemote1).toBe(1);
      expect(disconnectedRemote2).toBe(1);
    });
  });

  describe('Playwright.connect', function() {
    it('should be able to connect multiple times to the same browser', async({server}) => {
      const browserApp = await playwright.launchBrowserApp({...defaultBrowserOptions });
      const local = await playwright.connect({ wsEndpoint: browserApp.wsEndpoint() });
      const remote = await playwright.connect({ wsEndpoint: browserApp.wsEndpoint() });
      const page = await remote.defaultContext().newPage();
      expect(await page.evaluate(() => 7 * 8)).toBe(56);
      remote.disconnect();

      const secondPage = await local.defaultContext().newPage();
      expect(await secondPage.evaluate(() => 7 * 6)).toBe(42, 'original browser should still work');
      await browserApp.close();
    });
    it('should be able to close remote browser', async({server}) => {
      const browserApp = await playwright.launchBrowserApp({...defaultBrowserOptions });
      const local = await playwright.connect({ wsEndpoint: browserApp.wsEndpoint() });
      const remote = await playwright.connect({ wsEndpoint: browserApp.wsEndpoint() });
      await Promise.all([
        utils.waitEvent(local, 'disconnected'),
        remote.close(),
      ]);
    });
    // @see https://github.com/GoogleChrome/puppeteer/issues/4197#issuecomment-481793410
    it('should be able to connect to the same page simultaneously', async({server}) => {
      const browserApp = await playwright.launchBrowserApp({...defaultBrowserOptions });
      const browser1 = await playwright.connect({ wsEndpoint: browserApp.wsEndpoint() });
      const page1 = await browser1.defaultContext().newPage();
      await page1.goto(server.EMPTY_PAGE);
      const browser2 = await playwright.connect({ wsEndpoint: browserApp.wsEndpoint() });
      const page2 = (await browser2.defaultContext().pages()).find(page => page.url() === server.EMPTY_PAGE);
      expect(await page1.evaluate(() => 7 * 8)).toBe(56);
      expect(await page2.evaluate(() => 7 * 6)).toBe(42);
      await browserApp.close();
    });
  });
};
