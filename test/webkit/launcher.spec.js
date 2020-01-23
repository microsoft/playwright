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

module.exports.describe = function ({ testRunner, expect, playwright, defaultBrowserOptions }) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('WKPlaywright', function() {
    describe('Playwright.launch |pipe| option', function() {
      it('should have websocket by default', async() => {
        const options = Object.assign({pipe: false}, defaultBrowserOptions);
        const browserServer = await playwright.launchServer(options);
        const browser = await playwright.connect(browserServer.connectOptions());
        expect((await browser.defaultContext().pages()).length).toBe(1);
        expect(browserServer.wsEndpoint()).not.toBe(null);
        const page = await browser.defaultContext().newPage();
        expect(await page.evaluate('11 * 11')).toBe(121);
        await page.close();
        await browserServer.close();
      });
      it('should support the pipe option', async() => {
        const options = Object.assign({pipe: true}, defaultBrowserOptions);
        const browserServer = await playwright.launchServer(options);
        const browser = await playwright.connect(browserServer.connectOptions());
        expect((await browser.defaultContext().pages()).length).toBe(1);
        expect(browserServer.wsEndpoint()).toBe(null);
        const page = await browser.defaultContext().newPage();
        expect(await page.evaluate('11 * 11')).toBe(121);
        await page.close();
        await browserServer.close();
      });
      it('should fire "disconnected" when closing with pipe', async() => {
        const options = Object.assign({pipe: true}, defaultBrowserOptions);
        const browserServer = await playwright.launchServer(options);
        const browser = await playwright.connect(browserServer.connectOptions());
        const disconnectedEventPromise = new Promise(resolve => browser.once('disconnected', resolve));
        // Emulate user exiting browser.
        process.kill(-browserServer.process().pid, 'SIGKILL');
        await disconnectedEventPromise;
      });
      it('should fire "disconnected" when closing with websocket', async() => {
        const options = Object.assign({pipe: false}, defaultBrowserOptions);
        const browserServer = await playwright.launchServer(options);
        const browser = await playwright.connect(browserServer.connectOptions());
        const disconnectedEventPromise = new Promise(resolve => browser.once('disconnected', resolve));
        // Emulate user exiting browser.
        process.kill(-browserServer.process().pid, 'SIGKILL');
        await disconnectedEventPromise;
      });
    });
  });
};
