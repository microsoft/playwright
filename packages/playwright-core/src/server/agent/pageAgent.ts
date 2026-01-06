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
import { Page } from '../page';
import performTools from './performTools';
import expectTools from './expectTools';

import type { Progress } from '../progress';
import type * as channels from '@protocol/channels';
import type * as loopTypes from '@lowire/loop';
import type * as actions from './actions';
import type { ToolDefinition } from './tool';

type Usage = {
  turns: number,
  inputTokens: number,
  outputTokens: number,
};

const emptyUsage: Usage = { turns: 0, inputTokens: 0, outputTokens: 0 };

export async function pageAgentPerformWithEvents(progress: Progress, page: Page, options: channels.PageAgentPerformParams): Promise<{ usage: Usage, actions: actions.ActionWithCode[] }> {
  const context = new Context(progress, page);
  const usageContainer = { value: emptyUsage };
  const eventSupport = eventSupportHooks(page, usageContainer);

  await pageAgentPerform(context, {
    ...eventSupport,
    ...options,
  });
  return {
    usage: usageContainer.value,
    actions: context.actions,
  };
}

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
  return { actions: context.actions };
}

export async function pageAgentExpectWithEvents(progress: Progress, page: Page, options: channels.PageAgentExpectParams): Promise<{ usage: Usage, actions: actions.ActionWithCode[] }> {
  const context = new Context(progress, page);
  const usageContainer = { value: emptyUsage };
  const eventSupport = eventSupportHooks(page, usageContainer);

  await pageAgentExpect(context, {
    ...eventSupport,
    ...options,
  });
  return {
    usage: usageContainer.value,
    actions: context.actions,
  };
}

export async function pageAgentExpect(context: Context, options: loopTypes.LoopEvents & channels.PageAgentExpectParams) {
  const cacheKey = (options.cacheKey ?? options.expectation).trim();
  const cachedActions = await cachedPerform(context, cacheKey);
  if (cachedActions) {
    return {
      usage: emptyUsage,
      actions: cachedActions,
    };
  }

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

export async function pageAgentExtractWithEvents(progress: Progress, page: Page, options: channels.PageAgentExtractParams): Promise<{
  result: any
  usage: Usage,
}> {
  const context = new Context(progress, page);
  const usageContainer = { value: emptyUsage };
  const eventSupport = eventSupportHooks(page, usageContainer);

  const task = `
### Instructions
Extract the following information from the page. Do not perform any actions, just extract the information.

### Query
${options.query}`;
  const { result } = await runLoop(context, [], task, options.schema, { ...eventSupport, ...options });
  return { result, usage: usageContainer.value };
}

async function runLoop(context: Context, toolDefinitions: ToolDefinition[], userTask: string, resultSchema: loopTypes.Schema | undefined, options: loopTypes.LoopEvents & {
  api?: string,
  apiEndpoint?: string,
  apiKey?: string,
  apiVersion?: string,
  model?: string,
  maxTurns?: number;
  maxTokens?: number;
}): Promise<{
  result: any
}> {
  const { page } = context;
  const browserContext = page.browserContext;

  const api = options.api ?? browserContext._options.agent?.api;
  const apiEndpoint = options.apiEndpoint ?? browserContext._options.agent?.apiEndpoint;
  const apiKey = options.apiKey ?? browserContext._options.agent?.apiKey;
  const apiVersion = options.apiVersion ?? browserContext._options.agent?.apiVersion;
  const model = options.model ?? browserContext._options.agent?.model;

  if (!api || !apiKey || !model)
    throw new Error(`This action requires the API and API key to be set on the browser context`);

  const { full } = await page.snapshotForAI(context.progress);
  const { tools, callTool } = toolsForLoop(context, toolDefinitions, { resultSchema });

  const limits = context.limits(options);
  const loop = new Loop({
    api: api as any,
    apiEndpoint,
    apiKey,
    apiVersion,
    model,
    summarize: true,
    debug,
    callTool,
    tools,
    ...limits,
    ...options
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

export function eventSupportHooks(page: Page, usageContainer: { value: Usage }): loopTypes.LoopEvents {
  return {
    onBeforeTurn(params: { conversation: loopTypes.Conversation }) {
      const userMessage = params.conversation.messages.find(m => m.role === 'user');
      page.emit(Page.Events.AgentTurn, { role: 'user', message: userMessage?.content ?? '' });
      return 'continue' as const;
    },

    onAfterTurn(params: { assistantMessage: loopTypes.AssistantMessage, totalUsage: loopTypes.Usage }) {
      const usage = { inputTokens: params.totalUsage.input, outputTokens: params.totalUsage.output };
      const intent = params.assistantMessage.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
      page.emit(Page.Events.AgentTurn, { role: 'assistant', message: intent, usage });
      if (!params.assistantMessage.content.filter(c => c.type === 'tool_call').length)
        page.emit(Page.Events.AgentTurn, { role: 'assistant', message: `no tool calls`, usage });
      usageContainer.value = { turns: usageContainer.value.turns + 1, inputTokens: usageContainer.value.inputTokens + usage.inputTokens, outputTokens: usageContainer.value.outputTokens + usage.outputTokens };
      return 'continue' as const;
    },

    onBeforeToolCall(params: { toolCall: loopTypes.ToolCallContentPart }) {
      page.emit(Page.Events.AgentTurn, { role: 'assistant', message: `call tool "${params.toolCall.name}"` });
      return 'continue' as const;
    },

    onAfterToolCall(params: { toolCall: loopTypes.ToolCallContentPart, result: loopTypes.ToolResult }) {
      const suffix = params.toolCall.result?.isError ? 'failed' : 'succeeded';
      page.emit(Page.Events.AgentTurn, { role: 'user', message: `tool "${params.toolCall.name}" ${suffix}` });
      return 'continue' as const;
    },

    onToolCallError(params: { toolCall: loopTypes.ToolCallContentPart, error: Error }) {
      page.emit(Page.Events.AgentTurn, { role: 'user', message: `tool "${params.toolCall.name}" failed: ${params.error.message}` });
      return 'continue' as const;
    }
  };
}
