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
 * @type {TestSuite}
 */
module.exports.describe = function ({ testRunner, expect, FFOX, WEBKIT }) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('BrowserContext.setGeolocation', function() {
    it.context('should work', async({server, context}) => {
      const page = await context.newPage();
      await context.grantPermissions(['geolocation']);
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
    it.context('should throw when invalid longitude', async({context}) => {
      let error = null;
      try {
        await context.setGeolocation({longitude: 200, latitude: 10});
      } catch (e) {
        error = e;
      }
      expect(error.message).toContain('Invalid longitude "200"');
    });
    it.context('should throw with missing latitude', async({context}) => {
      let error = null;
      try {
        await context.setGeolocation({longitude: 10});
      } catch (e) {
        error = e;
      }
      expect(error.message).toContain('Invalid latitude "undefined"');
    });
    it.browser('should not modify passed default options object', async({browser}) => {
      const geolocation = { longitude: 10, latitude: 10 };
      const options = { geolocation };
      const context = await browser.newContext(options);
      await context.setGeolocation({ longitude: 20, latitude: 20 });
      expect(options.geolocation).toBe(geolocation);
      await context.close();
    });
    it.browser('should throw with missing longitude in default options', async({browser}) => {
      let error = null;
      try {
        const context = await browser.newContext({ geolocation: {latitude: 10} });
        await context.close();
      } catch (e) {
        error = e;
      }
      expect(error.message).toContain('Invalid longitude "undefined"');
    });
    it.browser('should use context options', async({browser, server}) => {
      const options = { geolocation: { longitude: 10, latitude: 10 }, permissions: ['geolocation'] };
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
    it.context('watchPosition should be notified', async({server, context}) => {
      const page = await context.newPage();
      await context.grantPermissions(['geolocation']);
      await page.goto(server.EMPTY_PAGE);
      const messages = [];
      page.on('console', message => messages.push(message.text()));

      await context.setGeolocation({latitude: 0, longitude: 0});
      await page.evaluate(() => {
        navigator.geolocation.watchPosition(pos => {
          const coords = pos.coords;
          console.log(`lat=${coords.latitude} lng=${coords.longitude}`);
        }, err => {});
      });
      await context.setGeolocation({latitude: 0, longitude: 10});
      await page.waitForEvent('console', message => message.text().includes('lat=0 lng=10'));
      await context.setGeolocation({latitude: 20, longitude: 30});
      await page.waitForEvent('console', message => message.text().includes('lat=20 lng=30'));
      await context.setGeolocation({latitude: 40, longitude: 50});
      await page.waitForEvent('console', message => message.text().includes('lat=40 lng=50'));

      const allMessages = messages.join('|');
      expect(allMessages).toContain('lat=0 lng=10');
      expect(allMessages).toContain('lat=20 lng=30');
      expect(allMessages).toContain('lat=40 lng=50');
    });
    it.context('should use context options for popup', async({context, server}) => {
      const page = await context.newPage();
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ longitude: 10, latitude: 10 });
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.evaluate(url => window._popup = window.open(url), server.PREFIX + '/geolocation.html'),
      ]);
      await popup.waitForLoadState();
      const geolocation = await popup.evaluate(() => window.geolocationPromise);
      expect(geolocation).toEqual({ longitude: 10, latitude: 10 });
    });
  });
};
