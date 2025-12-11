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

import { toolsForLoop } from './backend';
import { debug } from '../../utilsBundle';
import { Loop } from '../../mcpBundle';
import { runAction } from './actionRunner';
import { Context } from './context';

import type { Progress } from '../progress';
import type * as channels from '@protocol/channels';
import type { Page } from '../page';
import type * as loopTypes from '@lowire/loop';
import type * as actions from './actions';

type Usage = {
  turns: number,
  inputTokens: number,
  outputTokens: number,
};

export async function pagePerform(progress: Progress, page: Page, options: channels.PagePerformParams): Promise<Usage> {
  const context = new Context(progress, page);

  if (await cachedPerform(context, options))
    return { turns: 0, inputTokens: 0, outputTokens: 0 };

  const { usage } = await perform(context, options.task, undefined, options);
  await updateCache(context, options);
  return usage;
}

export async function pageExtract(progress: Progress, page: Page, options: channels.PageExtractParams): Promise<{
  result: any,
  usage: Usage
}> {
  const context = new Context(progress, page);
  const task = `
### Instructions
Extract the following information from the page. Do not perform any actions, just extract the information.

### Query
${options.query}`;
  const { result, usage } = await perform(context, task, options.schema, options);
  return { result, usage };
}

async function perform(context: Context, userTask: string, resultSchema: loopTypes.Schema | undefined, options: { maxTurns?: number, maxTokens?: number } = {}): Promise<{
  result: any,
  usage: Usage
}> {
  const { progress, page } = context;
  const browserContext = page.browserContext;
  if (!browserContext._options.agent)
    throw new Error(`page.perform() and page.extract() require the agent to be set on the browser context`);

  const { full } = await page.snapshotForAI(progress);
  const { tools, callTool } = toolsForLoop(context);

  const limits = context.limits(options);
  let turns = 0;
  const loop = new Loop(browserContext._options.agent.provider as any, {
    model: browserContext._options.agent.model,
    summarize: true,
    debug,
    callTool,
    tools,
    ...limits,
    beforeTurn: params => {
      ++turns;
      const lastReply = params.conversation.messages.findLast(m => m.role === 'assistant');
      const toolCall = lastReply?.content.find(c => c.type === 'tool_call');
      if (!resultSchema && toolCall && toolCall.arguments.thatShouldBeIt)
        return 'break';
      return 'continue';
    },
    ...options
  });

  const task = `${userTask}

### Page snapshot
${full}
`;

  const { result, usage } = await loop.run(task, { resultSchema });
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

const allCaches = new Map<string, CachedActions>();

async function cachedPerform(context: Context, options: channels.PagePerformParams): Promise<boolean> {
  if (!context.options?.cacheFile || context.options.cacheMode === 'ignore')
    return false;

  const cache = await cachedActions(context.options.cacheFile);
  const cacheKey = (options.key ?? options.task).trim();
  const entry = cache[cacheKey];
  if (!entry) {
    if (context.options.cacheMode === 'force')
      throw new Error(`No cached actions for key "${cacheKey}", but cache mode is set to "force"`);
    return false;
  }

  for (const action of entry.actions)
    await runAction(context.progress, context.page, action, context.options.secrets ?? []);
  return true;
}

async function updateCache(context: Context, options: channels.PagePerformParams) {
  const cacheFile = context.options?.cacheFile;
  if (!cacheFile)
    return;
  const cache = await cachedActions(cacheFile);
  const cacheKey = (options.key ?? options.task).trim();
  cache[cacheKey] = {
    timestamp: Date.now(),
    actions: context.actions,
  };
  await fs.promises.writeFile(cacheFile, JSON.stringify(cache, undefined, 2));
}

async function cachedActions(cacheFile: string): Promise<CachedActions> {
  let cache = allCaches.get(cacheFile);
  if (!cache) {
    cache = await fs.promises.readFile(cacheFile, 'utf-8').then(text => JSON.parse(text)).catch(() => ({})) as CachedActions;
    allCaches.set(cacheFile, cache);
  }
  return cache;
}
