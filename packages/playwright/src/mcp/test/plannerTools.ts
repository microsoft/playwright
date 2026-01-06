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

export const setupPage = defineTestTool({
  schema: {
    name: 'planner_setup_page',
    title: 'Setup planner page',
    description: 'Setup the page for test planning',
    inputSchema: z.object({
      project: z.string().optional().describe('Project to use for setup. For example: "chromium", if no project is provided uses the first project in the config.'),
      seedFile: z.string().optional().describe('A seed file contains a single test that is used to setup the page for testing, for example: "tests/seed.spec.ts". If no seed file is provided, a default seed file is created.'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const seed = await context.getOrCreateSeedFile(params.seedFile, params.project);
    const { output, status } = await context.runSeedTest(seed.file, seed.projectName);
    return { content: [{ type: 'text', text: output }], isError: status !== 'paused' };
  },
});

const planSchema = z.object({
  overview: z.string().describe('A brief overview of the application to be tested'),
  suites: z.array(z.object({
    name: z.string().describe('The name of the suite'),
    seedFile: z.string().describe('A seed file that was used to setup the page for testing.'),
    tests: z.array(z.object({
      name: z.string().describe('The name of the test'),
      file: z.string().describe('The file the test should be saved to, for example: "tests/<suite-name>/<test-name>.spec.ts".'),
      steps: z.array(z.object({
        perform: z.string().optional().describe(`Action to perform. For example: 'Click on the "Submit" button'.`),
        expect: z.string().array().describe(`Expected result of the action where appropriate. For example: 'The page should show the "Thank you for your submission" message'`),
      })),
    })),
  })),
});

export const submitTestPlan = defineTestTool({
  schema: {
    name: 'planner_submit_plan',
    title: 'Submit test plan',
    description: 'Submit the test plan to the test planner',
    inputSchema: planSchema,
    type: 'readOnly',
  },

  handle: async (context, params) => {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(params, null, 2),
      }],
    };
  },
});

export const saveTestPlan = defineTestTool({
  schema: {
    name: 'planner_save_plan',
    title: 'Save test plan as markdown file',
    description: 'Save the test plan as a markdown file',
    inputSchema: planSchema.extend({
      name: z.string().describe('The name of the test plan, for example: "Test Plan".'),
      fileName: z.string().describe('The file to save the test plan to, for example: "spec/test.plan.md". Relative to the workspace root.'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const lines: string[] = [];
    lines.push(`# ${params.name}`);
    lines.push(``);
    lines.push(`## Application Overview`);
    lines.push(``);
    lines.push(params.overview);
    lines.push(``);
    lines.push(`## Test Scenarios`);
    for (let i = 0; i < params.suites.length; i++) {
      lines.push(``);
      const suite = params.suites[i];
      lines.push(`### ${i + 1}. ${suite.name}`);
      lines.push(``);
      lines.push(`**Seed:** \`${suite.seedFile}\``);
      for (let j = 0; j < suite.tests.length; j++) {
        lines.push(``);
        const test = suite.tests[j];
        lines.push(`#### ${i + 1}.${j + 1}. ${test.name}`);
        lines.push(``);
        lines.push(`**File:** \`${test.file}\``);
        lines.push(``);
        lines.push(`**Steps:**`);
        for (let k = 0; k < test.steps.length; k++) {
          lines.push(`  ${k + 1}. ${test.steps[k].perform ?? '-'}`);
          for (const expect of test.steps[k].expect)
            lines.push(`    - expect: ${expect}`);
        }
      }
    }
    lines.push(``);
    await fs.promises.writeFile(path.resolve(context.rootPath, params.fileName), lines.join('\n'));
    return {
      content: [{
        type: 'text',
        text: `Test plan saved to ${params.fileName}`,
      }],
    };
  },
});
