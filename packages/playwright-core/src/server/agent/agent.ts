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
import { Loop, z, zodToJsonSchema } from '../../mcpBundle';
import { runAction } from './actionRunner';
import { Context } from './context';

import type { Progress } from '../progress';
import type * as channels from '@protocol/channels';
import type { Page } from '../page';
import type * as loopTypes from '@lowire/loop';
import type * as actions from './actions';

export async function pagePerform(progress: Progress, page: Page, options: channels.PagePerformParams): Promise<void> {
  const context = new Context(progress, page);

  if (await cachedPerform(context, options))
    return;

  await perform(context, options.task, zodToJsonSchema(z.object({
    error: z.string().optional().describe('An error message if the task could not be completed successfully'),
  })) as loopTypes.Schema, options);
  await updateCache(context, options);
}

export async function pageExtract(progress: Progress, page: Page, options: channels.PageExtractParams) {
  const context = new Context(progress, page);
  const task = `
### Instructions
Extract the following information from the page. Do not perform any actions, just extract the information.

### Query
${options.query}`;
  return await perform(context, task, options.schema, options);
}

async function perform(context: Context, userTask: string, resultSchema: loopTypes.Schema, options: { maxTurns?: number } = {}): Promise<any> {
  const { progress, page } = context;
  const browserContext = page.browserContext;
  if (!browserContext._options.agent)
    throw new Error(`page.perform() and page.extract() require the agent to be set on the browser context`);

  const { full } = await page.snapshotForAI(progress);
  const { tools, callTool } = toolsForLoop(context);

  const loop = new Loop(browserContext._options.agent.provider as any, {
    model: browserContext._options.agent.model,
    summarize: true,
    debug,
    callTool,
    tools,
    ...options
  });

  const task = `${userTask}

### Page snapshot
${full}
`;

  return await loop.run(task, {
    resultSchema
  });
}

type CachedActions = Record<string, actions.Action[]>;

const allCaches = new Map<string, CachedActions>();

async function cachedPerform(context: Context, options: channels.PagePerformParams): Promise<boolean> {
  if (!context.options?.cacheFile || context.options.cacheMode === 'ignore')
    return false;

  const cache = await cachedActions(context.options.cacheFile);
  const cacheKey = options.key ?? options.task;
  const actions = cache[cacheKey];
  if (!actions) {
    if (context.options.cacheMode === 'force')
      throw new Error(`No cached actions for key "${cacheKey}", but cache mode is set to "force"`);
    return false;
  }

  for (const action of actions)
    await runAction(context.progress, context.page, action, context.options.secrets ?? []);
  return true;
}

async function updateCache(context: Context, options: channels.PagePerformParams) {
  const cacheFile = context.options?.cacheFile;
  if (!cacheFile)
    return;
  const cache = await cachedActions(cacheFile);
  const cacheKey = options.key ?? options.task;
  cache[cacheKey] = context.actions;
  await fs.promises.writeFile(cacheFile, JSON.stringify(cache, undefined, 2));
}

async function cachedActions(cacheFile: string): Promise<CachedActions> {
  let cache = allCaches.get(cacheFile);
  if (!cache) {
    const text = await fs.promises.readFile(cacheFile, 'utf-8').catch(() => '{}');
    cache = JSON.parse(text) as CachedActions;
    allCaches.set(cacheFile, cache);
  }
  return cache;
}
