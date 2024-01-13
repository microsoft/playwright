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

it('should avoid side effects after timeout', async ({ page, server, mode }) => {
  it.skip(mode !== 'default');

  await page.goto(server.PREFIX + '/input/button.html');
  const error = await page.click('button', { timeout: 2000, __testHookBeforePointerAction: () => new Promise(f => setTimeout(f, 2500)) } as any).catch(e => e);
  await page.waitForTimeout(5000);  // Give it some time to click after the test hook is done waiting.
  expect(await page.evaluate('result')).toBe('Was not clicked');
  expect(error.message).toContain('page.click: Timeout 2000ms exceeded.');
});

it('should timeout waiting for button to be enabled', async ({ page }) => {
  await page.setContent('<button onclick="javascript:window.__CLICKED=true;" disabled><span>Click target</span></button>');
  const error = await page.click('text=Click target', { timeout: 3000 }).catch(e => e);
  expect(await page.evaluate('window.__CLICKED')).toBe(undefined);
  expect(error.message).toContain('page.click: Timeout 3000ms exceeded.');
  expect(error.message).toContain('element is not enabled');
  expect(error.message).toContain('retrying click action');
});
