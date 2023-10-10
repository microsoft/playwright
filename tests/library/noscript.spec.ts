/**
 * Copyright (c) Martin Schitter (2023).
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { contextTest as it, expect } from '../config/browserTest';

it.describe('disable JS', () => {
  it.use({ javaScriptEnabled: false });
  it('noscript (disabled)', async ({ server, page }) => {
    await page.goto(server.PREFIX + '/noscript.html');

    await expect(page.locator('#id1'),
        'Elements within noscript spans should be accessible').toHaveCount(1);
    await expect(page.locator('#id1'),
        'Text within noscript spans should be shown').toHaveText('JS Disabled (1)');
    await expect(page.getByText('JS Disabled (1)'),
        'Noscript Text should be found').toBeVisible();
    await expect(page.locator('#id2')).toHaveText('JS Disabled (2)');
  });
});

it('noscript (enabled)', async ({ server, page }) => {
  await page.goto(server.PREFIX + '/noscript.html');

  await expect(page.locator('#id1')).toHaveCount(0);
  await expect(page.locator('#id2')).toBeHidden();
});
