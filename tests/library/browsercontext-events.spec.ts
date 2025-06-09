/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import { browserTest as test, expect } from '../config/browserTest';
import type { ElementHandle } from 'playwright-core';

test('console event should work @smoke', async ({ page }) => {
  const [, message] = await Promise.all([
    page.evaluate(() => console.log('hello')),
    page.context().waitForEvent('console'),
  ]);

  expect(message.text()).toBe('hello');
  expect(message.page()).toBe(page);
});

test('console event should work with element handles', async ({ page }) => {
  await page.setContent('<body>hello</body>');
  const [, message] = await Promise.all([
    page.evaluate(() => console.log(document.body)),
    page.context().waitForEvent('console'),
  ]);
  const body = message.args()[0];
  expect(await body.evaluate(x => x.nodeName)).toBe('BODY');
  await (body as ElementHandle).click();
});

test('console event should work in popup', async ({ page }) => {
  const [, message, popup] = await Promise.all([
    page.evaluate(() => {
      const win = window.open('');
      (win as any).console.log('hello');
    }),
    page.context().waitForEvent('console'),
    page.waitForEvent('popup'),
  ]);

  expect(message.text()).toBe('hello');
  expect(message.page()).toBe(popup);
});

test('console event should work in popup 2', async ({ page, browserName }) => {
  test.fixme(browserName === 'firefox', 'console message from javascript: url is not reported at all');

  const [, message, popup] = await Promise.all([
    page.evaluate(async () => {
      const win = window.open('javascript:console.log("hello")')!;
      await new Promise(f => window.builtins.setTimeout(f, 0));
      win.close();
    }),
    page.context().waitForEvent('console', msg => msg.type() === 'log'),
    page.context().waitForEvent('page'),
  ]);

  expect(message.text()).toBe('hello');
  expect(message.page()).toBe(popup);
});

test('console event should work in immediately closed popup', async ({ page, browserName }) => {
  test.fixme(browserName === 'firefox', 'console message is not reported at all');

  const [, message, popup] = await Promise.all([
    page.evaluate(async () => {
      const win = window.open()!;
      (win as any).console.log('hello');
      win.close();
    }),
    page.context().waitForEvent('console'),
    page.waitForEvent('popup'),
  ]);

  expect(message.text()).toBe('hello');
  expect(message.page()).toBe(popup);
});

test('dialog event should work @smoke', async ({ page }) => {
  const promise = page.evaluate(() => prompt('hey?'));
  const [dialog1, dialog2] = await Promise.all([
    page.context().waitForEvent('dialog'),
    page.waitForEvent('dialog'),
  ]);

  expect(dialog1).toBe(dialog2);
  expect(dialog1.message()).toBe('hey?');
  expect(dialog1.page()).toBe(page);
  await dialog1.accept('hello');
  expect(await promise).toBe('hello');
});

test('dialog event should work in popup', async ({ page }) => {
  const promise = page.evaluate(() => {
    const win = window.open('');
    return (win as any).prompt('hey?');
  });

  const [dialog, popup] = await Promise.all([
    page.context().waitForEvent('dialog'),
    page.waitForEvent('popup'),
  ]);

  expect(dialog.message()).toBe('hey?');
  expect(dialog.page()).toBe(popup);
  await dialog.accept('hello');
  expect(await promise).toBe('hello');
});

test('dialog event should work in popup 2', async ({ page, browserName }) => {
  test.fixme(browserName === 'firefox', 'dialog from javascript: url is not reported at all');

  const promise = page.evaluate(async () => {
    window.open('javascript:prompt("hey?")');
  });

  const dialog = await page.context().waitForEvent('dialog');

  expect(dialog.message()).toBe('hey?');
  expect(dialog.page()).toBe(null);
  await dialog.accept('hello');
  await promise;
});

test('dialog event should work in immediately closed popup', async ({ page }) => {
  const promise = page.evaluate(async () => {
    const win = window.open()!;
    const result = (win as any).prompt('hey?');
    win.close();
    return result;
  });

  const [dialog, popup] = await Promise.all([
    page.context().waitForEvent('dialog'),
    page.waitForEvent('popup'),
  ]);

  expect(dialog.message()).toBe('hey?');
  expect(dialog.page()).toBe(popup);
  await dialog.accept('hello');
  expect(await promise).toBe('hello');
});

test('dialog event should work with inline script tag', async ({ page, server }) => {
  server.setRoute('/popup.html', (req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(`<script>window.result = prompt('hey?')</script>`);
  });

  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<a href='popup.html' target=_blank>Click me</a>`);

  const promise = page.click('a');
  const [dialog, popup] = await Promise.all([
    page.context().waitForEvent('dialog'),
    page.context().waitForEvent('page'),
  ]);

  expect(dialog.message()).toBe('hey?');
  expect(dialog.page()).toBe(popup);
  await dialog.accept('hello');
  await promise;
  await expect.poll(() => popup.evaluate('window.result')).toBe('hello');
});

test('weberror event should work', async ({ page }) => {
  const [webError] = await Promise.all([
    page.context().waitForEvent('weberror'),
    page.setContent('<script>throw new Error("boom")</script>'),
  ]);
  expect(webError.page()).toBe(page);
  expect(webError.error().stack).toContain('boom');
});
