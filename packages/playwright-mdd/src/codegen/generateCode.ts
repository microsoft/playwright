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

import { z } from 'zod';

import { defineTool } from './tool';
import { Context as BrowserContext } from '../browser/context';

const generateCode = defineTool({
  schema: {
    name: 'codegen',
    description: 'Generate code for the given test spec',
    inputSchema: z.object({
      tests: z.array(z.object({
        name: z.string(),
        steps: z.array(z.string()),
      })),
    }),
  },

  handle: async (context, params) => {
    const { tests } = params;
    const code: string[] = [
      `/* eslint-disable notice/notice */`,
      '',
      `import { test, expect } from '@playwright/test';`,
      '',
    ];
    for (const test of tests) {
      code.push(`test('${test.name}', async ({ page }) => {`);
      const context = await BrowserContext.create();
      const result = await context.runScript(test.steps);
      code.push(...result.code.map(c => c ? `  ${c}` : ''));
      code.push('});');
      code.push('');
      await context.close();
    }
    return {
      content: 'Generated code has been saved and delivered to the user. Call the "done" tool, do not produce any other output.',
      code
    };
  },
});

export default [
  generateCode,
];
