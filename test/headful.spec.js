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

const { makeUserDataDir, removeUserDataDir } = require('./utils');

/**
 * @type {TestSuite}
 */
module.exports.describe = function({testRunner, expect, playwright, defaultBrowserOptions, FFOX, CHROMIUM, WEBKIT, WIN}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  const headfulOptions = Object.assign({}, defaultBrowserOptions, {
    headless: false
  });
  const headlessOptions = Object.assign({}, defaultBrowserOptions, {
    headless: true
  });

  describe('Headful', function() {
    it('should have default url when launching browser', async function() {
      const userDataDir = await makeUserDataDir();
      const browserContext = await playwright.launchPersistent(userDataDir, headfulOptions);
      const pages = (await browserContext.pages()).map(page => page.url());
      expect(pages).toEqual(['about:blank']);
      await browserContext.close();
      await removeUserDataDir(userDataDir);
    });
    // see https://github.com/microsoft/playwright/issues/717
    it.skip((WIN && CHROMIUM) || FFOX)('headless should be able to read cookies written by headful', async({server}) => {
      const userDataDir = await makeUserDataDir();
      // Write a cookie in headful chrome
      const headfulContext = await playwright.launchPersistent(userDataDir, headfulOptions);
      const headfulPage = await headfulContext.newPage();
      await headfulPage.goto(server.EMPTY_PAGE);
      await headfulPage.evaluate(() => document.cookie = 'foo=true; expires=Fri, 31 Dec 9999 23:59:59 GMT');
      await headfulContext.close();
      // Read the cookie from headless chrome
      const headlessContext = await playwright.launchPersistent(userDataDir, headlessOptions);
      const headlessPage = await headlessContext.newPage();
      await headlessPage.goto(server.EMPTY_PAGE);
      const cookie = await headlessPage.evaluate(() => document.cookie);
      await headlessContext.close();
      // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
      await removeUserDataDir(userDataDir);
      expect(cookie).toBe('foo=true');
    });
    it.skip(FFOX)('should close browser with beforeunload page', async({server}) => {
      const userDataDir = await makeUserDataDir();
      const browserContext = await playwright.launchPersistent(userDataDir, headfulOptions);
      const page = await browserContext.newPage();
      await page.goto(server.PREFIX + '/beforeunload.html');
      // We have to interact with a page so that 'beforeunload' handlers
      // fire.
      await page.click('body');
      await browserContext.close();
      await removeUserDataDir(userDataDir);
    });
  });
};
