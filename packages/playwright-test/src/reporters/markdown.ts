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
import type { FullResult, TestCase } from '../../types/testReporter';
import { BaseReporter, formatTestTitle } from './base';

type MarkdownReporterOptions = {
  configDir: string,
  outputFile?: string;
};


class MarkdownReporter extends BaseReporter {
  private _options: MarkdownReporterOptions;

  constructor(options: MarkdownReporterOptions) {
    super();
    this._options = options;
  }

  printsToStdio() {
    return false;
  }

  override async onEnd(result: FullResult) {
    await super.onEnd(result);
    const summary = this.generateSummary();
    const lines: string[] = [];
    lines.push(`:x: <b>failed: ${summary.unexpected.length}</b>`);
    this._printTestList(summary.unexpected, lines);
    if (summary.flaky.length) {
      lines.push(`:warning: <b>flaky: ${summary.flaky.length}</b>`);
      this._printTestList(summary.flaky, lines);
    }
    if (summary.interrupted.length) {
      lines.push(`:warning: <b>interrupted: ${summary.interrupted.length}</b>`);
      this._printTestList(summary.interrupted, lines);
    }
    if (summary.skipped) {
      lines.push(`:ballot_box_with_check: <b>skipped: ${summary.skipped}</b>`);
      lines.push(``);
    }
    lines.push(`:white_check_mark: <b>passed: ${summary.expected}</b>`);
    lines.push(``);

    const reportFile = path.resolve(this._options.configDir, this._options.outputFile || 'report.md');
    await fs.promises.mkdir(path.dirname(reportFile), { recursive: true });
    await fs.promises.writeFile(reportFile, lines.join('\n'));
  }

  private _printTestList(tests: TestCase[], lines: string[]) {
    for (const test of tests)
      lines.push(` - ${formatTestTitle(this.config, test)}`);
    lines.push(``);
  }
}


export default MarkdownReporter;

