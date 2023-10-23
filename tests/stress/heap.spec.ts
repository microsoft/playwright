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
test.skip(({ browserName }) => browserName !== 'chromium');

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
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/server/console').ConsoleMessage)).toBe(0);

  for (const page of pages)
    await page.close();
  pages.length = 0;

  expect(await queryObjectCount(require('../../packages/playwright-core/lib/server/page').Page)).toBe(0);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/server/dispatchers/networkDispatchers').RequestDispatcher)).toBe(0);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/server/dispatchers/networkDispatchers').ResponseDispatcher)).toBe(0);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/server/console').ConsoleMessage)).toBe(0);

  expect(await queryObjectCount(require('../../packages/playwright-core/lib/client/page').Page)).toBeLessThan(COUNT);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/server/page').Page)).toBe(0);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/client/network').Request)).toBe(0);
  expect(await queryObjectCount(require('../../packages/playwright-core/lib/client/network').Response)).toBe(0);
});

test.describe(() => {
  test.beforeEach(() => {
    require('../../packages/playwright-core/lib/server/dispatchers/dispatcher').setMaxDispatchersForTest(100);
  });

  test('should collect stale handles', async ({ page, server }) => {
    page.on('request', () => {});
    const response = await page.goto(server.PREFIX + '/title.html');
    for (let i = 0; i < 200; ++i) {
      await page.evaluate(async () => {
        const response = await fetch('/');
        await response.text();
      });
    }
    const e = await response.allHeaders().catch(e => e);
    expect(e.message).toContain('The object has been collected to prevent unbounded heap growth.');

    const counts = [
      { count: await queryObjectCount(require('../../packages/playwright-core/lib/client/network').Request), message: 'client.Request' },
      { count: await queryObjectCount(require('../../packages/playwright-core/lib/client/network').Response), message: 'client.Response' },
      { count: await queryObjectCount(require('../../packages/playwright-core/lib/server/network').Request), message: 'server.Request' },
      { count: await queryObjectCount(require('../../packages/playwright-core/lib/server/network').Response), message: 'server.Response' },
      { count: await queryObjectCount(require('../../packages/playwright-core/lib/server/dispatchers/networkDispatchers').RequestDispatcher), message: 'dispatchers.RequestDispatcher' },
      { count: await queryObjectCount(require('../../packages/playwright-core/lib/server/dispatchers/networkDispatchers').ResponseDispatcher), message: 'dispatchers.ResponseDispatcher' },
    ];
    for (const { count, message } of counts) {
      expect(count, { message }).toBeGreaterThan(50);
      expect(count, { message }).toBeLessThan(150);
    }
  });

  test.afterEach(() => {
    require('../../packages/playwright-core/lib/server/dispatchers/dispatcher').setMaxDispatchersForTest(null);
  });
});
