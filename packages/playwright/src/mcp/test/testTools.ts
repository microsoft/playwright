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

import { noColors, escapeRegExp } from 'playwright-core/lib/utils';

import { z } from '../sdk/bundle';
import { terminalScreen } from '../../reporters/base';
import ListReporter from '../../reporters/list';
import ListModeReporter from '../../reporters/listModeReporter';
import { findTopLevelProjects } from '../../runner/projectUtils';

import { defineTestTool } from './testTool';
import { StringWriteStream } from './streams';
import { fileExistsAsync } from '../../util';

import type { ProgressCallback } from '../sdk/server';

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
    const { screen } = createScreen(progress);
    const configDir = context.configLocation.configDir;
    const reporter = new ListReporter({ configDir, screen, includeTestId: true, prefixStdio: 'out' });
    const testRunner = await context.createTestRunner();
    await testRunner.runTests(reporter, {
      locations: params.locations,
      projects: params.projects,
      disableConfigReporters: true,
    });

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
    const { screen } = createScreen(progress);
    const configDir = context.configLocation.configDir;
    const reporter = new ListReporter({ configDir, screen, includeTestId: true, prefixStdio: 'out' });
    const testRunner = await context.createTestRunner();
    await testRunner.runTests(reporter, {
      headed: !context.options?.headless,
      testIds: [params.test.id],
      // For automatic recovery
      timeout: 0,
      workers: 1,
      pauseOnError: true,
      disableConfigReporters: true,
    });

    return { content: [] };
  },
});

export const setupPage = defineTestTool({
  schema: {
    name: 'test_setup_page',
    title: 'Setup page',
    description: 'Setup the page for test.',
    inputSchema: z.object({
      project: z.string().optional().describe('Project to use for setup. For example: "chromium", if no project is provided uses the first project in the config.'),
      seedFile: z.string().optional().describe('A seed file contains a single test that is used to setup the page for testing, for example: "tests/seed.spec.ts". If no seed file is provided, a default seed file is created.'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, progress) => {
    const { screen } = createScreen(progress);
    const configDir = context.configLocation.configDir;
    const reporter = new ListReporter({ configDir, screen });
    const testRunner = await context.createTestRunner();
    const config = await testRunner.loadConfig();
    const project = params.project ? config.projects.find(p => p.project.name === params.project) : findTopLevelProjects(config)[0];
    const testDir = project?.project.testDir || configDir;

    let seedFile: string | undefined;
    if (!params.seedFile) {
      seedFile = path.resolve(testDir, 'seed.spec.ts');
      await fs.promises.mkdir(path.dirname(seedFile), { recursive: true });
      await fs.promises.writeFile(seedFile, `import { test, expect } from '@playwright/test';

test.describe('Test group', () => {
  test('seed', async ({ page }) => {
    // generate code here.
  });
});
`);
    } else {
      const candidateFiles: string[] = [];
      candidateFiles.push(path.resolve(testDir, params.seedFile));
      candidateFiles.push(path.resolve(configDir, params.seedFile));
      candidateFiles.push(path.resolve(context.rootPath, params.seedFile));
      for (const candidateFile of candidateFiles) {
        if (await fileExistsAsync(candidateFile)) {
          seedFile = candidateFile;
          break;
        }
      }
      if (!seedFile)
        throw new Error('seed test not found.');
    }


    const seedFileContent = await fs.promises.readFile(seedFile, 'utf8');
    progress({ message: `### Seed test
File: ${path.relative(context.rootPath, seedFile)}
\`\`\`ts
${seedFileContent}
\`\`\`
` });

    const result = await testRunner.runTests(reporter, {
      headed: !context.options?.headless,
      locations: ['/' + escapeRegExp(seedFile) + '/'],
      projects: params.project ? [params.project] : undefined,
      timeout: 0,
      workers: 1,
      pauseAtEnd: true,
      disableConfigReporters: true,
      failOnLoadErrors: true,
    });

    // Ideally, we should check that page was indeed created and browser mcp has kicked in.
    // However, that is handled in the upper layer, so hard to check here.
    if (result.status === 'passed' && !reporter.suite?.allTests().length)
      throw new Error('seed test not found.');

    if (result.status !== 'passed')
      throw new Error('Errors while running the seed test.');

    return { content: [] };
  },
});

function createScreen(progress: ProgressCallback) {
  const stream = new StringWriteStream(progress);
  const screen = {
    ...terminalScreen,
    isTTY: false,
    colors: noColors,
    stdout: stream as unknown as NodeJS.WriteStream,
    stderr: stream as unknown as NodeJS.WriteStream,
  };
  return { screen, stream };
}
