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

it('should report data from all pages to a single node callback', async ({ context, server }) => {
  const reports = [];
  const page1 = await context.newPage();
  await context.addInitScript(report => {
    void report(location.pathname);
  }, (pathname: string) => {
    reports.push(pathname);
  });
  // `page1` existed before the call and `page2` is created after it.
  await page1.goto(server.EMPTY_PAGE);
  const page2 = await context.newPage();
  await page2.goto(server.PREFIX + '/grid.html');
  // New pages also run the init script on their initial `about:blank` document, so ignore those.
  await expect.poll(() => [...new Set(reports.filter(p => p.startsWith('/')))].sort()).toEqual(['/empty.html', '/grid.html']);
});

it('should stop reporting after the context callback disposable is disposed', async ({ context, server }) => {
  const reports = [];
  const handle = await context.addInitScript(report => {
    (window as any)['__report'] = report;
    void report(location.pathname);
  }, (pathname: string) => {
    reports.push(pathname);
  });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => reports).toContain('/empty.html');

  await handle.dispose();

  const page2 = await context.newPage();
  await page2.goto(server.PREFIX + '/grid.html');
  expect(await page2.evaluate(() => typeof (window as any)['__report'])).toBe('undefined');
  expect(reports).not.toContain('/grid.html');
});

it('context should not register the callback on the global object', async ({ context, server }) => {
  await context.addInitScript(report => {
    void report();
  }, () => {});
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const globals = await page.evaluate(() => Object.getOwnPropertyNames(globalThis).filter(name => name.startsWith('__pw_fn_')));
  expect(globals).toEqual([]);
});
