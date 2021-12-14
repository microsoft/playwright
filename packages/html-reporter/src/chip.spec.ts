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

import { test, expect } from '../test/componentTest';

test.use({ webpack: require.resolve('../webpack.config.js') });

test('chip expand collapse', async ({ renderComponent }) => {
  const component = await renderComponent('ChipComponent');
  await expect(component.locator('text=Chip body')).toBeVisible();
  // expect(await component.screenshot()).toMatchSnapshot('expanded.png');
  await component.locator('text=Title').click();
  await expect(component.locator('text=Chip body')).not.toBeVisible();
  // expect(await component.screenshot()).toMatchSnapshot('collapsed.png');
  await component.locator('text=Title').click();
  await expect(component.locator('text=Chip body')).toBeVisible();
  // expect(await component.screenshot()).toMatchSnapshot('expanded.png');
});

test('chip render long title', async ({ renderComponent }) => {
  const title = 'Extremely long title. '.repeat(10);
  const component = await renderComponent('ChipComponent', { title });
  await expect(component).toContainText('Extremely long title.');
  await expect(component.locator('text=Extremely long title.')).toHaveAttribute('title', title);
});

test('chip setExpanded is called', async ({ renderComponent }) => {
  const expandedValues: boolean[] = [];
  const component = await renderComponent('ChipComponentWithFunctions', {
    setExpanded: (expanded: boolean) => expandedValues.push(expanded)
  });

  await component.locator('text=Title').click();
  expect(expandedValues).toEqual([true]);
});
