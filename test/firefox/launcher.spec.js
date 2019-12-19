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
const os = require('os');
const path = require('path');
const {helper} = require('../../lib/helper');
const rmAsync = helper.promisify(require('rimraf'));
const mkdtempAsync = helper.promisify(fs.mkdtemp);
const TMP_FOLDER = path.join(os.tmpdir(), 'pptr_tmp_folder-');

module.exports.describe = function ({ testRunner, expect, defaultBrowserOptions, playwright }) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('FFPlaywright', function() {
    describe('Playwright.launch', function() {
      it('userDataDir option', async({server}) => {
        const userDataDir = await mkdtempAsync(TMP_FOLDER);
        const options = Object.assign({userDataDir}, defaultBrowserOptions);
        const browser = await playwright.launch(options);
        // Open a page to make sure its functional.
        await browser.defaultContext().newPage();
        expect(fs.readdirSync(userDataDir).length).toBeGreaterThan(0);
        await browser.close();
        expect(fs.readdirSync(userDataDir).length).toBeGreaterThan(0);
        // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
        await rmAsync(userDataDir).catch(e => {});
      });
      it('userDataDir argument', async({server}) => {
        const userDataDir = await mkdtempAsync(TMP_FOLDER);
        const options = Object.assign({}, defaultBrowserOptions);
        options.args = [
          ...(defaultBrowserOptions.args || []),
          `-profile`,
          userDataDir,
        ];
        const browser = await playwright.launch(options);
        expect(fs.readdirSync(userDataDir).length).toBeGreaterThan(0);
        await browser.close();
        expect(fs.readdirSync(userDataDir).length).toBeGreaterThan(0);
        // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
        await rmAsync(userDataDir).catch(e => {});
      });
      it('should return the default arguments', async() => {
        expect(playwright.defaultArgs({browser: 'firefox'})).toContain('-headless');
        expect(playwright.defaultArgs({browser: 'firefox', headless: false})).not.toContain('-headless');
        expect(playwright.defaultArgs({browser: 'firefox', userDataDir: 'foo'})).toContain('-profile');
        expect(playwright.defaultArgs({browser: 'firefox', userDataDir: 'foo'})).toContain('foo');
      });
      it('should filter out ignored default arguments', async() => {
        // Make sure we launch with `--enable-automation` by default.
        const defaultArgs = playwright.defaultArgs(defaultBrowserOptions);
        const browserServer = await playwright.launchServer(Object.assign({}, defaultBrowserOptions, {
          // Ignore first and third default argument.
          ignoreDefaultArgs: [ defaultArgs[0], defaultArgs[2] ],
        }));
        const spawnargs = browserServer.process().spawnargs;
        expect(spawnargs.indexOf(defaultArgs[0])).toBe(-1);
        expect(spawnargs.indexOf(defaultArgs[1])).not.toBe(-1);
        expect(spawnargs.indexOf(defaultArgs[2])).toBe(-1);
        await browserServer.close();
      });
    });
  });
};
