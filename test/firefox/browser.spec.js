/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const path = require('path');
const {spawn, execSync} = require('child_process');

module.exports.describe = function({testRunner, defaultBrowserOptions, playwright, playwrightPath}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('FFBrowser', function() {
    it('should close the browser when the node process closes', async({ server }) => {
      const options = Object.assign({}, defaultBrowserOptions, {
        // Disable DUMPIO to cleanly read stdout.
        dumpio: false,
      });
      const res = spawn('node', [path.join(__dirname, '..', 'fixtures', 'closeme.js'), playwrightPath, JSON.stringify(options)]);
      let wsEndPointCallback;
      const wsEndPointPromise = new Promise(x => wsEndPointCallback = x);
      let output = '';
      res.stdout.on('data', data => {
        output += data;
        if (output.indexOf('\n'))
          wsEndPointCallback(output.substring(0, output.indexOf('\n')));
      });
      const browser = await playwright.connect({ browserWSEndpoint: await wsEndPointPromise });
      const promises = [
        new Promise(resolve => browser.once('disconnected', resolve)),
        new Promise(resolve => res.on('close', resolve))
      ];
      if (process.platform === 'win32')
        execSync(`taskkill /pid ${res.pid} /T /F`);
      else
        process.kill(res.pid);
      await Promise.all(promises);
    });
  });
};
