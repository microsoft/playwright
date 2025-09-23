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

import * as mcp from '../sdk/exports';
import { currentTestInfo } from '../../common/globals';
import { stripAnsiEscapes } from '../../util';
import { defaultConfig, FullConfig } from '../browser/config';
import { BrowserServerBackend } from '../browser/browserServerBackend';

import type * as playwright from '../../../index';
import type { Page } from '../../../../playwright-core/src/client/page';
import type { BrowserContextFactory } from '../browser/browserContextFactory';
import type { ClientInfo } from '../sdk/server';

export async function runBrowserBackendAtEnd(context: playwright.BrowserContext, errorMessage?: string) {
  const testInfo = currentTestInfo();
  if (!testInfo)
    return;

  const shouldPause = errorMessage ? testInfo?._pauseOnError() : testInfo?._pauseAtEnd();
  if (!shouldPause)
    return;

  const lines: string[] = [];
  if (errorMessage)
    lines.push(`### Paused on error:`, stripAnsiEscapes(errorMessage));
  else
    lines.push(`### Paused at end of test. ready for interaction`);

  for (let i = 0; i < context.pages().length; i++) {
    const page = context.pages()[i];
    const stateSuffix = context.pages().length > 1 ? (i + 1) + ' of ' + (context.pages().length) : 'state';
    lines.push(
        '',
        `### Page ${stateSuffix}`,
        `- Page URL: ${page.url()}`,
        `- Page Title: ${await page.title()}`.trim(),
        `- Page Snapshot:`,
        '```yaml',
        await (page as Page)._snapshotForAI(),
        '```',
    );
  }

  lines.push('');
  if (errorMessage)
    lines.push(`### Task`, `Try recovering from the error prior to continuing`);

  const config: FullConfig = {
    ...defaultConfig,
    capabilities: ['testing'],
  };

  await mcp.runOnPauseBackendLoop(new BrowserServerBackend(config, identityFactory(context)), lines.join('\n'));
}

function identityFactory(browserContext: playwright.BrowserContext): BrowserContextFactory {
  return {
    createContext: async (clientInfo: ClientInfo, abortSignal: AbortSignal, toolName: string | undefined) => {
      return {
        browserContext,
        close: async () => {}
      };
    }
  };
}
