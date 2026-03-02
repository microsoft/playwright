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

import path from 'path';
import fs from 'fs';
import { createGuid } from 'playwright-core/lib/utils';
import * as mcp from 'playwright-core/lib/mcp/exports';
import { defaultConfig, BrowserServerBackend, Tab, identityBrowserContextFactory, startMcpDaemonServer, sessionConfigFromArgs, createClientInfo } from 'playwright-core/lib/mcp/exports';

import { stripAnsiEscapes } from '../../util';

import type * as playwright from '../../../index';
import type { Page } from '../../../../playwright-core/src/client/page';
import type { TestInfoImpl } from '../../worker/testInfo';

export type BrowserMCPRequest = {
  initialize?: { clientInfo: mcp.ClientInfo },
  listTools?: {},
  callTool?: { name: string, arguments: mcp.CallToolRequest['params']['arguments'] },
  close?: {},
};

export type BrowserMCPResponse = {
  initialize?: { pausedMessage: string },
  listTools?: mcp.Tool[],
  callTool?: mcp.CallToolResult,
  close?: {},
};

export function createCustomMessageHandler(testInfo: TestInfoImpl, context: playwright.BrowserContext) {
  let backend: BrowserServerBackend | undefined;
  return async (data: BrowserMCPRequest): Promise<BrowserMCPResponse> => {
    if (data.initialize) {
      if (backend)
        throw new Error('MCP backend is already initialized');
      const config: mcp.FullConfig = { ...defaultConfig, capabilities: ['testing'] };
      const tools = mcp.filteredTools(config);
      backend = new BrowserServerBackend(config, context, tools);
      await backend.initialize(data.initialize.clientInfo);
      const pausedMessage = await generatePausedMessage(testInfo, context);
      return { initialize: { pausedMessage } };
    }

    if (data.listTools) {
      if (!backend)
        throw new Error('MCP backend is not initialized');
      return { listTools: await backend.listTools() };
    }

    if (data.callTool) {
      if (!backend)
        throw new Error('MCP backend is not initialized');
      return { callTool: await backend.callTool(data.callTool.name, data.callTool.arguments) };
    }

    if (data.close) {
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
    let console = testInfo.errors.length ? await Tab.collectConsoleMessages(page) : [];
    console = console.filter(msg => msg.type === 'error');
    if (console.length) {
      lines.push('- Console Messages:');
      for (const message of console)
        lines.push(`  - ${message.toString()}`);
    }
    lines.push(
        `- Page Snapshot:`,
        '```yaml',
        (await (page as Page)._snapshotForAI()).full,
        '```',
    );
  }

  lines.push('');
  if (testInfo.errors.length)
    lines.push(`### Task`, `Try recovering from the error prior to continuing`);

  return lines.join('\n');
}

export async function runDaemonForContext(testInfo: TestInfoImpl, context: playwright.BrowserContext): Promise<void> {
  if (process.env.PWPAUSE !== 'cli')
    return;

  const outputDir = path.join(testInfo.artifactsDir(), '.playwright-mcp');
  const sessionName = `test-worker-${createGuid().slice(0, 6)}`;
  const clientInfo = createClientInfo();
  const sessionConfig = sessionConfigFromArgs(clientInfo, sessionName, { _: [] });
  const sessionConfigFile = path.resolve(clientInfo.daemonProfilesDir, `${sessionName}.session`);
  await fs.promises.mkdir(path.dirname(sessionConfigFile), { recursive: true });
  await fs.promises.writeFile(sessionConfigFile, JSON.stringify(sessionConfig, null, 2));
  await startMcpDaemonServer({
    ...defaultConfig,
    outputMode: 'file',
    snapshot: { mode: 'full', output: 'file' },
    outputDir,
  }, sessionConfig, identityBrowserContextFactory(context), true /* noShutdown */);

  const lines = [''];
  if (testInfo.errors.length) {
    lines.push(`### Paused on test error`);
    for (const error of testInfo.errors)
      lines.push(stripAnsiEscapes(error.message || ''));
  } else {
    lines.push(`### Paused at the end of the test`);
  }
  lines.push(
      `### Debugging Instructions`,
      `- Use "playwright-cli --session=${sessionName}" to explore the page and fix the problem.`,
      `- Stop this test run when finished. Restart if needed.`,
      ``,
  );

  /* eslint-disable-next-line no-console */
  console.log(lines.join('\n'));
  await new Promise(() => {});
}
