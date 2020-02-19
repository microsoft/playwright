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

/**
 * @type {BrowserTestSuite}
 */
module.exports.describe = function({testRunner, expect, defaultBrowserOptions, playwright, FFOX, CHROMIUM, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;
  describe('ignoreHTTPSErrors', function() {
    it('should work', async({browser, httpsServer}) => {
      let error = null;
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const response = await page.goto(httpsServer.EMPTY_PAGE).catch(e => error = e);
      expect(error).toBe(null);
      expect(response.ok()).toBe(true);
      await context.close();
    });
    it('should work with mixed content', async({browser, server, httpsServer}) => {
      httpsServer.setRoute('/mixedcontent.html', (req, res) => {
        res.end(`<iframe src=${server.EMPTY_PAGE}></iframe>`);
      });
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      await page.goto(httpsServer.PREFIX + '/mixedcontent.html', {waitUntil: 'load'});
      expect(page.frames().length).toBe(2);
      // Make sure blocked iframe has functional execution context
      // @see https://github.com/GoogleChrome/puppeteer/issues/2709
      expect(await page.frames()[0].evaluate('1 + 2')).toBe(3);
      expect(await page.frames()[1].evaluate('2 + 3')).toBe(5);
      await context.close();
    });
  });
};
