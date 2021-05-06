/**
 * Copyright 2017 Google Inc. All rights reserved.
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

import { test as it, expect } from '../config/pageTest';

it('should fire', async ({page, server, isWebKit}) => {
  const [error] = await Promise.all([
    page.waitForEvent('pageerror'),
    page.goto(server.PREFIX + '/error.html'),
  ]);
  expect(error.name).toBe('Error');
  expect(error.message).toBe('Fancy error!');
  let stack = await page.evaluate(() => window['e'].stack);
  // Note that WebKit reports the stack of the 'throw' statement instead of the Error constructor call.
  if (isWebKit)
    stack = stack.replace('14:25', '15:19');
  expect(error.stack).toBe(stack);
});

it('should contain sourceURL', async ({page, server, isWebKit}) => {
  it.fail(isWebKit);

  const [error] = await Promise.all([
    page.waitForEvent('pageerror'),
    page.goto(server.PREFIX + '/error.html'),
  ]);
  expect(error.stack).toContain('myscript.js');
});

it('should contain the Error.name property', async ({ page }) => {
  const [error] = await Promise.all([
    page.waitForEvent('pageerror'),
    page.evaluate(() => {
      setTimeout(() => {
        const error = new Error('my-message');
        error.name = 'my-name';
        throw error;
      }, 0);
    })
  ]);
  expect(error.name).toBe('my-name');
  expect(error.message).toBe('my-message');
});

it('should support an empty Error.name property', async ({ page }) => {
  const [error] = await Promise.all([
    page.waitForEvent('pageerror'),
    page.evaluate(() => {
      setTimeout(() => {
        const error = new Error('my-message');
        error.name = '';
        throw error;
      }, 0);
    })
  ]);
  expect(error.name).toBe('');
  expect(error.message).toBe('my-message');
});

it('should handle odd values', async ({page}) => {
  const cases = [
    [null, 'null'],
    [undefined, 'undefined'],
    [0, '0'],
    ['', ''],
  ];
  for (const [value, message] of cases) {
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.evaluate(value => setTimeout(() => { throw value; }, 0), value),
    ]);
    expect(error.message).toBe(message);
  }
});

it('should handle object', async ({page, isChromium}) => {
  const [error] = await Promise.all([
    page.waitForEvent('pageerror'),
    page.evaluate(() => setTimeout(() => { throw {}; }, 0)),
  ]);
  expect(error.message).toBe(isChromium ? 'Object' : '[object Object]');
});

it('should handle window', async ({page, isChromium, isFirefox, isElectron}) => {
  it.skip(isElectron);
  const [error] = await Promise.all([
    page.waitForEvent('pageerror'),
    page.evaluate(() => setTimeout(() => { throw window; }, 0)),
  ]);
  expect(error.message).toBe(isChromium ? 'Window' : '[object Window]');
});
