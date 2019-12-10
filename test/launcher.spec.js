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
const {helper} = require('../lib/helper');
const rmAsync = helper.promisify(require('rimraf'));
const mkdtempAsync = helper.promisify(fs.mkdtemp);
const TMP_FOLDER = path.join(os.tmpdir(), 'pptr_tmp_folder-');
const utils = require('./utils');

module.exports.addTests = function({testRunner, expect, defaultBrowserOptions, playwright, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Playwright', function() {
    describe('Playwright.launch', function() {
      it('should reject all promises when browser is closed', async() => {
        const browser = await playwright.launch(defaultBrowserOptions);
        const page = await browser.newPage();
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
      it.skip(WEBKIT)('userDataDir option', async({server}) => {
        const userDataDir = await mkdtempAsync(TMP_FOLDER);
        const options = Object.assign({userDataDir}, defaultBrowserOptions);
        const browser = await playwright.launch(options);
        // Open a page to make sure its functional.
        await browser.newPage();
        expect(fs.readdirSync(userDataDir).length).toBeGreaterThan(0);
        await browser.close();
        expect(fs.readdirSync(userDataDir).length).toBeGreaterThan(0);
        // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
        await rmAsync(userDataDir).catch(e => {});
      });
      it.skip(WEBKIT)('userDataDir argument', async({server}) => {
        const userDataDir = await mkdtempAsync(TMP_FOLDER);
        const options = Object.assign({}, defaultBrowserOptions);
        options.ignoreDefaultArgs = true;
        const browser = await playwright.launch(options);
        const page = await browser.newPage();
        expect(await page.evaluate('11 * 11')).toBe(121);
        await page.close();
        await browser.close();
      });
      it.skip(WEBKIT)('should filter out ignored default arguments', async() => {
        // Make sure we launch with `--enable-automation` by default.
        const defaultArgs = playwright.defaultArgs(defaultBrowserOptions);
        const browser = await playwright.launch(Object.assign({}, defaultBrowserOptions, {
          // Ignore first and third default argument.
          ignoreDefaultArgs: [ defaultArgs[0], defaultArgs[2] ],
        }));
        const spawnargs = browser.process().spawnargs;
        expect(spawnargs.indexOf(defaultArgs[0])).toBe(-1);
        expect(spawnargs.indexOf(defaultArgs[1])).not.toBe(-1);
        expect(spawnargs.indexOf(defaultArgs[2])).toBe(-1);
        await browser.close();
      });
      it.skip(WEBKIT)('should set the default viewport', async() => {
        const options = Object.assign({}, defaultBrowserOptions, {
          defaultViewport: {
            width: 456,
            height: 789
          }
        });
        const browser = await playwright.launch(options);
        const page = await browser.newPage();
        expect(await page.evaluate('window.innerWidth')).toBe(456);
        expect(await page.evaluate('window.innerHeight')).toBe(789);
        await browser.close();
      });
      it('should disable the default viewport', async() => {
        const options = Object.assign({}, defaultBrowserOptions, {
          defaultViewport: null
        });
        const browser = await playwright.launch(options);
        const page = await browser.newPage();
        expect(page.viewport()).toBe(null);
        await browser.close();
      });
      it('should take fullPage screenshots when defaultViewport is null', async({server}) => {
        const options = Object.assign({}, defaultBrowserOptions, {
          defaultViewport: null
        });
        const browser = await playwright.launch(options);
        const page = await browser.newPage();
        await page.goto(server.PREFIX + '/grid.html');
        const screenshot = await page.screenshot({
          fullPage: true
        });
        expect(screenshot).toBeInstanceOf(Buffer);
        await browser.close();
      });
      it('should have default URL when launching browser', async function() {
        const browser = await playwright.launch(defaultBrowserOptions);
        const pages = (await browser.pages()).map(page => page.url());
        expect(pages).toEqual(['about:blank']);
        await browser.close();
      });
      it('should have custom URL when launching browser', async function({server}) {
        const options = Object.assign({}, defaultBrowserOptions);
        options.args = [server.EMPTY_PAGE].concat(options.args || []);
        const browser = await playwright.launch(options);
        const pages = await browser.pages();
        expect(pages.length).toBe(1);
        const page = pages[0];
        if (page.url() !== server.EMPTY_PAGE)
          await page.waitForNavigation();
        expect(page.url()).toBe(server.EMPTY_PAGE);
        await browser.close();
      });
    });

    describe('Playwright.executablePath', function() {
      it('should work', async({server}) => {
        const executablePath = playwright.executablePath();
        expect(fs.existsSync(executablePath)).toBe(true);
        expect(fs.realpathSync(executablePath)).toBe(executablePath);
      });
    });
  });

  describe('Top-level requires', function() {
    it('should require top-level Errors', async() => {
      const Errors = require(path.join(utils.projectRoot(), '/Errors'));
      expect(Errors.TimeoutError).toBe(playwright.errors.TimeoutError);
    });
    it('should require top-level DeviceDescriptors', async() => {
      const Devices = require(path.join(utils.projectRoot(), '/DeviceDescriptors'));
      expect(Devices['iPhone 6']).toBe(playwright.devices['iPhone 6']);
    });
  });
};
