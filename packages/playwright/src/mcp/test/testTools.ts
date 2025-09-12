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

import { noColors } from 'playwright-core/lib/utils';

import { z } from '../sdk/bundle';
import { terminalScreen } from '../../reporters/base';
import ListReporter from '../../reporters/list';
import ListModeReporter from '../../reporters/listModeReporter';

import { defineTestTool } from './testTool';
import { StringWriteStream } from './streams';

export const listTests = defineTestTool({
  schema: {
    name: 'test_list',
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
    name: 'test_run',
    title: 'Run tests',
    description: 'Run tests',
    inputSchema: z.object({
      locations: z.array(z.string()).optional().describe('Folder, file or location to run: "test/e2e" or "test/e2e/file.spec.ts" or "test/e2e/file.spec.ts:20"'),
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

  handle: async (context, params) => {
    const { screen, stream } = createScreen();
    const configDir = context.configLocation.configDir;
    const reporter = new ListReporter({ configDir, screen });
    const testRunner = await context.createTestRunner();
    const result = await testRunner.runTests(reporter, {
      headed: !context.options?.headless,
      testIds: [params.test.id],
      // For automatic recovery
      timeout: 0,
      workers: 1,
      pauseOnError: true,
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

export const setupPage = defineTestTool({
  schema: {
    name: 'test_setup_page',
    title: 'Setup page',
    description: 'Setup the page for test',
    inputSchema: z.object({
      project: z.string().optional().describe('Project to use for setup. For example: "chromium", if no project is provided uses the first project in the config.'),
      testLocation: z.string().optional().describe('Location of the test to use for setup. For example: "test/e2e/file.spec.ts:20". Sets up blank page if no location is provided.'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const { screen, stream } = createScreen();
    const configDir = context.configLocation.configDir;
    const reporter = new ListReporter({ configDir, screen });
    const testRunner = await context.createTestRunner();

    let testLocation = params.testLocation;
    if (!testLocation) {
      testLocation = '.template.spec.ts';
      const templateFile = path.join(configDir, testLocation);
      if (!fs.existsSync(templateFile)) {
        await fs.promises.writeFile(templateFile, `
          import { test, expect } from '@playwright/test';
            test('template', async ({ page }) => {});
          `);
      }
    }

    const result = await testRunner.runTests(reporter, {
      headed: !context.options?.headless,
      locations: [testLocation],
      projects: params.project ? [params.project] : undefined,
      timeout: 0,
      workers: 1,
      pauseAtEnd: true,
    });

    const text = stream.content();
    return {
      content: [{ type: 'text', text }],
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
