// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

module.exports.addTests = function({testRunner, expect, headless, playwright, FFOX, CHROME, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Browser.process', function() {
    it('should not return child_process for remote browser', async function({browser}) {
      const browserWSEndpoint = browser.chromium.wsEndpoint();
      const remoteBrowser = await playwright.connect({browserWSEndpoint});
      expect(remoteBrowser.process()).toBe(null);
      remoteBrowser.disconnect();
    });
  });
};
