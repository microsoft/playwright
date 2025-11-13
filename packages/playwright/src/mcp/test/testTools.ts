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

import { z } from '../sdk/bundle';
import ListModeReporter from '../../reporters/listModeReporter';
import { defineTestTool } from './testTool';
import { createScreen } from './testContext';

export const listTests = defineTestTool({
  schema: {
    name: 'test_list',
    title: 'List tests',
    description: 'List tests',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (context, _, progress) => {
    const { screen } = createScreen(progress);
    const reporter = new ListModeReporter({ screen, includeTestId: true });
    const testRunner = await context.createTestRunner();
    await testRunner.listTests(reporter, {});

    return { content: [] };
  },
});

export const runTests = defineTestTool({
  schema: {
    name: 'test_run',
    title: 'Run tests',
    description: 'Run tests',
    inputSchema: z.object({
      locations: z.array(z.string()).optional().describe('Folder, file or location to run: "test/e2e" or "test/e2e/file.spec.ts" or "test/e2e/file.spec.ts:20"'),
      projects: z.array(z.string()).optional().describe('Projects to run, projects from playwright.config.ts, by default runs all projects. Running with "chromium" is a good start'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, progress) => {
    await context.runWithGlobalSetup(async (testRunner, reporter) => {
      await testRunner.runTests(reporter, {
        locations: params.locations,
        projects: params.projects,
        disableConfigReporters: true,
      });
    }, progress);

    return { content: [] };
  },
});

export const debugTest = defineTestTool({
  schema: {
    name: 'test_debug',
    title: 'Debug single test',
    description: 'Debug single test',
    inputSchema: z.object({
      test: z.object({
        id: z.string().describe('Test ID to debug.'),
        title: z.string().describe('Human readable test title for granting permission to debug the test.'),
      }),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, progress) => {
    await context.runWithGlobalSetup(async (testRunner, reporter) => {
      await testRunner.runTests(reporter, {
        headed: context.computedHeaded,
        testIds: [params.test.id],
        // For automatic recovery
        timeout: 0,
        workers: 1,
        pauseOnError: true,
        disableConfigReporters: true,
        actionTimeout: 5000,
      });
    }, progress);

    return { content: [] };
  },
});
