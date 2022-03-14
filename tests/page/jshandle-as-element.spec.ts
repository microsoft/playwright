/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import { test, expect } from './pageTest';

test('should work @smoke', async ({ page }) => {
  const aHandle = await page.evaluateHandle(() => document.body);
  const element = aHandle.asElement();
  expect(element).toBeTruthy();
});

test('should return null for non-elements', async ({ page }) => {
  const aHandle = await page.evaluateHandle(() => 2);
  const element = aHandle.asElement();
  expect(element).toBeFalsy();
});

test('should return ElementHandle for TextNodes', async ({ page }) => {
  await page.setContent('<div>ee!</div>');
  const aHandle = await page.evaluateHandle(() => document.querySelector('div').firstChild);
  const element = aHandle.asElement();
  expect(element).toBeTruthy();
  expect(await page.evaluate(e => e.nodeType === Node.TEXT_NODE, element)).toBeTruthy();
});

test('should work with nullified Node', async ({ page }) => {
  await page.setContent('<section>test</section>');
  await page.evaluate('delete Node');
  const handle = await page.evaluateHandle(() => document.querySelector('section'));
  const element = handle.asElement();
  expect(element).not.toBe(null);
});
