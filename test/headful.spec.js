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

const utils = require('./utils');
const { makeUserDataDir, removeUserDataDir } = utils;
const {FFOX, CHROMIUM, WEBKIT, WIN} = utils.testOptions(browserType);

describe('Headful', function() {
  it('should have default url when launching browser', async ({browserType, defaultBrowserOptions}) => {
    const userDataDir = await makeUserDataDir();
    const browserContext = await browserType.launchPersistentContext(userDataDir, {...defaultBrowserOptions, headless: false });
    const urls = browserContext.pages().map(page => page.url());
    expect(urls).toEqual(['about:blank']);
    await browserContext.close();
    await removeUserDataDir(userDataDir);
  });
  it.slow().fail(WIN && CHROMIUM)('headless should be able to read cookies written by headful', async({browserType, defaultBrowserOptions, server}) => {
    // see https://github.com/microsoft/playwright/issues/717
    const userDataDir = await makeUserDataDir();
    // Write a cookie in headful chrome
    const headfulContext = await browserType.launchPersistentContext(userDataDir, {...defaultBrowserOptions, headless: false});
    const headfulPage = await headfulContext.newPage();
    await headfulPage.goto(server.EMPTY_PAGE);
    await headfulPage.evaluate(() => document.cookie = 'foo=true; expires=Fri, 31 Dec 9999 23:59:59 GMT');
    await headfulContext.close();
    // Read the cookie from headless chrome
    const headlessContext = await browserType.launchPersistentContext(userDataDir, {...defaultBrowserOptions, headless: true});
    const headlessPage = await headlessContext.newPage();
    await headlessPage.goto(server.EMPTY_PAGE);
    const cookie = await headlessPage.evaluate(() => document.cookie);
    await headlessContext.close();
    // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
    await removeUserDataDir(userDataDir);
    expect(cookie).toBe('foo=true');
  });
  it.slow()('should close browser with beforeunload page', async({browserType, defaultBrowserOptions, server}) => {
    const userDataDir = await makeUserDataDir();
    const browserContext = await browserType.launchPersistentContext(userDataDir, {...defaultBrowserOptions, headless: false});
    const page = await browserContext.newPage();
    await page.goto(server.PREFIX + '/beforeunload.html');
    // We have to interact with a page so that 'beforeunload' handlers
    // fire.
    await page.click('body');
    await browserContext.close();
    await removeUserDataDir(userDataDir);
  });
  it('should not crash when creating second context', async ({browserType, defaultBrowserOptions, server}) => {
    const browser = await browserType.launch({...defaultBrowserOptions, headless: false });
    {
      const browserContext = await browser.newContext();
      const page = await browserContext.newPage();
      await browserContext.close();
    }
    {
      const browserContext = await browser.newContext();
      const page = await browserContext.newPage();
      await browserContext.close();
    }
    await browser.close();
  });
  it('should click background tab', async({browserType, defaultBrowserOptions, server}) => {
    const browser = await browserType.launch({...defaultBrowserOptions, headless: false });
    const page = await browser.newPage();
    await page.setContent(`<button>Hello</button><a target=_blank href="${server.EMPTY_PAGE}">empty.html</a>`);
    await page.click('a');
    await page.click('button');
    await browser.close();
  });
});
