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

import * as mcp from '../sdk/exports';
import { defaultConfig, FullConfig } from '../browser/config';
import { BrowserServerBackend } from '../browser/browserServerBackend';
import { Tab } from '../browser/tab';

import type * as playwright from '../../../index';
import type { Page } from '../../../../playwright-core/src/client/page';
import type { BrowserContextFactory } from '../browser/browserContextFactory';
import type { TestInfo } from '../../../test';

export type TestPausedExtraData = {
  mcpUrl: string;
  contextState: string;
};

export async function runBrowserBackendOnTestPause(testInfo: TestInfo, context: playwright.BrowserContext) {
  const lines: string[] = [];

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
    console = console.filter(msg => !msg.type || msg.type === 'error');
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

  const config: FullConfig = {
    ...defaultConfig,
    capabilities: ['testing'],
  };

  const factory: mcp.ServerBackendFactory = {
    name: 'Playwright',
    nameInConfig: 'playwright',
    version: '0.0.0',
    create: () => new BrowserServerBackend(config, identityFactory(context))
  };
  const httpServer = await mcp.startHttpServer({ port: 0 });
  const mcpUrl = await mcp.installHttpTransport(httpServer, factory, true);
  const dispose = async () => {
    await new Promise(cb => httpServer.close(cb));
  };
  const extraData = { mcpUrl, contextState: lines.join('\n') } as TestPausedExtraData;
  return { extraData, dispose };
}

function identityFactory(browserContext: playwright.BrowserContext): BrowserContextFactory {
  return {
    createContext: async (clientInfo: mcp.ClientInfo, abortSignal: AbortSignal, toolName: string | undefined) => {
      return {
        browserContext,
        close: async () => {}
      };
    }
  };
}
