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
import { BaseReporter, formatError, formatTestTitle, stripAnsiEscapes } from './base';

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

  override printsToStdio() {
    return false;
  }

  override async onEnd(result: FullResult) {
    await super.onEnd(result);
    const summary = this.generateSummary();
    const lines: string[] = [];
    if (summary.unexpected.length) {
      lines.push(`**${summary.unexpected.length} failed**`);
      this._printTestList(':x:', summary.unexpected, lines);
    }
    if (summary.flaky.length) {
      lines.push(`**${summary.flaky.length} flaky**`);
      this._printTestList(':warning:', summary.flaky, lines);
    }
    if (summary.interrupted.length) {
      lines.push(`**${summary.interrupted.length} interrupted**`);
      this._printTestList(':warning:', summary.interrupted, lines);
    }
    const skipped = summary.skipped ? `, ${summary.skipped} skipped` : '';
    lines.push(`**${summary.expected} passed${skipped}**`);
    lines.push(`:heavy_check_mark::heavy_check_mark::heavy_check_mark:`);
    lines.push(``);

    if (summary.unexpected.length || summary.flaky.length) {
      lines.push(`<details>`);
      lines.push(``);
      if (summary.unexpected.length)
        this._printTestListDetails(':x:', summary.unexpected, lines);
      if (summary.flaky.length)
        this._printTestListDetails(':warning:', summary.flaky, lines);
      lines.push(`</details>`);
    }

    const reportFile = path.resolve(this._options.configDir, this._options.outputFile || 'report.md');
    await fs.promises.mkdir(path.dirname(reportFile), { recursive: true });
    await fs.promises.writeFile(reportFile, lines.join('\n'));
  }

  private _printTestList(prefix: string, tests: TestCase[], lines: string[]) {
    for (const test of tests)
      lines.push(`${prefix} ${formatTestTitle(this.config, test)}`);
    lines.push(``);
  }

  private _printTestListDetails(prefix: string, tests: TestCase[], lines: string[]) {
    for (const test of tests)
      this._printTestDetails(prefix, test, lines);
  }

  private _printTestDetails(prefix: string, test: TestCase, lines: string[]) {
    lines.push(`${prefix} <b> ${formatTestTitle(this.config, test)} </b>`);
    let retry = 0;
    for (const result of test.results) {
      if (result.status === 'passed')
        break;
      if (retry)
        lines.push(`<b>Retry ${retry}:</b>`);
      retry++;
      if (result.error?.snippet) {
        lines.push(``);
        lines.push('```');
        lines.push(stripAnsiEscapes(formatError(result.error, false).message));
        lines.push('```');
        lines.push(``);
      }
    }
    lines.push(``);
  }
}


export default MarkdownReporter;

