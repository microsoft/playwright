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

// Debug helper that shows what exactly is retaining a given object type.
// To get the constructorName, run "console.log(object.constructor.name)" in the test.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function findRetainerPaths(constructorName: string, maxPaths = 10): Promise<void> {
  const session: import('inspector').Session = new (require('node:inspector').Session)();
  session.connect();
  const chunks: string[] = [];
  session.on('HeapProfiler.addHeapSnapshotChunk', (m: any) => chunks.push(m.params.chunk));
  try {
    await new Promise<void>(f => session.post('HeapProfiler.takeHeapSnapshot', { reportProgress: false }, () => f()));
  } finally {
    session.disconnect();
  }
  const snapshot = JSON.parse(chunks.join(''));
  const { nodes, edges, strings, snapshot: meta } = snapshot;
  const nodeFields: string[] = meta.meta.node_fields;
  const edgeFields: string[] = meta.meta.edge_fields;
  const edgeTypes: string[] = meta.meta.edge_types[0];
  const nf = nodeFields.length;
  const ef = edgeFields.length;
  const nodeTypeOff = nodeFields.indexOf('type');
  const nodeNameOff = nodeFields.indexOf('name');
  const nodeIdOff = nodeFields.indexOf('id');
  const nodeEdgeCountOff = nodeFields.indexOf('edge_count');
  const edgeTypeOff = edgeFields.indexOf('type');
  const edgeNameOff = edgeFields.indexOf('name_or_index');
  const edgeToOff = edgeFields.indexOf('to_node');
  const nodeCount = nodes.length / nf;

  // Compute the first-edge index for every node (edges are laid out in node order).
  const firstEdge = new Uint32Array(nodeCount);
  let edgeCursor = 0;
  for (let i = 0; i < nodeCount; ++i) {
    firstEdge[i] = edgeCursor;
    edgeCursor += nodes[i * nf + nodeEdgeCountOff];
  }

  const nodeName = (i: number) => strings[nodes[i * nf + nodeNameOff]];
  const nodeTypeName = (i: number) => meta.meta.node_types[0][nodes[i * nf + nodeTypeOff]];

  // BFS from the synthetic root (node 0), recording how we reached each node.
  const parent = new Int32Array(nodeCount).fill(-1);
  const parentEdgeName = new Array<string>(nodeCount);
  const visited = new Uint8Array(nodeCount);
  visited[0] = 1;
  const queue = [0];
  for (let q = 0; q < queue.length; ++q) {
    const from = queue[q];
    const edgeStart = firstEdge[from];
    const count = nodes[from * nf + nodeEdgeCountOff];
    for (let e = 0; e < count; ++e) {
      const base = (edgeStart + e) * ef;
      const type = edgeTypes[edges[base + edgeTypeOff]];
      if (type === 'weak')
        continue; // Weak references do not retain.
      const to = edges[base + edgeToOff] / nf;
      if (visited[to])
        continue;
      visited[to] = 1;
      parent[to] = from;
      const rawName = edges[base + edgeNameOff];
      parentEdgeName[to] = (type === 'element' || type === 'hidden') ? `[${rawName}]` : strings[rawName];
      queue.push(to);
    }
  }

  const targets: number[] = [];
  for (let i = 0; i < nodeCount && targets.length < maxPaths; ++i) {
    if (nodeTypeName(i) === 'object' && nodeName(i) === constructorName)
      targets.push(i);
  }
  console.log(`\n===== retainer paths for ${constructorName} (showing ${targets.length}) =====`);
  for (const target of targets) {
    const path: string[] = [];
    let cur = target;
    while (cur !== -1) {
      const label = `${nodeName(cur)} (${nodeTypeName(cur)} @${nodes[cur * nf + nodeIdOff]})`;
      path.push(parent[cur] === -1 ? label : `${label}  <--[${parentEdgeName[cur]}]--`);
      cur = parent[cur];
    }
    console.log('  ' + path.join('\n    '));
    console.log('  ----');
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

test('should not leak workers', async ({ page }) => {
  const before = await queryObjectCount(coreServer.Worker);
  for (let i = 0; i < 5; ++i) {
    const [workerHandle, workerObj] = await Promise.all([
      page.evaluateHandle(index => new Worker(URL.createObjectURL(new Blob([String(index)], { type: 'application/javascript' }))), i),
      page.waitForEvent('worker'),
    ]);
    await Promise.all([
      workerObj.waitForEvent('close'),
      workerHandle.evaluate(workerObj => workerObj.terminate()),
    ]);
  }
  expect.soft(await queryObjectCount(coreServer.Worker)).toBe(before);
  expect.soft(await queryObjectCount(coreServer.WorkerDispatcher)).toBe(0);
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
