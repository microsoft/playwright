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

/**
 * @type {TestSuite}
 */
module.exports.describe = function({testRunner, expect, defaultBrowserOptions, playwright, FFOX, CHROMIUM, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('BrowserContext', function() {
    it('should work across sessions', async () => {
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const browser1 = await playwright.connect({ wsEndpoint: browserServer.wsEndpoint() });
      expect(browser1.contexts().length).toBe(0);
      await browser1.newContext();
      expect(browser1.contexts().length).toBe(1);

      const browser2 = await playwright.connect({ wsEndpoint: browserServer.wsEndpoint() });
      expect(browser2.contexts().length).toBe(0);
      await browser2.newContext();
      expect(browser2.contexts().length).toBe(1);

      expect(browser1.contexts().length).toBe(1);
      await browserServer.close();
    });
  });

  describe('Browser.Events.disconnected', function() {
    it('should be emitted when: browser gets closed, disconnected or underlying websocket gets closed', async () => {
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const originalBrowser = await playwright.connect({ wsEndpoint: browserServer.wsEndpoint() });
      const wsEndpoint = browserServer.wsEndpoint();
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
        remoteBrowser2.close(),
      ]);

      expect(disconnectedOriginal).toBe(0);
      expect(disconnectedRemote1).toBe(0);
      expect(disconnectedRemote2).toBe(1);

      await Promise.all([
        utils.waitEvent(remoteBrowser1, 'disconnected'),
        utils.waitEvent(originalBrowser, 'disconnected'),
        browserServer.close(),
      ]);

      expect(disconnectedOriginal).toBe(1);
      expect(disconnectedRemote1).toBe(1);
      expect(disconnectedRemote2).toBe(1);
    });
  });

  describe('Playwright.connect', function() {
    it('should be able to connect multiple times to the same browser', async({server}) => {
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const browser1 = await playwright.connect({ wsEndpoint: browserServer.wsEndpoint() });
      const browser2 = await playwright.connect({ wsEndpoint: browserServer.wsEndpoint() });
      const page1 = await browser1.newPage();
      expect(await page1.evaluate(() => 7 * 8)).toBe(56);
      browser1.close();

      const page2 = await browser2.newPage();
      expect(await page2.evaluate(() => 7 * 6)).toBe(42, 'original browser should still work');
      await browserServer.close();
    });
    it('should not be able to close remote browser', async() => {
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      {
        const remote = await playwright.connect({ wsEndpoint: browserServer.wsEndpoint() });
        await remote.newContext();
        await remote.close();
      }
      {
        const remote = await playwright.connect({ wsEndpoint: browserServer.wsEndpoint() });
        await remote.newContext();
        await remote.close();
      }
    });
  });
};
