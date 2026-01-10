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

import fs from 'fs';

import { toolsForLoop } from './tool';
import { debug } from '../../utilsBundle';
import { Loop } from '../../mcpBundle';
import { runAction } from './actionRunner';
import { Context } from './context';
import performTools from './performTools';
import expectTools from './expectTools';

import type * as channels from '@protocol/channels';
import type * as actions from './actions';
import type { ToolDefinition } from './tool';
import type * as loopTypes from '@lowire/loop';

export async function pageAgentPerform(context: Context, options: loopTypes.LoopEvents & channels.PageAgentPerformParams) {
  const cacheKey = (options.cacheKey ?? options.task).trim();
  if (await cachedPerform(context, cacheKey))
    return;

  const task = `
### Instructions
- Perform the following task on the page.
- Your reply should be a tool call that performs action the page".

### Task
${options.task}
`;

  await runLoop(context, performTools, task, undefined, options);
  await updateCache(context, cacheKey);
}

export async function pageAgentExpect(context: Context, options: loopTypes.LoopEvents & channels.PageAgentExpectParams) {
  const cacheKey = (options.cacheKey ?? options.expectation).trim();
  if (await cachedPerform(context, cacheKey))
    return;

  const task = `
### Instructions
- Call one of the "browser_expect_*" tools to verify / assert the condition.
- You can call exactly one tool and it can't be report_results, must be one of the assertion tools.

### Expectation
${options.expectation}
`;

  await runLoop(context, expectTools, task, undefined, options);
  await updateCache(context, cacheKey);
}

export async function runLoop(context: Context, toolDefinitions: ToolDefinition[], userTask: string, resultSchema: loopTypes.Schema | undefined, options: loopTypes.LoopEvents & {
  api?: string,
  apiEndpoint?: string,
  apiKey?: string,
  model?: string,
  maxTurns?: number;
  maxTokens?: number;
}): Promise<{
  result: any
}> {
  const { page } = context;

  if (!context.options?.api || !context.options?.apiKey || !context.options?.model)
    throw new Error(`This action requires the API and API key to be set on the browser context`);

  const { full } = await page.snapshotForAI(context.progress);
  const { tools, callTool } = toolsForLoop(context, toolDefinitions, { resultSchema });

  const loop = new Loop({
    api: context.options.api as any,
    apiEndpoint: context.options.apiEndpoint,
    apiKey: context.options.apiKey,
    model: context.options.model,
    maxTurns: context.options.maxTurns,
    maxTokens: context.options.maxTokens,
    summarize: true,
    debug,
    callTool,
    tools,
  });

  const task = `${userTask}

### Page snapshot
${full}
`;

  const { result } = await loop.run(task);
  return { result };
}

type CachedActions = Record<string, {
  timestamp: number,
  actions: actions.ActionWithCode[],
}>;

async function cachedPerform(context: Context, cacheKey: string): Promise<actions.ActionWithCode[] | undefined> {
  if (!context.options?.cacheFile)
    return;

  const cache = await cachedActions(context.options?.cacheFile);
  const entry = cache.actions[cacheKey];
  if (!entry)
    return;

  for (const action of entry.actions)
    await runAction(context.progress, 'run', context.page, action, context.options.secrets ?? []);
  return entry.actions;
}

async function updateCache(context: Context, cacheKey: string) {
  const cacheFile = context.options?.cacheFile;
  const cacheOutFile = context.options?.cacheOutFile;
  const cacheFileKey = cacheFile ?? cacheOutFile;

  const cache = cacheFileKey ? await cachedActions(cacheFileKey) : { actions: {}, newActions: {} };
  const newEntry = {
    timestamp: Date.now(),
    actions: context.actions,
  };
  cache.actions[cacheKey] = newEntry;
  cache.newActions[cacheKey] = newEntry;

  if (cacheOutFile) {
    const entries = Object.entries(cache.newActions);
    entries.sort((e1, e2) => e1[0].localeCompare(e2[0]));
    await fs.promises.writeFile(cacheOutFile, JSON.stringify(Object.fromEntries(entries), undefined, 2));
  } else if (cacheFile) {
    const entries = Object.entries(cache.actions);
    entries.sort((e1, e2) => e1[0].localeCompare(e2[0]));
    await fs.promises.writeFile(cacheFile, JSON.stringify(Object.fromEntries(entries), undefined, 2));
  }
}

type Cache = {
  actions: CachedActions;
  newActions: CachedActions;
};

const allCaches = new Map<string, Cache>();

async function cachedActions(cacheFile: string): Promise<Cache> {
  let cache = allCaches.get(cacheFile);
  if (!cache) {
    const actions = await fs.promises.readFile(cacheFile, 'utf-8').then(text => JSON.parse(text)).catch(() => ({})) as CachedActions;
    cache = { actions, newActions: {} };
    allCaches.set(cacheFile, cache);
  }
  return cache;
}
