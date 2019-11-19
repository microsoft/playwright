/**
 * Copyright 2017 Google Inc. All rights reserved.
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

  describe.skip(FFOX)('DefaultBrowserContext', function() {
    beforeEach(async state => {
      state.browser = await playwright.launch(defaultBrowserOptions);
      state.page = await state.browser.newPage();
    });
    afterEach(async state => {
      await state.browser.close();
      delete state.browser;
      delete state.page;
    });
    it('page.cookies() should work', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.evaluate(() => {
        document.cookie = 'username=John Doe';
      });
      expect(await page.cookies()).toEqual([{
        name: 'username',
        value: 'John Doe',
        domain: 'localhost',
        path: '/',
        expires: -1,
        size: 16,
        httpOnly: false,
        secure: false,
        session: true,
        sameSite: 'None',
      }]);
    });
    it.skip(WEBKIT)('page.setCookie() should work', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.setCookie({
        name: 'username',
        value: 'John Doe'
      });
      expect(await page.evaluate(() => document.cookie)).toBe('username=John Doe');
      expect(await page.cookies()).toEqual([{
        name: 'username',
        value: 'John Doe',
        domain: 'localhost',
        path: '/',
        expires: -1,
        size: 16,
        httpOnly: false,
        secure: false,
        session: true,
        sameSite: 'None',
      }]);
    });
    it.skip(WEBKIT)('page.deleteCookie() should work', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.setCookie({
        name: 'cookie1',
        value: '1'
      }, {
        name: 'cookie2',
        value: '2'
      });
      expect(await page.evaluate('document.cookie')).toBe('cookie1=1; cookie2=2');
      await page.deleteCookie({name: 'cookie2'});
      expect(await page.evaluate('document.cookie')).toBe('cookie1=1');
      expect(await page.cookies()).toEqual([{
        name: 'cookie1',
        value: '1',
        domain: 'localhost',
        path: '/',
        expires: -1,
        size: 8,
        httpOnly: false,
        secure: false,
        session: true,
        sameSite: 'None',
      }]);
    });
  });
};
