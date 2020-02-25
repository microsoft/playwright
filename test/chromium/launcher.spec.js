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

const TMP_FOLDER = path.join(os.tmpdir(), 'pw_tmp_folder-');

/**
 * @type {TestSuite}
 */
module.exports.describe = function({testRunner, expect, defaultBrowserOptions, playwright, WIN}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('CrPlaywright', function() {
    describe('Playwright.launch webSocket option', function() {
      it('should support the remote-debugging-port argument', async() => {
        const options = Object.assign({}, defaultBrowserOptions);
        const browserServer = await playwright.launchServer({ ...options, port: 0 });
        const browser = await playwright.connect({ wsEndpoint: browserServer.wsEndpoint() });
        expect(browserServer.wsEndpoint()).not.toBe(null);
        const page = await browser.newPage();
        expect(await page.evaluate('11 * 11')).toBe(121);
        await page.close();
        await browserServer.close();
      });
      it('should throw with remote-debugging-pipe argument and webSocket', async() => {
        const options = Object.assign({}, defaultBrowserOptions);
        options.args = ['--remote-debugging-pipe'].concat(options.args || []);
        const error = await playwright.launchServer(options).catch(e => e);
        expect(error.message).toContain('Playwright manages remote debugging connection itself');
      });
    });
  });

  describe('Browser target events', function() {
    it('should work', async({server}) => {
      const browser = await playwright.launch(defaultBrowserOptions);
      const context = await browser.newContext();
      const events = [];
      context.on('targetcreated', target => events.push('CREATED'));
      context.on('targetchanged', target => events.push('CHANGED'));
      context.on('targetdestroyed', target => events.push('DESTROYED'));
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      await page.close();
      expect(events).toEqual(['CREATED', 'CHANGED', 'DESTROYED']);
      await browser.close();
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
};
