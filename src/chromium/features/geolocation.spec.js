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

const utils = require('../../../test/utils');
const {waitEvent} = utils;

module.exports.addTests = function ({ testRunner, expect }) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  // FIXME: not supported in WebKit (as well as Emulation domain in general).
  // It was removed from WebKit in https://webkit.org/b/126630
  describe('Overrides.setGeolocation', function() {
    it('should work', async({page, server, context}) => {
      await context.permissions.override(server.PREFIX, ['geolocation']);
      await page.goto(server.EMPTY_PAGE);
      await page.overrides.setGeolocation({longitude: 10, latitude: 10});
      const geolocation = await page.evaluate(() => new Promise(resolve => navigator.geolocation.getCurrentPosition(position => {
        resolve({latitude: position.coords.latitude, longitude: position.coords.longitude});
      })));
      expect(geolocation).toEqual({
        latitude: 10,
        longitude: 10
      });
    });
    it('should throw when invalid longitude', async({page, server, context}) => {
      let error = null;
      try {
        await page.overrides.setGeolocation({longitude: 200, latitude: 10});
      } catch (e) {
        error = e;
      }
      expect(error.message).toContain('Invalid longitude "200"');
    });
  });

};
