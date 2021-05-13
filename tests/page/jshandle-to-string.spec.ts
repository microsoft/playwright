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

it('should work for primitives', async ({page}) => {
  const numberHandle = await page.evaluateHandle(() => 2);
  expect(numberHandle.toString()).toBe('JSHandle@2');
  const stringHandle = await page.evaluateHandle(() => 'a');
  expect(stringHandle.toString()).toBe('JSHandle@a');
});

it('should work for complicated objects', async ({page}) => {
  const aHandle = await page.evaluateHandle(() => window);
  expect(aHandle.toString()).toBe('JSHandle@object');
});

it('should work for promises', async ({page}) => {
  // wrap the promise in an object, otherwise we will await.
  const wrapperHandle = await page.evaluateHandle(() => ({b: Promise.resolve(123)}));
  const bHandle = await wrapperHandle.getProperty('b');
  expect(bHandle.toString()).toBe('JSHandle@promise');
});

it('should work with different subtypes', async ({page, browserName}) => {
  expect((await page.evaluateHandle('(function(){})')).toString()).toBe('JSHandle@function');
  expect((await page.evaluateHandle('12')).toString()).toBe('JSHandle@12');
  expect((await page.evaluateHandle('true')).toString()).toBe('JSHandle@true');
  expect((await page.evaluateHandle('undefined')).toString()).toBe('JSHandle@undefined');
  expect((await page.evaluateHandle('"foo"')).toString()).toBe('JSHandle@foo');
  expect((await page.evaluateHandle('Symbol()')).toString()).toBe('JSHandle@symbol');
  expect((await page.evaluateHandle('new Map()')).toString()).toBe('JSHandle@map');
  expect((await page.evaluateHandle('new Set()')).toString()).toBe('JSHandle@set');
  expect((await page.evaluateHandle('[]')).toString()).toBe('JSHandle@array');
  expect((await page.evaluateHandle('null')).toString()).toBe('JSHandle@null');
  expect((await page.evaluateHandle('/foo/')).toString()).toBe('JSHandle@regexp');
  expect((await page.evaluateHandle('document.body')).toString()).toBe('JSHandle@node');
  expect((await page.evaluateHandle('new Date()')).toString()).toBe('JSHandle@date');
  expect((await page.evaluateHandle('new WeakMap()')).toString()).toBe('JSHandle@weakmap');
  expect((await page.evaluateHandle('new WeakSet()')).toString()).toBe('JSHandle@weakset');
  expect((await page.evaluateHandle('new Error()')).toString()).toBe('JSHandle@error');
  // TODO(yurys): change subtype from array to typedarray in WebKit.
  expect((await page.evaluateHandle('new Int32Array()')).toString()).toBe(browserName === 'webkit' ? 'JSHandle@array' : 'JSHandle@typedarray');
  expect((await page.evaluateHandle('new Proxy({}, {})')).toString()).toBe('JSHandle@proxy');
});
