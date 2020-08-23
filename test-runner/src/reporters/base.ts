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
  pending: Test[] = [];
  passes: Test[] = [];
  failures: Test[] = [];
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

  onPending(test: Test) {
    this.pending.push(test);
  }

  onPass(test: Test) {
    this.passes.push(test);
  }

  onFail(test: Test) {
    this.failures.push(test);
  }

  onEnd() {
    this.duration = Date.now() - this.startTime;
  }

  epilogue() {
    console.log('');

    console.log(colors.green(`  ${this.passes.length} passing`) + colors.dim(` (${milliseconds(this.duration)})`));  

    if (this.pending.length)
      console.log(colors.yellow(`  ${this.pending.length} skipped`));

    if (this.failures.length) {  
      console.log(colors.red(`  ${this.failures.length} failing`));
      console.log('');
      this.failures.forEach((failure, index) => {
        const relativePath = path.relative(process.cwd(), failure.file);
        const header = `  ${index +1}. ${terminalLink(relativePath, `file://${os.hostname()}${failure.file}`)} › ${failure.title}`;
        console.log(colors.bold(colors.red(header)));
        const stack = failure.error.stack;
        if (stack) {
          console.log('');
          const messageLocation = failure.error.stack.indexOf(failure.error.message);
          const preamble = failure.error.stack.substring(0, messageLocation + failure.error.message.length);
          console.log(indent(preamble, '    '));
          const position = positionInFile(stack, failure.file);
          if (position) {
            const source = fs.readFileSync(failure.file, 'utf8');
            console.log('');
            console.log(indent(codeFrameColumns(source, {
                start: position,
              },
              { highlightCode: true}
            ), '    '));
          }
          console.log('');
          console.log(indent(colors.dim(stack.substring(preamble.length + 1)), '    '));
        } else {
          console.log('');
          console.log(indent(String(failure.error), '    '));
        }
        console.log('');
      });
    }
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
