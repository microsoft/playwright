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

/**
 * @type {PageTestSuite}
 */
module.exports.describe = function ({ testRunner, expect, FFOX, WEBKIT }) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe.skip(FFOX)('Overrides.setGeolocation', function() {
    it('should work', async({page, server, context}) => {
      await context.setPermissions(server.PREFIX, ['geolocation']);
      await page.goto(server.EMPTY_PAGE);
      await context.setGeolocation({longitude: 10, latitude: 10});
      const geolocation = await page.evaluate(() => new Promise(resolve => navigator.geolocation.getCurrentPosition(position => {
        resolve({latitude: position.coords.latitude, longitude: position.coords.longitude});
      })));
      expect(geolocation).toEqual({
        latitude: 10,
        longitude: 10
      });
    });
    it('should throw when invalid longitude', async({context}) => {
      let error = null;
      try {
        await context.setGeolocation({longitude: 200, latitude: 10});
      } catch (e) {
        error = e;
      }
      expect(error.message).toContain('Invalid longitude "200"');
    });
    it('should throw with missing latitude', async({context}) => {
      let error = null;
      try {
        await context.setGeolocation({longitude: 10});
      } catch (e) {
        error = e;
      }
      expect(error.message).toContain('Invalid latitude "undefined"');
    });
    it('should not modify passed default options object', async({browser}) => {
      const geolocation = { longitude: 10, latitude: 10 };
      const options = { geolocation };
      const context = await browser.newContext(options);
      await context.setGeolocation({ longitude: 20, latitude: 20 });
      expect(options.geolocation).toBe(geolocation);
      await context.close();
    });
    it('should throw with missing longitude in default options', async({browser}) => {
      let error = null;
      try {
        const context = await browser.newContext({ geolocation: {latitude: 10} });
        await context.close();
      } catch (e) {
        error = e;
      }
      expect(error.message).toContain('Invalid longitude "undefined"');
    });
    it('should use context options', async({browser, server}) => {
      const options = { geolocation: { longitude: 10, latitude: 10 }, permissions: {} };
      options.permissions[server.PREFIX] = ['geolocation'];
      const context = await browser.newContext(options);
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);

      const geolocation = await page.evaluate(() => new Promise(resolve => navigator.geolocation.getCurrentPosition(position => {
        resolve({latitude: position.coords.latitude, longitude: position.coords.longitude});
      })));
      expect(geolocation).toEqual({
        latitude: 10,
        longitude: 10
      });
      await context.close();
    });
  });
};
