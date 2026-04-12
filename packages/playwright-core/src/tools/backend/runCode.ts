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
import vm from 'vm';

import { ManualPromise } from '../../utils/isomorphic/manualPromise';

import { z } from '../../zodBundle';
import { defineTabTool } from './tool';

const codeSchema = z.object({
  code: z.string().optional().describe(`A JavaScript function containing Playwright code to execute. It will be invoked with a single argument, page, which you can use for any page interaction. For example: \`async (page) => { await page.getByRole('button', { name: 'Submit' }).click(); return await page.title(); }\``),
  filename: z.string().optional().describe('Load code from the specified file. If both code and filename are provided, code will be ignored.'),
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
    let code = params.code;
    if (params.filename) {
      const resolvedPath = await response.resolveClientFilename(params.filename);
      code = await fs.promises.readFile(resolvedPath, 'utf-8');
    }
    response.addCode(`await (${code})(page);`);
    const __end__ = new ManualPromise<void>();
    const context: any = {
      page: tab.page,
      __end__,
    };
    vm.createContext(context);
    await tab.waitForCompletion(async () => {
      // Compile the user function separately to avoid template literal escaping issues
      // when the code contains backticks.
      context.__fn__ = vm.runInContext('(' + code + ')', context);
      const snippet = '(async () => {\n' +
          '  try {\n' +
          '    const result = await __fn__(page);\n' +
          '    __end__.resolve(JSON.stringify(result));\n' +
          '  } catch (e) {\n' +
          '    __end__.reject(e);\n' +
          '  }\n' +
          '})()';
      await vm.runInContext(snippet, context);
      const result = await __end__;
      if (typeof result === 'string')
        response.addTextResult(result);
    });
  },
});

export default [
  runCode,
];
