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

import { test, expect } from './pageTest';

test('should use extended serialization in evaluate', async ({ page }) => {
  const value = new Map([['key', new Set([1, 2])]]);
  const result = await page.evaluate(value => {
    if (!(value instanceof Map) || !(value.get('key') instanceof Set))
      throw new Error('Expected Map and Set arguments');
    value.get('key')!.add(3);
    return value;
  }, value, { serialization: 'extended' });
  expect(result).toEqual(new Map([['key', new Set([1, 2, 3])]]));
  expect(await page.evaluate(value => value, value, { serialization: 'default' })).toEqual({});
});

test('should use extended serialization with handles', async ({ page }) => {
  const value = new Map([['key', new Set([1, 2])]]);
  const handle = await page.evaluateHandle(value => value, value, { serialization: 'extended' });
  expect(await handle.evaluate(value => value instanceof Map && value.get('key') instanceof Set)).toBe(true);
  expect(await handle.evaluate((value, set) => ({ value, set }), new Set([3]), { serialization: 'extended' })).toEqual({ value, set: new Set([3]) });
  expect(await handle.evaluate(value => value)).toEqual({});
  await handle.dispose();
});

test('should use extended serialization with locators', async ({ page }) => {
  await page.setContent('<div>hello</div>');
  const value = new Map([['key', new Set([1, 2])]]);
  const result = await page.locator('div').evaluate((element, value) => ({ text: element.textContent, value }), value, { serialization: 'extended' });
  expect(result).toEqual({ text: 'hello', value });
});

test('should reject an unsupported serialization mode', async ({ page }) => {
  // @ts-expect-error Invalid serialization mode.
  await expect(page.evaluate(() => 42, undefined, { serialization: 'invalid' })).rejects.toThrow('serialization: expected one of (default|extended)');
});
