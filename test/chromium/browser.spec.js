// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

module.exports.describe = function({testRunner, expect, headless, playwright, FFOX, CHROME, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('CrBrowser', function() {
    it('should close all belonging targets once closing context', async function({browser, newContext}) {
      const targets = async () => (await browser.targets()).filter(t => t.type() === 'page');
      expect((await targets()).length).toBe(1);

      const context = await newContext();
      await context.newPage();
      expect((await targets()).length).toBe(2);
      expect((await context.pages()).length).toBe(1);

      await context.close();
      expect((await targets()).length).toBe(1);
    });
  });
};
