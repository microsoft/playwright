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
import { resolveReporterOutputPath } from '../util';
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
    if (summary.fatalErrors.length)
      lines.push(`**${summary.fatalErrors.length} fatal errors, not part of any test**`);
    if (summary.unexpected.length) {
      lines.push(`**${summary.unexpected.length} failed**`);
      this._printTestList(':x:', summary.unexpected, lines);
    }
    if (summary.flaky.length) {
      lines.push(`<details>`);
      lines.push(`<summary><b>${summary.flaky.length} flaky</b></summary>`);
      this._printTestList(':warning:', summary.flaky, lines, ' <br/>');
      lines.push(`</details>`);
      lines.push(``);
    }
    if (summary.interrupted.length) {
      lines.push(`<details>`);
      lines.push(`<summary><b>${summary.interrupted.length} interrupted</b></summary>`);
      this._printTestList(':warning:', summary.interrupted, lines, ' <br/>');
      lines.push(`</details>`);
      lines.push(``);
    }
    const skipped = summary.skipped ? `, ${summary.skipped} skipped` : '';
    const didNotRun = summary.didNotRun ? `, ${summary.didNotRun} did not run` : '';
    lines.push(`**${summary.expected} passed${skipped}${didNotRun}**`);
    lines.push(`:heavy_check_mark::heavy_check_mark::heavy_check_mark:`);
    lines.push(``);

    const reportFile = resolveReporterOutputPath('report.md', this._options.configDir, this._options.outputFile);
    await fs.promises.mkdir(path.dirname(reportFile), { recursive: true });
    await fs.promises.writeFile(reportFile, lines.join('\n'));
  }

  private _printTestList(prefix: string, tests: TestCase[], lines: string[], suffix?: string) {
    for (const test of tests)
      lines.push(`${prefix} ${formatTestTitle(this.config, test)}${suffix || ''}`);
    lines.push(``);
  }
}

export default MarkdownReporter;
