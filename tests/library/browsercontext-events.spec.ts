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

test('console event should work @smoke', async ({ page }) => {
  const [, message] = await Promise.all([
    page.evaluate(() => console.log('hello')),
    page.context().waitForEvent('console'),
  ]);

  expect(message.text()).toBe('hello');
  expect(message.page()).toBe(page);
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
      const win = window.open('javascript:console.log("hello")');
      await new Promise(f => setTimeout(f, 0));
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
      const win = window.open();
      (win as any).console.log('hello');
      win.close();
    }),
    page.context().waitForEvent('console'),
    page.waitForEvent('popup'),
  ]);

  expect(message.text()).toBe('hello');
  expect(message.page()).toBe(popup);
});
