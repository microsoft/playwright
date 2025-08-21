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

import { defineTool } from './tool';
import { StringWriteStream } from './streams';

export const runTests = defineTool({
  schema: {
    name: 'playwright_test_run_tests',
    title: 'Run tests',
    description: 'Run tests',
    inputSchema: z.object({
      tests: z.array(z.object({
        id: z.string().describe('Test ID to run.'),
        title: z.string().describe('Human readable test title for granting permission to run the test.'),
      })).optional().describe('Tests to run. All tests are run if not provided.'),
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
    const result = await testRunner.runTests(reporter, {
      testIds: params.tests?.map(test => test.id),
      // For automatic recovery
      timeout: 0,
      workers: 1,
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
