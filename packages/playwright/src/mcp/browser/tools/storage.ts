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

import { z } from 'playwright-core/lib/mcpBundle';
import { defineTool } from './tool';

const storageState = defineTool({
  capability: 'storage',

  schema: {
    name: 'browser_storage_state',
    title: 'Save storage state',
    description: 'Save storage state (cookies, local storage) to a file for later reuse',
    inputSchema: z.object({
      filename: z.string().optional().describe('File name to save the storage state to. Defaults to `storage-state-{timestamp}.json` if not specified.'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    const browserContext = await context.ensureBrowserContext();
    const state = await browserContext.storageState();
    const serializedState = JSON.stringify(state, null, 2);
    const resolvedFile = await response.resolveClientFile({ prefix: 'storage-state', ext: 'json', suggestedFilename: params.filename }, 'Storage state');
    response.addCode(`await page.context().storageState({ path: '${resolvedFile.relativeName}' });`);
    await response.addFileResult(resolvedFile, serializedState);
  },
});

const setStorageState = defineTool({
  capability: 'storage',

  schema: {
    name: 'browser_set_storage_state',
    title: 'Restore storage state',
    description: 'Restore storage state (cookies, local storage) from a file. This clears existing cookies and local storage before restoring.',
    inputSchema: z.object({
      filename: z.string().describe('Path to the storage state file to restore from'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const browserContext = await context.ensureBrowserContext();
    await browserContext.setStorageState(params.filename);
    response.addTextResult(`Storage state restored from ${params.filename}`);
    response.addCode(`await page.context().setStorageState('${params.filename}');`);
  },
});

export default [
  storageState,
  setStorageState,
];
