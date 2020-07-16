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

const {WIN, LINUX, MAC, HEADLESS} = utils = require('./utils');
const {FIREFOX, CHROMIUM, WEBKIT, launchEnv} = require('playwright-runner');
const { makeUserDataDir, removeUserDataDir } = utils;
const {serverEnv} = require('./environments/server');
const {it} = serverEnv.mixin(launchEnv);

describe('Headful', function() {
  it('should have default url when launching browser', async ({launcher}) => {
    const userDataDir = await makeUserDataDir();
    const browserContext = await launcher.launchPersistentContext(userDataDir, {headless: false });
    const urls = browserContext.pages().map(page => page.url());
    expect(urls).toEqual(['about:blank']);
    await browserContext.close();
    await removeUserDataDir(userDataDir);
  });
  it.slow.todo(WIN && CHROMIUM)('headless should be able to read cookies written by headful', async ({launcher, server}) => {
    // see https://github.com/microsoft/playwright/issues/717
    const userDataDir = await makeUserDataDir();
    // Write a cookie in headful chrome
    const headfulContext = await launcher.launchPersistentContext(userDataDir, {headless: false});
    const headfulPage = await headfulContext.newPage();
    await headfulPage.goto(server.EMPTY_PAGE);
    await headfulPage.evaluate(() => document.cookie = 'foo=true; expires=Fri, 31 Dec 9999 23:59:59 GMT');
    await headfulContext.close();
    // Read the cookie from headless chrome
    const headlessContext = await launcher.launchPersistentContext(userDataDir, {headless: true});
    const headlessPage = await headlessContext.newPage();
    await headlessPage.goto(server.EMPTY_PAGE);
    const cookie = await headlessPage.evaluate(() => document.cookie);
    await headlessContext.close();
    // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
    await removeUserDataDir(userDataDir);
    expect(cookie).toBe('foo=true');
  });
  it.slow('should close browser with beforeunload page', async ({launcher, server}) => {
    const userDataDir = await makeUserDataDir();
    const browserContext = await launcher.launchPersistentContext(userDataDir, {headless: false});
    const page = await browserContext.newPage();
    await page.goto(server.PREFIX + '/beforeunload.html');
    // We have to interact with a page so that 'beforeunload' handlers
    // fire.
    await page.click('body');
    await browserContext.close();
    await removeUserDataDir(userDataDir);
  });
  it('should not crash when creating second context', async ({launcher, server}) => {
    const browser = await launcher.launch({headless: false });
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
  it('should click background tab', async ({launcher, server}) => {
    const browser = await launcher.launch({headless: false });
    const page = await browser.newPage();
    await page.setContent(`<button>Hello</button><a target=_blank href="${server.EMPTY_PAGE}">empty.html</a>`);
    await page.click('a');
    await page.click('button');
    await browser.close();
  });
  it('should close browser after context menu was triggered', async ({launcher, server}) => {
    const browser = await launcher.launch({headless: false });
    const page = await browser.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    await page.click('body', {button: 'right'});
    await browser.close();
  });
  it('should(not) block third party cookies', async ({launcher, server}) => {
    const browser = await launcher.launch({headless: false });
    const page = await browser.newPage();
    await page.goto(server.EMPTY_PAGE);
    await page.evaluate(src => {
      let fulfill;
      const promise = new Promise(x => fulfill = x);
      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      iframe.onload = fulfill;
      iframe.src = src;
      return promise;
    }, server.CROSS_PROCESS_PREFIX + '/grid.html');
    const documentCookie = await page.frames()[1].evaluate(() => {
      document.cookie = 'username=John Doe';
      return document.cookie;
    });
    await page.waitForTimeout(2000);
    const allowsThirdParty = CHROMIUM || FIREFOX;
    expect(documentCookie).toBe(allowsThirdParty ? 'username=John Doe' : '');
    const cookies = await page.context().cookies(server.CROSS_PROCESS_PREFIX + '/grid.html');
    if (allowsThirdParty) {
      expect(cookies).toEqual([
        {
          'domain': '127.0.0.1',
          'expires': -1,
          'httpOnly': false,
          'name': 'username',
          'path': '/',
          'sameSite': 'None',
          'secure': false,
          'value': 'John Doe'
        }
      ]);
    } else {
      expect(cookies).toEqual([]);
    }
    await browser.close();
  });
  it.todo(WEBKIT)('should not override viewport size when passed null', async function({launcher, server}) {
    // Our WebKit embedder does not respect window features.
    const browser = await launcher.launch({headless: false });
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(() => {
        const win = window.open(window.location.href, 'Title', 'toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=600,height=300,top=0,left=0');
        win.resizeTo(500, 450);
      }),
    ]);
    await popup.waitForLoadState();
    await popup.waitForFunction(() => window.outerWidth === 500 && window.outerHeight === 450);
    await context.close();
  });
});
