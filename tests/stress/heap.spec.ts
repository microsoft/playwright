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

import { contextTest as test, expect } from '../config/browserTest';
import { queryObjectCount } from '../config/queryObjects';

test.describe.configure({ mode: 'serial' });

for (let i = 0; i < 3; ++i) {
  test(`test #${i} to request page and context`, async ({ page, context }) => {
    // This test is here to create page instance
  });
}

test('test to request page and context', async ({ page, context }) => {
  // This test is here to create page instance
});

test('should not leak fixtures w/ page', async ({ page }) => {
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/client/page').Page)).toBe(1);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/client/browserContext').BrowserContext)).toBe(1);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/client/browser').Browser)).toBe(1);
});

test('should not leak fixtures w/o page', async ({}) => {
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/client/page').Page)).toBe(0);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/client/browserContext').BrowserContext)).toBe(0);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/client/browser').Browser)).toBe(1);
});

test('should not leak server-side objects', async ({ page }) => {
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/server/page').Page)).toBe(1);
  // 4 is because v8 heap creates objects for descendant classes, so WKContext, CRContext, FFContext and our context instance.
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/server/browserContext').BrowserContext)).toBe(4);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/server/browser').Browser)).toBe(4);
});

test('should not leak dispatchers after closing page', async ({ context, server }) => {
  const pages = [];
  const COUNT = 5;
  for (let i = 0; i < COUNT; ++i) {
    const page = await context.newPage();
    // ensure listeners are registered
    page.on('console', () => {});
    await page.goto(server.PREFIX + '/title.html');
    await page.evaluate(async i => {
      console.log('message', i);
    }, i);
    pages.push(page);
  }

  expect(await queryObjectCount(require('../../packages/playwright-core/lib/server/page').Page)).toBe(COUNT);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/server/dispatchers/networkDispatchers').RequestDispatcher)).toBe(COUNT);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/server/dispatchers/networkDispatchers').ResponseDispatcher)).toBe(COUNT);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/server/dispatchers/consoleMessageDispatcher').ConsoleMessageDispatcher)).toBe(COUNT);

  for (const page of pages)
    await page.close();
  pages.length = 0;

  expect(await queryObjectCount(require('../../packages/playwright-core/lib/server/page').Page)).toBe(0);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/server/dispatchers/networkDispatchers').RequestDispatcher)).toBe(0);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/server/dispatchers/networkDispatchers').ResponseDispatcher)).toBe(0);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/server/dispatchers/consoleMessageDispatcher').ConsoleMessageDispatcher)).toBe(0);

  expect(await queryObjectCount(require('../../packages/playwright-core/lib/client/page').Page)).toBeLessThan(COUNT);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/server/page').Page)).toBe(0);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/client/network').Request)).toBe(0);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/client/network').Response)).toBe(0);
});
