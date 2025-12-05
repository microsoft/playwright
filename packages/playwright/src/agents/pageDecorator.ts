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
import { Loop, zodToJsonSchema } from 'playwright-core/lib/mcpBundle';

import { identityBrowserContextFactory } from '../mcp/browser/browserContextFactory';
import { BrowserServerBackend } from '../mcp/browser/browserServerBackend';
import { defaultConfig } from '../mcp/browser/config';
import { wrapInClient } from '../mcp/sdk/server';

import type { ZodSchema } from 'zod';
import type { Playwright } from '../../../playwright-core/src/client/playwright';
import type { Page } from '../../../playwright-core/src/client/page';
import type * as lowireLoop from '@lowire/loop';

export function decoratePage(playwright: Playwright) {
  playwright._instrumentation.addListener({
    onPage: page => {
      page.perform = pagePerform.bind(null, page);
      page.extract = pageExtract.bind(null, page);
    }
  });
}

async function pagePerform(page: Page, userTask: string, options: { maxTurns?: number } = {}): Promise<void> {
  const resultSchema = {
    type: 'object',
    properties: {
      code: { type: 'string' },
    },
    required: ['code']
  };
  await perform(page, userTask, resultSchema, options);
}

async function pageExtract(page: Page, query: string, schema: ZodSchema, options: { maxTurns?: number } = {}) {
  const task = `
### Instructions
Extract the following information from the page. Do not perform any actions, just extract the information.

### Query
${query}`;
  return await perform(page, task, zodToJsonSchema(schema), options);
}

async function perform(page: Page, userTask: string, resultSchema: any, options: { maxTurns?: number } = {}): Promise<any> {
  const context = page.context();
  if (!context._options.agent)
    throw new Error(`page.perform() and page.extract() require the agent to be set on the browser context`);

  const { full } = await page._snapshotForAI();
  const backend = new BrowserServerBackend(defaultConfig, identityBrowserContextFactory(context));
  const client = await wrapInClient(backend, { name: 'Internal', version: '0.0.0' });
  const callTool: (params: { name: string, arguments: any}) => Promise<lowireLoop.ToolResult> = async params => {
    return await client.callTool(params) as lowireLoop.ToolResult;
  };

  const loop = new Loop(context._options.agent.provider as any, {
    model: context._options.agent.model,
    summarize: true,
    debug,
    callTool,
    tools: await backend.listTools(),
    ...options
  });

  const task = `${userTask}

### Page snapshot
${full}
`;

  try {
    return await loop.run(task, {
      resultSchema
    });
  } finally {
    await client.close();
  }
}
