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

it('should work for primitives', async ({ page }) => {
  const numberHandle = await page.evaluateHandle(() => 2);
  expect(numberHandle.toString()).toBe('2');
  const stringHandle = await page.evaluateHandle(() => 'a');
  expect(stringHandle.toString()).toBe('a');
});

it('should work for complicated objects', async ({ page, browserName }) => {
  const aHandle = await page.evaluateHandle(() => window);
  if (browserName !== 'firefox')
    expect(aHandle.toString()).toBe('Window');
  else
    expect(aHandle.toString()).toBe('JSHandle@object');
});

it('should beautifully render sparse arrays', async ({ page, browserName }) => {
  const [msg] = await Promise.all([
    page.waitForEvent('console'),
    page.evaluateHandle(() => {
      const a = [];
      a[1] = 1;
      a[10] = 2;
      a[100] = 3;
      console.log(a);
    }),
  ]);
  if (browserName === 'firefox')
    expect(msg.text()).toBe('Array');
  else
    expect(msg.text()).toBe('[empty, 1, empty x 8, 2, empty x 89, 3]');
});

it('should work for promises', async ({ page }) => {
  // wrap the promise in an object, otherwise we will await.
  const wrapperHandle = await page.evaluateHandle(() => ({ b: Promise.resolve(123) }));
  const bHandle = await wrapperHandle.getProperty('b');
  expect(bHandle.toString()).toBe('Promise');
});

it('should work with different subtypes @smoke', async ({ page, browserName }) => {
  expect((await page.evaluateHandle('(function(){})')).toString()).toContain('function');
  expect((await page.evaluateHandle('12')).toString()).toBe('12');
  expect((await page.evaluateHandle('true')).toString()).toBe('true');
  expect((await page.evaluateHandle('undefined')).toString()).toBe('undefined');
  expect((await page.evaluateHandle('"foo"')).toString()).toBe('foo');
  expect((await page.evaluateHandle('Symbol()')).toString()).toBe('Symbol()');
  expect((await page.evaluateHandle('new Map()')).toString()).toContain('Map');
  expect((await page.evaluateHandle('new Set()')).toString()).toContain('Set');
  expect((await page.evaluateHandle('[]')).toString()).toContain('Array');
  expect((await page.evaluateHandle('null')).toString()).toBe('null');
  expect((await page.evaluateHandle('document.body')).toString()).toBe('JSHandle@node');
  expect((await page.evaluateHandle('new WeakMap()')).toString()).toBe('WeakMap');
  expect((await page.evaluateHandle('new WeakSet()')).toString()).toBe('WeakSet');
  expect((await page.evaluateHandle('new Error()')).toString()).toContain('Error');
  expect((await page.evaluateHandle('new Proxy({}, {})')).toString()).toBe((browserName === 'chromium') ? 'Proxy(Object)' : 'Proxy');
});

it('should work with previewable subtypes', async ({ page, browserName }) => {
  it.skip(browserName === 'firefox');
  expect((await page.evaluateHandle('/foo/')).toString()).toBe('/foo/');
  expect((await page.evaluateHandle('new Date(0)')).toString()).toContain('GMT');
  expect((await page.evaluateHandle('new Int32Array()')).toString()).toContain('Int32Array');
});
