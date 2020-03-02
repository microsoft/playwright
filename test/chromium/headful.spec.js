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
const { makeUserDataDir, removeUserDataDir } = require('../utils');

const rmAsync = util.promisify(require('rimraf'));
const mkdtempAsync = util.promisify(fs.mkdtemp);

const TMP_FOLDER = path.join(os.tmpdir(), 'pw_tmp_folder-');

/**
 * @type {TestSuite}
 */
module.exports.describe = function({testRunner, expect, playwright, defaultBrowserOptions, FFOX, CHROMIUM, WEBKIT, WIN}) {
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

  describe('ChromiumHeadful', function() {
    it('Context.backgroundPages should return a background pages', async() => {
      const userDataDir = await makeUserDataDir();
      const context = await playwright.launchPersistent(userDataDir, extensionOptions);
      const backgroundPages = await context.backgroundPages();
      let backgroundPage = backgroundPages.length
          ? backgroundPages[0]
          : await new Promise(fulfill => context.once('backgroundpage', async event => fulfill(await event.page())));
      expect(backgroundPage).toBeTruthy();
      expect(await context.backgroundPages()).toContain(backgroundPage);
      expect(await context.pages()).not.toContain(backgroundPage);
      await removeUserDataDir(userDataDir);
    });
    // TODO: Support OOOPIF. @see https://github.com/GoogleChrome/puppeteer/issues/2548
    it.fail(true)('OOPIF: should report google.com frame', async({server}) => {
      // https://google.com is isolated by default in Chromium embedder.
      const browser = await playwright.launch(headfulOptions);
      const page = await browser.newPage();
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
};

