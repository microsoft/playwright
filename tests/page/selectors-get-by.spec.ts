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

import { test as it, expect } from './pageTest';

it('getByTestId should work', async ({ page }) => {
  await page.setContent('<div><div data-testid="Hello">Hello world</div></div>');
  await expect(page.getByTestId('Hello')).toHaveText('Hello world');
  await expect(page.mainFrame().getByTestId('Hello')).toHaveText('Hello world');
  await expect(page.locator('div').getByTestId('Hello')).toHaveText('Hello world');
});

it('getByTestId should escape id', async ({ page }) => {
  await page.setContent(`<div><div data-testid='He"llo'>Hello world</div></div>`);
  await expect(page.getByTestId('He"llo')).toHaveText('Hello world');
});

it('getByText should work', async ({ page }) => {
  await page.setContent(`<div>yo</div><div>ya</div><div>\nye  </div>`);
  expect(await page.getByText('ye').evaluate(e => e.outerHTML)).toContain('>\nye  </div>');
  expect(await page.getByText(/ye/).evaluate(e => e.outerHTML)).toContain('>\nye  </div>');

  await page.setContent(`<div> ye </div><div>ye</div>`);
  expect(await page.getByText('ye', { exact: true }).first().evaluate(e => e.outerHTML)).toContain('> ye </div>');
});

it('getByLabelText should work', async ({ page }) => {
  await page.setContent(`<div><label for=target>Name</label><input id=target type=text></div>`);
  expect(await page.getByText('Name').evaluate(e => e.nodeName)).toBe('LABEL');
  expect(await page.getByLabelText('Name').evaluate(e => e.nodeName)).toBe('INPUT');
  expect(await page.mainFrame().getByLabelText('Name').evaluate(e => e.nodeName)).toBe('INPUT');
  expect(await page.locator('div').getByLabelText('Name').evaluate(e => e.nodeName)).toBe('INPUT');
});

it('getByPlaceholderText should work', async ({ page }) => {
  await page.setContent(`<div>
    <input placeholder='Hello'>
    <input placeholder='Hello World'>
  </div>`);
  await expect(page.getByPlaceholderText('hello')).toHaveCount(2);
  await expect(page.getByPlaceholderText('Hello', { exact: true })).toHaveCount(1);
  await expect(page.getByPlaceholderText(/wor/i)).toHaveCount(1);

  // Coverage
  await expect(page.mainFrame().getByPlaceholderText('hello')).toHaveCount(2);
  await expect(page.locator('div').getByPlaceholderText('hello')).toHaveCount(2);
});

it('getByAltText should work', async ({ page }) => {
  await page.setContent(`<div>
    <input alt='Hello'>
    <input alt='Hello World'>
  </div>`);
  await expect(page.getByAltText('hello')).toHaveCount(2);
  await expect(page.getByAltText('Hello', { exact: true })).toHaveCount(1);
  await expect(page.getByAltText(/wor/i)).toHaveCount(1);

  // Coverage
  await expect(page.mainFrame().getByAltText('hello')).toHaveCount(2);
  await expect(page.locator('div').getByAltText('hello')).toHaveCount(2);
});

it('getByTitle should work', async ({ page }) => {
  await page.setContent(`<div>
    <input title='Hello'>
    <input title='Hello World'>
  </div>`);
  await expect(page.getByTitle('hello')).toHaveCount(2);
  await expect(page.getByTitle('Hello', { exact: true })).toHaveCount(1);
  await expect(page.getByTitle(/wor/i)).toHaveCount(1);

  // Coverage
  await expect(page.mainFrame().getByTitle('hello')).toHaveCount(2);
  await expect(page.locator('div').getByTitle('hello')).toHaveCount(2);
});
