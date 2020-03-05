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
module.exports.describe = function({testRunner, expect, defaultBrowserOptions, playwright, WIN}) {
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
      const error = await playwright.launchServer(options).catch(e => e);
      expect(error.message).toContain('Playwright manages remote debugging connection itself');
    });
    it('should throw with remote-debugging-port argument', async() => {
      const options = Object.assign({}, defaultBrowserOptions);
      options.args = ['--remote-debugging-port=9222'].concat(options.args || []);
      const error = await playwright.launchServer(options).catch(e => e);
      expect(error.message).toContain('Playwright manages remote debugging connection itself');
    });
    it('should open devtools when "devtools: true" option is given', async({server}) => {
      const browser = await playwright.launch(Object.assign({devtools: true}, headfulOptions));
      const context = await browser.newContext();
      const browserSession = await browser.createBrowserSession();
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
      const context = await playwright.launchPersistent(userDataDir, extensionOptions);
      const backgroundPages = await context.backgroundPages();
      let backgroundPage = backgroundPages.length
          ? backgroundPages[0]
          : await context.waitForEvent('backgroundpage').then(async event => await event.page());
      expect(backgroundPage).toBeTruthy();
      expect(await context.backgroundPages()).toContain(backgroundPage);
      expect(await context.pages()).not.toContain(backgroundPage);
      await removeUserDataDir(userDataDir);
    });
  });

  describe('BrowserFetcher', function() {
    it('should download and extract linux binary', async({server}) => {
      const downloadsFolder = await mkdtempAsync(TMP_FOLDER);
      const browserFetcher = playwright._createBrowserFetcher({
        platform: 'linux',
        path: downloadsFolder,
        host: server.PREFIX
      });
      let revisionInfo = browserFetcher.revisionInfo('123456');
      server.setRoute(revisionInfo.url.substring(server.PREFIX.length), (req, res) => {
        server.serveFile(req, res, '/chromium-linux.zip');
      });

      expect(revisionInfo.local).toBe(false);
      expect(browserFetcher._platform).toBe('linux');
      expect(await browserFetcher.canDownload('100000')).toBe(false);
      expect(await browserFetcher.canDownload('123456')).toBe(true);

      revisionInfo = await browserFetcher.download('123456');
      expect(revisionInfo.local).toBe(true);
      expect(await readFileAsync(revisionInfo.executablePath, 'utf8')).toBe('LINUX BINARY\n');
      const expectedPermissions = WIN ? 0666 : 0755;
      expect((await statAsync(revisionInfo.executablePath)).mode & 0777).toBe(expectedPermissions);
      expect(await browserFetcher.localRevisions()).toEqual(['123456']);
      await browserFetcher.remove('123456');
      expect(await browserFetcher.localRevisions()).toEqual([]);
      await rmAsync(downloadsFolder);
    });
  });

  describe('BrowserContext', function() {
    it('should not create pages automatically', async function() {
      const browser = await playwright.launch();
      const browserSession = await browser.createBrowserSession();
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
