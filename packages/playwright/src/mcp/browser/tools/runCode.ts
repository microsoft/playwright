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

import vm from 'vm';

import { ManualPromise } from 'playwright-core/lib/utils';

import { z } from 'playwright-core/lib/mcpBundle';
import { defineTabTool } from './tool';

const codeSchema = z.object({
  code: z.string().describe(`Playwright code snippet to run. The snippet should access the \`page\` object to interact with the page. Can make multiple statements. For example: \`await page.getByRole('button', { name: 'Submit' }).click();\``),
});

const runCode = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_run_code',
    title: 'Run Playwright code',
    description: 'Run Playwright code snippet',
    inputSchema: codeSchema,
    type: 'action',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();
    response.addCode(params.code);
    const __end__ = new ManualPromise<void>();
    const context = {
      page: tab.page,
      __end__,
    };
    vm.createContext(context);
    await tab.waitForCompletion(async () => {
      const snippet = `(async () => {
        try {
          ${params.code};
          __end__.resolve();
        } catch (e) {
          __end__.reject(e);
        }
      })()`;
      vm.runInContext(snippet, context);
      await __end__;
    });
  },
});

export default [
  runCode,
];
