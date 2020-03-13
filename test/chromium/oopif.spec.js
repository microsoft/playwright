/**
 * Copyright 2017 Google Inc. All rights reserved.
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

/**
 * @type {ChromiumTestSuite}
 */
module.exports.describe = function({testRunner, expect, defaultBrowserOptions, browserType, FFOX, CHROMIUM, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  const headfulOptions = Object.assign({}, defaultBrowserOptions, {
    headless: false
  });

  describe('OOPIF', function() {
    beforeAll(async function(state) {
      state.browser = await browserType.launch(Object.assign({}, defaultBrowserOptions, {
        args: (defaultBrowserOptions.args || []).concat(['--site-per-process']),
      }));
    });
    beforeEach(async function(state) {
      state.context = await state.browser.newContext();
      state.page = await state.context.newPage();
    });
    afterEach(async function(state) {
      await state.context.close();
      state.page = null;
      state.context = null;
    });
    afterAll(async function(state) {
      await state.browser.close();
      state.browser = null;
    });
    it.fail(true)('should report oopif frames', async function({browser, page, server, context}) {
      await page.goto(server.PREFIX + '/dynamic-oopif.html');
      expect(await countOOPIFs(browser)).toBe(1);
      expect(page.frames().length).toBe(2);
    });
    it('should load oopif iframes with subresources and request interception', async function({browser, page, server, context}) {
      await page.route('**/*', request => request.continue());
      await page.goto(server.PREFIX + '/dynamic-oopif.html');
      expect(await countOOPIFs(browser)).toBe(1);
    });
    // @see https://github.com/microsoft/playwright/issues/1240
    xit('should click a button when it overlays oopif', async function({browser, page, server, context}) {
      await page.goto(server.PREFIX + '/button-overlay-oopif.html');
      expect(await countOOPIFs(browser)).toBe(1);
      await page.click('button');
      expect(await page.evaluate(() => window.BUTTON_CLICKED)).toBe(true);
    });
    it.fail(true)('should report google.com frame with headful', async({server}) => {
      // TODO: Support OOOPIF. @see https://github.com/GoogleChrome/puppeteer/issues/2548
      // https://google.com is isolated by default in Chromium embedder.
      const browser = await browserType.launch(headfulOptions);
      const page = await browser.newPage();
      await page.goto(server.EMPTY_PAGE);
      await page.route('**/*', request => {
        request.fulfill({body: 'YO, GOOGLE.COM'});
      });
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
  });
};

async function countOOPIFs(browser) {
  const browserSession = await browser.newBrowserCDPSession();
  const oopifs = [];
  browserSession.on('Target.targetCreated', async ({targetInfo}) => {
    if (targetInfo.type === 'iframe')
       oopifs.push(targetInfo);
  });
  await browserSession.send('Target.setDiscoverTargets', { discover: true });
  await browserSession.detach();
  return oopifs.length;
}
