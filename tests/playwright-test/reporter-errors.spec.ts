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
  expect(errors).toEqual([
    { expected: 2, actual: 1 },
    { },
    { },
    { },
    { },
    { },
    { },
    { },
    { },
    { },
    { },
    { },
    { },
    { },
    { },
    { expected: [2], actual: [1] },
    { },
    { },
    { },
    { },
    { expected: { b: 2 }, actual: { a: 1 } },
    { },
    { },
  ].map(e => expect.objectContaining(e)));
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
  expect(errors).toEqual([
    { log: expect.any(Array), expected: 'checked', actual: 'unchecked' },
    { log: expect.any(Array), expected: 'disabled', actual: 'enabled' },
    { log: expect.any(Array), expected: 'editable', actual: 'editable' },
    { log: expect.any(Array), expected: 'empty', actual: 'notEmpty' },
    { log: expect.any(Array), expected: 'enabled', actual: 'enabled' },
    { log: expect.any(Array), expected: 'focused', actual: 'inactive' },
    { log: expect.any(Array), expected: 'hidden', actual: 'visible' },
    { log: expect.any(Array), expected: 'in viewport', actual: 'in viewport' },
    { log: expect.any(Array), expected: 'visible', actual: 'visible' },
    { log: expect.any(Array), expected: 'World', actual: 'Hello' },
    { log: expect.any(Array), expected: 'World', actual: '' },
    { log: expect.any(Array), expected: 'World', actual: '' },
    { log: expect.any(Array), expected: 'value', actual: null },
    { log: expect.any(Array), expected: 'have attribute', actual: 'not have attribute' },
    { log: expect.any(Array), expected: 'name', actual: '' },
    { log: expect.any(Array), expected: 2, actual: 1 },
    { log: expect.any(Array), expected: '10', actual: 'auto' },
    { log: expect.any(Array), expected: 'id', actual: '' },
    { log: expect.any(Array), expected: 'value' },
    { log: expect.any(Array), expected: 'role', actual: '' },
    { log: expect.any(Array), expected: 'World', actual: 'Hello' },
    { log: expect.any(Array), expected: 'value', actual: '' },
    { log: expect.any(Array), expected: ['value'], actual: [] },
  ].map(e => expect.objectContaining(e)));
});
