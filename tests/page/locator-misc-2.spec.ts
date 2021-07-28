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

import { test as it, expect } from './pageTest';

it('should press', async ({ page }) => {
  await page.setContent(`<input type='text' />`);
  await page.locator('input').press('h');
  expect(await page.$eval('input', input => input.value)).toBe('h');
});

it('should scroll into view', async ({ page, server, isAndroid }) => {
  it.fixme(isAndroid);

  await page.goto(server.PREFIX + '/offscreenbuttons.html');
  for (let i = 0; i < 11; ++i) {
    const button = page.locator('#btn' + i);
    const before = await button.evaluate(button => {
      return button.getBoundingClientRect().right - window.innerWidth;
    });
    expect(before).toBe(10 * i);
    await button.scrollIntoViewIfNeeded();
    const after = await button.evaluate(button => {
      return button.getBoundingClientRect().right - window.innerWidth;
    });
    expect(after <= 0).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
});

it('should select textarea', async ({ page, server, browserName }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  const textarea = page.locator('textarea');
  await textarea.evaluate(textarea => (textarea as HTMLTextAreaElement).value = 'some value');
  await textarea.selectText();
  if (browserName === 'firefox') {
    expect(await textarea.evaluate(el => (el as HTMLTextAreaElement).selectionStart)).toBe(0);
    expect(await textarea.evaluate(el => (el as HTMLTextAreaElement).selectionEnd)).toBe(10);
  } else {
    expect(await page.evaluate(() => window.getSelection().toString())).toBe('some value');
  }
});

it('should type', async ({ page }) => {
  await page.setContent(`<input type='text' />`);
  await page.locator('input').type('hello');
  expect(await page.$eval('input', input => input.value)).toBe('hello');
});

it('should take screenshot', async ({ page, server, browserName, headless, isAndroid }) => {
  it.skip(browserName === 'firefox' && !headless);
  it.skip(isAndroid, 'Different dpr. Remove after using 1x scale for screenshots.');
  await page.setViewportSize({width: 500, height: 500});
  await page.goto(server.PREFIX + '/grid.html');
  await page.evaluate(() => window.scrollBy(50, 100));
  const element = page.locator('.box:nth-of-type(3)');
  const screenshot = await element.screenshot();
  expect(screenshot).toMatchSnapshot('screenshot-element-bounding-box.png');
});

it('should return bounding box', async ({ page, server, browserName, headless }) => {
  it.fail(browserName === 'firefox' && !headless);

  await page.setViewportSize({ width: 500, height: 500 });
  await page.goto(server.PREFIX + '/grid.html');
  const element = page.locator('.box:nth-of-type(13)');
  const box = await element.boundingBox();
  expect(box).toEqual({ x: 100, y: 50, width: 50, height: 50 });
});
