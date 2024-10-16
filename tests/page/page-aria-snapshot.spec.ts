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

it('should snapshot the check box @smoke', async ({ page }) => {
  await page.setContent(`<input id='checkbox' type='checkbox'></input>`);
  expect(await page.locator('body').ariaSnapshot()).toBe('- checkbox');
});

it('should snapshot nested element', async ({ page }) => {
  await page.setContent(`
    <div>
      <input id='checkbox' type='checkbox'></input>
    </div>`);
  expect(await page.locator('body').ariaSnapshot()).toBe('- checkbox');
});

it('should snapshot fragment', async ({ page }) => {
  await page.setContent(`
    <div>
      <a href="about:blank">Link</a>
      <a href="about:blank">Link</a>
    </div>`);
  expect(await page.locator('body').ariaSnapshot()).toBe(`- link "Link"\n- link "Link"`);
});
