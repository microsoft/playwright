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

import path from 'path';
import { z } from 'zod';
import { defineTool } from '../tool.js';

import type * as reporterTypes from 'playwright/types/testReporter';

export const listTests = defineTool({
  schema: {
    name: 'playwright_test_list_tests',
    title: 'List tests',
    description: 'List tests',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const reporter = new ListModeReporter();
    await context.testRunner.listTests(reporter, {});

    if (reporter.hasErrors())
      throw new Error(reporter.content());

    return {
      content: [{ type: 'text', text: reporter.content() }],
    };
  },
});

class ListModeReporter implements reporterTypes.Reporter {
  private _lines: string[] = [];
  private _hasErrors = false;

  onBegin(config: reporterTypes.FullConfig, suite: reporterTypes.Suite): void {
    this._lines.push(`Listing tests:`);
    const tests = suite.allTests();
    const files = new Set<string>();
    for (const test of tests) {
      // root, project, file, ...describes, test
      const [, projectName, , ...titles] = test.titlePath();
      const location = `${path.relative(config.rootDir, test.location.file)}:${test.location.line}:${test.location.column}`;
      const projectTitle = projectName ? `[${projectName}] › ` : '';
      this._lines.push(`  [id=${test.id}] ${projectTitle}${location} › ${titles.join(' › ')}`);
      files.add(test.location.file);
    }
    this._lines.push(`Total: ${tests.length} ${tests.length === 1 ? 'test' : 'tests'} in ${files.size} ${files.size === 1 ? 'file' : 'files'}`);
  }

  onError(error: reporterTypes.TestError) {
    this._hasErrors = true;
    this._lines.push(error.stack || error.message || error.value || '');
  }

  hasErrors(): boolean {
    return this._hasErrors;
  }

  content(): string {
    return this._lines.join('\n');
  }
}
