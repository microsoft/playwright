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
  expect(await page.getByText(/e/).evaluate(e => e.outerHTML)).toContain('>\nye  </div>');

  await page.setContent(`<div> ye </div><div>ye</div>`);
  expect(await page.getByText('ye', { exact: true }).first().evaluate(e => e.outerHTML)).toContain('> ye </div>');

  await page.setContent(`<div>Hello world</div><div>Hello</div>`);
  expect(await page.getByText('Hello', { exact: true }).evaluate(e => e.outerHTML)).toBe('<div>Hello</div>');
});

it('getByLabel should work', async ({ page }) => {
  await page.setContent(`<div><label for=target>Name</label><input id=target type=text></div>`);
  expect(await page.getByText('Name').evaluate(e => e.nodeName)).toBe('LABEL');
  expect(await page.getByLabel('Name').evaluate(e => e.nodeName)).toBe('INPUT');
  expect(await page.mainFrame().getByLabel('Name').evaluate(e => e.nodeName)).toBe('INPUT');
  expect(await page.locator('div').getByLabel('Name').evaluate(e => e.nodeName)).toBe('INPUT');
});

it('getByLabel should work with nested elements', async ({ page }) => {
  await page.setContent(`<label for=target>Last <span>Name</span></label><input id=target type=text>`);

  await expect(page.getByLabel('last name')).toHaveAttribute('id', 'target');
  await expect(page.getByLabel('st na')).toHaveAttribute('id', 'target');
  await expect(page.getByLabel('Name')).toHaveAttribute('id', 'target');
  await expect(page.getByLabel('Last Name', { exact: true })).toHaveAttribute('id', 'target');
  await expect(page.getByLabel(/Last\s+name/i)).toHaveAttribute('id', 'target');

  expect(await page.getByLabel('Last', { exact: true }).elementHandles()).toEqual([]);
  expect(await page.getByLabel('last name', { exact: true }).elementHandles()).toEqual([]);
  expect(await page.getByLabel('Name', { exact: true }).elementHandles()).toEqual([]);
  expect(await page.getByLabel('what?').elementHandles()).toEqual([]);
  expect(await page.getByLabel(/last name/).elementHandles()).toEqual([]);
});

it('getByPlaceholder should work', async ({ page }) => {
  await page.setContent(`<div>
    <input placeholder='Hello'>
    <input placeholder='Hello World'>
  </div>`);
  await expect(page.getByPlaceholder('hello')).toHaveCount(2);
  await expect(page.getByPlaceholder('Hello', { exact: true })).toHaveCount(1);
  await expect(page.getByPlaceholder(/wor/i)).toHaveCount(1);

  // Coverage
  await expect(page.mainFrame().getByPlaceholder('hello')).toHaveCount(2);
  await expect(page.locator('div').getByPlaceholder('hello')).toHaveCount(2);
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

it('getBy escaping', async ({ page }) => {
  await page.setContent(`<label id=label for=control>Hello
wo"rld</label><input id=control />`);
  await page.$eval('input', input => {
    input.setAttribute('placeholder', 'hello\nwo"rld');
    input.setAttribute('title', 'hello\nwo"rld');
    input.setAttribute('alt', 'hello\nwo"rld');
  });
  await expect(page.getByText('hello\nwo"rld')).toHaveAttribute('id', 'label');
  await expect(page.getByLabel('hello\nwo"rld')).toHaveAttribute('id', 'control');
  await expect(page.getByPlaceholder('hello\nwo"rld')).toHaveAttribute('id', 'control');
  await expect(page.getByAltText('hello\nwo"rld')).toHaveAttribute('id', 'control');
  await expect(page.getByTitle('hello\nwo"rld')).toHaveAttribute('id', 'control');

  await page.setContent(`<label id=label for=control>Hello
world</label><input id=control />`);
  await page.$eval('input', input => {
    input.setAttribute('placeholder', 'hello\nworld');
    input.setAttribute('title', 'hello\nworld');
    input.setAttribute('alt', 'hello\nworld');
  });
  await expect(page.getByText('hello\nworld')).toHaveAttribute('id', 'label');
  await expect(page.getByLabel('hello\nworld')).toHaveAttribute('id', 'control');
  await expect(page.getByPlaceholder('hello\nworld')).toHaveAttribute('id', 'control');
  await expect(page.getByAltText('hello\nworld')).toHaveAttribute('id', 'control');
  await expect(page.getByTitle('hello\nworld')).toHaveAttribute('id', 'control');
});
