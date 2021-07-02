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

import { playwrightTest as it, expect } from './config/browserTest';

it('should have default url when launching browser', async ({browserType, browserOptions, createUserDataDir}) => {
  const browserContext = await browserType.launchPersistentContext(await createUserDataDir(), {...browserOptions, headless: false });
  const urls = browserContext.pages().map(page => page.url());
  expect(urls).toEqual(['about:blank']);
  await browserContext.close();
});

it('should close browser with beforeunload page', async ({browserType, browserOptions, server, createUserDataDir}) => {
  it.slow();

  const browserContext = await browserType.launchPersistentContext(await createUserDataDir(), {...browserOptions, headless: false});
  const page = await browserContext.newPage();
  await page.goto(server.PREFIX + '/beforeunload.html');
  // We have to interact with a page so that 'beforeunload' handlers
  // fire.
  await page.click('body');
  await browserContext.close();
});

it('should not crash when creating second context', async ({browserType, browserOptions}) => {
  const browser = await browserType.launch({...browserOptions, headless: false });
  {
    const browserContext = await browser.newContext();
    await browserContext.newPage();
    await browserContext.close();
  }
  {
    const browserContext = await browser.newContext();
    await browserContext.newPage();
    await browserContext.close();
  }
  await browser.close();
});

it('should click background tab', async ({browserType, browserOptions, server}) => {
  const browser = await browserType.launch({...browserOptions, headless: false });
  const page = await browser.newPage();
  await page.setContent(`<button>Hello</button><a target=_blank href="${server.EMPTY_PAGE}">empty.html</a>`);
  await page.click('a');
  await page.click('button');
  await browser.close();
});

it('should close browser after context menu was triggered', async ({browserType, browserOptions, server}) => {
  const browser = await browserType.launch({...browserOptions, headless: false });
  const page = await browser.newPage();
  await page.goto(server.PREFIX + '/grid.html');
  await page.click('body', {button: 'right'});
  await browser.close();
});

it('should(not) block third party cookies', async ({browserType, browserOptions, server, browserName}) => {
  const browser = await browserType.launch({...browserOptions, headless: false });
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
  const allowsThirdParty = browserName === 'chromium' || browserName === 'firefox';
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

it('should not override viewport size when passed null', async function({browserType, browserOptions, server, browserName}) {
  it.fixme(browserName === 'webkit');

  // Our WebKit embedder does not respect window features.
  const browser = await browserType.launch({...browserOptions, headless: false });
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
  await browser.close();
});

it('Page.bringToFront should work', async ({browserType, browserOptions}) => {
  const browser = await browserType.launch({...browserOptions, headless: false });
  const page1 = await browser.newPage();
  await page1.setContent('Page1');
  const page2 = await browser.newPage();
  await page2.setContent('Page2');

  await page1.bringToFront();
  expect(await page1.evaluate('document.visibilityState')).toBe('visible');
  expect(await page2.evaluate('document.visibilityState')).toBe('visible');

  await page2.bringToFront();
  expect(await page1.evaluate('document.visibilityState')).toBe('visible');
  expect(await page2.evaluate('document.visibilityState')).toBe(
      'visible'
  );
  await browser.close();
});

