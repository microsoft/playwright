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
import milliseconds from 'ms';
import { codeFrameColumns } from '@babel/code-frame';
import path from 'path';
import fs from 'fs';
import os from 'os';
import terminalLink from 'terminal-link';
import StackUtils from 'stack-utils';
import { Test, Suite } from './test';
import { EventEmitter } from 'ws';
import { RunnerConfig } from './runnerConfig';

const stackUtils = new StackUtils();

class BaseReporter {
  pending: Test[] = [];
  passes: Test[] = [];
  failures: Test[] = [];
  duration = 0;
  startTime: number;
  config: RunnerConfig;
  suite: Suite;

  constructor(runner: EventEmitter) {
    process.on('SIGINT', async () => {
      this.epilogue();
      process.exit(130);
    });

    runner.on('pending', (test: Test) => {
      this.pending.push(test);
    });

    runner.on('pass', (test: Test) => {
      this.passes.push(test);
    });

    runner.on('fail', (test: Test) => {
      this.failures.push(test);
    });

    runner.once('begin', (options: { config: RunnerConfig, suite: Suite }) => {
      this.startTime = Date.now();
      this.config = options.config;
      this.suite = options.suite;
    });

    runner.once('end', () => {
      this.duration = Date.now() - this.startTime;
    });
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

export class DotReporter extends BaseReporter {
  constructor(runner: EventEmitter) {
    super(runner);

    runner.on('pending', () => {
      process.stdout.write(colors.yellow('∘'))
    });

    runner.on('pass', () => {
      process.stdout.write(colors.green('\u00B7'));
    });

    runner.on('fail', (test: Test) => {
      if (test.duration >= test.timeout)
        process.stdout.write(colors.red('T'));
      else
        process.stdout.write(colors.red('F'));
    });

    runner.once('end', () => {
      process.stdout.write('\n');
      this.epilogue();
    });
  }
}

export class ListReporter extends BaseReporter {
  constructor(runner: EventEmitter) {
    super(runner);

    runner.on('begin', () => {
      console.log();
    });

    runner.on('test', test => {
      process.stdout.write('    ' + colors.gray(test.fullTitle() + ': '));
    });

    runner.on('pending', test => {
      process.stdout.write(colors.green('  - ') + colors.cyan(test.fullTitle()));
      process.stdout.write('\n');
    });

    runner.on('pass', test => {
      process.stdout.write('\u001b[2K\u001b[0G');
      process.stdout.write(colors.green('  ✓ ') + colors.gray(test.fullTitle()));
      process.stdout.write('\n');
    });

    let failure = 0;
    runner.on('fail', (test: Test) => {
      process.stdout.write('\u001b[2K\u001b[0G');
      process.stdout.write(colors.red(`  ${++failure}) ` + test.fullTitle()));
      process.stdout.write('\n');
    });

    runner.once('end', () => {
      process.stdout.write('\n');
      this.epilogue();
    });
  }
}

export class JSONReporter extends BaseReporter {
  constructor(runner: EventEmitter) {
    super(runner);

    runner.once('end', () => {
      const result = {
        config: this.config,
        tests: this.suite.tests.map(test => this._serializeTest(test)),
        suites: this.suite.suites.map(suite => this._serializeSuite(suite))
      };
      console.log(JSON.stringify(result, undefined, 2));
    });
  }

  private _serializeSuite(suite: Suite): any {
    return {
      title: suite.title,
      file: suite.file,
      configuration: suite.configuration,
      tests: suite.tests.map(test => this._serializeTest(test)),
      suites: suite.suites.map(suite => this._serializeSuite(suite))
    };
  }

  private _serializeTest(test: Test): any {
    return {
      title: test.title,
      file: test.file,
      only: test.only,
      pending: test.pending,
      slow: test.slow,
      duration: test.duration,
      timeout: test.timeout,
      error: test.error
    };
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

export const reporters = {
  'dot': DotReporter,
  'list': ListReporter,
  'json': JSONReporter
};
