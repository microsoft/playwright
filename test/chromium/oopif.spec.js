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

/**
 * @type {ChromiumTestSuite}
 */
module.exports.describe = function({testRunner, expect, defaultBrowserOptions, playwright, FFOX, CHROMIUM, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('OOPIF', function() {
    beforeAll(async function(state) {
      state.browser = await playwright.launch(Object.assign({}, defaultBrowserOptions, {
        args: (defaultBrowserOptions.args || []).concat(['--site-per-process']),
      }));
    });
    beforeEach(async function(state) {
      state.context = await state.browser.newContext();
      state.page = await state.context.newPage();
    });
    afterEach(async function(state) {
      await state.context.close();
      state.page = null;
      state.context = null;
    });
    afterAll(async function(state) {
      await state.browser.close();
      state.browser = null;
    });
    xit('should report oopif frames', async function({browser, page, server, context}) {
      await page.goto(server.PREFIX + '/dynamic-oopif.html');
      expect(oopifs(page.context()).length).toBe(1);
      expect(page.frames().length).toBe(2);
    });
    it('should load oopif iframes with subresources and request interception', async function({browser, page, server, context}) {
      await page.route('*', request => request.continue());
      await page.goto(server.PREFIX + '/dynamic-oopif.html');
      expect(oopifs(page.context()).length).toBe(1);
    });
  });
};


function oopifs(context) {
  return context.targets().filter(target => target._targetInfo.type === 'iframe');
}
