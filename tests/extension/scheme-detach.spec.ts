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

import { test, expect, extensionId, connectWithToken } from './extension-fixtures';

import type { BrowserContext } from 'playwright';

async function watchDetach(browserContext: BrowserContext) {
  const serviceWorker = browserContext.serviceWorkers().find(w => w.url().includes(extensionId))!;
  await serviceWorker.evaluate(() => {
    (globalThis as any).__detach = [];
    (globalThis as any).chrome.debugger.onDetach.addListener((source: any, reason: string) => {
      (globalThis as any).__detach.push({ source, reason });
    });
  });
  return () => serviceWorker.evaluate(() => (globalThis as any).__detach);
}

test('debugger detaches from the whole tab when a subframe navigates to an unknown scheme', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42089' },
}, async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();
  const { client } = await connectWithToken(browserContext, startClient, browserWithExtension.userDataDir);

  server.setContent('/signin', `<title>SignIn</title><div>QR CODE HERE</div>`, 'text/html');
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX + '/signin' } });

  const getDetach = await watchDetach(browserContext);
  const page = browserContext.pages().find(p => p.url().endsWith('/signin'))!;
  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.src = 'customscheme://cc/';
    document.body.appendChild(iframe);
  }).catch(() => {});

  await expect.poll(async () => (await getDetach()).length, { timeout: 5000 }).toBeGreaterThan(0);
  const detach = await getDetach();
  expect(detach[0].reason).toBe('target_closed');
  expect(detach[0].source.frameId).toBeUndefined();

  expect(page.url()).toContain('/signin');
  expect(await page.title()).toBe('SignIn');
});

test('recovers and can screenshot after the debugger is detached', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42089' },
}, async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();
  const { client } = await connectWithToken(browserContext, startClient, browserWithExtension.userDataDir);

  server.setContent('/signin', `<title>SignIn</title><div>QR CODE HERE</div>`, 'text/html');

  const getDetach = await watchDetach(browserContext);
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX + '/signin' },
  })).toHaveResponse({ snapshot: expect.stringContaining('QR CODE HERE') });

  const page = browserContext.pages().find(p => p.url().endsWith('/signin'))!;
  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.src = 'customscheme://cc/';
    document.body.appendChild(iframe);
  }).catch(() => {});

  await expect.poll(async () => (await getDetach()).length, { timeout: 5000 }).toBeGreaterThan(0);
  expect((await getDetach())[0].reason).toBe('target_closed');

  expect(browserContext.pages().find(p => p.url().endsWith('/signin'))).toBeTruthy();

  await expect.poll(async () => {
    const list = await client.callTool({ name: 'browser_tabs', arguments: { action: 'list' } });
    return (list as any).content?.[0]?.text ?? '';
  }, { timeout: 15000 }).toContain('/signin');

  const list = await client.callTool({ name: 'browser_tabs', arguments: { action: 'list' } });
  const index = /- (\d+):[^\n]*\/signin/.exec((list as any).content[0].text)?.[1];
  expect(index).toBeTruthy();
  await client.callTool({ name: 'browser_tabs', arguments: { action: 'select', index: Number(index) } });

  expect(await client.callTool({ name: 'browser_snapshot', arguments: {} })).toHaveResponse({
    inlineSnapshot: expect.stringContaining('QR CODE HERE'),
  });
  expect(await client.callTool({ name: 'browser_take_screenshot', arguments: {} })).toHaveResponse({
    code: expect.stringContaining('page.screenshot'),
  });
});
