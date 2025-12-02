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

import { colors } from 'playwright-core/lib/utils';

import { identityBrowserContextFactory } from '../mcp/browser/browserContextFactory';
import { BrowserServerBackend } from '../mcp/browser/browserServerBackend';
import { defaultConfig } from '../mcp/browser/config';
import { Loop } from '../mcp/sdk/bundle';
import { wrapInClient } from '../mcp/sdk/server';

import type * as playwright from 'playwright-core';
import type * as tinyLoop from 'tiny-loop';

export async function performTask(context: playwright.BrowserContext, task: string) {
  const backend = new BrowserServerBackend(defaultConfig, identityBrowserContextFactory(context));
  const client = await wrapInClient(backend, { name: 'Internal', version: '0.0.0' });
  const loop = new Loop('copilot');

  const callTool: (params: { name: string, arguments: any}) => Promise<tinyLoop.ToolResult> = async params => {
    return await client.callTool(params) as tinyLoop.ToolResult;
  };

  try {
    return await loop.run(task, {
      tools: await backend.listTools(),
      callTool,
      logger,
    });
  } finally {
    await client.close();
  }
}

function logger(category: string, text: string, details = '') {
  const trimmedText = trim(text, 100);
  const trimmedDetails = trim(details, 100 - trimmedText.length - 1);
  // eslint-disable-next-line no-console
  console.log(colors.bold(colors.green(category)), trimmedText, colors.dim(trimmedDetails));
}

function trim(text: string, maxLength: number) {
  if (text.length <= maxLength)
    return text;
  return text.slice(0, maxLength - 3) + '...';
}
