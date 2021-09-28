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
// @ts-ignore
import milliseconds from 'ms';
import path from 'path';
import StackUtils from 'stack-utils';
import { FullConfig, TestCase, Suite, TestResult, TestError, Reporter, FullResult, TestStep } from '../../../types/testReporter';

const stackUtils = new StackUtils();

export type TestResultOutput = { chunk: string | Buffer, type: 'stdout' | 'stderr' };
export const kOutputSymbol = Symbol('output');
export interface Position {
  column: number;
  line: number;
}
export class BaseReporter implements Reporter  {
  duration = 0;
  config!: FullConfig;
  suite!: Suite;
  result!: FullResult;
  fileDurations = new Map<string, number>();
  monotonicStartTime: number = 0;
  private printTestOutput = !process.env.PWTEST_SKIP_TEST_OUTPUT;

  onBegin(config: FullConfig, suite: Suite) {
    this.monotonicStartTime = monotonicTime();
    this.config = config;
    this.suite = suite;
  }

  onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    this._appendOutput({ chunk, type: 'stdout' }, result);
  }

  onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    this._appendOutput({ chunk, type: 'stderr' }, result);
  }

  private _appendOutput(output: TestResultOutput, result: TestResult | undefined) {
    if (!result)
      return;
    (result as any)[kOutputSymbol] = (result as any)[kOutputSymbol] || [];
    (result as any)[kOutputSymbol].push(output);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const projectName = test.titlePath()[1];
    const relativePath = relativeTestPath(this.config, test);
    const fileAndProject = (projectName ? `[${projectName}] › ` : '') + relativePath;
    const duration = this.fileDurations.get(fileAndProject) || 0;
    this.fileDurations.set(fileAndProject, duration + result.duration);
  }

  onError(error: TestError) {
    console.log(formatError(error));
  }

  async onEnd(result: FullResult) {
    this.duration = monotonicTime() - this.monotonicStartTime;
    this.result = result;
  }

  private _printSlowTests() {
    if (!this.config.reportSlowTests)
      return;
    const fileDurations = [...this.fileDurations.entries()];
    fileDurations.sort((a, b) => b[1] - a[1]);
    const count = Math.min(fileDurations.length, this.config.reportSlowTests.max || Number.POSITIVE_INFINITY);
    for (let i = 0; i < count; ++i) {
      const duration = fileDurations[i][1];
      if (duration <= this.config.reportSlowTests.threshold)
        break;
      console.log(colors.yellow('  Slow test: ') + fileDurations[i][0] + colors.yellow(` (${milliseconds(duration)})`));
    }
  }

  epilogue(full: boolean) {
    let skipped = 0;
    let expected = 0;
    const skippedWithError: TestCase[] = [];
    const unexpected: TestCase[] = [];
    const flaky: TestCase[] = [];

    this.suite.allTests().forEach(test => {
      switch (test.outcome()) {
        case 'skipped': {
          ++skipped;
          if (test.results.some(result => !!result.error))
            skippedWithError.push(test);
          break;
        }
        case 'expected': ++expected; break;
        case 'unexpected': unexpected.push(test); break;
        case 'flaky': flaky.push(test); break;
      }
    });

    const failuresToPrint = [...unexpected, ...flaky, ...skippedWithError];
    if (full && failuresToPrint.length) {
      console.log('');
      this._printFailures(failuresToPrint);
    }

    this._printSlowTests();

    console.log('');
    if (unexpected.length) {
      console.log(colors.red(`  ${unexpected.length} failed`));
      for (const test of unexpected)
        console.log(colors.red(formatTestHeader(this.config, test, '    ')));
    }
    if (flaky.length) {
      console.log(colors.yellow(`  ${flaky.length} flaky`));
      for (const test of flaky)
        console.log(colors.yellow(formatTestHeader(this.config, test, '    ')));
    }
    if (skipped)
      console.log(colors.yellow(`  ${skipped} skipped`));
    if (expected)
      console.log(colors.green(`  ${expected} passed`) + colors.dim(` (${milliseconds(this.duration)})`));
    if (this.result.status === 'timedout')
      console.log(colors.red(`  Timed out waiting ${this.config.globalTimeout / 1000}s for the entire test run`));
  }

  private _printFailures(failures: TestCase[]) {
    failures.forEach((test, index) => {
      console.log(formatFailure(this.config, test, index + 1, this.printTestOutput));
    });
  }

  willRetry(test: TestCase): boolean {
    return test.outcome() === 'unexpected' && test.results.length <= test.retries;
  }
}

export function formatFailure(config: FullConfig, test: TestCase, index?: number, stdio?: boolean): string {
  const lines: string[] = [];
  lines.push(colors.red(formatTestHeader(config, test, '  ', index)));
  for (const result of test.results) {
    const resultTokens = formatResultFailure(test, result, '    ');
    if (!resultTokens.length)
      continue;
    if (result.retry) {
      lines.push('');
      lines.push(colors.gray(pad(`    Retry #${result.retry}`, '-')));
    }
    lines.push(...resultTokens);
    for (let i = 0; i < result.attachments.length; ++i) {
      const attachment = result.attachments[i];
      lines.push('');
      lines.push(colors.cyan(pad(`    attachment #${i + 1}: ${attachment.name} (${attachment.contentType})`, '-')));
      if (attachment.path) {
        const relativePath = path.relative(process.cwd(), attachment.path);
        lines.push(colors.cyan(`    ${relativePath}`));
        // Make this extensible
        if (attachment.name === 'trace') {
          lines.push(colors.cyan(`    Usage:`));
          lines.push('');
          lines.push(colors.cyan(`        npx playwright show-trace ${relativePath}`));
          lines.push('');
        }
      } else {
        if (attachment.contentType.startsWith('text/')) {
          let text = attachment.body!.toString();
          if (text.length > 300)
            text = text.slice(0, 300) + '...';
          lines.push(colors.cyan(`    ${text}`));
        }
      }
      lines.push(colors.cyan(pad('   ', '-')));
    }
    const output = ((result as any)[kOutputSymbol] || []) as TestResultOutput[];
    if (stdio && output.length) {
      const outputText = output.map(({ chunk, type }) => {
        const text = chunk.toString('utf8');
        if (type === 'stderr')
          return colors.red(stripAnsiEscapes(text));
        return text;
      }).join('');
      lines.push('');
      lines.push(colors.gray(pad('--- Test output', '-')) + '\n\n' + outputText + '\n' + pad('', '-'));
    }
  }
  lines.push('');
  return lines.join('\n');
}

export function formatResultFailure(test: TestCase, result: TestResult, initialIndent: string): string[] {
  const resultTokens: string[] = [];
  if (result.status === 'timedOut') {
    resultTokens.push('');
    resultTokens.push(indent(colors.red(`Timeout of ${test.timeout}ms exceeded.`), initialIndent));
  }
  if (result.status === 'passed' && test.expectedStatus === 'failed') {
    resultTokens.push('');
    resultTokens.push(indent(colors.red(`Expected to fail, but passed.`), initialIndent));
  }
  if (result.error !== undefined)
    resultTokens.push(indent(formatError(result.error, test.location.file), initialIndent));
  return resultTokens;
}

export function relativeTestPath(config: FullConfig, test: TestCase): string {
  return path.relative(config.rootDir, test.location.file) || path.basename(test.location.file);
}

export function stepSuffix(step: TestStep | undefined) {
  const stepTitles = step ? step.titlePath() : [];
  return stepTitles.map(t => ' › ' + t).join('');
}

export function formatTestTitle(config: FullConfig, test: TestCase, step?: TestStep): string {
  // root, project, file, ...describes, test
  const [, projectName, , ...titles] = test.titlePath();
  const location = `${relativeTestPath(config, test)}:${test.location.line}:${test.location.column}`;
  const projectTitle = projectName ? `[${projectName}] › ` : '';
  return `${projectTitle}${location} › ${titles.join(' ')}${stepSuffix(step)}`;
}

export function formatTestHeader(config: FullConfig, test: TestCase, indent: string, index?: number): string {
  const title = formatTestTitle(config, test);
  const header = `${indent}${index ? index + ') ' : ''}${title}`;
  return pad(header, '=');
}

export function formatError(error: TestError, file?: string) {
  const stack = error.stack;
  const tokens = [];
  if (stack) {
    tokens.push('');
    const lines = stack.split('\n');
    let firstStackLine = lines.findIndex(line => line.startsWith('    at '));
    if (firstStackLine === -1)
      firstStackLine = lines.length;
    tokens.push(lines.slice(0, firstStackLine).join('\n'));
    const stackLines = lines.slice(firstStackLine);
    const position = file ? positionInFile(stackLines, file) : null;
    if (position) {
      const source = fs.readFileSync(file!, 'utf8');
      tokens.push('');
      tokens.push(codeFrameColumns(source, { start: position }, { highlightCode: colors.enabled }));
    }
    tokens.push('');
    tokens.push(colors.dim(stackLines.join('\n')));
  } else if (error.message) {
    tokens.push('');
    tokens.push(error.message);
  } else {
    tokens.push('');
    tokens.push(error.value);
  }
  return tokens.join('\n');
}

function pad(line: string, char: string): string {
  if (line)
    line += ' ';
  return line + colors.gray(char.repeat(Math.max(0, 100 - line.length)));
}

export function indent(lines: string, tab: string) {
  return lines.replace(/^(?=.+$)/gm, tab);
}

export function positionInFile(stackLines: string[], file: string): Position | undefined {
  // Stack will have /private/var/folders instead of /var/folders on Mac.
  file = fs.realpathSync(file);
  for (const line of stackLines) {
    const parsed = stackUtils.parseLine(line);
    if (!parsed || !parsed.file)
      continue;
    if (path.resolve(process.cwd(), parsed.file) === file)
      return { column: parsed.column || 0, line: parsed.line || 0 };
  }
}

function monotonicTime(): number {
  const [seconds, nanoseconds] = process.hrtime();
  return seconds * 1000 + (nanoseconds / 1000000 | 0);
}

const asciiRegex = new RegExp('[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))', 'g');
export function stripAnsiEscapes(str: string): string {
  return str.replace(asciiRegex, '');
}
