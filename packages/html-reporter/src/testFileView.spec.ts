/**
 * Copyright (c) Microsoft Corporation.
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

import { expect, test } from '@playwright/test';

import type { Default } from './testFileView.story';

test.use({ viewport: { width: 800, height: 600 } });

test('should render project links', async ({ mount, page }) => {
  const component = await mount<typeof Default>('testFileView/Default');
  await expect(component.locator('.label', { hasText: 'chromium' })).toHaveCount(5);
  await expect(component.locator('.label', { hasText: 'webkit' })).toHaveCount(1);
  const webkitLabel = component.locator('.label', { hasText: 'webkit' });
  await webkitLabel.click();
  await expect(page).toHaveURL(/p(:|%3A)webkit/);
  await webkitLabel.click({ modifiers: ['ControlOrMeta'] });
  await expect(page).not.toHaveURL(/webkit/);
});
