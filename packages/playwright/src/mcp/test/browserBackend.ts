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

import { createGuid } from 'playwright-core/lib/utils';
import * as tools from 'playwright-core/lib/tools/exports';

import { stripAnsiEscapes } from '../../util';

import type * as playwright from '../../../index';
import type { TestInfoImpl } from '../../worker/testInfo';
import type { Browser } from '../../../../playwright-core/src/client/browser';

export type BrowserMCPRequest = {
  initialize?: { clientInfo: tools.ClientInfo },
  listTools?: {},
  callTool?: { name: string, arguments: tools.CallToolRequest['params']['arguments'] },
  close?: {},
};

export type BrowserMCPResponse = {
  initialize?: { pausedMessage: string },
  callTool?: tools.CallToolResult,
  close?: {},
};

export function createCustomMessageHandler(testInfo: TestInfoImpl, context: playwright.BrowserContext) {
  let backend: tools.BrowserBackend | undefined;
  const config: tools.ContextConfig = { capabilities: ['testing'] };
  const toolList = tools.filteredTools(config);

  return async (data: BrowserMCPRequest): Promise<BrowserMCPResponse> => {
    if (data.initialize) {
      if (backend)
        throw new Error('MCP backend is already initialized');
      backend = new tools.BrowserBackend(config, context, toolList);
      await backend.initialize(data.initialize.clientInfo);
      const pausedMessage = await generatePausedMessage(testInfo, context);
      return { initialize: { pausedMessage } };
    }

    if (data.callTool) {
      if (!backend)
        throw new Error('MCP backend is not initialized');
      return { callTool: await backend.callTool(data.callTool.name, data.callTool.arguments) };
    }

    if (data.close) {
      await backend?.dispose();
      backend = undefined;
      return { close: {} };
    }

    throw new Error('Unknown MCP request');
  };
}

async function generatePausedMessage(testInfo: TestInfoImpl, context: playwright.BrowserContext) {
  const lines: string[] = [];

  if (testInfo.errors.length) {
    lines.push(`### Paused on error:`);
    for (const error of testInfo.errors)
      lines.push(stripAnsiEscapes(error.message || ''));
  } else {
    lines.push(`### Paused at end of test. ready for interaction`);
  }

  for (let i = 0; i < context.pages().length; i++) {
    const page = context.pages()[i];
    const stateSuffix = context.pages().length > 1 ? (i + 1) + ' of ' + (context.pages().length) : 'state';
    lines.push(
        '',
        `### Page ${stateSuffix}`,
        `- Page URL: ${page.url()}`,
        `- Page Title: ${await page.title()}`.trim()
    );
    // Only print console errors when pausing on error, not when everything works as expected.
    let console = testInfo.errors.length ? await tools.Tab.collectConsoleMessages(page) : [];
    console = console.filter(msg => msg.type === 'error');
    if (console.length) {
      lines.push('- Console Messages:');
      for (const message of console)
        lines.push(`  - ${message.toString()}`);
    }
    lines.push(
        `- Page Snapshot:`,
        '```yaml',
        await page.ariaSnapshot({ content: 'ai' }),
        '```',
    );
  }

  lines.push('');
  if (testInfo.errors.length)
    lines.push(`### Task`, `Try recovering from the error prior to continuing`);

  return lines.join('\n');
}

export async function runDaemonForContext(testInfo: TestInfoImpl, context: playwright.BrowserContext) {
  if (testInfo._configInternal.configCLIOverrides.debug !== 'cli')
    return false;

  const sessionName = `tw-${createGuid().slice(0, 6)}`;
  await (context.browser() as Browser)!._register(sessionName, { workspaceDir: testInfo.project.testDir });

  /* eslint-disable-next-line no-console */
  console.log([
    `### The test is currently paused at the start`,
    ``,
    `### Debugging Instructions`,
    `- Run "playwright-cli attach ${sessionName}" to attach to this test`,
  ].join('\n'));

  await context.debugger.pause();
  return true;
}
