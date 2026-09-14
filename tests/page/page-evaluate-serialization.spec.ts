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

for (const target of ['page', 'frame'] as const) {
  for (const world of ['main', 'utility'] as const) {
    test(`should use extended serialization in ${target}.evaluate in ${world} world`, async ({ page }) => {
      const evaluator = target === 'page' ? page : page.mainFrame();
      const value = { map: new Map([['key', new Set([1, 2])]]), empty: new Map(), set: new Set() };
      const result = await evaluator.evaluate(async value => {
        if (!(value.map instanceof Map) || !(value.map.get('key') instanceof Set))
          throw new Error('Expected Map and Set arguments');
        value.map.get('key')!.add(3);
        return value;
      }, value, { serialization: 'extended', world });
      expect(result).toEqual({ map: new Map([['key', new Set([1, 2, 3])]]), empty: new Map(), set: new Set() });
      expect(await evaluator.evaluate(() => new Map([['key', 1]]), undefined, { serialization: 'default' })).toEqual({});
    });
  }

  test(`should use extended serialization in ${target}.evaluateHandle`, async ({ page }) => {
    const evaluator = target === 'page' ? page : page.mainFrame();
    const value = new Map([['key', new Set([1, 2])]]);
    const handle = await evaluator.evaluateHandle(value => value, value, { serialization: 'extended' });
    expect(await handle.evaluate(value => value instanceof Map && value.get('key') instanceof Set)).toBe(true);
    expect(await handle.evaluate(value => value, undefined, { serialization: 'extended' })).toEqual(value);
    expect(await handle.evaluate(value => value)).toEqual({});
    await handle.dispose();
  });
}

test('should preserve cycles and shared references with extended serialization', async ({ page }) => {
  const key = { name: 'key' };
  const map = new Map<unknown, unknown>();
  const set = new Set<unknown>([key, map]);
  map.set(key, set);
  map.set(map, map);
  set.add(set);
  const result = await page.evaluate(value => value, { key, map, set }, { serialization: 'extended' });
  expect(result.map.get(result.key)).toBe(result.set);
  expect(result.map.get(result.map)).toBe(result.map);
  expect(result.set.has(result.set)).toBe(true);
  expect(result.set.has(result.key)).toBe(true);
  expect(result.set.has(result.map)).toBe(true);
});

test('should use extended serialization with handle evaluation arguments', async ({ page }) => {
  const handle = await page.evaluateHandle(() => 42);
  const value = new Map([['key', new Set([1, 2])]]);
  expect(await handle.evaluate((n, value) => ({ n, value }), value, { serialization: 'extended' })).toEqual({ n: 42, value });
  const result = await handle.evaluateHandle((n, value) => ({ n, value }), value, { serialization: 'extended' });
  expect(await result.evaluate(value => value, undefined, { serialization: 'extended' })).toEqual({ n: 42, value });
  await result.dispose();
  await handle.dispose();
});

test('should use extended serialization with element and locator evaluation', async ({ page }) => {
  await page.setContent('<div>hello</div>');
  const value = new Map([['key', new Set([1, 2])]]);
  const locator = page.locator('div');
  const element = await locator.elementHandle();
  expect(await element!.evaluate((e, value) => ({ text: e.textContent, value }), value, { serialization: 'extended' })).toEqual({ text: 'hello', value });
  for (const world of ['main', 'utility'] as const)
    expect(await locator.evaluate((e, value) => ({ text: e.textContent, value }), value, { serialization: 'extended', world })).toEqual({ text: 'hello', value });
  const handle = await locator.evaluateHandle((e, value) => ({ text: e.textContent, value }), value, { serialization: 'extended' });
  expect(await handle.evaluate(value => value, undefined, { serialization: 'extended' })).toEqual({ text: 'hello', value });
  await handle.dispose();
  await element!.dispose();
});

test('should support handles inside Map and Set arguments', async ({ page }) => {
  const handle = await page.evaluateHandle(() => document.body);
  const value = new Map([[handle, new Set([handle])]]);
  expect(await page.evaluate(value => value.get(document.body)?.has(document.body), value, { serialization: 'extended' })).toBe(true);
  await handle.dispose();
});

test('should expose callbacks inside Map and Set arguments', async ({ page }) => {
  const callback = async (value: number) => value * 2;
  const result = await page.evaluate(async value => {
    const [callback] = value.get('callbacks')!;
    return new Map([['result', await callback(21)]]);
  }, new Map([['callbacks', new Set([callback])]]), { serialization: 'extended', exposeFunctions: true });
  expect(result).toEqual(new Map([['result', 42]]));
});

test('should reject an unsupported serialization mode', async ({ page }) => {
  // @ts-expect-error Invalid serialization mode.
  await expect(page.evaluate(() => 42, undefined, { serialization: 'invalid' })).rejects.toThrow('serialization: expected one of (default|extended)');
});
