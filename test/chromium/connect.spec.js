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

module.exports.describe = function({testRunner, expect, defaultBrowserOptions, playwright, FFOX, CHROMIUM, WEBKIT}) {
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
};
