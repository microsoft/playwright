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
import { server as coreServer } from '../../packages/playwright-core/lib/coreBundle';

test.describe.configure({ mode: 'serial' });
test.skip(({ mode }) => mode !== 'default');

// Force a separate worker to start from a clean heap.
test.use({ launchOptions: [async ({ launchOptions }, use) => use(launchOptions), { scope: 'worker' }] });

async function queryObjectCount(type: Function): Promise<number> {
  globalThis.typeForQueryObjects = type;
  const session: import('inspector').Session = new (require('node:inspector').Session)();
  session.connect();
  try {
    await new Promise(f => session.post('Runtime.enable', f));
    const { result: constructorFunction } = await new Promise(f => session.post('Runtime.evaluate', {
      expression: `globalThis.typeForQueryObjects.prototype`,
      includeCommandLineAPI: true,
    }, (_, result) => f(result))) as any;

    const { objects: instanceArray } = await new Promise(f => session.post('Runtime.queryObjects', {
      prototypeObjectId: constructorFunction.objectId
    }, (_, result) => f(result))) as any;

    const { result: { value } } = await new Promise<any>(f => session.post('Runtime.callFunctionOn', {
      functionDeclaration: 'function (arr) { return this.length; }',
      objectId: instanceArray.objectId,
      arguments: [{ objectId: instanceArray.objectId }],
    }, (_, result) => f(result as any)));

    return value;
  } finally {
    session.disconnect();
  }
}

const clientClass = {
  Page: null as Function,
  BrowserContext: null as Function,
  Browser: null as Function,
  Request: null as Function,
  Response: null as Function,
};

test.beforeAll(async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  clientClass.Page = page.constructor;
  clientClass.BrowserContext = context.constructor;
  clientClass.Browser = browser.constructor;
  const [request, response] = await Promise.all([
    page.waitForRequest(() => true),
    page.waitForResponse(() => true),
    page.goto(server.EMPTY_PAGE),
  ]);
  clientClass.Request = request.constructor;
  clientClass.Response = response.constructor;
  await context.close();
});

for (let i = 0; i < 3; ++i) {
  test(`test #${i} to request page and context`, async ({ page, context }) => {
    // This test is here to create page instance
  });
}

test('test to request page and context', async ({ page, context }) => {
  // This test is here to create page instance
});

test('should not leak fixtures w/ page', async ({ page }) => {
  expect(await queryObjectCount(clientClass.Page)).toBe(1);
  expect(await queryObjectCount(clientClass.BrowserContext)).toBe(1);
  expect(await queryObjectCount(clientClass.Browser)).toBe(1);
});

test('should not leak fixtures w/o page', async ({}) => {
  expect(await queryObjectCount(clientClass.Page)).toBe(0);
  expect(await queryObjectCount(clientClass.BrowserContext)).toBe(0);
  expect(await queryObjectCount(clientClass.Browser)).toBe(1);
});

test('should not leak server-side objects', async ({ page }) => {
  expect(await queryObjectCount(coreServer.Page)).toBe(1);
  // 6 is because v8 heap creates objects for descendant classes, so WKContext, CRContext, FFContext, WVBrowserContext, BidiBrowserContext and our context instance.
  expect(await queryObjectCount(coreServer.BrowserContext)).toBe(6);
  expect(await queryObjectCount(coreServer.Browser)).toBe(6);
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

  expect(await queryObjectCount(coreServer.Page)).toBe(COUNT);
  expect(await queryObjectCount(coreServer.RequestDispatcher)).toBe(COUNT);
  expect(await queryObjectCount(coreServer.ResponseDispatcher)).toBe(COUNT);

  for (const page of pages)
    await page.close();
  pages.length = 0;

  expect(await queryObjectCount(coreServer.Page)).toBe(0);
  expect(await queryObjectCount(coreServer.RequestDispatcher)).toBe(0);
  expect(await queryObjectCount(coreServer.ResponseDispatcher)).toBe(0);

  expect(await queryObjectCount(clientClass.Page)).toBeLessThan(COUNT);
  expect(await queryObjectCount(coreServer.Page)).toBe(0);
  expect(await queryObjectCount(clientClass.Request)).toBe(0);
  expect(await queryObjectCount(clientClass.Response)).toBe(0);
});

test.describe(() => {
  test.beforeEach(() => {
    coreServer.setMaxDispatchersForTest(100);
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
      { count: await queryObjectCount(clientClass.Request), message: 'client.Request' },
      { count: await queryObjectCount(clientClass.Response), message: 'client.Response' },
      { count: await queryObjectCount(coreServer.Request), message: 'server.Request' },
      { count: await queryObjectCount(coreServer.Response), message: 'server.Response' },
      { count: await queryObjectCount(coreServer.RequestDispatcher), message: 'dispatchers.RequestDispatcher' },
      { count: await queryObjectCount(coreServer.ResponseDispatcher), message: 'dispatchers.ResponseDispatcher' },
    ];
    for (const { count, message } of counts) {
      expect(count, { message }).toBeGreaterThan(50);
      expect(count, { message }).toBeLessThan(150);
    }
  });

  test('should collect frames', async ({ page, server }) => {
    test.slow();

    const kFrameCount = 310;

    await page.goto(server.EMPTY_PAGE);
    let cb;
    const promise = new Promise(f => cb = f);
    let counter = 0;
    page.on('frameattached', async () => {
      // Make sure we can access page.
      await page.title();
      if (++counter === kFrameCount)
        cb();
    });

    page.evaluate(async ({ url, count }) => {
      for (let i = 0; i < count; i++) {
        const frame = document.createElement('iframe');
        frame.src = url;
        document.body.appendChild(frame);
        await new Promise(f => window.builtins.setTimeout(f, 10));
        frame.remove();
      }
    }, { url: server.PREFIX + '/one-style.html', count: kFrameCount }).catch(() => {});
    await promise;
    await page.waitForTimeout(500);
  });

  test.afterEach(() => {
    coreServer.setMaxDispatchersForTest(null);
  });
});

test('cycle handles', async ({ page, server, trace }) => {
  test.slow();
  test.skip(trace === 'on', 'too slow with 2000 snapshots');

  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<div><span>hi</span></div>`.repeat(2000));
  const divs = await page.$$('div');
  for (const div of divs) {
    const span = await div.$('span');
    expect(await span.textContent()).toBe('hi');
  }
});
