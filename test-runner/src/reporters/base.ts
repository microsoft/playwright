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
import { Suite, Test, TestResult } from '../test';

const stackUtils = new StackUtils();

export class BaseReporter implements Reporter  {
  skipped: Test[] = [];
  passed: Test[] = [];
  flaky: Test[] = [];
  failed: Test[] = [];
  timedOut: Test[] = [];
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

  onTestBegin(test: Test) {
  }

  onTestStdOut(test: Test, chunk: string | Buffer) {
    if (!this.config.quiet)
      process.stdout.write(chunk);
  }

  onTestStdErr(test: Test, chunk: string | Buffer) {
    if (!this.config.quiet)
      process.stderr.write(chunk);
  }

  onTestEnd(test: Test, result: TestResult) {
    switch (result.status) {
      case 'skipped': {
        this.skipped.push(test);
        return;
      }
      case 'passed':
        if (test.results.length === 1)
          this.passed.push(test);
        else
          this.flaky.push(test);
        return;
      case 'failed':
        // Fall through.
      case 'timedOut': {
        if (test.results.length === this.config.retries + 1) {
          if (result.status === 'timedOut')
            this.timedOut.push(test);
          else
            this.failed.push(test);
        }
        return;
      }
    }
  }

  onEnd() {
    this.duration = Date.now() - this.startTime;
  }

  epilogue() {
    console.log('');

    console.log(colors.green(`  ${this.passed.length} passed`) + colors.dim(` (${milliseconds(this.duration)})`));

    if (this.skipped.length)
      console.log(colors.yellow(`  ${this.skipped.length} skipped`));

    if (this.failed.length) {
      console.log(colors.red(`  ${this.failed.length} failed`));
      console.log('');
      this._printFailures(this.failed);
    }

    if (this.flaky.length) {
      console.log(colors.red(`  ${this.flaky.length} flaky`));
      console.log('');
      this._printFailures(this.flaky);
    }

    if (this.timedOut.length) {
      console.log(colors.red(`  ${this.timedOut.length} timed out`));
      console.log('');
      this._printFailures(this.timedOut);
    }
  }

  private _printFailures(failures: Test[]) {
    failures.forEach((test, index) => {
      console.log(this.formatFailure(test, index + 1));
    });
  }

  formatFailure(test: Test, index?: number): string {
    const tokens: string[] = [];
    const relativePath = path.relative(process.cwd(), test.file);
    const header = `  ${index ? index + ')' : ''} ${terminalLink(relativePath, `file://${os.hostname()}${test.file}`)} › ${test.title}`;
    tokens.push(colors.bold(colors.red(header)));
    for (const result of test.results) {
      if (result.status === 'passed')
        continue;
      if (result.status === 'timedOut') {
        tokens.push('');
        tokens.push(indent(colors.red(`Timeout of ${test.timeout}ms exceeded.`), '    '));
      } else {
        const stack = result.error.stack;
        if (stack) {
          tokens.push('');
          const messageLocation = result.error.stack.indexOf(result.error.message);
          const preamble = result.error.stack.substring(0, messageLocation + result.error.message.length);
          tokens.push(indent(preamble, '    '));
          const position = positionInFile(stack, test.file);
          if (position) {
            const source = fs.readFileSync(test.file, 'utf8');
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
          tokens.push(indent(String(result.error), '    '));
        }
      }
      break;
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
