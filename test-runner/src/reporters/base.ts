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

import { codeFrameColumns } from '@babel/code-frame';
import colors from 'colors/safe';
import fs from 'fs';
import milliseconds from 'ms';
import os from 'os';
import path from 'path';
import StackUtils from 'stack-utils';
import terminalLink from 'terminal-link';
import { Reporter } from '../reporter';
import { RunnerConfig } from '../runnerConfig';
import { Suite, Test } from '../test';

const stackUtils = new StackUtils()

export class BaseReporter implements Reporter  {
  skipped: Test[] = [];
  passes: Test[] = [];
  failures: Test[] = [];
  timeouts: Test[] = [];
  duration = 0;
  startTime: number;
  config: RunnerConfig;
  suite: Suite;

  constructor() {
    process.on('SIGINT', async () => {
      this.epilogue();
      process.exit(130);
    });
  }

  onBegin(config: RunnerConfig, suite: Suite) {
    this.startTime = Date.now();
    this.config = config;
    this.suite = suite;
  }

  onTest(test: Test) {
  }

  onSkippedTest(test: Test) {
    this.skipped.push(test);
  }

  onTestStdOut(test: Test, chunk: string | Buffer) {
    if (!this.config.quiet)
      process.stdout.write(chunk);
  }

  onTestStdErr(test: Test, chunk: string | Buffer) {
    if (!this.config.quiet)
      process.stderr.write(chunk);
  }

  onTestPassed(test: Test) {
    this.passes.push(test);
  }

  onTestFailed(test: Test) {
    if (test.duration >= test.timeout)
      this.timeouts.push(test);
    else
      this.failures.push(test);
  }

  onEnd() {
    this.duration = Date.now() - this.startTime;
  }

  epilogue() {
    console.log('');

    console.log(colors.green(`  ${this.passes.length} passed`) + colors.dim(` (${milliseconds(this.duration)})`));  

    if (this.skipped.length)
      console.log(colors.yellow(`  ${this.skipped.length} skipped`));

    if (this.failures.length) {
      console.log(colors.red(`  ${this.failures.length} failed`));
      console.log('');
      this._printFailures(this.failures);
    }

    if (this.timeouts.length) {
      console.log(colors.red(`  ${this.timeouts.length} timed out`));
      console.log('');
      this._printFailures(this.timeouts);
    }
  }

  private _printFailures(failures: Test[]) {
    failures.forEach((failure, index) => {
      console.log(this.formatFailure(failure, index + 1));
    });
  }

  formatFailure(failure: Test, index?: number): string {
    const tokens: string[] = [];
    const relativePath = path.relative(process.cwd(), failure.file);
    const header = `  ${index ? index + ')' : ''} ${terminalLink(relativePath, `file://${os.hostname()}${failure.file}`)} › ${failure.title}`;
    tokens.push(colors.bold(colors.red(header)));
    const stack = failure.error.stack;
    if (stack) {
      tokens.push('');
      const messageLocation = failure.error.stack.indexOf(failure.error.message);
      const preamble = failure.error.stack.substring(0, messageLocation + failure.error.message.length);
      tokens.push(indent(preamble, '    '));
      const position = positionInFile(stack, failure.file);
      if (position) {
        const source = fs.readFileSync(failure.file, 'utf8');
        tokens.push('');
        tokens.push(indent(codeFrameColumns(source, {
            start: position,
          },
          { highlightCode: true}
        ), '    '));
      }
      tokens.push('');
      tokens.push(indent(colors.dim(stack.substring(preamble.length + 1)), '    '));
    } else {
      tokens.push('');
      tokens.push(indent(String(failure.error), '    '));
    }
    tokens.push('');
    return tokens.join('\n');
  }
}

function indent(lines: string, tab: string) {
  return lines.replace(/^/gm, tab);
}

function positionInFile(stack: string, file: string): { column: number; line: number; } {
  for (const line of stack.split('\n')) {
    const parsed = stackUtils.parseLine(line);
    if (!parsed)
      continue;
    if (path.resolve(process.cwd(), parsed.file) === file)
      return {column: parsed.column, line: parsed.line};
  }
  return null;
}
