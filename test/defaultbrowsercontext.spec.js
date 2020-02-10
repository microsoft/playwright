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

const { makeUserDataDir, removeUserDataDir } = require('./utils');

/**
 * @type {PageTestSuite}
 */
module.exports.describe = function ({ testRunner, expect, defaultBrowserOptions, playwright }) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('launchPersistent()', function() {
    beforeEach(async state => {
      state.userDataDir = await makeUserDataDir();
      state.browserContext = await playwright.launchPersistent(state.userDataDir, defaultBrowserOptions);
      state.page = await state.browserContext.newPage();
    });
    afterEach(async state => {
      await state.browserContext.close();
      delete state.browserContext;
      delete state.page;
      await removeUserDataDir(state.userDataDir);
    });
    it('context.cookies() should work', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.evaluate(() => {
        document.cookie = 'username=John Doe';
      });
      expect(await page.context().cookies()).toEqual([{
        name: 'username',
        value: 'John Doe',
        domain: 'localhost',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        session: true,
        sameSite: 'None',
      }]);
    });
    it('context.setCookies() should work', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.context().setCookies([{
        url: server.EMPTY_PAGE,
        name: 'username',
        value: 'John Doe'
      }]);
      expect(await page.evaluate(() => document.cookie)).toBe('username=John Doe');
      expect(await page.context().cookies()).toEqual([{
        name: 'username',
        value: 'John Doe',
        domain: 'localhost',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        session: true,
        sameSite: 'None',
      }]);
    });
    it('context.clearCookies() should work', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.context().setCookies([{
        url: server.EMPTY_PAGE,
        name: 'cookie1',
        value: '1'
      }, {
        url: server.EMPTY_PAGE,
        name: 'cookie2',
        value: '2'
      }]);
      expect(await page.evaluate('document.cookie')).toBe('cookie1=1; cookie2=2');
      await page.context().clearCookies();
      expect(await page.evaluate('document.cookie')).toBe('');
    });
  });
};
