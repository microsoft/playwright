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

import { test as it, expect, rafraf } from './pageTest';

it('should timeout waiting for stable position', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  const button = await page.$('button');
  await button.evaluate(button => {
    button.style.transition = 'margin 5s linear 0s';
    button.style.marginLeft = '200px';
  });
  // rafraf for Firefox to kick in the animation.
  await rafraf(page);
  const error = await button.click({ timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('elementHandle.click: Timeout 3000ms exceeded.');
  expect(error.message).toContain('waiting for element to be visible, enabled and stable');
  expect(error.message).toContain('element is not stable');
  expect(error.message).toContain('retrying click action');
});

it('should click for the second time after first timeout', async ({ page, server, mode }) => {
  it.skip(mode !== 'default');

  await page.goto(server.PREFIX + '/input/button.html');
  const __testHookBeforePointerAction = () => new Promise(f => setTimeout(f, 1500));
  const error = await page.click('button', { timeout: 1000, __testHookBeforePointerAction } as any).catch(e => e);
  expect(error.message).toContain('page.click: Timeout 1000ms exceeded.');

  expect(await page.evaluate('result')).toBe('Was not clicked');
  await page.waitForTimeout(2000);
  expect(await page.evaluate('result')).toBe('Was not clicked');

  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
});
