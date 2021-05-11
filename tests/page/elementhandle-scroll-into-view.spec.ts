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

it('should work', async ({ page, server, isAndroid }) => {
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
  await page.evaluate(() => new Promise(f => setTimeout(f, 1000)));
  expect(done).toBe(false);
  await div.evaluate(after);
  await promise;
  expect(done).toBe(true);
}
it('should wait for display:none to become visible', async ({ page, server }) => {
  await page.setContent('<div style="display:none">Hello</div>');
  await testWaiting(page, div => div.style.display = 'block');
});

it('should wait for display:contents to become visible', async ({ page, server }) => {
  await page.setContent('<div style="display:contents">Hello</div>');
  await testWaiting(page, div => div.style.display = 'block');
});

it('should wait for visibility:hidden to become visible', async ({ page, server }) => {
  await page.setContent('<div style="visibility:hidden">Hello</div>');
  await testWaiting(page, div => div.style.visibility = 'visible');
});

it('should wait for zero-sized element to become visible', async ({ page, server }) => {
  await page.setContent('<div style="height:0">Hello</div>');
  await testWaiting(page, div => div.style.height = '100px');
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
});
