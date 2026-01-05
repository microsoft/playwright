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

export async function pageAgentPerform(progress: Progress, page: Page, options: channels.PageAgentPerformParams): Promise<Usage> {
  const context = new Context(progress, page);

  const cacheKey = (options.key ?? options.task).trim();
  if (await cachedPerform(progress, context, cacheKey))
    return { turns: 0, inputTokens: 0, outputTokens: 0 };

  const task = `
### Instructions
- Perform the following task on the page.
- Your reply should be a tool call that performs action the page".

### Task
${options.task}
`;

  const { usage } = await runLoop(progress, context, performTools, task, undefined, options);
  await updateCache(context, cacheKey);
  return usage;
}

export async function pageAgentExpect(progress: Progress, page: Page, options: channels.PageAgentExpectParams): Promise<Usage> {
  const context = new Context(progress, page);

  const cacheKey = (options.key ?? options.expectation).trim();
  if (await cachedPerform(progress, context, cacheKey))
    return { turns: 0, inputTokens: 0, outputTokens: 0 };

  const task = `
### Instructions
- Call one of the "browser_expect_*" tools to verify / assert the condition.
- You can call exactly one tool and it can't be report_results, must be one of the assertion tools.

### Expectation
${options.expectation}
`;

  const { usage } = await runLoop(progress, context, expectTools, task, undefined, options);
  await updateCache(context, cacheKey);
  return usage;
}

export async function pageAgentExtract(progress: Progress, page: Page, options: channels.PageAgentExtractParams): Promise<{
  result: any,
  usage: Usage
}> {

  const context = new Context(progress, page);

  const task = `
### Instructions
Extract the following information from the page. Do not perform any actions, just extract the information.

### Query
${options.query}`;
  const { result, usage } = await runLoop(progress, context, [], task, options.schema, options);
  return { result, usage };
}

async function runLoop(progress: Progress, context: Context, toolDefinitions: ToolDefinition[], userTask: string, resultSchema: loopTypes.Schema | undefined, options: {
  maxTurns?: number;
  maxTokens?: number;
}): Promise<{
  result: any,
  usage: Usage
}> {
  const { page } = context;
  const browserContext = page.browserContext;
  if (!browserContext._options.agent?.provider || !browserContext._options.agent?.model)
    throw new Error(`This action requires the agent provider and model to be set on the browser context`);

  const { full } = await page.snapshotForAI(progress);
  const { tools, callTool } = toolsForLoop(context, toolDefinitions, { resultSchema });

  page.emit(Page.Events.AgentTurn, { role: 'user', message: userTask });

  const limits = context.limits(options);
  let turns = 0;
  const loop = new Loop(browserContext._options.agent.provider as any, {
    model: browserContext._options.agent.model,
    summarize: true,
    debug,
    callTool,
    tools,
    ...limits,
    onBeforeTurn: ({ conversation }) => {
      const userMessage = conversation.messages.find(m => m.role === 'user');
      page.emit(Page.Events.AgentTurn, { role: 'user', message: userMessage?.content ?? '' });
      return 'continue';
    },
    onAfterTurn: ({ assistantMessage, totalUsage }) => {
      ++turns;
      const usage = { inputTokens: totalUsage.input, outputTokens: totalUsage.output };
      const intent = assistantMessage.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
      page.emit(Page.Events.AgentTurn, { role: 'assistant', message: intent, usage });
      if (!assistantMessage.content.filter(c => c.type === 'tool_call').length)
        page.emit(Page.Events.AgentTurn, { role: 'assistant', message: `no tool calls`, usage });
      return 'continue';
    },
    onBeforeToolCall: ({ toolCall }) => {
      page.emit(Page.Events.AgentTurn, { role: 'assistant', message: `call tool "${toolCall.name}"` });
      return 'continue';
    },
    onAfterToolCall: ({ toolCall }) => {
      const suffix = toolCall.result?.isError ? 'failed' : 'succeeded';
      page.emit(Page.Events.AgentTurn, { role: 'user', message: `tool "${toolCall.name}" ${suffix}` });
      return 'continue';
    },
    onToolCallError: ({ toolCall, error }) => {
      page.emit(Page.Events.AgentTurn, { role: 'user', message: `tool "${toolCall.name}" failed: ${error.message}` });
      return 'continue';
    },
    ...options
  });

  const task = `${userTask}

### Page snapshot
${full}
`;

  const { result, usage } = await loop.run(task);
  return {
    result,
    usage: {
      turns,
      inputTokens: usage.input,
      outputTokens: usage.output,
    }
  };
}

type CachedActions = Record<string, {
  timestamp: number,
  actions: actions.Action[],
}>;

async function cachedPerform(progress: Progress, context: Context, cacheKey: string): Promise<boolean> {
  if (!context.options?.cacheFile)
    return false;

  const cache = await cachedActions(context.options?.cacheFile);
  const entry = cache.actions[cacheKey];
  if (!entry)
    return false;

  for (const action of entry.actions)
    await runAction(progress, 'run', context.page, action, context.options.secrets ?? []);
  return true;
}

async function updateCache(context: Context, cacheKey: string) {
  const cacheFile = context.options?.cacheFile;
  const cacheOutFile = context.options?.cacheOutFile;

  const cache = cacheFile ? await cachedActions(cacheFile) : { actions: {}, newActions: {} };
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
