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

import { test, expect } from './playwright-test-fixtures';

test('should report matcherResults for generic matchers', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test, expect as baseExpect } from '@playwright/test';
      const expect = baseExpect.soft;
      test('fail', ({}) => {
        expect(1).toBe(2);
        expect(1).toBeCloseTo(2);
        expect(undefined).toBeDefined();
        expect(1).toBeFalsy();
        expect(1).toBeGreaterThan(2);
        expect(1).toBeGreaterThanOrEqual(2);
        expect('a').toBeInstanceOf(Number);
        expect(2).toBeLessThan(1);
        expect(2).toBeLessThanOrEqual(1);
        expect(1).toBeNaN();
        expect(1).toBeNull();
        expect(0).toBeTruthy();
        expect(1).toBeUndefined();
        expect([1]).toContain(2);
        expect([1]).toContainEqual(2);
        expect([1]).toEqual([2]);
        expect([1]).toHaveLength(2);
        expect({ a: 1 }).toHaveProperty('b');
        expect('a').toMatch(/b/);
        expect({ a: 1 }).toMatchObject({ b: 2 });
        expect({ a: 1 }).toStrictEqual({ b: 2 });
        expect(() => {}).toThrow();
        expect(() => {}).toThrowError('a');
      });
    `
  }, { });
  expect(result.exitCode).toBe(1);

  const { errors } = result.report.suites[0].specs[0].tests[0].results[0];
  const matcherResults = errors.map(e => e.matcherResult);
  expect(matcherResults).toEqual([
    { name: 'toBe', pass: false, expected: 2, actual: 1 },
    { pass: false },
    { pass: false },
    { pass: false },
    { pass: false },
    { pass: false },
    { pass: false },
    { pass: false },
    { pass: false },
    { pass: false },
    { pass: false },
    { pass: false },
    { pass: false },
    { pass: false },
    { pass: false },
    { name: 'toEqual', pass: false, expected: [2], actual: [1] },
    { pass: false },
    { pass: false },
    { pass: false },
    { pass: false },
    { name: 'toStrictEqual', pass: false, expected: { b: 2 }, actual: { a: 1 } },
    { pass: false },
    { pass: false },
  ]);
});

test('should report matcherResults for web matchers', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test, expect as baseExpect } from '@playwright/test';

      const expect = baseExpect.configure({ soft: true, timeout: 1 });
      test('fail', async ({ page }) => {
        await page.setContent('<span>Hello</span><div display="none">World</div><input type="checkbox"><textarea></textarea><button>Submit</button><select multiple><option value="value">Text</option></select>');
        await expect(page.locator('input')).toBeChecked();
        await expect(page.locator('input')).toBeDisabled();
        await expect(page.locator('textarea')).not.toBeEditable();
        await expect(page.locator('span')).toBeEmpty();
        await expect(page.locator('button')).not.toBeEnabled();
        await expect(page.locator('button')).toBeFocused();
        await expect(page.locator('span')).toBeHidden();
        await expect(page.locator('div')).not.toBeInViewport();
        await expect(page.locator('div')).not.toBeVisible();
        await expect(page.locator('span')).toContainText('World');
        await expect(page.locator('span')).toHaveAccessibleDescription('World');
        await expect(page.locator('span')).toHaveAccessibleName('World');
        await expect(page.locator('span')).toHaveAttribute('name', 'value');
        await expect(page.locator('span')).toHaveAttribute('name');
        await expect(page.locator('span')).toHaveClass('name');
        await expect(page.locator('span')).toHaveCount(2);
        await expect(page.locator('span')).toHaveCSS('width', '10');
        await expect(page.locator('span')).toHaveId('id');
        await expect(page.locator('span')).toHaveJSProperty('name', 'value');
        await expect(page.locator('span')).toHaveRole('role');
        await expect(page.locator('span')).toHaveText('World');
        await expect(page.locator('textarea')).toHaveValue('value');
        await expect(page.locator('select')).toHaveValues(['value']);
      });
    `
  }, { });
  expect(result.exitCode).toBe(1);

  const { errors } = result.report.suites[0].specs[0].tests[0].results[0];
  const matcherResults = errors.map(e => e.matcherResult);
  expect(matcherResults).toEqual([
    { name: 'toBeChecked', pass: false, expected: 'checked', actual: 'unchecked', timeout: 1 },
    { name: 'toBeDisabled', pass: false, expected: 'disabled', actual: 'enabled', timeout: 1 },
    { name: 'toBeEditable', pass: true, expected: 'editable', actual: 'editable', timeout: 1 },
    { name: 'toBeEmpty', pass: false, expected: 'empty', actual: 'notEmpty', timeout: 1 },
    { name: 'toBeEnabled', pass: true, expected: 'enabled', actual: 'enabled', timeout: 1 },
    { name: 'toBeFocused', pass: false, expected: 'focused', actual: 'inactive', timeout: 1 },
    { name: 'toBeHidden', pass: false, expected: 'hidden', actual: 'visible', timeout: 1 },
    { name: 'toBeInViewport', pass: true, expected: 'in viewport', actual: 'in viewport', timeout: 1 },
    { name: 'toBeVisible', pass: true, expected: 'visible', actual: 'visible', timeout: 1 },
    { name: 'toContainText', pass: false, expected: 'World', actual: 'Hello', timeout: 1 },
    { name: 'toHaveAccessibleDescription', pass: false, expected: 'World', actual: '', timeout: 1 },
    { name: 'toHaveAccessibleName', pass: false, expected: 'World', actual: '', timeout: 1 },
    { name: 'toHaveAttribute', pass: false, expected: 'value', actual: null, timeout: 1 },
    { name: 'toHaveAttribute', pass: false, expected: 'have attribute', actual: 'not have attribute', timeout: 1 },
    { name: 'toHaveClass', pass: false, expected: 'name', actual: '', timeout: 1 },
    { name: 'toHaveCount', pass: false, expected: 2, actual: 1, timeout: 1 },
    { name: 'toHaveCSS', pass: false, expected: '10', actual: 'auto', timeout: 1 },
    { name: 'toHaveId', pass: false, expected: 'id', actual: '', timeout: 1 },
    { name: 'toHaveJSProperty', pass: false, expected: 'value', timeout: 1 },
    { name: 'toHaveRole', pass: false, expected: 'role', actual: '', timeout: 1 },
    { name: 'toHaveText', pass: false, expected: 'World', actual: 'Hello', timeout: 1 },
    { name: 'toHaveValue', pass: false, expected: 'value', actual: '', timeout: 1 },
    { name: 'toHaveValues', pass: false, expected: ['value'], actual: [], timeout: 1 },
  ]);
});
