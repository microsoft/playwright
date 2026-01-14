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

import type * as actions from './actions';
import type { ToolDefinition } from './tool';
import type * as loopTypes from '@lowire/loop';
import type { Progress } from '../progress';

export type CallParams = {
  cacheKey?: string;
  maxTokens?: number;
  maxTurns?: number;
};

export async function pageAgentPerform(progress: Progress, context: Context, userTask: string, callParams: CallParams) {
  const cacheKey = (callParams.cacheKey ?? userTask).trim();
  if (await cachedPerform(progress, context, cacheKey))
    return;

  const task = `
### Instructions
- Perform the following task on the page.
- Your reply should be a tool call that performs action the page".

### Task
${userTask}
`;

  await runLoop(progress, context, performTools, task, undefined, callParams);
  await updateCache(context, cacheKey);
}

export async function pageAgentExpect(progress: Progress, context: Context, expectation: string, callParams: CallParams) {
  const cacheKey = (callParams.cacheKey ?? expectation).trim();
  if (await cachedPerform(progress, context, cacheKey))
    return;

  const task = `
### Instructions
- Call one of the "browser_expect_*" tools to verify / assert the condition.
- You can call exactly one tool and it can't be report_results, must be one of the assertion tools.

### Expectation
${expectation}
`;

  callParams.maxTurns = callParams.maxTurns ?? 3;
  await runLoop(progress, context, expectTools, task, undefined, callParams);
  await updateCache(context, cacheKey);
}

export async function pageAgentExtract(progress: Progress, context: Context, query: string, schema: loopTypes.Schema, callParams: CallParams): Promise<any> {

  const task = `
### Instructions
Extract the following information from the page. Do not perform any actions, just extract the information.

### Query
${query}`;
  const { result } = await runLoop(progress, context, [], task, schema, callParams);
  return result;
}

async function runLoop(progress: Progress, context: Context, toolDefinitions: ToolDefinition[], userTask: string, resultSchema: loopTypes.Schema | undefined, params: CallParams): Promise<{
  result: any
}> {
  const { page } = context;
  if (!context.agentParams.api || !context.agentParams.model)
    throw new Error(`This action requires the API and API key to be set on the page agent. Did you mean to --run-agents=missing?`);
  if (!context.agentParams.apiKey)
    throw new Error(`This action requires API key to be set on the page agent.`);

  const { full } = await page.snapshotForAI(progress);
  const { tools, callTool, reportedResult } = toolsForLoop(progress, context, toolDefinitions, { resultSchema });
  const secrets = Object.fromEntries((context.agentParams.secrets || [])?.map(s => ([s.name, s.value])));

  const loop = new Loop({
    api: context.agentParams.api as any,
    apiEndpoint: context.agentParams.apiEndpoint,
    apiKey: context.agentParams.apiKey,
    model: context.agentParams.model,
    maxTurns: params.maxTurns ?? context.agentParams.maxTurns,
    maxTokens: params.maxTokens ?? context.agentParams.maxTokens,
    summarize: true,
    debug,
    callTool,
    tools,
    secrets,
    ...context.events,
  });

  const task: string[] = [];
  if (context.agentParams.systemPrompt) {
    task.push('### System');
    task.push(context.agentParams.systemPrompt);
    task.push('');
  }

  task.push('### Task');
  task.push(userTask);

  if (context.history().length) {
    task.push('### Context history');
    task.push(context.history().map(h => `- ${h.type}: ${h.description}`).join('\n'));
    task.push('');
  }
  task.push('### Page snapshot');
  task.push(full);
  task.push('');
  await loop.run(task.join('\n'));

  return { result: resultSchema ? reportedResult() : undefined };
}

type CachedActions = Record<string, {
  actions: actions.ActionWithCode[],
}>;

async function cachedPerform(progress: Progress, context: Context, cacheKey: string): Promise<actions.ActionWithCode[] | undefined> {
  if (!context.agentParams?.cacheFile)
    return;

  const cache = await cachedActions(context.agentParams?.cacheFile);
  const entry = cache.actions[cacheKey];
  if (!entry)
    return;

  for (const action of entry.actions)
    await runAction(progress, 'run', context.page, action, context.agentParams.secrets ?? []);
  return entry.actions;
}

async function updateCache(context: Context, cacheKey: string) {
  const cacheFile = context.agentParams?.cacheFile;
  const cacheOutFile = context.agentParams?.cacheOutFile;
  const cacheFileKey = cacheFile ?? cacheOutFile;

  const cache = cacheFileKey ? await cachedActions(cacheFileKey) : { actions: {}, newActions: {} };
  const newEntry = { actions: context.actions() };
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
