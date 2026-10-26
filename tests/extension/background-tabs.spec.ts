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

import { test, expect, extensionId, readExtensionToken } from './extension-fixtures';

import type { BrowserContext } from 'playwright';

// The client works in tabs of the user's own browser. Its tabs open in the
// background and keep working there while the user's tab stays active.

function serviceWorker(browserContext: BrowserContext) {
  return browserContext.serviceWorkers().find(w => w.url().includes(extensionId))!;
}

async function activeTabTitles(browserContext: BrowserContext): Promise<string[]> {
  return await serviceWorker(browserContext).evaluate(async () => {
    const chrome = (globalThis as any).chrome;
    const tabs = await chrome.tabs.query({ active: true });
    return tabs.map((t: any) => t.title);
  });
}

async function activateTab(browserContext: BrowserContext, title: string) {
  await serviceWorker(browserContext).evaluate(async title => {
    const chrome = (globalThis as any).chrome;
    const [tab] = await chrome.tabs.query({ title });
    await chrome.tabs.update(tab.id, { active: true });
  }, title);
}

test(`browser_tabs new opens the tab in the background`, async ({ browserWithExtension, startClient, server }) => {
  server.setContent('/user', '<title>User</title><body>User page</body>', 'text/html');
  server.setContent('/second', '<title>Second</title><body>Second page</body>', 'text/html');
  const browserContext = await browserWithExtension.launch();
  const token = await readExtensionToken(browserContext);
  const userPage = browserContext.pages()[0];
  await userPage.goto(server.PREFIX + '/user');

  const { client } = await startClient({
    args: ['--extension'],
    env: { PLAYWRIGHT_MCP_EXTENSION_TOKEN: token, PWTEST_EXTENSION_USER_DATA_DIR: browserWithExtension.userDataDir },
  });
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
  await activateTab(browserContext, 'User');

  expect(await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'new', url: server.PREFIX + '/second' },
  })).toHaveResponse({ snapshot: expect.stringContaining('Second page') });
  expect(await activeTabTitles(browserContext)).toEqual(['User']);
});

test(`client can click and type in its tab while it is hidden`, async ({ browserWithExtension, startClient, server }) => {
  server.setContent('/user', '<title>User</title><body>User page</body>', 'text/html');
  server.setContent('/form', `<title>Form</title>
    <input id=field aria-label=Field>
    <button onclick="this.textContent = 'Clicked'">Press</button>
    <div id=editor contenteditable aria-label=Editor></div>`, 'text/html');
  // The test's own connection must not emulate focus, so that only the relay's does.
  const browserContext = await browserWithExtension.launch('unmanaged');
  const token = await readExtensionToken(browserContext);
  const userPage = browserContext.pages()[0];
  await userPage.goto(server.PREFIX + '/user');

  const { client } = await startClient({
    args: ['--extension'],
    env: { PLAYWRIGHT_MCP_EXTENSION_TOKEN: token, PWTEST_EXTENSION_USER_DATA_DIR: browserWithExtension.userDataDir },
  });
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX + '/form' } });
  await activateTab(browserContext, 'User');
  expect(await activeTabTitles(browserContext)).toEqual(['User']);

  await client.callTool({ name: 'browser_click', arguments: { element: 'Press button', target: 'button' } });
  await client.callTool({ name: 'browser_type', arguments: { element: 'Field', target: '#field', text: 'typed', slowly: true } });
  await client.callTool({ name: 'browser_type', arguments: { element: 'Editor', target: '#editor', text: 'edited', slowly: true } });
  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: { function: `() => [document.querySelector('button').textContent, field.value, editor.textContent, document.visibilityState, document.hasFocus()].join('|')` },
  })).toHaveResponse({ result: expect.stringContaining('Clicked|typed|edited|visible|true') });
  expect(await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {},
  })).toHaveResponse({ result: expect.stringContaining('Screenshot of viewport') });
  expect(await activeTabTitles(browserContext)).toEqual(['User']);
});
