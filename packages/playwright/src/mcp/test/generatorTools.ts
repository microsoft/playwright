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

import { z } from 'playwright-core/lib/mcpBundle';
import { defineTestTool } from './testTool';
import { GeneratorJournal } from './testContext';

export const setupPage = defineTestTool({
  schema: {
    name: 'generator_setup_page',
    title: 'Setup generator page',
    description: 'Setup the page for test.',
    inputSchema: z.object({
      plan: z.string().describe('The plan for the test. This should be the actual test plan with all the steps.'),
      project: z.string().optional().describe('Project to use for setup. For example: "chromium", if no project is provided uses the first project in the config.'),
      seedFile: z.string().optional().describe('A seed file contains a single test that is used to setup the page for testing, for example: "tests/seed.spec.ts". If no seed file is provided, a default seed file is created.'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const seed = await context.getOrCreateSeedFile(params.seedFile, params.project);
    context.generatorJournal = new GeneratorJournal(context.rootPath, params.plan, seed);
    const { output, status } = await context.runSeedTest(seed.file, seed.projectName);
    return { content: [{ type: 'text', text: output }], isError: status !== 'paused' };
  },
});

export const generatorReadLog = defineTestTool({
  schema: {
    name: 'generator_read_log',
    title: 'Retrieve test log',
    description: 'Retrieve the performed test log',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async context => {
    if (!context.generatorJournal)
      throw new Error(`Please setup page using "${setupPage.schema.name}" first.`);
    const result = context.generatorJournal.journal();
    return { content: [{
      type: 'text',
      text: result,
    }] };
  },
});

export const generatorWriteTest = defineTestTool({
  schema: {
    name: 'generator_write_test',
    title: 'Write test',
    description: 'Write the generated test to the test file',
    inputSchema: z.object({
      fileName: z.string().describe('The file to write the test to'),
      code: z.string().describe('The generated test code'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    if (!context.generatorJournal)
      throw new Error(`Please setup page using "${setupPage.schema.name}" first.`);

    const testRunner = context.existingTestRunner();
    if (!testRunner)
      throw new Error('No test runner found, please setup page and perform actions first.');
    const config = await testRunner.loadConfig();

    const dirs: string[] = [];
    for (const project of config.projects) {
      const testDir = path.relative(context.rootPath, project.project.testDir).replace(/\\/g, '/');
      const fileName = params.fileName.replace(/\\/g, '/');
      if (fileName.startsWith(testDir)) {
        const resolvedFile = path.resolve(context.rootPath, fileName);
        await fs.promises.mkdir(path.dirname(resolvedFile), { recursive: true });
        await fs.promises.writeFile(resolvedFile, params.code);
        return {
          content: [{
            type: 'text',
            text: `### Result\nTest written to ${params.fileName}`,
          }]
        };
      }
      dirs.push(testDir);
    }
    throw new Error(`Test file did not match any of the test dirs: ${dirs.join(', ')}`);
  },
});
