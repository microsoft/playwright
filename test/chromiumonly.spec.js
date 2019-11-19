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

module.exports.addLauncherTests = function({testRunner, expect, defaultBrowserOptions, playwright}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Chromium-Specific Launcher tests', function() {
    describe('Playwright.launch |browserURL| option', function() {
      it('should be able to connect using browserUrl, with and without trailing slash', async({server}) => {
        const originalBrowser = await playwright.launch(Object.assign({}, defaultBrowserOptions, {
          args: ['--remote-debugging-port=21222']
        }));
        const browserURL = 'http://127.0.0.1:21222';

        const browser1 = await playwright.connect({browserURL});
        const page1 = await browser1.newPage();
        expect(await page1.evaluate(() => 7 * 8)).toBe(56);
        browser1.disconnect();

        const browser2 = await playwright.connect({browserURL: browserURL + '/'});
        const page2 = await browser2.newPage();
        expect(await page2.evaluate(() => 8 * 7)).toBe(56);
        browser2.disconnect();
        originalBrowser.close();
      });
      it('should throw when using both browserWSEndpoint and browserURL', async({server}) => {
        const originalBrowser = await playwright.launch(Object.assign({}, defaultBrowserOptions, {
          args: ['--remote-debugging-port=21222']
        }));
        const browserURL = 'http://127.0.0.1:21222';

        let error = null;
        await playwright.connect({browserURL, browserWSEndpoint: originalBrowser.wsEndpoint()}).catch(e => error = e);
        expect(error.message).toContain('Exactly one of browserWSEndpoint, browserURL or transport');

        originalBrowser.close();
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
        const browser = await playwright.launch(options);
        expect((await browser.pages()).length).toBe(1);
        expect(browser.wsEndpoint()).toBe('');
        const page = await browser.newPage();
        expect(await page.evaluate('11 * 11')).toBe(121);
        await page.close();
        await browser.close();
      });
      it('should support the pipe argument', async() => {
        const options = Object.assign({}, defaultBrowserOptions);
        options.args = ['--remote-debugging-pipe'].concat(options.args || []);
        const browser = await playwright.launch(options);
        expect(browser.wsEndpoint()).toBe('');
        const page = await browser.newPage();
        expect(await page.evaluate('11 * 11')).toBe(121);
        await page.close();
        await browser.close();
      });
      it('should fire "disconnected" when closing with pipe', async() => {
        const options = Object.assign({pipe: true}, defaultBrowserOptions);
        const browser = await playwright.launch(options);
        const disconnectedEventPromise = new Promise(resolve => browser.once('disconnected', resolve));
        // Emulate user exiting browser.
        browser.process().kill();
        await disconnectedEventPromise;
      });
    });

    describe('Page.waitForFileChooser', () => {
      it('should fail gracefully when trying to work with filechoosers within multiple connections', async() => {
        // 1. Launch a browser and connect to all pages.
        const originalBrowser = await playwright.launch(defaultBrowserOptions);
        await originalBrowser.pages();
        // 2. Connect a remote browser and connect to first page.
        const remoteBrowser = await playwright.connect({browserWSEndpoint: originalBrowser.wsEndpoint()});
        const [page] = await remoteBrowser.pages();
        // 3. Make sure |page.waitForFileChooser()| does not work with multiclient.
        let error = null;
        await page.waitForFileChooser().catch(e => error = e);
        expect(error.message).toBe('File chooser handling does not work with multiple connections to the same page');
        originalBrowser.close();
      });

    });
  });
};

module.exports.addPageTests = function({testRunner, expect}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Chromium-Specific Page Tests', function() {
    it('Page.setRequestInterception should work with intervention headers', async({server, page}) => {
      server.setRoute('/intervention', (req, res) => res.end(`
        <script>
          document.write('<script src="${server.CROSS_PROCESS_PREFIX}/intervention.js">' + '</scr' + 'ipt>');
        </script>
      `));
      server.setRedirect('/intervention.js', '/redirect.js');
      let serverRequest = null;
      server.setRoute('/redirect.js', (req, res) => {
        serverRequest = req;
        res.end('console.log(1);');
      });

      await page.setRequestInterception(true);
      page.on('request', request => request.continue());
      await page.goto(server.PREFIX + '/intervention');
      // Check for feature URL substring rather than https://www.chromestatus.com to
      // make it work with Edgium.
      expect(serverRequest.headers.intervention).toContain('feature/5718547946799104');
    });
  });
};

