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

const path = require('path');
const os = require('os');
const fs = require('fs');
const util = require('util');

const rmAsync = util.promisify(require('rimraf'));
const mkdtempAsync = util.promisify(fs.mkdtemp);

const TMP_FOLDER = path.join(os.tmpdir(), 'pw_tmp_folder-');

module.exports.describe = function({testRunner, expect, playwright, defaultBrowserOptions, FFOX, CHROMIUM, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  const headfulOptions = Object.assign({}, defaultBrowserOptions, {
    headless: false
  });
  const headlessOptions = Object.assign({}, defaultBrowserOptions, {
    headless: true
  });
  const extensionPath = path.join(__dirname, '..', 'assets', 'simple-extension');
  const extensionOptions = Object.assign({}, defaultBrowserOptions, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  describe('HEADFUL', function() {
    it('background_page target type should be available', async() => {
      const browserWithExtension = await playwright.launch(extensionOptions);
      const page = await browserWithExtension.defaultContext().newPage();
      const backgroundPageTarget = await browserWithExtension.waitForTarget(target => target.type() === 'background_page');
      await page.close();
      await browserWithExtension.close();
      expect(backgroundPageTarget).toBeTruthy();
    });
    it('target.page() should return a background_page', async({}) => {
      const browserWithExtension = await playwright.launch(extensionOptions);
      const backgroundPageTarget = await browserWithExtension.waitForTarget(target => target.type() === 'background_page');
      const page = await backgroundPageTarget.page();
      expect(await page.evaluate(() => 2 * 3)).toBe(6);
      expect(await page.evaluate(() => window.MAGIC)).toBe(42);
      await browserWithExtension.close();
    });
    it('should have default url when launching browser', async function() {
      const browser = await playwright.launch(extensionOptions);
      const pages = (await browser.defaultContext().pages()).map(page => page.url());
      expect(pages).toEqual(['about:blank']);
      await browser.close();
    });
    // see https://github.com/microsoft/playwright/issues/717
    it.skip(WIN && CHROMIUM)('headless should be able to read cookies written by headful', async({server}) => {
      const userDataDir = await mkdtempAsync(TMP_FOLDER);
      // Write a cookie in headful chrome
      const headfulBrowser = await playwright.launch(Object.assign({userDataDir}, headfulOptions));
      const headfulPage = await headfulBrowser.defaultContext().newPage();
      await headfulPage.goto(server.EMPTY_PAGE);
      await headfulPage.evaluate(() => document.cookie = 'foo=true; expires=Fri, 31 Dec 9999 23:59:59 GMT');
      await headfulBrowser.close();
      // Read the cookie from headless chrome
      const headlessBrowser = await playwright.launch(Object.assign({userDataDir}, headlessOptions));
      const headlessPage = await headlessBrowser.defaultContext().newPage();
      await headlessPage.goto(server.EMPTY_PAGE);
      const cookie = await headlessPage.evaluate(() => document.cookie);
      await headlessBrowser.close();
      // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
      await rmAsync(userDataDir).catch(e => {});
      expect(cookie).toBe('foo=true');
    });
    // TODO: Support OOOPIF. @see https://github.com/GoogleChrome/puppeteer/issues/2548
    xit('OOPIF: should report google.com frame', async({server}) => {
      // https://google.com is isolated by default in Chromium embedder.
      const browser = await playwright.launch(headfulOptions);
      const page = await browser.defaultContext().newPage();
      await page.goto(server.EMPTY_PAGE);
      await page.interception.enable();
      page.on('request', r => page.interception.fulfill(r, {body: 'YO, GOOGLE.COM'}));
      await page.evaluate(() => {
        const frame = document.createElement('iframe');
        frame.setAttribute('src', 'https://google.com/');
        document.body.appendChild(frame);
        return new Promise(x => frame.onload = x);
      });
      await page.waitForSelector('iframe[src="https://google.com/"]');
      const urls = page.frames().map(frame => frame.url()).sort();
      expect(urls).toEqual([
        server.EMPTY_PAGE,
        'https://google.com/'
      ]);
      await browser.close();
    });
    it('should close browser with beforeunload page', async({server}) => {
      const browser = await playwright.launch(headfulOptions);
      const page = await browser.defaultContext().newPage();
      await page.goto(server.PREFIX + '/beforeunload.html');
      // We have to interact with a page so that 'beforeunload' handlers
      // fire.
      await page.click('body');
      await browser.close();
    });
    it('should open devtools when "devtools: true" option is given', async({server}) => {
      const browser = await playwright.launch(Object.assign({devtools: true}, headfulOptions));
      const context = await browser.newContext();
      await Promise.all([
        context.newPage(),
        browser.waitForTarget(target => target.browserContext() === context && target.url().includes('devtools://')),
      ]);
      await browser.close();
    });
  });
};

