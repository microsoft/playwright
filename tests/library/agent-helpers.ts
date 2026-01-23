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
import path from 'path';

import { browserTest as test } from '../config/browserTest';
import type { BrowserContext, Page, PageAgent } from '@playwright/test';

export function cacheFile() {
  return test.info().outputPath('agent-cache.json');
}

export async function cacheObject() {
  return JSON.parse(await fs.promises.readFile(cacheFile(), 'utf8'));
}

export async function setCacheObject(object: any) {
  await fs.promises.writeFile(cacheFile(), JSON.stringify(object, null, 2), 'utf8');
}

type AgentOptions = Parameters<Page['agent']>[0];

export async function generateAgent(context: BrowserContext, options: AgentOptions = {}) {
  const apiCacheFile = path.join(__dirname, '__llm_cache__', sanitizeFileName(test.info().titlePath.join(' ')) + '.json');

  const page = await context.newPage();
  const agent = await page.agent({
    provider: {
      api: 'anthropic' as const,
      apiKey: process.env.AZURE_SONNET_API_KEY ?? 'dummy',
      apiEndpoint: process.env.AZURE_SONNET_ENDPOINT,
      model: 'claude-sonnet-4-5',
      ...{ _apiCacheFile: apiCacheFile }
    },
    ...options,
    cache: {
      cacheFile: cacheFile(),
    },
    ...{ _doNotRenderActive: true },
  });
  return { page, agent };
}

export async function runAgent(context: BrowserContext, options: AgentOptions = {}) {
  const page = await context.newPage();
  const agent = await page.agent({
    ...options,
    cache: { cacheFile: cacheFile() },
    ...{ _doNotRenderActive: true },
  });
  return { page, agent };
}

export async function run(context: BrowserContext, callback: (page: Page, agent: PageAgent) => Promise<void>, options: { secrets?: Record<string, string> } = {}) {
  {
    const { page, agent } = await generateAgent(context, options);
    await callback(page, agent);
  }
  {
    const { page, agent } = await runAgent(context, options);
    await callback(page, agent);
  }
}

function sanitizeFileName(name: string): string {
  return name.replace('.spec.ts', '').replace(/[^a-zA-Z0-9_]+/g, '-');
}
