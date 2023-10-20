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

import { contextTest as it, expect } from '../config/browserTest';

it('should work with browser context scripts @smoke', async ({ context, server }) => {
  await context.addInitScript(() => (window as any)['temp'] = 123);
  const page = await context.newPage();
  await page.addInitScript(() => (window as any)['injected'] = (window as any)['temp']);
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => (window as any)['result'])).toBe(123);
});

it('should work without navigation, after all bindings', async ({ context }) => {
  let callback: (arg: unknown) => void;
  const promise = new Promise(f => callback = f);
  await context.exposeFunction('woof', function(arg: any) {
    callback(arg);
  });

  await context.addInitScript(() => {
    (window as any)['woof']('hey');
    (window as any)['temp'] = 123;
  });
  const page = await context.newPage();

  expect(await page.evaluate(() => (window as any)['temp'])).toBe(123);
  expect(await promise).toBe('hey');
});

it('should work without navigation in popup', async ({ context }) => {
  await context.addInitScript(() => (window as any)['temp'] = 123);
  const page = await context.newPage();
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => (window as any)['win'] = window.open()),
  ]);
  expect(await popup.evaluate(() => (window as any)['temp'])).toBe(123);
});

it('should work with browser context scripts with a path', async ({ context, server, asset }) => {
  await context.addInitScript({ path: asset('injectedfile.js') });
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => (window as any)['result'])).toBe(123);
});

it('should work with browser context scripts for already created pages', async ({ context, server }) => {
  const page = await context.newPage();
  await context.addInitScript(() => (window as any)['temp'] = 123);
  await page.addInitScript(() => (window as any)['injected'] = (window as any)['temp']);
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => (window as any)['result'])).toBe(123);
});
