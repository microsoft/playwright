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
import type { ElementHandle } from 'playwright-core';

it('should work @smoke', async ({ page }) => {
  const aHandle = await page.evaluateHandle(() => ({
    one: 1,
    two: 2,
    three: 3
  }));
  const twoHandle = await aHandle.getProperty('two');
  expect(await twoHandle.jsonValue()).toEqual(2);
});

it('should work with undefined, null, and empty', async ({ page }) => {
  const aHandle = await page.evaluateHandle(() => ({
    undefined: undefined,
    null: null,
  }));
  const undefinedHandle = await aHandle.getProperty('undefined');
  expect(String(await undefinedHandle.jsonValue())).toEqual('undefined');
  const nullHandle = await aHandle.getProperty('null');
  expect(await nullHandle.jsonValue()).toEqual(null);
  const emptyhandle = await aHandle.getProperty('empty');
  expect(String(await emptyhandle.jsonValue())).toEqual('undefined');
});

it('should work with unserializable values', async ({ page }) => {
  const aHandle = await page.evaluateHandle(() => ({
    infinity: Infinity,
    nInfinity: -Infinity,
    nan: NaN,
    nzero: -0
  }));
  const infinityHandle = await aHandle.getProperty('infinity');
  expect(await infinityHandle.jsonValue()).toEqual(Infinity);
  const nInfinityHandle = await aHandle.getProperty('nInfinity');
  expect(await nInfinityHandle.jsonValue()).toEqual(-Infinity);
  const nanHandle = await aHandle.getProperty('nan');
  expect(String(await nanHandle.jsonValue())).toEqual('NaN');
  const nzeroHandle = await aHandle.getProperty('nzero');
  expect(await nzeroHandle.jsonValue()).toEqual(-0);
});

it('getProperties should work', async ({ page }) => {
  const aHandle = await page.evaluateHandle(() => ({
    foo: 'bar'
  }));
  const properties = await aHandle.getProperties();
  const foo = properties.get('foo');
  expect(foo).toBeTruthy();
  expect(await foo.jsonValue()).toBe('bar');
});

it('getProperties should return empty map for non-objects', async ({ page }) => {
  const aHandle = await page.evaluateHandle(() => 123);
  const properties = await aHandle.getProperties();
  expect(properties.size).toBe(0);
});

it('getProperties should return even non-own properties', async ({ page }) => {
  const aHandle = await page.evaluateHandle(() => {
    class A {
      a: string;
      constructor() {
        this.a = '1';
      }
    }
    class B extends A {
      b: string;
      constructor() {
        super();
        this.b = '2';
      }
    }
    return new B();
  });
  const properties = await aHandle.getProperties();
  expect(await properties.get('a').jsonValue()).toBe('1');
  expect(await properties.get('b').jsonValue()).toBe('2');
});

it('getProperties should work with elements', async ({ page }) => {
  await page.setContent(`<div>Hello</div>`);
  const handle = await page.evaluateHandle(() => ({ body: document.body }));
  const properties = await handle.getProperties();
  const body = properties.get('body') as ElementHandle;
  expect(body).toBeTruthy();
  expect(await body.textContent()).toBe('Hello');
});
