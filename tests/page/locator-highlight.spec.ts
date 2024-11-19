/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import { test as it, expect, roundBox } from './pageTest';

it.skip(({ mode }) => mode !== 'default', 'Highlight element has a closed shadow-root on != default');

it('should highlight locator', async ({ page }) => {
  await page.setContent(`<input type='text' />`);
  await page.locator('input').highlight();
  await expect(page.locator('x-pw-tooltip')).toHaveText('locator(\'input\')');
  await expect(page.locator('x-pw-highlight')).toBeVisible();
  const box1 = roundBox(await page.locator('input').boundingBox());
  const box2 = roundBox(await page.locator('x-pw-highlight').boundingBox());
  expect(box1).toEqual(box2);
});
