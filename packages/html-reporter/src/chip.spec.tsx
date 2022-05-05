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

import React from 'react';
import { expect, test } from '@playwright/test';
import { AutoChip, Chip as LocalChip } from './chip';

test.use({ viewport: { width: 500, height: 500 } });

test('expand collapse', async ({ mount }) => {
  const component = await mount(<AutoChip header='title'>
    Chip body
  </AutoChip>);
  await expect(component.locator('text=Chip body')).toBeVisible();
  await component.locator('text=Title').click();
  await expect(component.locator('text=Chip body')).not.toBeVisible();
  await component.locator('text=Title').click();
  await expect(component.locator('text=Chip body')).toBeVisible();
});

test('render long title', async ({ mount }) => {
  const title = 'Extremely long title. '.repeat(10);
  const component = await mount(<AutoChip header={title}>
    Chip body
  </AutoChip>);
  await expect(component).toContainText('Extremely long title.');
  await expect(component.locator('text=Extremely long title.')).toHaveAttribute('title', title);
});

test('setExpanded is called', async ({ mount }) => {
  const expandedValues: boolean[] = [];
  const component = await mount(<LocalChip header='Title'
    setExpanded={(expanded: boolean) => expandedValues.push(expanded)}>
  </LocalChip>);

  await component.locator('text=Title').click();
  expect(expandedValues).toEqual([true]);
});
