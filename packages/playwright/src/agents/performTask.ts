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

import fs from 'fs';
import path from 'path';

import { debug } from 'playwright-core/lib/utilsBundle';
import { z, zodToJsonSchema, Loop } from 'playwright-core/lib/mcpBundle';

import { identityBrowserContextFactory } from '../mcp/browser/browserContextFactory';
import { BrowserServerBackend } from '../mcp/browser/browserServerBackend';
import { defaultConfig } from '../mcp/browser/config';
import { wrapInClient } from '../mcp/sdk/server';

import type * as playwright from 'playwright-core';
import type * as lowireLoop from '@lowire/loop';
import type * as zod from 'zod';
import type { TestInfo } from '../../types/test';

export type PerformTaskOptions = {
  provider?: 'github' | 'openai' | 'anthropic' | 'google';
  model?: string;
  maxTokens?: number;
  reasoning?: boolean;
  temperature?: number;
};

const resultSchema = z.object({
  code: z.string().optional().describe(`
Generated code to perform the task using Playwright API.
Check out the <code> blocks and combine them. Should be presented in the following form:

perform(async ({ page }) => {
  // generated code here.
});
`),
  error: z.string().optional().describe('The error that occurred if execution failed.').optional(),
});

export async function performTask(testInfo: TestInfo, context: playwright.BrowserContext, userTask: string, options: PerformTaskOptions) {
  const cacheStatus = await performTaskFromCache(testInfo, context, userTask);
  if (cacheStatus === 'success')
    return;

  const backend = new BrowserServerBackend(defaultConfig, identityBrowserContextFactory(context));
  const client = await wrapInClient(backend, { name: 'Internal', version: '0.0.0' });
  const callTool: (params: { name: string, arguments: any}) => Promise<lowireLoop.ToolResult> = async params => {
    return await client.callTool(params) as lowireLoop.ToolResult;
  };

  const loop = new Loop(options.provider ?? 'github', {
    model: options.model ?? 'claude-sonnet-4.5',
    reasoning: options.reasoning,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    summarize: true,
    debug,
    callTool,
    tools: await backend.listTools(),
  });

  try {
    const result = await loop.run<zod.infer<typeof resultSchema>>(userTask, { resultSchema: zodToJsonSchema(resultSchema) as lowireLoop.Schema });
    if (result.code)
      await updatePerformFile(testInfo, userTask, result.code, options);
  } finally {
    await client.close();
  }
}

async function updatePerformFile(testInfo: TestInfo, userTask: string, taskCode: string, options: PerformTaskOptions) {
  const relativeFile = path.relative(testInfo.project.testDir, testInfo.file);
  const promptCacheFile = testInfo.file.replace('.spec.ts', '.cache.ts');
  const testTitle = testInfo.title;

  const loop = new Loop(options.provider ?? 'github', {
    model: options.model ?? 'claude-sonnet-4.5',
    reasoning: options.reasoning,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    summarize: true,
    debug,
    callTool: async () => ({ content: [] }),
    tools: [],
  });

  const resultSchema = z.object({
    code: z.string().optional().describe(`
Generated code with all the perofrm routines combined or updated into the following format:

import { performCache } from '@playwright/test';

performCache({
  file: 'tests/page/perform-task.spec.ts',
  test: 'perform task',
  task: 'Click the learn more button',
  code: async ({ page }) => {
    await page.getByRole('link', { name: 'Learn more' }).click();
  },
});
`),
  });

  const existingCode = await fs.promises.readFile(promptCacheFile, 'utf8').catch(() => '');
  const task = `
- Create or update a perform file to include performCache block for the given task and code.
- Dedupe items with the same file, test, and task.
- Should produce code in the following format

import { performCache } from '@playwright/test';

performCache({
  file: '<file>',
  test: '<test>',
  task: '<task>',
  code: async ({ page }) => {
    <code>
  },
});

performCache({
...

## Params for the new or updated performCache block
<file-content>${existingCode}</file-content>
<file>${relativeFile}</file>
<test>${testTitle}</test>
<task>${userTask}</task>
<code>${taskCode}</code>
`;

  const result = await loop.run<zod.infer<typeof resultSchema>>(task, { resultSchema: zodToJsonSchema(resultSchema) as lowireLoop.Schema });
  if (result.code)
    await fs.promises.writeFile(promptCacheFile, result.code);
}

type PerformCacheEntry = {
  file: string,
  test: string,
  task: string,
  code: ({ page }: { page: playwright.Page }) => Promise<void>
};

const performCacheMap = new Map<string, PerformCacheEntry>();

export function performCache(entry: PerformCacheEntry) {
  performCacheMap.set(JSON.stringify({ ...entry, code: undefined }), entry);
}

async function performTaskFromCache(testInfo: TestInfo, context: playwright.BrowserContext, userTask: string): Promise<'success' | 'cache-miss' | Error> {
  const relativeFile = path.relative(testInfo.project.testDir, testInfo.file);
  const key = JSON.stringify({ file: relativeFile, test: testInfo.title, task: userTask });
  const entry = performCacheMap.get(key);
  if (!entry)
    return 'cache-miss';
  try {
    await entry.code({ page: context.pages()[0] });
    return 'success';
  } catch (error) {
    return error;
  }
}
