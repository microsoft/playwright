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
import { it, expect } from './fixtures';

it('expose binding should work', async ({browser}) => {
  const context = await browser.newContext();
  let bindingSource;
  await context.exposeBinding('add', (source, a, b) => {
    bindingSource = source;
    return a + b;
  });
  const page = await context.newPage();
  const result = await page.evaluate('add(5, 6)');
  expect(bindingSource.context).toBe(context);
  expect(bindingSource.page).toBe(page);
  expect(bindingSource.frame).toBe(page.mainFrame());
  expect(result).toEqual(11);
  await context.close();
});

it('should work', async ({browser, server}) => {
  const context = await browser.newContext();
  await context.exposeFunction('add', (a, b) => a + b);
  const page = await context.newPage();
  await page.exposeFunction('mul', (a, b) => a * b);
  await context.exposeFunction('sub', (a, b) => a - b);
  await context.exposeBinding('addHandle', async ({ frame }, a, b) => {
    const handle = await frame.evaluateHandle(([a, b]) => a + b, [a, b]);
    return handle;
  });
  const result = await page.evaluate('(async () => ({ mul: await mul(9, 4), add: await add(9, 4), sub: await sub(9, 4), addHandle: await addHandle(5, 6) }))()');
  expect(result).toEqual({ mul: 36, add: 13, sub: 5, addHandle: 11 });
  await context.close();
});

it('should throw for duplicate registrations', async ({browser, server}) => {
  const context = await browser.newContext();
  await context.exposeFunction('foo', () => {});
  await context.exposeFunction('bar', () => {});
  let error = await context.exposeFunction('foo', () => {}).catch(e => e);
  expect(error.message).toContain('Function "foo" has been already registered');
  const page = await context.newPage();
  error = await page.exposeFunction('foo', () => {}).catch(e => e);
  expect(error.message).toContain('Function "foo" has been already registered in the browser context');
  await page.exposeFunction('baz', () => {});
  error = await context.exposeFunction('baz', () => {}).catch(e => e);
  expect(error.message).toContain('Function "baz" has been already registered in one of the pages');
  await context.close();
});

it('should be callable from-inside addInitScript', async ({browser, server}) => {
  const context = await browser.newContext();
  let args = [];
  await context.exposeFunction('woof', function(arg) {
    args.push(arg);
  });
  await context.addInitScript('window["woof"]("context")');
  const page = await context.newPage();
  await page.addInitScript('window["woof"]("page")');
  args = [];
  await page.reload();
  expect(args).toEqual(['context', 'page']);
  await context.close();
});

it('exposeBindingHandle should work', async ({browser}) => {
  const context = await browser.newContext();
  let target;
  await context.exposeBinding('logme', (source, t) => {
    target = t;
    return 17;
  }, { handle: true });
  const page = await context.newPage();
  const result = await page.evaluate(async function() {
    return window['logme']({ foo: 42 });
  });
  expect(await target.evaluate(x => x.foo)).toBe(42);
  expect(result).toEqual(17);
  await context.close();
});
