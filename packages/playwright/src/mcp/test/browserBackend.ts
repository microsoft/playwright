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

export async function runBrowserBackendOnError(page: playwright.Page, message: () => string) {
  const testInfo = currentTestInfo();
  if (!testInfo || !testInfo._pauseOnError())
    return;

  const config: FullConfig = {
    ...defaultConfig,
    capabilities: ['testing'],
  };

  const snapshot = await (page as Page)._snapshotForAI();
  const introMessage = `### Paused on error:
${stripAnsiEscapes(message())}

### Current page snapshot:
${snapshot}

### Task
Try recovering from the error prior to continuing`;

  await mcp.runOnPauseBackendLoop(new BrowserServerBackend(config, identityFactory(page.context())), introMessage);
}

export async function runBrowserBackendAtEnd(context: playwright.BrowserContext) {
  const testInfo = currentTestInfo();
  if (!testInfo || !testInfo._pauseAtEnd())
    return;

  const page = context.pages()[0];
  if (!page)
    return;

  const snapshot = await (page as Page)._snapshotForAI();
  const introMessage = `### Paused at end of test. ready for interaction

### Current page snapshot:
${snapshot}`;

  const config: FullConfig = {
    ...defaultConfig,
    capabilities: ['testing'],
  };

  await mcp.runOnPauseBackendLoop(new BrowserServerBackend(config, identityFactory(context)), introMessage);
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
