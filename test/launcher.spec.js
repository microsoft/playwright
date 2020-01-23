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
const path = require('path');
const utils = require('./utils');

module.exports.describe = function({testRunner, expect, defaultBrowserOptions, playwright, WEBKIT}) {
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
      const Errors = require(path.join(utils.projectRoot(), '/lib/errors.js'));
      expect(Errors.TimeoutError).toBe(playwright.errors.TimeoutError);
    });
    it('should require top-level DeviceDescriptors', async() => {
      const Devices = require(path.join(utils.projectRoot(), '/lib/deviceDescriptors.js')).DeviceDescriptors;
      expect(Devices['iPhone 6']).toBe(playwright.devices['iPhone 6']);
    });
  });

  describe('Browser.isConnected', () => {
    it('should set the browser connected state', async () => {
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const browserWSEndpoint = browserServer.wsEndpoint();
      const remote = await playwright.connect({browserWSEndpoint});
      expect(remote.isConnected()).toBe(true);
      await remote.disconnect();
      expect(remote.isConnected()).toBe(false);
      await browserServer.close();
    });
    it('should throw when used after isConnected returns false', async({server}) => {
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const remote = await playwright.connect({...defaultBrowserOptions, browserWSEndpoint: browserServer.wsEndpoint()});
      const page = await remote.defaultContext().newPage();
      await Promise.all([
        browserServer.close(),
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
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const remote = await playwright.connect({...defaultBrowserOptions, browserWSEndpoint: browserServer.wsEndpoint()});
      const page = await remote.defaultContext().newPage();
      const navigationPromise = page.goto(server.PREFIX + '/one-style.html', {timeout: 60000}).catch(e => e);
      await server.waitForRequest('/one-style.css');
      await remote.disconnect();
      const error = await navigationPromise;
      expect(error.message).toBe('Navigation failed because browser has disconnected!');
      await browserServer.close();
    });
    it('should reject waitForSelector when browser closes', async({server}) => {
      server.setRoute('/empty.html', () => {});
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const remote = await playwright.connect({...defaultBrowserOptions, browserWSEndpoint: browserServer.wsEndpoint()});
      const page = await remote.defaultContext().newPage();
      const watchdog = page.waitForSelector('div', { timeout: 60000 }).catch(e => e);
      await remote.disconnect();
      const error = await watchdog;
      expect(error.message).toContain('Protocol error');
      await browserServer.close();
    });
    it('should throw if used after disconnect', async({server}) => {
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const remote = await playwright.connect({...defaultBrowserOptions, browserWSEndpoint: browserServer.wsEndpoint()});
      const page = await remote.defaultContext().newPage();
      await remote.disconnect();
      const error = await page.evaluate('1 + 1').catch(e => e);
      expect(error.message).toContain('has been closed');
      await browserServer.close();
    });
  });

  describe('Browser.close', function() {
    it('should terminate network waiters', async({context, server}) => {
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const remote = await playwright.connect({...defaultBrowserOptions, browserWSEndpoint: browserServer.wsEndpoint()});
      const newPage = await remote.defaultContext().newPage();
      const results = await Promise.all([
        newPage.waitForRequest(server.EMPTY_PAGE).catch(e => e),
        newPage.waitForResponse(server.EMPTY_PAGE).catch(e => e),
        browserServer.close()
      ]);
      for (let i = 0; i < 2; i++) {
        const message = results[i].message;
        expect(message).toContain('Target closed');
        expect(message).not.toContain('Timeout');
      }
    });
  });

  describe('Playwright.connect', function() {
    it.skip(WEBKIT)('should be able to reconnect to a browser', async({server}) => {
      const browserServer = await playwright.launchServer(defaultBrowserOptions);
      const browser = await playwright.connect(browserServer.connectOptions());
      const browserWSEndpoint = browserServer.wsEndpoint();
      const page = await browser.defaultContext().newPage();
      await page.goto(server.PREFIX + '/frames/nested-frames.html');
      await browser.disconnect();

      const remote = await playwright.connect({...defaultBrowserOptions, browserWSEndpoint});
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
      await browserServer.close();
    });
  });
};
