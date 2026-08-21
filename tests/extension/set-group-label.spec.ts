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

import { test, expect, connectWithName, playwrightGroups, readExtensionToken } from './extension-fixtures';

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { BrowserContext } from 'playwright';

async function playwrightGroupTitles(browserContext: BrowserContext): Promise<string[]> {
  return (await playwrightGroups(browserContext)).map(group => group.title);
}

async function setGroupLabel(client: Client, label: string): Promise<string> {
  const response = await client.callTool({ name: 'browser_set_group_label', arguments: { label } }) as any;
  return response.content?.[0]?.text ?? '';
}

test(`browser_set_group_label renames the connection's tab group`, {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41840' },
}, async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();
  const token = await readExtensionToken(browserContext);

  const client = await connectWithName(browserWithExtension, startClient, token, 'client-a');
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

  const { tools } = await client.listTools();
  expect(tools.map(tool => tool.name)).toContain('browser_set_group_label');

  expect(await setGroupLabel(client, 'checkout flow bug')).toContain('Tab group renamed to "Playwright · checkout flow bug"');
  await expect.poll(() => playwrightGroupTitles(browserContext)).toEqual([
    'Playwright · checkout flow bug',
  ]);

  // Relabeling replaces the previous label.
  expect(await setGroupLabel(client, 'login flow bug')).toContain('Tab group renamed to "Playwright · login flow bug"');
  await expect.poll(() => playwrightGroupTitles(browserContext)).toEqual([
    'Playwright · login flow bug',
  ]);
});

test(`labels are deduplicated across connections`, {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41840' },
}, async ({ browserWithExtension, startClient, server }) => {
  server.setContent('/second', '<title>Second</title><body>Second page</body>', 'text/html');

  const browserContext = await browserWithExtension.launch();
  const token = await readExtensionToken(browserContext);

  const clientA = await connectWithName(browserWithExtension, startClient, token, 'client-a');
  await clientA.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

  const clientB = await connectWithName(browserWithExtension, startClient, token, 'client-b');
  await clientB.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX + '/second' } });

  // Labeling one group leaves the other connection's group alone.
  expect(await setGroupLabel(clientA, 'checkout flow bug')).toContain('Tab group renamed to "Playwright · checkout flow bug"');
  await expect.poll(() => playwrightGroupTitles(browserContext)).toEqual([
    'Playwright · checkout flow bug',
    'Playwright · client-b',
  ]);

  // The same label from another connection gets a suffix.
  expect(await setGroupLabel(clientB, 'checkout flow bug')).toContain('Tab group renamed to "Playwright · checkout flow bug (2)"');
  await expect.poll(() => playwrightGroupTitles(browserContext)).toEqual([
    'Playwright · checkout flow bug',
    'Playwright · checkout flow bug (2)',
  ]);
});
