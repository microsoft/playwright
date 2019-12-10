/**
 * Copyright 2018 Google Inc. All rights reserved.
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

const utils = require('./utils');

module.exports.addTests = function({testRunner, expect}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('BrowserContext', function() {
    it('should have default context', async function({browser, server}) {
      expect(browser.browserContexts().length).toBe(1);
      const defaultContext = browser.browserContexts()[0];
      expect(defaultContext.isIncognito()).toBe(false);
      let error = null;
      await defaultContext.close().catch(e => error = e);
      expect(browser.defaultBrowserContext()).toBe(defaultContext);
      expect(error.message).toContain('cannot be closed');
    });
    it('should create new incognito context', async function({browser, server}) {
      expect(browser.browserContexts().length).toBe(1);
      const context = await browser.createIncognitoBrowserContext();
      expect(context.isIncognito()).toBe(true);
      expect(browser.browserContexts().length).toBe(2);
      expect(browser.browserContexts().indexOf(context) !== -1).toBe(true);
      await context.close();
      expect(browser.browserContexts().length).toBe(1);
    });
    it('should close all belonging targets once closing context', async function({browser, server}) {
      expect((await browser.pages()).length).toBe(1);

      const context = await browser.createIncognitoBrowserContext();
      await context.newPage();
      expect((await browser.pages()).length).toBe(2);
      expect((await context.pages()).length).toBe(1);

      await context.close();
      expect((await browser.pages()).length).toBe(1);
    });
    it('window.open should use parent tab context', async function({browser, server}) {
      const context = await browser.createIncognitoBrowserContext();
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const [popupTarget] = await Promise.all([
        utils.waitEvent(page, 'popup'),
        page.evaluate(url => window.open(url), server.EMPTY_PAGE)
      ]);
      expect(popupTarget.browserContext()).toBe(context);
      await context.close();
    });
    it('should isolate localStorage and cookies', async function({browser, server}) {
      // Create two incognito contexts.
      const context1 = await browser.createIncognitoBrowserContext();
      const context2 = await browser.createIncognitoBrowserContext();
      expect((await context1.pages()).length).toBe(0);
      expect((await context2.pages()).length).toBe(0);

      // Create a page in first incognito context.
      const page1 = await context1.newPage();
      await page1.goto(server.EMPTY_PAGE);
      await page1.evaluate(() => {
        localStorage.setItem('name', 'page1');
        document.cookie = 'name=page1';
      });

      expect((await context1.pages()).length).toBe(1);
      expect((await context2.pages()).length).toBe(0);

      // Create a page in second incognito context.
      const page2 = await context2.newPage();
      await page2.goto(server.EMPTY_PAGE);
      await page2.evaluate(() => {
        localStorage.setItem('name', 'page2');
        document.cookie = 'name=page2';
      });

      expect((await context1.pages()).length).toBe(1);
      expect((await context2.pages()).length).toBe(1);
      expect((await context1.pages())[0]).toBe(page1);
      expect((await context2.pages())[0]).toBe(page2);

      // Make sure pages don't share localstorage or cookies.
      expect(await page1.evaluate(() => localStorage.getItem('name'))).toBe('page1');
      expect(await page1.evaluate(() => document.cookie)).toBe('name=page1');
      expect(await page2.evaluate(() => localStorage.getItem('name'))).toBe('page2');
      expect(await page2.evaluate(() => document.cookie)).toBe('name=page2');

      // Cleanup contexts.
      await Promise.all([
        context1.close(),
        context2.close()
      ]);
      expect(browser.browserContexts().length).toBe(1);
    });
  });
};
