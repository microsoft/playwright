/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import { expect, test } from '@playwright/experimental-ct-react';
import { Expandable } from './expandable';

test.use({ viewport: { width: 500, height: 500 } });

test('should render collapsed', async ({ mount }) => {
  const component = await mount(<Expandable expanded={false} setExpanded={() => {}} title='Title'>Details text</Expandable>);
  await expect(component.locator('text=Title')).toBeVisible();
  await expect(component.locator('text=Details')).toBeHidden();
  await expect(component.locator('.codicon-chevron-right')).toBeVisible();
});

test('should render expanded', async ({ mount }) => {
  const component = await mount(<Expandable expanded={true} setExpanded={() => {}} title='Title'>Details text</Expandable>);
  await expect(component.locator('text=Title')).toBeVisible();
  await expect(component.locator('text=Details')).toBeVisible();
  await expect(component.locator('.codicon-chevron-down')).toBeVisible();
});

test('click should expand', async ({ mount }) => {
  let expanded = false;
  const component = await mount(<Expandable expanded={false} setExpanded={e => expanded = e} title='Title'>Details text</Expandable>);
  await component.locator('.codicon-chevron-right').click();
  expect(expanded).toBeTruthy();
});
