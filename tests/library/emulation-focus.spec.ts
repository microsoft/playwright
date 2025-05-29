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

import { contextTest as it, browserTest, expect } from '../config/browserTest';
import { attachFrame } from '../config/utils';

it('should think that it is focused by default', async ({ page }) => {
  expect(await page.evaluate('document.hasFocus()')).toBe(true);
});

it('should think that all pages are focused @smoke', async ({ page }) => {
  const page2 = await page.context().newPage();
  expect(await page.evaluate('document.hasFocus()')).toBe(true);
  expect(await page2.evaluate('document.hasFocus()')).toBe(true);
  await page2.close();
});

it('should focus popups by default', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => { window.open(url); }, server.EMPTY_PAGE),
  ]);
  expect(await popup.evaluate('document.hasFocus()')).toBe(true);
  expect(await page.evaluate('document.hasFocus()')).toBe(true);
});

it('should provide target for keyboard events', async ({ page, server }) => {
  const page2 = await page.context().newPage();
  await Promise.all([
    page.goto(server.PREFIX + '/input/textarea.html'),
    page2.goto(server.PREFIX + '/input/textarea.html'),
  ]);
  await Promise.all([
    page.focus('input'),
    page2.focus('input'),
  ]);
  const text = 'first';
  const text2 = 'second';
  await Promise.all([
    page.keyboard.type(text),
    page2.keyboard.type(text2),
  ]);
  const results = await Promise.all([
    page.evaluate('result'),
    page2.evaluate('result'),
  ]);
  expect(results).toEqual([text, text2]);
});

it('should not affect mouse event target page', async ({ page, server }) => {
  const page2 = await page.context().newPage();
  function clickCounter() {
    document.onclick = () => window['clickCount']  = (window['clickCount'] || 0) + 1;
  }
  await Promise.all([
    page.evaluate(clickCounter),
    page2.evaluate(clickCounter),
    page.focus('body'),
    page2.focus('body'),
  ]);
  await Promise.all([
    page.mouse.click(1, 1),
    page2.mouse.click(1, 1),
  ]);
  const counters = await Promise.all([
    page.evaluate('window.clickCount'),
    page2.evaluate('window.clickCount'),
  ]);
  expect(counters).toEqual([1, 1]);
});

it('should change document.activeElement', async ({ page, server }) => {
  const page2 = await page.context().newPage();
  await Promise.all([
    page.goto(server.PREFIX + '/input/textarea.html'),
    page2.goto(server.PREFIX + '/input/textarea.html'),
  ]);
  await Promise.all([
    page.focus('input'),
    page2.focus('textarea'),
  ]);
  const active = await Promise.all([
    page.evaluate('document.activeElement.tagName'),
    page2.evaluate('document.activeElement.tagName'),
  ]);
  expect(active).toEqual(['INPUT', 'TEXTAREA']);
});

it('should not affect screenshots', async ({ page, server, browserName, headless, isWindows, isLinux, isHeadlessShell, channel }) => {
  it.skip(browserName === 'webkit' && isWindows && !headless, 'WebKit/Windows/headed has a larger minimal viewport. See https://github.com/microsoft/playwright/issues/22616');
  it.skip(browserName === 'webkit' && isLinux && !headless, 'WebKit headed has a larger minimal viewport on gtk4.');
  it.skip(browserName === 'firefox' && !headless, 'Firefox headed produces a different image');
  it.fixme(browserName === 'chromium' && !isHeadlessShell && channel !== 'chromium-tip-of-tree', 'https://github.com/microsoft/playwright/issues/33330');

  const page2 = await page.context().newPage();
  await Promise.all([
    page.setViewportSize({ width: 500, height: 500 }),
    page.goto(server.PREFIX + '/grid.html'),
    page2.setViewportSize({ width: 50, height: 50 }),
    page2.goto(server.PREFIX + '/grid.html'),
  ]);
  await Promise.all([
    page.focus('body'),
    page2.focus('body'),
  ]);
  const screenshots = await Promise.all([
    page.screenshot(),
    page2.screenshot(),
  ]);
  expect(screenshots[0]).toMatchSnapshot('screenshot-sanity.png');
  expect(screenshots[1]).toMatchSnapshot('grid-cell-0.png');
});

it('should change focused iframe', async ({ page, server, browserName, headless }) => {
  it.skip(browserName === 'firefox' && !headless, 'Headed FF might lose focus');
  await page.goto(server.EMPTY_PAGE);
  const [frame1, frame2] = await Promise.all([
    attachFrame(page, 'frame1', server.PREFIX + '/input/textarea.html'),
    attachFrame(page, 'frame2', server.PREFIX + '/input/textarea.html'),
  ]);
  function logger() {
    self['_events'] = [];
    const element = document.querySelector('input');
    element.onfocus = element.onblur = e => self['_events'].push(e.type);
  }
  await Promise.all([
    frame1.evaluate(logger),
    frame2.evaluate(logger),
  ]);
  const focused = await Promise.all([
    frame1.evaluate('document.hasFocus()'),
    frame2.evaluate('document.hasFocus()'),
  ]);
  expect(focused).toEqual([false, false]);
  {
    await frame1.focus('input');
    const events = await Promise.all([
      frame1.evaluate('self._events'),
      frame2.evaluate('self._events'),
    ]);
    expect(events).toEqual([['focus'], []]);
    const focused = await Promise.all([
      frame1.evaluate('document.hasFocus()'),
      frame2.evaluate('document.hasFocus()'),
    ]);
    expect(focused).toEqual([true, false]);
  }
  {
    await frame2.focus('input');
    const events = await Promise.all([
      frame1.evaluate('self._events'),
      frame2.evaluate('self._events'),
    ]);
    expect(events).toEqual([['focus', 'blur'], ['focus']]);
    const focused = await Promise.all([
      frame1.evaluate('document.hasFocus()'),
      frame2.evaluate('document.hasFocus()'),
    ]);
    expect(focused).toEqual([false, true]);
  }
});

// @see https://github.com/microsoft/playwright/issues/3476
browserTest('should focus with more than one page/context', async ({ contextFactory }) => {
  const page1 = await (await contextFactory()).newPage();
  const page2 = await (await contextFactory()).newPage();
  await page1.setContent(`<button id="foo" onfocus="window.gotFocus=true">foo</button>`);
  await page2.setContent(`<button id="foo" onfocus="window.gotFocus=true">foo</button>`);
  await page1.focus('#foo');
  await page2.focus('#foo');
  expect(await page1.evaluate(() => !!window['gotFocus'])).toBe(true);
  expect(await page2.evaluate(() => !!window['gotFocus'])).toBe(true);
});

browserTest('should not fire blur events when interacting with more than one page/context', async ({ contextFactory, browserName }) => {
  browserTest.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30399' });
  const page1 = await (await contextFactory()).newPage();
  const page2 = await (await contextFactory()).newPage();
  await page1.setContent(`<button id="foo" onblur="window.gotBlur=true">foo</button>`);
  await page2.setContent(`<button id="foo" onblur="window.gotBlur=true">foo</button>`);
  await page1.click('#foo');
  await page2.click('#foo');
  expect(await page1.evaluate(() => !!window['gotBlur'])).toBe(false);
  expect(await page2.evaluate(() => !!window['gotBlur'])).toBe(false);
});

browserTest('should trigger hover state concurrently', async ({ browserType, browserName, headless }) => {
  browserTest.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/27969' });
  browserTest.skip(!headless, 'headed messes up with hover');
  browserTest.fixme(browserName === 'firefox');

  const browser1 = await browserType.launch();
  const context1 = await browser1.newContext();
  const page1 = await context1.newPage();
  const page2 = await context1.newPage();
  const browser2 = await browserType.launch();
  const page3 = await browser2.newPage();

  for (const page of [page1, page2, page3]) {
    await page.setContent(`
      <style>
        button { display: none; }
        div:hover button { display: inline };
      </style>
      <div><span>hover me</span><button onclick="window.clicked=1+(window.clicked || 0)">click me</button></div>
    `);
  }

  for (const page of [page1, page2, page3])
    await page.hover('span');
  for (const page of [page1, page2, page3])
    await page.click('button');
  for (const page of [page1, page2, page3])
    expect(await page.evaluate('window.clicked')).toBe(1);
  for (const page of [page1, page2, page3])
    await page.click('button');
  for (const page of [page1, page2, page3])
    expect(await page.evaluate('window.clicked')).toBe(2);
});
