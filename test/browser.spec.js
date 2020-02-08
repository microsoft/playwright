/**
 * Copyright 2020 Microsoft Corporation. All rights reserved.
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

module.exports.describe = function({testRunner, expect, playwright, CHROMIUM, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Browser', function() {
    it('should create new page', async function({browser}) {
      expect((await browser.pages()).length).toBe(0);
      const page1 = await browser.newPage();
      expect((await browser.pages()).length).toBe(1);
      expect(browser.contexts().length).toBe(1);

      const page2 = await browser.newPage();
      expect((await browser.pages()).length).toBe(2);
      expect(browser.contexts().length).toBe(2);

      await page1.context().close();
      expect((await browser.pages()).length).toBe(1);
      expect(browser.contexts().length).toBe(1);

      await page2.context().close();
      expect((await browser.pages()).length).toBe(0);
      expect(browser.contexts().length).toBe(0);
    });
  });
};
