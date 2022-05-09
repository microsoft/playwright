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

import { test as it, expect } from './pageTest';

it('should work', async ({ page }) => {
  const windowHandle = await page.evaluateHandle(() => window);
  expect(windowHandle).toBeTruthy();
});

it('should accept object handle as an argument', async ({ page }) => {
  const navigatorHandle = await page.evaluateHandle(() => navigator);
  const text = await page.evaluate(e => e.userAgent, navigatorHandle);
  expect(text).toContain('Mozilla');
});

it('should accept object handle to primitive types', async ({ page }) => {
  const aHandle = await page.evaluateHandle(() => 5);
  const isFive = await page.evaluate(e => Object.is(e, 5), aHandle);
  expect(isFive).toBeTruthy();
});

it('should accept nested handle', async ({ page }) => {
  const foo = await page.evaluateHandle(() => ({ x: 1, y: 'foo' }));
  const result = await page.evaluate(({ foo }) => {
    return foo;
  }, { foo });
  expect(result).toEqual({ x: 1, y: 'foo' });
});

it('should accept nested window handle', async ({ page }) => {
  const foo = await page.evaluateHandle(() => window);
  const result = await page.evaluate(({ foo }) => {
    return foo === window;
  }, { foo });
  expect(result).toBe(true);
});

it('should accept multiple nested handles', async ({ page }) => {
  const foo = await page.evaluateHandle(() => ({ x: 1, y: 'foo' }));
  const bar = await page.evaluateHandle(() => 5);
  const baz = await page.evaluateHandle(() => (['baz']));
  const result = await page.evaluate(x => {
    return JSON.stringify(x);
  }, { a1: { foo }, a2: { bar, arr: [{ baz }] } });
  expect(JSON.parse(result)).toEqual({
    a1: { foo: { x: 1, y: 'foo' } },
    a2: { bar: 5, arr: [{ baz: ['baz'] }] }
  });
});

it('should accept same handle multiple times', async ({ page }) => {
  const foo = await page.evaluateHandle(() => 1);
  expect(await page.evaluate(x => x, { foo, bar: [foo], baz: { foo } })).toEqual({ foo: 1, bar: [1], baz: { foo: 1 } });
});

it('should accept same nested object multiple times', async ({ page }) => {
  const foo = { x: 1 };
  expect(await page.evaluate(x => x, { foo, bar: [foo], baz: { foo } })).toEqual({ foo: { x: 1 }, bar: [{ x: 1 }], baz: { foo: { x: 1 } } });
});

it('should accept object handle to unserializable value', async ({ page }) => {
  const aHandle = await page.evaluateHandle(() => Infinity);
  expect(await page.evaluate(e => Object.is(e, Infinity), aHandle)).toBe(true);
});

it('should pass configurable args', async ({ page }) => {
  const result = await page.evaluate(arg => {
    if (arg.foo !== 42)
      throw new Error('Not a 42');
    arg.foo = 17;
    if (arg.foo !== 17)
      throw new Error('Not 17');
    delete arg.foo;
    if (arg.foo === 17)
      throw new Error('Still 17');
    return arg;
  }, { foo: 42 });
  expect(result).toEqual({});
});

it('should work with primitives', async ({ page }) => {
  const aHandle = await page.evaluateHandle(() => {
    window['FOO'] = 123;
    return window;
  });
  expect(await page.evaluate(e => e['FOO'], aHandle)).toBe(123);
});
