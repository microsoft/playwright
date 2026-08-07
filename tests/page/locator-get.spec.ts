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

import { by } from 'playwright-core';

import { test as it, expect } from './pageTest';

it('should build the same locators the getBy* factories build', async ({ page }) => {
  expect(page.get(by.altText('Alt')).toString()).toBe(page.getByAltText('Alt').toString());
  expect(page.get(by.label('Label')).toString()).toBe(page.getByLabel('Label').toString());
  expect(page.get(by.placeholder('Placeholder')).toString()).toBe(page.getByPlaceholder('Placeholder').toString());
  expect(page.get(by.role('button', { name: 'Save' })).toString()).toBe(page.getByRole('button', { name: 'Save' }).toString());
  expect(page.get(by.testId('id')).toString()).toBe(page.getByTestId('id').toString());
  expect(page.get(by.text('Text', { exact: true })).toString()).toBe(page.getByText('Text', { exact: true }).toString());
  expect(page.get(by.title('Title')).toString()).toBe(page.getByTitle('Title').toString());
});

it('should chain the same way locators chain', async ({ page }) => {
  const chained = page.getByTestId('list').getByRole('listitem').filter({ hasText: 'Row' }).first();
  expect(page.get(by.testId('list').role('listitem').filter({ hasText: 'Row' }).first()).toString()).toBe(chained.toString());
});

it('should compose get() the same way as chaining', async ({ page }) => {
  const row = by.role('listitem');
  const label = by.text('Label');
  expect(page.get(by.testId('list').get(row.get(label))).toString()).toBe(page.get(by.testId('list').get(row).get(label)).toString());
});

it('should accept a selector in get()', async ({ page }) => {
  expect(page.get(by.get('#outer')).toString()).toBe(page.locator('#outer').toString());
  expect(page.get(by.get('#outer').get('span')).toString()).toBe(page.locator('#outer').locator('span').toString());

  await page.setContent(`<div id=outer><span>Hello</span><span>World</span></div>`);
  await expect(page.get(by.get('#outer').get('span'))).toHaveText(['Hello', 'World']);
  await expect(page.get(by.get('#outer').get(by.text('World')))).toHaveText('World');
  await expect(page.get(by.text('World').get('..'))).toHaveId('outer');
});

it('should work on page, frame and locator', async ({ page }) => {
  await page.setContent(`<div id=outer><div data-testid="Hello">Hello world</div></div>`);
  const hello = by.testId('Hello');
  await expect(page.get(hello)).toHaveText('Hello world');
  await expect(page.mainFrame().get(hello)).toHaveText('Hello world');
  await expect(page.locator('#outer').get(hello)).toHaveText('Hello world');
});

it('should work inside a frame locator', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/frames/one-frame.html');
  await expect(page.frameLocator('iframe').get(by.get('div'))).toHaveText(`Hi, I'm frame`);
});

it('should resolve the test id attribute when bound, not when built', async ({ page, playwright }) => {
  const hello = by.testId('Hello');
  await page.setContent('<div data-my-custom-testid="Hello">Hello world</div>');
  playwright.selectors.setTestIdAttribute('data-my-custom-testid');
  await expect(page.get(hello)).toHaveText('Hello world');
});

it('should resolve the test id attribute in nested and filter positions', async ({ page, playwright }) => {
  const row = by.get('li').filter({ has: by.testId('unread') }).get(by.text('Subject'));
  await page.setContent(`
    <ul>
      <li><span>Subject</span></li>
      <li><i data-pw="unread"></i><span>Subject</span></li>
    </ul>
  `);
  playwright.selectors.setTestIdAttribute('data-pw');
  await expect(page.get(row)).toHaveCount(1);
});

it('should filter by has, hasNot, hasText, hasNotText and visible', async ({ page }) => {
  await page.setContent(`
    <div class=item><span>one</span><b>keep</b></div>
    <div class=item><span>two</span></div>
    <div class=item style="display: none"><span>one</span><b>keep</b></div>
  `);
  await expect(page.get(by.get('.item').filter({ has: by.get('b') }))).toHaveCount(2);
  await expect(page.get(by.get('.item').filter({ hasNot: by.get('b') }))).toHaveCount(1);
  await expect(page.get(by.get('.item').filter({ hasText: 'two' }))).toHaveCount(1);
  await expect(page.get(by.get('.item').filter({ hasNotText: 'two' }))).toHaveCount(2);
  await expect(page.get(by.get('.item').filter({ visible: true }))).toHaveCount(2);
});

it('should support and, or, nth, first and last', async ({ page }) => {
  await page.setContent(`
    <button title=Subscribe>one</button>
    <button>two</button>
    <div role=button>three</div>
  `);
  await expect(page.get(by.role('button').and(by.title('Subscribe')))).toHaveText('one');
  await expect(page.get(by.role('button').or(by.get('div')))).toHaveCount(3);
  await expect(page.get(by.role('button').nth(1))).toHaveText('two');
  await expect(page.get(by.role('button').first())).toHaveText('one');
  await expect(page.get(by.role('button').last())).toHaveText('three');
});

it('should describe the locator', async ({ page }) => {
  await page.setContent(`<button>Save</button>`);
  const saveButton = page.get(by.role('button').describe('save button'));
  await expect(saveButton).toHaveText('Save');
  expect(saveButton.description()).toBe('save button');
});

it('should be reusable and never mutated by chaining', async ({ page }) => {
  await page.setContent(`<ul><li>A</li><li>B</li></ul>`);
  const list = by.get('ul');
  await expect(page.get(list.text('A'))).toHaveText('A');
  await expect(page.get(list.text('B'))).toHaveText('B');
  await expect(page.get(list)).toHaveText('AB');
});

it('should throw for an empty by', async ({ page }) => {
  expect(() => page.get(by)).toThrow(/Empty "by" locator/);
});
