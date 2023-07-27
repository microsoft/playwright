
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

import { browserTest as it, expect } from '../config/browserTest';

it('should fire', async ({ context, page, server, browserName }) => {
  const url = server.PREFIX + '/error.html';
  const [error] = await Promise.all([
    context.waitForEvent('pageerror'),
    page.goto(url),
  ]);
  expect(error.name).toBe('Error');
  expect(error.message).toBe('Fancy error!');
  if (browserName === 'chromium') {
    expect(error.stack).toBe(`Error: Fancy error!
    at c (myscript.js:14:11)
    at b (myscript.js:10:5)
    at a (myscript.js:6:5)
    at myscript.js:3:1`);
  } else if (browserName === 'webkit') {
    expect(error.stack).toBe(`Error: Fancy error!
    at c (${url}:14:36)
    at b (${url}:10:6)
    at a (${url}:6:6)
    at global code (${url}:3:2)`);
  } else if (browserName === 'firefox') {
    expect(error.stack).toBe(`Error: Fancy error!
    at c (myscript.js:14:11)
    at b (myscript.js:10:5)
    at a (myscript.js:6:5)
    at  (myscript.js:3:1)`);
  }
});

it('should receive pageError in context', async ({ context, server }) => {
  const messages = [];
  context.on('pageerror', error => messages.push(error.message));
  const page = await context.newPage();
  await Promise.all([
    context.waitForEvent('pageerror'),
    page.goto(server.PREFIX + '/error.html'),
  ]);
  expect(messages.length).toBe(1);
});

it('should contain sourceURL', async ({ context, page, server, browserName }) => {
  it.fail(browserName === 'webkit');

  const [error] = await Promise.all([
    context.waitForEvent('pageerror'),
    page.goto(server.PREFIX + '/error.html'),
  ]);
  expect(error.stack).toContain('myscript.js');
});

it('should contain the Error.name property', async ({ page, context }) => {
  const [error] = await Promise.all([
    context.waitForEvent('pageerror'),
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

it('should handle odd values', async ({ context, page }) => {
  const cases = [
    [null, 'null'],
    [undefined, 'undefined'],
    [0, '0'],
    ['', ''],
  ];
  for (const [value, message] of cases) {
    const [error] = await Promise.all([
      context.waitForEvent('pageerror'),
      page.evaluate(value => setTimeout(() => { throw value; }, 0), value),
    ]);
    expect(error.message).toBe(message);
  }
});

it('should handle object', async ({ context, page, browserName }) => {
  const [error] = await Promise.all([
    context.waitForEvent('pageerror'),
    page.evaluate(() => setTimeout(() => { throw {}; }, 0)),
  ]);
  expect(error.message).toBe(browserName === 'chromium' ? 'Object' : '[object Object]');
});

it('should handle window', async ({ context, page, browserName }) => {
  const [error] = await Promise.all([
    context.waitForEvent('pageerror'),
    page.evaluate(() => setTimeout(() => { throw window; }, 0)),
  ]);
  expect(error.message).toBe(browserName === 'chromium' ? 'Window' : '[object Window]');
});

it('should remove a listener of a non-existing event handler', async ({ context }) => {
  context.removeListener('pageerror', () => {});
});

it('should emit error from unhandled rejects', async ({ context, page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/14165' });
  const [error] = await Promise.all([
    context.waitForEvent('pageerror'),
    page.setContent(`
        <script>
          Promise.reject(new Error('sad :('));
        </script>
    `),
  ]);
  expect(error.message).toContain('sad :(');
});
