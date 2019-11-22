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

module.exports.addTests = function({testRunner, expect, headless, playwright, FFOX, CHROME, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Browser.version', function() {
    it('should return whether we are in headless', async({browser}) => {
      const version = await browser.version();
      expect(version.length).toBeGreaterThan(0);
      if (CHROME)
        expect(version.startsWith('Headless')).toBe(headless);
      else if (WEBKIT)
        expect(version.startsWith('Safari/')).toBe(true);
      else
        expect(version.startsWith('Firefox/')).toBe(true);
    });
  });

  describe('Browser.userAgent', function() {
    it('should include WebKit', async({browser}) => {
      const userAgent = await browser.userAgent();
      expect(userAgent.length).toBeGreaterThan(0);
      if (CHROME || WEBKIT)
        expect(userAgent).toContain('WebKit');
      else
        expect(userAgent).toContain('Gecko');
    });
  });

  describe('Browser.process', function() {
    it('should return child_process instance', async function({browser}) {
      const process = await browser.process();
      expect(process.pid).toBeGreaterThan(0);
    });
    it.skip(WEBKIT || FFOX)('should not return child_process for remote browser', async function({browser}) {
      const browserWSEndpoint = browser.chromium.wsEndpoint();
      const remoteBrowser = await playwright.connect({browserWSEndpoint});
      expect(remoteBrowser.process()).toBe(null);
      remoteBrowser.disconnect();
    });
  });

  describe.skip(WEBKIT || FFOX)('Browser.isConnected', () => {
    it('should set the browser connected state', async({browser}) => {
      const browserWSEndpoint = browser.chromium.wsEndpoint();
      const newBrowser = await playwright.connect({browserWSEndpoint});
      expect(newBrowser.isConnected()).toBe(true);
      newBrowser.disconnect();
      expect(newBrowser.isConnected()).toBe(false);
    });
  });
};
