/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import { debug } from 'playwright-core/lib/utilsBundle';
import { Loop } from 'playwright-core/lib/mcpBundle';

import { identityBrowserContextFactory } from '../mcp/browser/browserContextFactory';
import { BrowserServerBackend } from '../mcp/browser/browserServerBackend';
import { defaultConfig } from '../mcp/browser/config';
import { wrapInClient } from '../mcp/sdk/server';

import type * as playwright from 'playwright-core';
import type * as lowireLoop from '@lowire/loop';

export async function performTask(context: playwright.BrowserContext, task: string) {
  const backend = new BrowserServerBackend(defaultConfig, identityBrowserContextFactory(context));
  const client = await wrapInClient(backend, { name: 'Internal', version: '0.0.0' });
  const loop = new Loop('github', { model: 'claude-sonnet-4.5' });

  const callTool: (params: { name: string, arguments: any}) => Promise<lowireLoop.ToolResult> = async params => {
    return await client.callTool(params) as lowireLoop.ToolResult;
  };

  try {
    return await loop.run(task, {
      tools: await backend.listTools(),
      callTool,
      debug,
    });
  } finally {
    await client.close();
  }
}
