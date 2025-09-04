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

import { noColors } from 'playwright-core/lib/utils';

import { z } from '../sdk/bundle';
import { terminalScreen } from '../../reporters/base';
import ListReporter from '../../reporters/list';
import ListModeReporter from '../../reporters/listModeReporter';

import { defineTestTool } from './testTool';
import { StringWriteStream } from './streams';

export const listTests = defineTestTool({
  schema: {
    name: 'playwright_test_list_tests',
    title: 'List tests',
    description: 'List tests',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async context => {
    const { screen, stream } = createScreen();
    const reporter = new ListModeReporter({ screen, includeTestId: true });
    const testRunner = await context.createTestRunner();
    await testRunner.listTests(reporter, {});

    return {
      content: [{ type: 'text', text: stream.content() }],
    };
  },
});

export const runTests = defineTestTool({
  schema: {
    name: 'playwright_test_run_tests',
    title: 'Run tests',
    description: 'Run tests',
    inputSchema: z.object({
      locations: z.array(z.string()).describe('Folder, file or location to run: "test/e2e" or "test/e2e/file.spec.ts" or "test/e2e/file.spec.ts:20"'),
      projects: z.array(z.string()).optional().describe('Projects to run, projects from playwright.config.ts, by default runs all projects. Running with "chromium" is a good start'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const { screen, stream } = createScreen();
    const configDir = context.configLocation.configDir;
    const reporter = new ListReporter({ configDir, screen, includeTestId: true });
    const testRunner = await context.createTestRunner();
    const result = await testRunner.runTests(reporter, {
      locations: params.locations,
      projects: params.projects,
    });

    const text = stream.content();
    return {
      content: [
        { type: 'text', text },
      ],
      isError: result.status !== 'passed',
    };
  },
});

export const debugTest = defineTestTool({
  schema: {
    name: 'playwright_test_debug_test',
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

  handle: async (context, params) => {
    const stream = new StringWriteStream();
    const screen = {
      ...terminalScreen,
      isTTY: false,
      colors: noColors,
      stdout: stream as unknown as NodeJS.WriteStream,
      stderr: stream as unknown as NodeJS.WriteStream,
    };
    const configDir = context.configLocation.configDir;
    const reporter = new ListReporter({ configDir, screen });
    const testRunner = await context.createTestRunner();
    process.env.PLAYWRIGHT_DEBUGGER_ENABLED = '1';
    const result = await testRunner.runTests(reporter, {
      headed: true,
      testIds: [params.test.id],
      // For automatic recovery
      timeout: 0,
      workers: 1,
    }).finally(() => {
      process.env.PLAYWRIGHT_DEBUGGER_ENABLED = undefined;
    });

    const text = stream.content();
    return {
      content: [
        { type: 'text', text },
      ],
      isError: result.status !== 'passed',
    };
  },
});

function createScreen() {
  const stream = new StringWriteStream();
  const screen = {
    ...terminalScreen,
    isTTY: false,
    colors: noColors,
    stdout: stream as unknown as NodeJS.WriteStream,
    stderr: stream as unknown as NodeJS.WriteStream,
  };
  return { screen, stream };
}
