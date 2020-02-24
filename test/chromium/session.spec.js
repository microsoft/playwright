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

const { waitEvent } = require('../utils');

/**
 * @type {ChromiumTestSuite}
 */
module.exports.describe = function({testRunner, expect, FFOX, CHROMIUM, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Chromium.createCDPSession', function() {
    it('should work', async function({page, browser, server}) {
      const client = await page.context().pageTarget(page).createCDPSession();

      await Promise.all([
        client.send('Runtime.enable'),
        client.send('Runtime.evaluate', { expression: 'window.foo = "bar"' })
      ]);
      const foo = await page.evaluate(() => window.foo);
      expect(foo).toBe('bar');
    });
    it('should send events', async function({page, browser, server}) {
      const client = await page.context().pageTarget(page).createCDPSession();
      await client.send('Network.enable');
      const events = [];
      client.on('Network.requestWillBeSent', event => events.push(event));
      await page.goto(server.EMPTY_PAGE);
      expect(events.length).toBe(1);
    });
    it('should enable and disable domains independently', async function({page, browser, server}) {
      const client = await page.context().pageTarget(page).createCDPSession();
      await client.send('Runtime.enable');
      await client.send('Debugger.enable');
      // JS coverage enables and then disables Debugger domain.
      await page.coverage.startJSCoverage();
      await page.coverage.stopJSCoverage();
      // generate a script in page and wait for the event.
      const [event] = await Promise.all([
        waitEvent(client, 'Debugger.scriptParsed'),
        page.evaluate('//# sourceURL=foo.js')
      ]);
      // expect events to be dispatched.
      expect(event.url).toBe('foo.js');
    });
    it('should be able to detach session', async function({page, browser, server}) {
      const client = await page.context().pageTarget(page).createCDPSession();
      await client.send('Runtime.enable');
      const evalResponse = await client.send('Runtime.evaluate', {expression: '1 + 2', returnByValue: true});
      expect(evalResponse.result.value).toBe(3);
      await client.detach();
      let error = null;
      try {
        await client.send('Runtime.evaluate', {expression: '3 + 1', returnByValue: true});
      } catch (e) {
        error = e;
      }
      expect(error.message).toContain('Session closed.');
    });
    it('should throw nice errors', async function({page, browser}) {
      const client = await page.context().pageTarget(page).createCDPSession();
      const error = await theSourceOfTheProblems().catch(error => error);
      expect(error.stack).toContain('theSourceOfTheProblems');
      expect(error.message).toContain('ThisCommand.DoesNotExist');

      async function theSourceOfTheProblems() {
        await client.send('ThisCommand.DoesNotExist');
      }
    });
  });
};
