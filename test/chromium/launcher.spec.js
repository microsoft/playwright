/**
 * Copyright 2019 Google Inc. All rights reserved.
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

const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readFileAsync = util.promisify(fs.readFile);
const rmAsync = util.promisify(require('rimraf'));
const mkdtempAsync = util.promisify(fs.mkdtemp);
const statAsync = util.promisify(fs.stat);
const { makeUserDataDir, removeUserDataDir } = require('../utils');

const TMP_FOLDER = path.join(os.tmpdir(), 'pw_tmp_folder-');

/**
 * @type {TestSuite}
 */
module.exports.describe = function({testRunner, expect, defaultBrowserOptions, browserType, WIN}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  const headfulOptions = Object.assign({}, defaultBrowserOptions, {
    headless: false
  });
  const extensionPath = path.join(__dirname, '..', 'assets', 'simple-extension');
  const extensionOptions = Object.assign({}, defaultBrowserOptions, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  describe('launcher', function() {
    it('should throw with remote-debugging-pipe argument', async() => {
      const options = Object.assign({}, defaultBrowserOptions);
      options.args = ['--remote-debugging-pipe'].concat(options.args || []);
      const error = await browserType.launchServer(options).catch(e => e);
      expect(error.message).toContain('Playwright manages remote debugging connection itself');
    });
    it('should throw with remote-debugging-port argument', async() => {
      const options = Object.assign({}, defaultBrowserOptions);
      options.args = ['--remote-debugging-port=9222'].concat(options.args || []);
      const error = await browserType.launchServer(options).catch(e => e);
      expect(error.message).toContain('Playwright manages remote debugging connection itself');
    });
    it('should open devtools when "devtools: true" option is given', async({server}) => {
      const browser = await browserType.launch(Object.assign({devtools: true}, headfulOptions));
      const context = await browser.newContext();
      const browserSession = await browser.newBrowserCDPSession();
      await browserSession.send('Target.setDiscoverTargets', { discover: true });
      const devtoolsPagePromise = new Promise(fulfill => browserSession.on('Target.targetCreated', async ({targetInfo}) => {
        if (targetInfo.type === 'other' && targetInfo.url.includes('devtools://'))
           fulfill();
      }));
      await Promise.all([
        devtoolsPagePromise,
        context.newPage()
      ]);
      await browser.close();
    });
  });

  describe('extensions', () => {
    it('should return background pages', async() => {
      const userDataDir = await makeUserDataDir();
      const context = await browserType.launchPersistentContext(userDataDir, extensionOptions);
      const backgroundPages = context.backgroundPages();
      let backgroundPage = backgroundPages.length
          ? backgroundPages[0]
          : await context.waitForEvent('backgroundpage');
      expect(backgroundPage).toBeTruthy();
      expect(context.backgroundPages()).toContain(backgroundPage);
      expect(context.pages()).not.toContain(backgroundPage);
      await removeUserDataDir(userDataDir);
    });
  });

  describe('BrowserContext', function() {
    it('should not create pages automatically', async function() {
      const browser = await browserType.launch();
      const browserSession = await browser.newBrowserCDPSession();
      const targets = [];
      browserSession.on('Target.targetCreated', async ({targetInfo}) => {
        if (targetInfo.type !== 'browser')
           targets.push(targetInfo);
      });
      await browserSession.send('Target.setDiscoverTargets', { discover: true });
      await browser.newContext();
      await browser.close();
      expect(targets.length).toBe(0);
    });
  });
};
