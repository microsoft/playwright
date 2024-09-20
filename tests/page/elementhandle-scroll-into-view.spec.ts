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

it('should work @smoke', async ({ page, server, isAndroid }) => {
  it.fixme(isAndroid);

  await page.goto(server.PREFIX + '/offscreenbuttons.html');
  for (let i = 0; i < 11; ++i) {
    const button = await page.$('#btn' + i);
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

it('should throw for detached element', async ({ page, server }) => {
  await page.setContent('<div>Hello</div>');
  const div = await page.$('div');
  await div.evaluate(div => div.remove());
  const error = await div.scrollIntoViewIfNeeded().catch(e => e);
  expect(error.message).toContain('Element is not attached to the DOM');
});

async function testWaiting(page, after) {
  const div = await page.$('div');
  let done = false;
  const promise = div.scrollIntoViewIfNeeded().then(() => done = true);
  await page.waitForTimeout(1000);
  expect(done).toBe(false);
  await div.evaluate(after);
  await promise;
  expect(done).toBe(true);
}

it('should wait for display:none to become visible', async ({ page, server }) => {
  await page.setContent('<div style="display:none">Hello</div>');
  await testWaiting(page, div => div.style.display = 'block');
});

it('should scroll display:contents into view', async ({ page, browserName, browserMajorVersion }) => {
  it.skip(browserName === 'chromium' && browserMajorVersion < 105, 'Needs https://chromium-review.googlesource.com/c/chromium/src/+/3758670');
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/15034' });

  await page.setContent(`
    <style>
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
      ::-webkit-scrollbar { display: none; }
      * { scrollbar-width: none; }
    </style>
    <div id=container style="width:200px;height:200px;overflow:scroll;border:1px solid black;">
      <div style="margin-top:500px;background:red;">
        <div style="height:50px;width:100px;background:cyan;">
          <div id=target style="display:contents">Hello</div>
        </div>
      <div>
    </div>
  `);
  const div = await page.$('#target');
  await div.scrollIntoViewIfNeeded();
  const scrollTop = await page.$eval('#container', e => e.scrollTop);
  // On Android the value is not exact due to various scale conversions.
  expect(Math.abs(scrollTop - 350)).toBeLessThan(1);
});

it('should work for visibility:hidden element', async ({ page }) => {
  await page.setContent('<div style="visibility:hidden">Hello</div>');
  const div = await page.$('div');
  await div.scrollIntoViewIfNeeded();
});

it('should work for zero-sized element', async ({ page }) => {
  await page.setContent('<div style="height:0">Hello</div>');
  const div = await page.$('div');
  await div.scrollIntoViewIfNeeded();
});

it('should wait for nested display:none to become visible', async ({ page, server }) => {
  await page.setContent('<span style="display:none"><div>Hello</div></span>');
  await testWaiting(page, div => div.parentElement.style.display = 'block');
});

it('should wait for element to stop moving', async ({ page, server }) => {
  await page.setContent(`
    <style>
      @keyframes move {
        from { margin-left: 0; }
        to { margin-left: 200px; }
      }
      div.animated {
        animation: 2s linear 0s infinite alternate move;
      }
    </style>
    <div class=animated>moving</div>
    `);
  await testWaiting(page, div => div.classList.remove('animated'));
});

it('should timeout waiting for visible', async ({ page, server }) => {
  await page.setContent('<div style="display:none">Hello</div>');
  const div = await page.$('div');
  const error = await div.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('element is not visible');
  expect(error.message).toContain('retrying scroll into view action');
});
