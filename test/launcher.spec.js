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
const util = require('util');

const utils = require('./utils');
const rmAsync = util.promisify(require('rimraf'));
const mkdtempAsync = util.promisify(fs.mkdtemp);

const TMP_FOLDER = path.join(os.tmpdir(), 'pw_tmp_folder-');

module.exports.describe = function({testRunner, expect, defaultBrowserOptions, playwright, playwrightPath, product, CHROMIUM, FFOX, WEBKIT, WIN}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Playwright', function() {
    describe('Playwright.launch', function() {
      it('should reject all promises when browser is closed', async() => {
        const browser = await playwright.launch(defaultBrowserOptions);
        const page = await browser.defaultContext().newPage();
        let error = null;
        const neverResolves = page.evaluate(() => new Promise(r => {})).catch(e => error = e);
        await browser.close();
        await neverResolves;
        expect(error.message).toContain('Protocol error');
      });
      it('should reject if executable path is invalid', async({server}) => {
        let waitError = null;
        const options = Object.assign({}, defaultBrowserOptions, {executablePath: 'random-invalid-path'});
        await playwright.launch(options).catch(e => waitError = e);
        expect(waitError.message).toContain('Failed to launch');
      });
      it('should have default URL when launching browser', async function() {
        const browser = await playwright.launch(defaultBrowserOptions);
        const pages = (await browser.defaultContext().pages()).map(page => page.url());
        expect(pages).toEqual(['about:blank']);
        await browser.close();
      });
      it('should have custom URL when launching browser', async function({server}) {
        const options = Object.assign({}, defaultBrowserOptions);
        options.args = [server.EMPTY_PAGE].concat(options.args || []);
        const browser = await playwright.launch(options);
        const pages = await browser.defaultContext().pages();
        expect(pages.length).toBe(1);
        const page = pages[0];
        if (page.url() !== server.EMPTY_PAGE) {
          await page.waitForNavigation();
        }
        expect(page.url()).toBe(server.EMPTY_PAGE);
        await browser.close();
      });
      it('should return child_process instance', async () => {
        const browserApp = await playwright.launchBrowserApp(defaultBrowserOptions);
        expect(browserApp.process().pid).toBeGreaterThan(0);
        await browserApp.close();
      });
    });

    describe('Playwright.executablePath', function() {
      it('should work', async({server}) => {
        const executablePath = playwright.executablePath();
        expect(fs.existsSync(executablePath)).toBe(true);
        expect(fs.realpathSync(executablePath)).toBe(executablePath);
      });
    });

    describe('Playwright.name', function() {
      it('should work', async({server}) => {
        if (WEBKIT)
          expect(playwright.name()).toBe('webkit');
        else if (FFOX)
          expect(playwright.name()).toBe('firefox');
        else if (CHROMIUM)
          expect(playwright.name()).toBe('chromium');
        else
          throw new Error('Unknown browser');
      });
    });

    describe('Playwright.defaultArguments', () => {
      it('should return the default arguments', async() => {
        if (CHROMIUM)
          expect(playwright.defaultArgs()).toContain('--no-first-run');
        expect(playwright.defaultArgs()).toContain(FFOX ? '-headless' : '--headless');
        expect(playwright.defaultArgs({headless: false})).not.toContain(FFOX ? '-headless' : '--headless');
        expect(playwright.defaultArgs({userDataDir: 'foo'})).toContain(FFOX ? 'foo' : '--user-data-dir=foo');
      });
      it('should filter out ignored default arguments', async() => {
        const defaultArgsWithoutUserDataDir = playwright.defaultArgs(defaultBrowserOptions);
        const defaultArgsWithUserDataDir = playwright.defaultArgs({...defaultBrowserOptions, userDataDir: 'fake-profile'});
        const browserApp = await playwright.launchBrowserApp(Object.assign({}, defaultBrowserOptions, {
          userDataDir: 'fake-profile',
          // Filter out any of the args added by the fake profile
          ignoreDefaultArgs: defaultArgsWithUserDataDir.filter(x => !defaultArgsWithoutUserDataDir.includes(x))
        }));
        const spawnargs = browserApp.process().spawnargs;
        expect(spawnargs.some(x => x.includes('fake-profile'))).toBe(false);
        await browserApp.close();
      });
    });
  });

  describe('Top-level requires', function() {
    it('should require top-level Errors', async() => {
      const Errors = require(path.join(utils.projectRoot(), '/lib/errors.js'));
      expect(Errors.TimeoutError).toBe(playwright.errors.TimeoutError);
    });
    it('should require top-level DeviceDescriptors', async() => {
      const Devices = require(path.join(utils.projectRoot(), '/lib/deviceDescriptors.js')).DeviceDescriptors;
      expect(Devices['iPhone 6']).toBeTruthy();
      expect(Devices['iPhone 6']).toBe(playwright.devices['iPhone 6']);
      expect(Devices['iPhone 6']).toBe(require(playwrightPath).devices['iPhone 6']);
    });
  });

  describe('Browser.isConnected', () => {
    it('should set the browser connected state', async () => {
      const browserApp = await playwright.launchBrowserApp({...defaultBrowserOptions, webSocket: true});
      const remote = await playwright.connect({browserWSEndpoint: browserApp.wsEndpoint()});
      expect(remote.isConnected()).toBe(true);
      await remote.disconnect();
      expect(remote.isConnected()).toBe(false);
      await browserApp.close();
    });
    it('should throw when used after isConnected returns false', async({server}) => {
      const browserApp = await playwright.launchBrowserApp({...defaultBrowserOptions, webSocket: true});
      const remote = await playwright.connect(browserApp.connectOptions());
      const page = await remote.defaultContext().newPage();
      await Promise.all([
        browserApp.close(),
        new Promise(f => remote.once('disconnected', f)),
      ]);
      expect(remote.isConnected()).toBe(false);
      const error = await page.evaluate('1 + 1').catch(e => e);
      expect(error.message).toContain('has been closed');
    });
  });

  describe('Browser.disconnect', function() {
    it('should reject navigation when browser closes', async({server}) => {
      server.setRoute('/one-style.css', () => {});
      const browserApp = await playwright.launchBrowserApp({...defaultBrowserOptions, webSocket: true});
      const remote = await playwright.connect(browserApp.connectOptions());
      const page = await remote.defaultContext().newPage();
      const navigationPromise = page.goto(server.PREFIX + '/one-style.html', {timeout: 60000}).catch(e => e);
      await server.waitForRequest('/one-style.css');
      await remote.disconnect();
      const error = await navigationPromise;
      expect(error.message).toBe('Navigation failed because browser has disconnected!');
      await browserApp.close();
    });
    it('should reject waitForSelector when browser closes', async({server}) => {
      server.setRoute('/empty.html', () => {});
      const browserApp = await playwright.launchBrowserApp({...defaultBrowserOptions, webSocket: true});
      const remote = await playwright.connect(browserApp.connectOptions());
      const page = await remote.defaultContext().newPage();
      const watchdog = page.$wait('div', { timeout: 60000 }).catch(e => e);
      
      // Make sure the previous waitForSelector has time to make it to the browser before we disconnect.
      await page.$wait('body');

      await remote.disconnect();
      const error = await watchdog;
      expect(error.message).toContain('Protocol error');
      await browserApp.close();
    });
    it('should throw if used after disconnect', async({server}) => {
      const browserApp = await playwright.launchBrowserApp({...defaultBrowserOptions, webSocket: true});
      const remote = await playwright.connect(browserApp.connectOptions());
      const page = await remote.defaultContext().newPage();
      await remote.disconnect();
      const error = await page.evaluate('1 + 1').catch(e => e);
      expect(error.message).toContain('has been closed');
      await browserApp.close();
    });
  });

  describe('Browser.close', function() {
    it('should terminate network waiters', async({context, server}) => {
      const browserApp = await playwright.launchBrowserApp({...defaultBrowserOptions, webSocket: true});
      const remote = await playwright.connect(browserApp.connectOptions());
      const newPage = await remote.defaultContext().newPage();
      const results = await Promise.all([
        newPage.waitForRequest(server.EMPTY_PAGE).catch(e => e),
        newPage.waitForResponse(server.EMPTY_PAGE).catch(e => e),
        browserApp.close()
      ]);
      for (let i = 0; i < 2; i++) {
        const message = results[i].message;
        expect(message).toContain('Target closed');
        expect(message).not.toContain('Timeout');
      }
    });
    it('should be able to close remote browser', async({server}) => {
      const browserApp = await playwright.launchBrowserApp({...defaultBrowserOptions, webSocket: true});
      const remote = await playwright.connect(browserApp.connectOptions());
      await Promise.all([
        new Promise(f => browserApp.once('close', f)),
        remote.close(),
      ]);
    });
  });

  describe('Playwright.launch |webSocket| option', function() {
    it('should not have websocket by default', async() => {
      const browserApp = await playwright.launchBrowserApp(defaultBrowserOptions);
      const browser = await playwright.connect(browserApp.connectOptions());
      expect((await browser.defaultContext().pages()).length).toBe(1);
      expect(browserApp.wsEndpoint()).toBe(null);
      const page = await browser.defaultContext().newPage();
      expect(await page.evaluate('11 * 11')).toBe(121);
      await page.close();
      await browserApp.close();
    });
    it('should support the webSocket option', async() => {
      const options = Object.assign({webSocket: true}, defaultBrowserOptions);
      const browserApp = await playwright.launchBrowserApp(options);
      const browser = await playwright.connect(browserApp.connectOptions());
      expect((await browser.defaultContext().pages()).length).toBe(1);
      expect(browserApp.wsEndpoint()).not.toBe(null);
      const page = await browser.defaultContext().newPage();
      expect(await page.evaluate('11 * 11')).toBe(121);
      await page.close();
      await browserApp.close();
    });
    it('should fire "disconnected" when closing without webSocket', async() => {
      const browserApp = await playwright.launchBrowserApp(defaultBrowserOptions);
      const browser = await playwright.connect(browserApp.connectOptions());
      const disconnectedEventPromise = new Promise(resolve => browser.once('disconnected', resolve));
      browserApp.kill();
      await disconnectedEventPromise;
    });
    it('should fire "disconnected" when closing with webSocket', async() => {
      const options = Object.assign({webSocket: true}, defaultBrowserOptions);
      const browserApp = await playwright.launchBrowserApp(options);
      const browser = await playwright.connect(browserApp.connectOptions());
      const disconnectedEventPromise = new Promise(resolve => browser.once('disconnected', resolve));
      browserApp.kill();
      await disconnectedEventPromise;
    });
  });

  describe('Playwright.connect', function() {
    it.skip(WEBKIT)('should be able to reconnect to a browser', async({server}) => {
      const browserApp = await playwright.launchBrowserApp({...defaultBrowserOptions, webSocket: true});
      const browser = await playwright.connect(browserApp.connectOptions());
      const page = await browser.defaultContext().newPage();
      await page.goto(server.PREFIX + '/frames/nested-frames.html');
      await browser.disconnect();

      const remote = await playwright.connect(browserApp.connectOptions());
      const pages = await remote.defaultContext().pages();
      const restoredPage = pages.find(page => page.url() === server.PREFIX + '/frames/nested-frames.html');
      expect(utils.dumpFrames(restoredPage.mainFrame())).toEqual([
        'http://localhost:<PORT>/frames/nested-frames.html',
        '    http://localhost:<PORT>/frames/frame.html (aframe)',
        '    http://localhost:<PORT>/frames/two-frames.html (2frames)',
        '        http://localhost:<PORT>/frames/frame.html (dos)',
        '        http://localhost:<PORT>/frames/frame.html (uno)',
      ]);
      expect(await restoredPage.evaluate(() => 7 * 8)).toBe(56);
      await browserApp.close();
    });
  });

  describe('Playwright.launch({userDataDir})', function() {
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
      options.args = [...(defaultBrowserOptions.args || [])];
      if (FFOX)
        options.args.push('-profile', userDataDir);
      else
        options.args.push(`--user-data-dir=${userDataDir}`);
      const browser = await playwright.launch(options);
      // Open a page to make sure its functional.
      await browser.defaultContext().newPage();
      expect(fs.readdirSync(userDataDir).length).toBeGreaterThan(0);
      await browser.close();
      expect(fs.readdirSync(userDataDir).length).toBeGreaterThan(0);
      // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
      await rmAsync(userDataDir).catch(e => {});
    });
    it.skip(FFOX)('userDataDir option should restore state', async({server}) => {
      const userDataDir = await mkdtempAsync(TMP_FOLDER);
      const options = Object.assign({userDataDir}, defaultBrowserOptions);
      const browser = await playwright.launch(options);
      const page = await browser.defaultContext().newPage();
      await page.goto(server.EMPTY_PAGE);
      await page.evaluate(() => localStorage.hey = 'hello');
      await browser.close();

      const browser2 = await playwright.launch(options);
      const page2 = await browser2.defaultContext().newPage();
      await page2.goto(server.EMPTY_PAGE);
      expect(await page2.evaluate(() => localStorage.hey)).toBe('hello');
      await browser2.close();

      const browser3 = await playwright.launch(defaultBrowserOptions);
      const page3 = await browser3.defaultContext().newPage();
      await page3.goto(server.EMPTY_PAGE);
      expect(await page3.evaluate(() => localStorage.hey)).not.toBe('hello');
      await browser3.close();

      // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
      await rmAsync(userDataDir).catch(e => {});
    });
    // See https://github.com/microsoft/playwright/issues/717
    it.skip(FFOX || (WIN && CHROMIUM))('userDataDir option should restore cookies', async({server}) => {
      const userDataDir = await mkdtempAsync(TMP_FOLDER);
      const options = Object.assign({userDataDir}, defaultBrowserOptions);
      const browser = await playwright.launch(options);
      const page = await browser.defaultContext().newPage();
      await page.goto(server.EMPTY_PAGE);
      await page.evaluate(() => document.cookie = 'doSomethingOnlyOnce=true; expires=Fri, 31 Dec 9999 23:59:59 GMT');
      await browser.close();

      const browser2 = await playwright.launch(options);
      const page2 = await browser2.defaultContext().newPage();
      await page2.goto(server.EMPTY_PAGE);
      expect(await page2.evaluate(() => document.cookie)).toBe('doSomethingOnlyOnce=true');
      await browser2.close();

      const browser3 = await playwright.launch(defaultBrowserOptions);
      const page3 = await browser3.defaultContext().newPage();
      await page3.goto(server.EMPTY_PAGE);
      expect(await page3.evaluate(() => localStorage.hey)).not.toBe('doSomethingOnlyOnce=true');
      await browser3.close();

      // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
      await rmAsync(userDataDir).catch(e => {});
    });
  });
};
