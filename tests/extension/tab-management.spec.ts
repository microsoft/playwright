/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect, connectAndNavigate, extensionId } from './extension-fixtures';

test(`browser_tabs new creates a new tab`, async ({ startExtensionClient, server }) => {
  server.setContent('/second.html', '<title>Second</title><body>Second page<body>', 'text/html');
  const { browserContext, client } = await startExtensionClient();

  const navigateResponse = await connectAndNavigate(browserContext, client, server.HELLO_WORLD);
  expect(navigateResponse).toHaveResponse({
    snapshot: expect.stringContaining(`- generic [active] [ref=f1e1]: Hello, world!`),
  });

  const newTabResponse = await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'new', url: server.PREFIX + '/second.html' },
  });
  expect(newTabResponse).toHaveResponse({
    snapshot: expect.stringContaining(`- generic [active] [ref=e1]: Second page`),
  });

  const listResponse = await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'list' },
  });
  expect(listResponse).toHaveResponse({
    result: expect.stringMatching(/- 0: \[Title\]\(.*\/hello-world\)\n- 1: \(current\) \[Second\]\(.*\/second\.html\)/),
  });
});

test(`browser_tabs select switches the active tab`, async ({ startExtensionClient, server }) => {
  server.setContent('/first.html', '<title>First</title><body>First page</body>', 'text/html');
  server.setContent('/second.html', '<title>Second</title><body>Second page</body>', 'text/html');
  const { browserContext, client } = await startExtensionClient();

  await connectAndNavigate(browserContext, client, server.PREFIX + '/first.html');

  await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'new', url: server.PREFIX + '/second.html' },
  });

  const selectResponse = await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'select', index: 0 },
  });
  expect(selectResponse).toHaveResponse({
    result: expect.stringMatching(/- 0: \(current\) \[First\]\(.*\/first\.html\)\n- 1: \[Second\]\(.*\/second\.html\)/),
  });

  const snapshotResponse = await client.callTool({
    name: 'browser_snapshot',
    arguments: {},
  });
  expect(snapshotResponse).toHaveResponse({
    inlineSnapshot: expect.stringContaining('First page'),
  });
});

test(`browser_tabs close removes a tab`, async ({ startExtensionClient, server }) => {
  server.setContent('/first.html', '<title>First</title><body>First page</body>', 'text/html');
  server.setContent('/second.html', '<title>Second</title><body>Second page</body>', 'text/html');
  const { browserContext, client } = await startExtensionClient();

  await connectAndNavigate(browserContext, client, server.PREFIX + '/first.html');

  await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'new', url: server.PREFIX + '/second.html' },
  });

  const closeResponse = await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'close', index: 0 },
  });
  expect(closeResponse).toHaveResponse({
    result: expect.stringMatching(/^- 0: \(current\) \[Second\]\(.*\/second\.html\)$/m),
  });

  const listResponse = await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'list' },
  });
  expect(listResponse).toHaveResponse({
    result: expect.not.stringContaining('First'),
  });
  expect(listResponse).toHaveResponse({
    result: expect.stringContaining('Second'),
  });
});

test(`cmd+click opens new tab visible in tab list`, async ({ startExtensionClient, server }) => {
  server.setContent('/link-page', '<title>LinkPage</title><body><a href="/target-page">click me</a></body>', 'text/html');
  server.setContent('/target-page', '<title>TargetPage</title><body>Target content</body>', 'text/html');
  const { browserContext, client } = await startExtensionClient();

  const navigateResponse = await connectAndNavigate(browserContext, client, server.PREFIX + '/link-page');
  expect(navigateResponse).toHaveResponse({
    snapshot: expect.stringContaining(`click me`),
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'click me', target: 'f1e2', modifiers: ['ControlOrMeta'] },
  });

  await expect.poll(async () => {
    const listResponse = await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'list' },
    });
    return (listResponse as any).content?.[0]?.text ?? '';
  }).toContain('TargetPage');

  const listResponse = await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'list' },
  });
  expect(listResponse).toHaveResponse({
    result: expect.stringMatching(/- 0:.*\[LinkPage\].*\n- 1:.*\[TargetPage\]/),
  });
});

test(`window.open from tracked tab auto-attaches new tab`, async ({ startExtensionClient, server }) => {
  server.setContent('/opener-page', `<title>Opener</title><body><button onclick="window.open('${server.PREFIX}/opened-page', '_blank', 'noopener')">open</button></body>`, 'text/html');
  server.setContent('/opened-page', '<title>Opened</title><body>Opened content</body>', 'text/html');
  const { browserContext, client } = await startExtensionClient();

  const navigateResponse = await connectAndNavigate(browserContext, client, server.PREFIX + '/opener-page');
  expect(navigateResponse).toHaveResponse({
    snapshot: expect.stringContaining('open'),
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'open', target: 'f1e2' },
  });

  await expect.poll(async () => {
    const listResponse = await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'list' },
    });
    return (listResponse as any).content?.[0]?.text ?? '';
  }).toContain('Opened');

  const listResponse = await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'list' },
  });
  expect(listResponse).toHaveResponse({
    result: expect.stringMatching(/- 0:.*\[Opener\].*\n- 1:.*\[Opened\]/),
  });
});

test(`pending attach is released when the connection closes`, {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43005' },
}, async ({ startExtensionClient, server }) => {
  server.setContent('/second.html', '<title>Second</title><body>Second page</body>', 'text/html');
  const { browserContext, client } = await startExtensionClient();
  await connectAndNavigate(browserContext, client, server.HELLO_WORLD);

  const [sw] = browserContext.serviceWorkers();
  await sw.evaluate(() => {
    const g = globalThis as any;
    const originalAttach = g.chrome.debugger.attach.bind(g.chrome.debugger);
    g.__originalAttach = originalAttach;
    g.chrome.debugger.attach = (target: any, version: string) => {
      g.__heldTabId = target.tabId;
      g.__pendingAttach = new Promise(resolve => g.__releaseAttach = resolve).then(() => originalAttach(target, version));
      return g.__pendingAttach;
    };
  });

  void client.callTool({ name: 'browser_tabs', arguments: { action: 'new', url: server.PREFIX + '/second.html' } }).catch(() => {});
  await expect.poll(() => sw.evaluate(() => (globalThis as any).__heldTabId)).toBeTruthy();

  const isAttached = () => sw.evaluate(async () => {
    const g = globalThis as any;
    try {
      await g.__originalAttach({ tabId: g.__heldTabId }, '1.3');
    } catch {
      return true;
    }
    await g.chrome.debugger.detach({ tabId: g.__heldTabId });
    return false;
  });

  await client.close();
  const statusPage = await browserContext.newPage();
  await statusPage.goto(`chrome-extension://${extensionId}/status.html`);
  await expect(statusPage.locator('.client-info')).toHaveCount(0);

  await sw.evaluate(async () => {
    const g = globalThis as any;
    g.__releaseAttach();
    await g.__pendingAttach;
  });
  await expect.poll(isAttached).toBe(false);
});
