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

it('should remove context init script after dispose', async ({ context, server }) => {
  const disposable = await context.addInitScript(() => (window as any)['temp'] = 123);
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => (window as any)['temp'])).toBe(123);

  await disposable.dispose();
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => (window as any)['temp'])).toBe(undefined);
});

it('should remove context init script and keep working in new pages', async ({ context, server }) => {
  const disposable = await context.addInitScript(() => (window as any)['temp'] = 123);
  await disposable.dispose();
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => (window as any)['temp'])).toBe(undefined);
});

it('should expose functions passed as arguments', async ({ context, server }) => {
  const received: string[] = [];
  await context.addInitScript(async ({ cb }) => {
    await cb(location.href);
  }, { cb: async (href: string) => { received.push(href); } }, { exposeFunctions: true });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => received).toContain(server.EMPTY_PAGE);
});

it('should expose functions that survive navigation', async ({ context, server }) => {
  const received: number[] = [];
  await context.addInitScript(({ cb }) => {
    (window as any).cb = cb;
  }, { cb: (n: number) => { received.push(n); return n * 2; } }, { exposeFunctions: true });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  expect(await page.evaluate(() => (window as any).cb(1))).toBe(2);
  await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
  expect(await page.evaluate(() => (window as any).cb(2))).toBe(4);
  expect(received).toEqual([1, 2]);
});

it('should expose functions in popups', async ({ context, server }) => {
  await context.addInitScript(({ mul }) => {
    (window as any).mul = mul;
  }, { mul: (a: number, b: number) => a * b }, { exposeFunctions: true });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window.open('about:blank')),
  ]);
  expect(await popup.evaluate(() => (window as any).mul(6, 7))).toBe(42);
});

it('should remove exposed functions after dispose', async ({ context, server }) => {
  const disposable = await context.addInitScript(({ cb }) => {
    (window as any).cb = cb;
  }, { cb: (n: number) => n * 2 }, { exposeFunctions: true });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  expect(await page.evaluate(() => (window as any).cb(21))).toBe(42);
  await disposable.dispose();
  await page.goto(server.EMPTY_PAGE);
  expect(await page.evaluate(() => typeof (window as any).cb)).toBe('undefined');
});

it('init script should run only once in popup', async ({ context }) => {
  await context.addInitScript(() => {
    window['callCount'] = (window['callCount'] || 0) + 1;
  });
  const page = await context.newPage();
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window.open('about:blank')),
  ]);
  expect(await popup.evaluate('callCount')).toEqual(1);
});
