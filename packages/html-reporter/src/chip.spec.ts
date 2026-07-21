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

import type { Auto, AutoCollapsed, Stateful, WithBody } from './chip.story';

test.use({ viewport: { width: 500, height: 500 } });

test('expand collapse', async ({ mount }) => {
  const component = await mount<typeof Auto>('chip/Auto');
  await expect(component.getByText('Chip body')).toBeVisible();
  await component.getByText('Title').click();
  await expect(component.getByText('Chip body')).not.toBeVisible();
  await component.getByText('Title').click();
  await expect(component.getByText('Chip body')).toBeVisible();
});

test('render long title', async ({ mount }) => {
  const title = 'Extremely long title. '.repeat(10);
  const component = await mount<typeof Auto>('chip/Auto', { header: title });
  await expect(component).toContainText('Extremely long title.');
  await expect(component.getByText('Extremely long title.')).toHaveAttribute('title', title);
});

test('setExpanded is called', async ({ mount }) => {
  const component = await mount<typeof Stateful>('chip/Stateful');
  await component.getByText('Title').click();
  await expect(component.getByTestId('expanded')).toHaveValue('true');
  await component.getByText('Title').click();
  await expect(component.getByTestId('expanded')).toHaveValue('false');
});

test('body render prop is rendered', async ({ mount }) => {
  const component = await mount<typeof WithBody>('chip/WithBody');
  await expect(component.getByText('Body from render prop')).toBeVisible();
  await expect(component.getByText('Chip children')).toBeVisible();
});

test('setExpanded should work', async ({ mount }) => {
  const component = await mount<typeof AutoCollapsed>('chip/AutoCollapsed');
  await component.getByText('Title').click();
  await expect(component).toMatchAriaSnapshot(`
    - button "Title" [expanded]
    - region: Body
  `);
});
