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

import type { Default } from './imageDiffView.story';

test.use({ viewport: { width: 1000, height: 800 } });

test('should render links', async ({ mount }) => {
  const component = await mount<typeof Default>('shared/imageDiffView/Default');
  await expect(component.locator('a')).toHaveText([
    'screenshot-diff.png',
    'screenshot-actual.png',
    'screenshot-expected.png',
  ]);
});

test('should show diff by default', async ({ mount }) => {
  const component = await mount<typeof Default>('shared/imageDiffView/Default');
  const image = component.locator('img');
  const box = await image.boundingBox();
  expect(box).toEqual(expect.objectContaining({ width: 48, height: 48 }));
});

test('should render mode switcher tabs with role="tab"', async ({ mount }) => {
  const component = await mount<typeof Default>('shared/imageDiffView/Default');
  const tablist = component.getByRole('tablist');
  await expect(tablist).toBeVisible();

  const tabs = component.getByRole('tab');
  await expect(tabs).toHaveText(['Diff', 'Actual', 'Expected', 'Side by side', 'Slider']);
  await expect(component.getByRole('tab', { name: 'Diff' })).toHaveAttribute('aria-selected', 'true');
  await expect(component.getByRole('tab', { name: 'Actual' })).toHaveAttribute('aria-selected', 'false');
  await expect(component.getByRole('tab', { name: 'Expected' })).toHaveAttribute('aria-selected', 'false');
  await expect(component.getByRole('tab', { name: 'Side by side' })).toHaveAttribute('aria-selected', 'false');
  await expect(component.getByRole('tab', { name: 'Slider' })).toHaveAttribute('aria-selected', 'false');
});

test('can focus mode switcher tab and activate via keyboard', async ({ mount, page }) => {
  const component = await mount<typeof Default>('shared/imageDiffView/Default');
  const diffTab = component.getByRole('tab', { name: 'Diff' });
  const actualTab = component.getByRole('tab', { name: 'Actual' });
  const expectedTab = component.getByRole('tab', { name: 'Expected' });
  const sxsTab = component.getByRole('tab', { name: 'Side by side' });
  const sliderTab = component.getByRole('tab', { name: 'Slider' });

  await expect(diffTab).toHaveAttribute('aria-selected', 'true');

  await actualTab.focus();
  await expect(actualTab).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(actualTab).toHaveAttribute('aria-selected', 'true');
  await expect(diffTab).toHaveAttribute('aria-selected', 'false');

  await expectedTab.focus();
  await expect(expectedTab).toBeFocused();
  await page.keyboard.press('Space');
  await expect(expectedTab).toHaveAttribute('aria-selected', 'true');
  await expect(actualTab).toHaveAttribute('aria-selected', 'false');

  await sxsTab.focus();
  await expect(sxsTab).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(sxsTab).toHaveAttribute('aria-selected', 'true');
  await expect(expectedTab).toHaveAttribute('aria-selected', 'false');

  await sliderTab.focus();
  await expect(sliderTab).toBeFocused();
  await page.keyboard.press('Space');
  await expect(sliderTab).toHaveAttribute('aria-selected', 'true');
  await expect(sxsTab).toHaveAttribute('aria-selected', 'false');
});

test('clicking mode switcher tab changes mode and updates aria-selected', async ({ mount }) => {
  const component = await mount<typeof Default>('shared/imageDiffView/Default');
  const diffTab = component.getByRole('tab', { name: 'Diff' });
  const actualTab = component.getByRole('tab', { name: 'Actual' });

  await expect(diffTab).toHaveAttribute('aria-selected', 'true');
  await actualTab.click();
  await expect(actualTab).toHaveAttribute('aria-selected', 'true');
  await expect(diffTab).toHaveAttribute('aria-selected', 'false');
});
