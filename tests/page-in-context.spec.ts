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

import { browserTest as it, expect } from './config/browserTest';
import { attachFrame, chromiumVersionLessThan } from './config/utils';

it('should not be visible in context.pages', async ({contextFactory}) => {
  const context = await contextFactory();
  const page = await context.newPage();
  expect(context.pages()).toContain(page);
  await page.close();
  expect(context.pages()).not.toContain(page);
});

it('page.context should return the correct instance', async function({contextFactory}) {
  const context = await contextFactory();
  const page = await context.newPage();
  expect(page.context()).toBe(context);
});

it('frame.focus should work multiple times', async ({ contextFactory }) => {
  const context = await contextFactory();
  const page1 = await context.newPage();
  const page2 = await context.newPage();
  for (const page of [page1, page2]) {
    await page.setContent(`<button id="foo" onfocus="window.gotFocus=true"></button>`);
    await page.focus('#foo');
    expect(await page.evaluate(() => !!window['gotFocus'])).toBe(true);
  }
});

it('should click with disabled javascript', async ({browser, server}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/wrappedlink.html');
  await Promise.all([
    page.click('a'),
    page.waitForNavigation()
  ]);
  expect(page.url()).toBe(server.PREFIX + '/wrappedlink.html#clicked');
  await context.close();
});

it('should not hang with touch-enabled viewports', async ({browser, playwright}) => {
  // @see https://github.com/GoogleChrome/puppeteer/issues/161
  const { viewport, hasTouch } = playwright.devices['iPhone 6'];
  const context = await browser.newContext({ viewport, hasTouch });
  const page = await context.newPage();
  await page.mouse.down();
  await page.mouse.move(100, 10);
  await page.mouse.up();
  await context.close();
});

it('should click the button with deviceScaleFactor set', async ({browser, server}) => {
  const context = await browser.newContext({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 5 });
  const page = await context.newPage();
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(5);
  await page.setContent('<div style="width:100px;height:100px">spacer</div>');
  await attachFrame(page, 'button-test', server.PREFIX + '/input/button.html');
  const frame = page.frames()[1];
  const button = await frame.$('button');
  await button.click();
  expect(await frame.evaluate(() => window['result'])).toBe('Clicked');
  await context.close();
});

it('should click the button with offset with page scale', async ({browser, server, isWebKit, isChromium, headful, browserName, browserVersion}) => {
  it.skip(browserName === 'firefox');

  const context = await browser.newContext({ viewport: { width: 400, height: 400 }, isMobile: true });
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', button => {
    button.style.borderWidth = '8px';
    document.body.style.margin = '0';
  });
  await page.click('button', { position: { x: 20, y: 10 } });
  expect(await page.evaluate('result')).toBe('Clicked');
  const round = x => Math.round(x + 0.01);
  let expected = { x: 28, y: 18 };  // 20;10 + 8px of border in each direction
  if (isWebKit) {
    // WebKit rounds up during css -> dip -> css conversion.
    expected = { x: 29, y: 19 };
  } else if (isChromium && !headful) {
    // Headless Chromium rounds down during css -> dip -> css conversion.
    expected = { x: 27, y: 18 };
  } else if (isChromium && headful && !chromiumVersionLessThan(browserVersion, '92.0.4498.0')) {
    // New headed Chromium rounds down during css -> dip -> css conversion as well.
    expected = { x: 27, y: 18 };
  }
  expect(round(await page.evaluate('pageX'))).toBe(expected.x);
  expect(round(await page.evaluate('pageY'))).toBe(expected.y);
  await context.close();
});

