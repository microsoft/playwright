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

import colors from 'colors/safe';
import * as path from 'path';
import { BaseReporter, formatFailure } from './base';
import { FullConfig, Test, Suite, TestResult } from '../types';

class LineReporter extends BaseReporter {
  private _total: number;
  private _current = 0;
  private _failures = 0;
  private _lastTest: Test;

  onBegin(config: FullConfig, suite: Suite) {
    super.onBegin(config, suite);
    this._total = suite.totalTestCount();
    console.log();
  }

  onStdOut(chunk: string | Buffer, test?: Test) {
    this._dumpToStdio(test, chunk, process.stdout);
  }

  onStdErr(chunk: string | Buffer, test?: Test) {
    this._dumpToStdio(test, chunk, process.stderr);
  }

  private _fullTitle(test: Test) {
    const baseName = path.basename(test.spec.file);
    const runListName = test.alias ? `[${test.alias}] ` : '';
    return `${baseName} - ${runListName}${test.spec.fullTitle()}`;
  }

  private _dumpToStdio(test: Test | undefined, chunk: string | Buffer, stream: NodeJS.WriteStream) {
    if (this.config.quiet)
      return;
    stream.write(`\u001B[1A\u001B[2K`);
    if (test && this._lastTest !== test) {
      // Write new header for the output.
      stream.write(colors.gray(this._fullTitle(test) + `\n`));
      this._lastTest = test;
    }

    stream.write(chunk);
    console.log();
  }

  onTestEnd(test: Test, result: TestResult) {
    super.onTestEnd(test, result);
    const width = process.stdout.columns - 1;
    const title = `[${++this._current}/${this._total}] ${this._fullTitle(test)}`.substring(0, width);
    process.stdout.write(`\u001B[1A\u001B[2K${title}\n`);
    if (!this.willRetry(test, result) && !test.ok()) {
      process.stdout.write(`\u001B[1A\u001B[2K`);
      console.log(formatFailure(this.config, test, ++this._failures));
      console.log();
    }
  }

  onEnd() {
    process.stdout.write(`\u001B[1A\u001B[2K`);
    super.onEnd();
    this.epilogue(false);
  }
}

export default LineReporter;
