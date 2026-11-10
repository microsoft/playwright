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

import fs from 'fs/promises';
import path from 'path';

import { test, expect } from './harness';

import type { User } from './harness';

type Detach = { source: { tabId?: number, frameId?: string }, reason: string };

// Records the debugger detach events that Chrome sends to the extension.
async function recordDebuggerDetach(user: User): Promise<() => Promise<Detach[]>> {
  await user.chrome(async chrome => {
    const detaches: object[] = (globalThis as any).__detaches = [];
    chrome.debugger.onDetach.addListener((source: object, reason: string) => detaches.push({ source, reason }));
  });
  return () => user.chrome(async () => (globalThis as any).__detaches);
}

// Chrome detaches the debugger from the tab when one of its frames goes to a scheme that Chrome does not know.
async function addFrameWithUnknownScheme(user: User, title: string): Promise<void> {
  await user.pageOf(title).evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.src = 'customscheme://cc/';
    document.body.appendChild(iframe);
  }).catch(() => {});
}

// An extension that adds its own frame to the page "Framed". Chrome does not let other extensions debug such a frame.
const testWithFrameInjector = test.extend({
  extraExtensions: async ({}, use, testInfo) => {
    const injector = testInfo.outputPath('frame-injector');
    await fs.mkdir(injector);
    await fs.writeFile(path.join(injector, 'manifest.json'), JSON.stringify({
      manifest_version: 3,
      name: 'Frame injector',
      version: '1.0',
      content_scripts: [{ matches: ['http://*/*'], js: ['content.js'], run_at: 'document_idle' }],
      web_accessible_resources: [{ resources: ['frame.html'], matches: ['<all_urls>'] }],
    }));
    await fs.writeFile(path.join(injector, 'content.js'), `
      if (location.pathname === '/Framed') {
        const frame = document.createElement('iframe');
        frame.src = chrome.runtime.getURL('frame.html');
        document.documentElement.appendChild(frame);
      }
    `);
    await fs.writeFile(path.join(injector, 'frame.html'), '<!DOCTYPE html><title>Foreign frame</title>');
    await use([injector]);
  },
});

test('frame with an unknown scheme detaches the debugger from the tab, and the tab stays open', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42089' },
}, async ({ user, connectWithToken }) => {
  const client = await connectWithToken('worker');
  await client.navigate('SignIn');
  const detaches = await recordDebuggerDetach(user);

  await addFrameWithUnknownScheme(user, 'SignIn');

  // The detach is for the tab, not for the frame.
  await expect.poll(detaches).toEqual([{ source: { tabId: await user.tabId('SignIn') }, reason: 'target_closed' }]);
  expect(await user.tabs()).toContain('SignIn');
});

test('client controls the tab again after a frame with an unknown scheme detaches the debugger', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42089' },
}, async ({ user, connectWithToken }) => {
  const client = await connectWithToken('worker');
  await client.navigate('SignIn');
  const detaches = await recordDebuggerDetach(user);

  await addFrameWithUnknownScheme(user, 'SignIn');
  await expect.poll(detaches).toHaveLength(1);

  await client.expectControls('SignIn');
  expect(await client.mcp.callTool({ name: 'browser_take_screenshot', arguments: {} })).toHaveResponse({
    code: expect.stringContaining('page.screenshot'),
  });
});

testWithFrameInjector('client reports an error when the frame of another extension detaches the debugger', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43230' },
}, async ({ user, connectWithToken }) => {
  const client = await connectWithToken('worker');
  const detaches = await recordDebuggerDetach(user);

  const response = await client.mcp.callTool({ name: 'browser_navigate', arguments: { url: user.urlOf('Framed') } });
  expect(response).toHaveResponse({
    isError: true,
    error: expect.stringContaining('frame that extensions are not allowed to debug'),
  });
  expect(JSON.stringify(response)).not.toContain('TypeError');
  await expect.poll(detaches).toContainEqual(expect.objectContaining({ reason: 'target_closed' }));

  // The client works after the error.
  await client.navigate('Alpha');
  expect(await client.snapshot()).toContain('Page Alpha');
});
