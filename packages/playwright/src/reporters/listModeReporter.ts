/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import path from 'path';

import { formatError, terminalScreen } from './base';

import type { FullConfig, TestError } from '../../types/testReporter';
import type { Suite } from '../common/test';
import type { TerminalScreen } from './base';
import type { ReporterV2 } from './reporterV2';

class ListModeReporter implements ReporterV2 {
  private config!: FullConfig;
  private screen: TerminalScreen;

  constructor(options?: { screen?: TerminalScreen }) {
    this.screen = options?.screen ?? terminalScreen;
  }

  version(): 'v2' {
    return 'v2';
  }

  onConfigure(config: FullConfig) {
    this.config = config;
  }

  onBegin(suite: Suite): void {
    this._writeLine(`Listing tests:`);
    const tests = suite.allTests();
    const files = new Set<string>();
    for (const test of tests) {
      // root, project, file, ...describes, test
      const [, projectName, , ...titles] = test.titlePath();
      const location = `${path.relative(this.config.rootDir, test.location.file)}:${test.location.line}:${test.location.column}`;
      const projectTitle = projectName ? `[${projectName}] › ` : '';
      this._writeLine(`  ${projectTitle}${location} › ${titles.join(' › ')}`);
      files.add(test.location.file);
    }
    this._writeLine(`Total: ${tests.length} ${tests.length === 1 ? 'test' : 'tests'} in ${files.size} ${files.size === 1 ? 'file' : 'files'}`);
  }

  onError(error: TestError) {
    this.screen.stderr.write('\n' + formatError(terminalScreen, error).message + '\n');
  }

  private _writeLine(line: string) {
    this.screen.stdout.write(line + '\n');
  }
}

export default ListModeReporter;
