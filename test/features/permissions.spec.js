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

const fs = require('fs');
const path = require('path');

/**
 * @type {PageTestSuite}
 */
module.exports.describe = function({testRunner, expect, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  // Permissions API is not implemented in WebKit (see https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API)
  describe.skip(WEBKIT)('Permissions', function() {
    function getPermission(page, name) {
      return page.evaluate(name => navigator.permissions.query({name}).then(result => result.state), name);
    }

    it('should be prompt by default', async({page, server, context}) => {
      await page.goto(server.EMPTY_PAGE);
      expect(await getPermission(page, 'geolocation')).toBe('prompt');
    });
    it('should deny permission when not listed', async({page, server, context}) => {
      await page.goto(server.EMPTY_PAGE);
      await context.setPermissions(server.EMPTY_PAGE, []);
      expect(await getPermission(page, 'geolocation')).toBe('denied');
    });
    it('should fail when bad permission is given', async({page, server, context}) => {
      await page.goto(server.EMPTY_PAGE);
      let error = {};
      await context.setPermissions(server.EMPTY_PAGE, ['foo']).catch(e => error = e);
      expect(error.message).toBe('Unknown permission: foo');
    });
    it('should grant permission when listed', async({page, server, context}) => {
      await page.goto(server.EMPTY_PAGE);
      await context.setPermissions(server.EMPTY_PAGE, ['geolocation']);
      expect(await getPermission(page, 'geolocation')).toBe('granted');
    });
    it('should reset permissions', async({page, server, context}) => {
      await page.goto(server.EMPTY_PAGE);
      await context.setPermissions(server.EMPTY_PAGE, ['geolocation']);
      expect(await getPermission(page, 'geolocation')).toBe('granted');
      await context.clearPermissions();
      expect(await getPermission(page, 'geolocation')).toBe('prompt');
    });
    it('should trigger permission onchange', async({page, server, context}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.evaluate(() => {
        window['events'] = [];
        return navigator.permissions.query({name: 'geolocation'}).then(function(result) {
          window['events'].push(result.state);
          result.onchange = function() {
            window['events'].push(result.state);
          };
        });
      });
      expect(await page.evaluate(() => window['events'])).toEqual(['prompt']);
      await context.setPermissions(server.EMPTY_PAGE, []);
      expect(await page.evaluate(() => window['events'])).toEqual(['prompt', 'denied']);
      await context.setPermissions(server.EMPTY_PAGE, ['geolocation']);
      expect(await page.evaluate(() => window['events'])).toEqual(['prompt', 'denied', 'granted']);
      await context.clearPermissions();
      expect(await page.evaluate(() => window['events'])).toEqual(['prompt', 'denied', 'granted', 'prompt']);
    });
    it('should isolate permissions between browser contexs', async({page, server, context, browser}) => {
      await page.goto(server.EMPTY_PAGE);
      const otherContext = await browser.newContext();
      const otherPage = await otherContext.newPage();
      await otherPage.goto(server.EMPTY_PAGE);
      expect(await getPermission(page, 'geolocation')).toBe('prompt');
      expect(await getPermission(otherPage, 'geolocation')).toBe('prompt');

      await context.setPermissions(server.EMPTY_PAGE, []);
      await otherContext.setPermissions(server.EMPTY_PAGE, ['geolocation']);
      expect(await getPermission(page, 'geolocation')).toBe('denied');
      expect(await getPermission(otherPage, 'geolocation')).toBe('granted');

      await context.clearPermissions();
      expect(await getPermission(page, 'geolocation')).toBe('prompt');
      expect(await getPermission(otherPage, 'geolocation')).toBe('granted');
      await otherContext.close();
    });
  });
};
