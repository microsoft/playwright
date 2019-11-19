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

module.exports.addTests = function({testRunner, expect, playwright, FFOX, CHROME, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const iPhone = playwright.devices['iPhone 6'];
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;
  describe.skip(WEBKIT)('Touchscreen', function() {
    it('should tap the button', async({page, server}) => {
      await page.emulate(iPhone);
      await page.goto(server.PREFIX + '/input/button.html');
      await page.tap('button');
      expect(await page.evaluate(() => result)).toBe('Clicked');
    });
    it('should report touches', async({page, server}) => {
      await page.emulate(iPhone);
      await page.goto(server.PREFIX + '/input/touches.html');
      const button = await page.$('button');
      await button.tap();
      expect(await page.evaluate(() => getResult())).toEqual(['Touchstart: 0', 'Touchend: 0']);
    });
  });
};
