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

import { stripAnsi } from '../config/utils';
import { test, expect } from './pageTest';

test('strict mode violation', async ({ page }) => {
  await page.setContent('<div>a</div><div>b</div>');
  const error = await expect(page.locator('div')).toHaveText('foo', { timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.name + ': ' + error.message)).toContain(
`Error: expect(locator).toHaveText(expected) failed

Locator: locator('div')
Expected: "foo"
Error: strict mode violation: locator('div') resolved to 2 elements:
    1) <div>a</div> aka getByText('a')
    2) <div>b</div> aka getByText('b')

Call log:
`);
});

test('invalid selector', async ({ page }) => {
  await page.setContent('<div>a</div><div>b</div>');
  const error = await expect(page.locator('##')).toBeVisible({ timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.name + ': ' + error.message)).toContain(
`Error: expect(locator).toBeVisible() failed

Locator: ##
Expected: visible
Error: Unexpected token "#" while parsing css selector "##". Did you mean to CSS.escape it?

Call log:
`);
});

test('string array', async ({ page }) => {
  await page.setContent('<div>a</div><div>b</div>');
  const error = await expect(page.locator('div')).toHaveClass(['a', 'b'], { timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.name + ': ' + error.message)).toContain(
`Error: expect(locator).toHaveClass(expected) failed

Locator: locator('div')
Timeout: 1000ms
- Expected  - 2
+ Received  + 2

  Array [
-   "a",
-   "b",
+   "",
+   "",
  ]

Call log:
`);
});

test('string equality', async ({ page }) => {
  await page.setContent('<div>a</div><div>b</div>');
  const error = await expect(page.locator('div').first()).toHaveClass('a', { timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.name + ': ' + error.message)).toContain(
`Error: expect(locator).toHaveClass(expected) failed

Locator:  locator('div').first()
Expected: "a"
Received: ""
Timeout:  1000ms

Call log:
`);
});

test('pattern match', async ({ page }) => {
  await page.setContent('<div>a</div><div>b</div>');
  const error = await expect(page.locator('div').first()).toHaveClass(/bar/, { timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.name + ': ' + error.message)).toContain(
`Error: expect(locator).toHaveClass(expected) failed

Locator: locator('div').first()
Expected pattern: /bar/
Received string:  ""
Timeout: 1000ms

Call log:
`);
});

test('element not found', async ({ page }) => {
  await page.setContent('<div>a</div><div>b</div>');
  const error = await expect(page.locator('span')).toBeVisible({ timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.name + ': ' + error.message)).toContain(
`Error: expect(locator).toBeVisible() failed

Locator: locator('span')
Expected: visible
Timeout: 1000ms
Error: element(s) not found

Call log:
`);
});

test('substring', async ({ page }) => {
  await page.setContent('<div>a</div><div>b</div>');
  const error = await expect(page.locator('div').first()).toContainText('foo', { timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.name + ': ' + error.message)).toContain(
`Error: expect(locator).toContainText(expected) failed

Locator: locator('div').first()
Expected substring: "foo"
Received string:    "a"
Timeout: 1000ms

Call log:
`);
});

test('page receiver', async ({ page }) => {
  await page.setContent('<div>a</div><div>b</div>');
  const error = await expect(page).toHaveURL('http://example.com', { timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.name + ': ' + error.message)).toContain(
`Error: expect(page).toHaveURL(expected) failed

Expected: "http://example.com/"
Received: "about:blank"
Timeout:  1000ms

Call log:
`);
});

test('predicate', async ({ page }) => {
  await page.setContent('<div>a</div><div>b</div>');
  const error = await expect(page).toHaveURL(() => false, { timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.name + ': ' + error.message)).toContain(
`Error: expect(page).toHaveURL(expected) failed

Expected: predicate to succeed
Received: "about:blank"
Timeout:  1000ms
`);
});

test('wrong type', async ({ page }) => {
  await page.setContent('<div>a</div><div>b</div>');
  const error = await expect(page.locator('div')).toHaveText({} as any).catch(e => e);
  expect(stripAnsi(error.name + ': ' + error.message)).toContain(
`Error: expect(locator).toHaveText(expected) failed

Locator: locator('div')
Error: expected value must be a string or regular expression
Expected has type:  object
Expected has value: {}
`);
});
