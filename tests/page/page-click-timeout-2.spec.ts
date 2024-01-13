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

it('should timeout waiting for display:none to be gone', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', b => b.style.display = 'none');
  const error = await page.click('button', { timeout: 5000 }).catch(e => e);
  expect(error.message).toContain('page.click: Timeout 5000ms exceeded.');
  expect(error.message).toContain('waiting for element to be visible, enabled and stable');
  expect(error.message).toContain('element is not visible');
  expect(error.message).toContain('retrying click action');
});

it('should timeout waiting for visibility:hidden to be gone', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.$eval('button', b => b.style.visibility = 'hidden');
  const error = await page.click('button', { timeout: 5000 }).catch(e => e);
  expect(error.message).toContain('page.click: Timeout 5000ms exceeded.');
  expect(error.message).toContain('waiting for element to be visible, enabled and stable');
  expect(error.message).toContain('element is not visible');
  expect(error.message).toContain('retrying click action');
});
