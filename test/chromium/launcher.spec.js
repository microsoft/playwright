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

const { waitEvent } = require('../utils');
const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readFileAsync = util.promisify(fs.readFile);
const rmAsync = util.promisify(require('rimraf'));
const mkdtempAsync = util.promisify(fs.mkdtemp);
const statAsync = util.promisify(fs.stat);

const TMP_FOLDER = path.join(os.tmpdir(), 'pptr_tmp_folder-');

module.exports.describe = function({testRunner, expect, defaultBrowserOptions, playwright, WIN}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('CrPlaywright', function() {
    describe('Playwright.launch |browserURL| option', function() {
      it('should be able to connect using browserUrl, with and without trailing slash', async({server}) => {
        const originalBrowser = await playwright.launch(Object.assign({}, defaultBrowserOptions, {
          args: ['--remote-debugging-port=21222']
        }));
        const browserURL = 'http://127.0.0.1:21222';

        const browser1 = await playwright.connect({browserURL});
        const page1 = await browser1.defaultContext().newPage();
        expect(await page1.evaluate(() => 7 * 8)).toBe(56);
        browser1.disconnect();

        const browser2 = await playwright.connect({browserURL: browserURL + '/'});
        const page2 = await browser2.defaultContext().newPage();
        expect(await page2.evaluate(() => 8 * 7)).toBe(56);
        browser2.disconnect();
        originalBrowser.close();
      });
      it('should throw when using both browserWSEndpoint and browserURL', async({server}) => {
        const browserServer = await playwright.launchServer(Object.assign({}, defaultBrowserOptions, {
          args: ['--remote-debugging-port=21222']
        }));
        const browserURL = 'http://127.0.0.1:21222';

        let error = null;
        await playwright.connect({browserURL, browserWSEndpoint: browserServer.wsEndpoint()}).catch(e => error = e);
        expect(error.message).toContain('Exactly one of browserWSEndpoint, browserURL or transport');

        browserServer.close();
      });
      it('should throw when trying to connect to non-existing browser', async({server}) => {
        const originalBrowser = await playwright.launch(Object.assign({}, defaultBrowserOptions, {
          args: ['--remote-debugging-port=21222']
        }));
        const browserURL = 'http://127.0.0.1:32333';

        let error = null;
        await playwright.connect({browserURL}).catch(e => error = e);
        expect(error.message).toContain('Failed to fetch browser webSocket url from');
        originalBrowser.close();
      });
    });

    describe('Playwright.launch |pipe| option', function() {
      it('should support the pipe option', async() => {
        const options = Object.assign({pipe: true}, defaultBrowserOptions);
        const browserServer = await playwright.launchServer(options);
        const browser = await browserServer.connect();
        expect((await browser.defaultContext().pages()).length).toBe(1);
        expect(browserServer.wsEndpoint()).toBe(null);
        const page = await browser.defaultContext().newPage();
        expect(await page.evaluate('11 * 11')).toBe(121);
        await page.close();
        await browserServer.close();
      });
      it('should support the pipe argument', async() => {
        const options = Object.assign({}, defaultBrowserOptions);
        options.args = ['--remote-debugging-pipe'].concat(options.args || []);
        const browserServer = await playwright.launchServer(options);
        const browser = await browserServer.connect();
        expect(browserServer.wsEndpoint()).toBe(null);
        const page = await browser.defaultContext().newPage();
        expect(await page.evaluate('11 * 11')).toBe(121);
        await page.close();
        await browserServer.close();
      });
      it('should fire "disconnected" when closing with pipe', async() => {
        const options = Object.assign({pipe: true}, defaultBrowserOptions);
        const browserServer = await playwright.launchServer(options);
        const browser = await browserServer.connect();
        const disconnectedEventPromise = new Promise(resolve => browser.once('disconnected', resolve));
        // Emulate user exiting browser.
        browserServer.process().kill();
        await disconnectedEventPromise;
      });
    });
  });

  describe('Browser target events', function() {
    it('should work', async({server}) => {
      const browser = await playwright.launch(defaultBrowserOptions);
      const events = [];
      browser.on('targetcreated', () => events.push('CREATED'));
      browser.on('targetchanged', () => events.push('CHANGED'));
      browser.on('targetdestroyed', () => events.push('DESTROYED'));
      const page = await browser.defaultContext().newPage();
      await page.goto(server.EMPTY_PAGE);
      await page.close();
      expect(events).toEqual(['CREATED', 'CHANGED', 'DESTROYED']);
      await browser.close();
    });
  });

  describe('Browser.Events.disconnected', function() {
    it('should be emitted when: browser gets closed, disconnected or underlying websocket gets closed', async() => {
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const originalBrowser = await browserServer.connect();
      const browserWSEndpoint = browserServer.wsEndpoint();
      const remoteBrowser1 = await playwright.connect({browserWSEndpoint});
      const remoteBrowser2 = await playwright.connect({browserWSEndpoint});

      let disconnectedOriginal = 0;
      let disconnectedRemote1 = 0;
      let disconnectedRemote2 = 0;
      originalBrowser.on('disconnected', () => ++disconnectedOriginal);
      remoteBrowser1.on('disconnected', () => ++disconnectedRemote1);
      remoteBrowser2.on('disconnected', () => ++disconnectedRemote2);

      await Promise.all([
        waitEvent(remoteBrowser2, 'disconnected'),
        remoteBrowser2.disconnect(),
      ]);

      expect(disconnectedOriginal).toBe(0);
      expect(disconnectedRemote1).toBe(0);
      expect(disconnectedRemote2).toBe(1);

      await Promise.all([
        waitEvent(remoteBrowser1, 'disconnected'),
        waitEvent(originalBrowser, 'disconnected'),
        browserServer.close(),
      ]);

      expect(disconnectedOriginal).toBe(1);
      expect(disconnectedRemote1).toBe(1);
      expect(disconnectedRemote2).toBe(1);
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
