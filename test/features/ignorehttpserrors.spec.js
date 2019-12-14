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

module.exports.addTests = function({testRunner, expect, defaultBrowserOptions, playwright, FFOX, CHROME, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;
  describe('ignoreHTTPSErrors', function() {
    beforeAll(async state => {
      state.browser = await playwright.launch({...defaultBrowserOptions, ignoreHTTPSErrors: true});
    });
    afterAll(async state => {
      await state.browser.close();
      delete state.browser;
    });
    beforeEach(async state => {
      state.context = await state.browser.newContext();
      state.page = await state.context.newPage();
    });
    afterEach(async state => {
      await state.context.close();
      delete state.context;
      delete state.page;
    });

    it('should work with request interception', async({page, server, httpsServer}) => {
      await page.interception.enable();
      page.on('request', request => page.interception.continue(request));
      const response = await page.goto(httpsServer.EMPTY_PAGE);
      expect(response.status()).toBe(200);
    });
  });
};
