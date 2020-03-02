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
module.exports.describe = function({testRunner, expect, playwright, FFOX, CHROMIUM, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('BrowserContext', function() {
    it('should create a worker from a service worker', async({browser, page, server, context}) => {
      const [worker] = await Promise.all([
        new Promise(fulfill => context.once('serviceworker', fulfill)),
        page.goto(server.PREFIX + '/serviceworkers/empty/sw.html')
      ]);
      expect(await worker.evaluate(() => self.toString())).toBe('[object ServiceWorkerGlobalScope]');
    });
    it('should not create a worker from a shared worker', async({browser, page, server, context}) => {
      await page.goto(server.EMPTY_PAGE);
      let serviceWorkerCreated;
      context.once('serviceworker', () => serviceWorkerCreated = true);
      await page.evaluate(() => {
        new SharedWorker('data:text/javascript,console.log("hi")');
      });
      expect(serviceWorkerCreated).not.toBeTruthy();
    });
  });

  describe('Chromium-Specific Page Tests', function() {
    it('Page.route should work with intervention headers', async({server, page}) => {
      server.setRoute('/intervention', (req, res) => res.end(`
        <script>
          document.write('<script src="${server.CROSS_PROCESS_PREFIX}/intervention.js">' + '</scr' + 'ipt>');
        </script>
      `));
      server.setRedirect('/intervention.js', '/redirect.js');
      let serverRequest = null;
      server.setRoute('/redirect.js', (req, res) => {
        serverRequest = req;
        res.end('console.log(1);');
      });

      await page.route('*', request => request.continue());
      await page.goto(server.PREFIX + '/intervention');
      // Check for feature URL substring rather than https://www.chromestatus.com to
      // make it work with Edgium.
      expect(serverRequest.headers.intervention).toContain('feature/5718547946799104');
    });
  });

};
