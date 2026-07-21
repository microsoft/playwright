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

import type { Collapsed, Expanded, Stateful, StatefulTitleClick } from './expandable.story';

test.use({ viewport: { width: 500, height: 500 } });

test('should render collapsed', async ({ mount }) => {
  const component = await mount<typeof Collapsed>('components/expandable/Collapsed');
  await expect(component.locator('text=Title')).toBeVisible();
  await expect(component.locator('text=Details')).toBeHidden();
  await expect(component.locator('.codicon-chevron-right')).toBeVisible();
});

test('should render expanded', async ({ mount }) => {
  const component = await mount<typeof Expanded>('components/expandable/Expanded');
  await expect(component.locator('text=Title')).toBeVisible();
  await expect(component.locator('text=Details')).toBeVisible();
  await expect(component.locator('.codicon-chevron-down')).toBeVisible();
});

test('click should expand', async ({ mount }) => {
  const component = await mount<typeof Stateful>('components/expandable/Stateful');
  await component.locator('.codicon-chevron-right').click();
  await expect(component.getByTestId('expanded')).toHaveValue('true');
  await expect(component.locator('text=Details')).toBeVisible();
});

test('title click should expand when enabled', async ({ mount }) => {
  const component = await mount<typeof StatefulTitleClick>('components/expandable/StatefulTitleClick');
  await component.getByText('Title').click();
  await expect(component.getByTestId('expanded')).toHaveValue('true');
});

test('title click should not expand by default', async ({ mount }) => {
  const component = await mount<typeof Stateful>('components/expandable/Stateful');
  await component.getByText('Title').click();
  await expect(component.locator('.codicon-chevron-right')).toBeVisible();
  await expect(component.getByTestId('expanded')).toHaveValue('false');
});
