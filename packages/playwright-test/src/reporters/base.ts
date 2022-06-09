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

import { colors, ms as milliseconds } from 'playwright-core/lib/utilsBundle';
import fs from 'fs';
import path from 'path';
import { StackUtils } from 'playwright-core/lib/utilsBundle';
import type { FullConfig, TestCase, Suite, TestResult, TestError, Reporter, FullResult, TestStep, Location } from '../../types/testReporter';
import type { FullConfigInternal } from '../types';
import { codeFrameColumns } from '../babelBundle';
const stackUtils = new StackUtils();

export type TestResultOutput = { chunk: string | Buffer, type: 'stdout' | 'stderr' };
export const kOutputSymbol = Symbol('output');

type Annotation = {
  title: string;
  message: string;
  location?: Location;
};

type ErrorDetails = {
  message: string;
  location?: Location;
};

type TestSummary = {
  skipped: number;
  expected: number;
  skippedWithError: TestCase[];
  unexpected: TestCase[];
  flaky: TestCase[];
  failuresToPrint: TestCase[];
};

export class BaseReporter implements Reporter  {
  duration = 0;
  config!: FullConfigInternal;
  suite!: Suite;
  totalTestCount = 0;
  result!: FullResult;
  private fileDurations = new Map<string, number>();
  private monotonicStartTime: number = 0;
  private _omitFailures: boolean;
  private readonly _ttyWidthForTest: number;

  constructor(options: { omitFailures?: boolean } = {}) {
    this._omitFailures = options.omitFailures || false;
    this._ttyWidthForTest = parseInt(process.env.PWTEST_TTY_WIDTH || '', 10);
  }

  onBegin(config: FullConfig, suite: Suite) {
    this.monotonicStartTime = monotonicTime();
    this.config = config as FullConfigInternal;
    this.suite = suite;
    this.totalTestCount = suite.allTests().length;
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
    // Ignore any tests that are run in parallel.
    for (let suite: Suite | undefined = test.parent; suite; suite = suite.parent) {
      if ((suite as any)._parallelMode === 'parallel')
        return;
    }
    const projectName = test.titlePath()[1];
    const relativePath = relativeTestPath(this.config, test);
    const fileAndProject = (projectName ? `[${projectName}] › ` : '') + relativePath;
    const duration = this.fileDurations.get(fileAndProject) || 0;
    this.fileDurations.set(fileAndProject, duration + result.duration);
  }

  onError(error: TestError) {
    console.log('\n' + formatError(this.config, error, colors.enabled).message);
  }

  async onEnd(result: FullResult) {
    this.duration = monotonicTime() - this.monotonicStartTime;
    this.result = result;
  }

  protected fitToScreen(line: string, suffix?: string): string {
    const ttyWidth = this._ttyWidthForTest || process.stdout.columns || 0;
    if (!ttyWidth) {
      // Guard against the case where we cannot determine available width.
      return line;
    }
    return fitToWidth(line, ttyWidth, suffix);
  }

  protected generateStartingMessage() {
    const jobs = Math.min(this.config.workers, this.config._testGroupsCount);
    const shardDetails = this.config.shard ? `, shard ${this.config.shard.current} of ${this.config.shard.total}` : '';
    return `\nRunning ${this.totalTestCount} test${this.totalTestCount > 1 ? 's' : ''} using ${jobs} worker${jobs > 1 ? 's' : ''}${shardDetails}`;
  }

  protected getSlowTests(): [string, number][] {
    if (!this.config.reportSlowTests)
      return [];
    const fileDurations = [...this.fileDurations.entries()];
    fileDurations.sort((a, b) => b[1] - a[1]);
    const count = Math.min(fileDurations.length, this.config.reportSlowTests.max || Number.POSITIVE_INFINITY);
    const threshold =  this.config.reportSlowTests.threshold;
    return fileDurations.filter(([,duration]) => duration > threshold).slice(0, count);
  }

  protected generateSummaryMessage({ skipped, expected, unexpected, flaky }: TestSummary) {
    const tokens: string[] = [];
    if (unexpected.length) {
      tokens.push(colors.red(`  ${unexpected.length} failed`));
      for (const test of unexpected)
        tokens.push(colors.red(formatTestHeader(this.config, test, '    ')));
    }
    if (flaky.length) {
      tokens.push(colors.yellow(`  ${flaky.length} flaky`));
      for (const test of flaky)
        tokens.push(colors.yellow(formatTestHeader(this.config, test, '    ')));
    }
    if (skipped)
      tokens.push(colors.yellow(`  ${skipped} skipped`));
    if (expected)
      tokens.push(colors.green(`  ${expected} passed`) + colors.dim(` (${milliseconds(this.duration)})`));
    if (this.result.status === 'timedout')
      tokens.push(colors.red(`  Timed out waiting ${this.config.globalTimeout / 1000}s for the entire test run`));

    return tokens.join('\n');
  }

  protected generateSummary(): TestSummary {
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
    return {
      skipped,
      expected,
      skippedWithError,
      unexpected,
      flaky,
      failuresToPrint
    };
  }

  epilogue(full: boolean) {
    const summary = this.generateSummary();
    const summaryMessage = this.generateSummaryMessage(summary);
    if (full && summary.failuresToPrint.length && !this._omitFailures)
      this._printFailures(summary.failuresToPrint);
    this._printSlowTests();
    this._printSummary(summaryMessage);
  }

  private _printFailures(failures: TestCase[]) {
    console.log('');
    failures.forEach((test, index) => {
      console.log(formatFailure(this.config, test, {
        index: index + 1,
      }).message);
    });
  }

  private _printSlowTests() {
    const slowTests = this.getSlowTests();
    slowTests.forEach(([file, duration]) => {
      console.log(colors.yellow('  Slow test file: ') + file + colors.yellow(` (${milliseconds(duration)})`));
    });
    if (slowTests.length)
      console.log(colors.yellow('  Consider splitting slow test files to speed up parallel execution'));
  }

  private _printSummary(summary: string) {
    if (summary.trim()) {
      console.log('');
      console.log(summary);
    }
  }

  willRetry(test: TestCase): boolean {
    return test.outcome() === 'unexpected' && test.results.length <= test.retries;
  }
}

export function formatFailure(config: FullConfig, test: TestCase, options: {index?: number, includeStdio?: boolean, includeAttachments?: boolean} = {}): {
  message: string,
  annotations: Annotation[]
} {
  const { index, includeStdio, includeAttachments = true } = options;
  const lines: string[] = [];
  const title = formatTestTitle(config, test);
  const annotations: Annotation[] = [];
  const header = formatTestHeader(config, test, '  ', index);
  lines.push(colors.red(header));
  for (const result of test.results) {
    const resultLines: string[] = [];
    const errors = formatResultFailure(config, test, result, '    ', colors.enabled);
    if (!errors.length)
      continue;
    const retryLines = [];
    if (result.retry) {
      retryLines.push('');
      retryLines.push(colors.gray(pad(`    Retry #${result.retry}`, '-')));
    }
    resultLines.push(...retryLines);
    resultLines.push(...errors.map(error => '\n' + error.message));
    if (includeAttachments) {
      for (let i = 0; i < result.attachments.length; ++i) {
        const attachment = result.attachments[i];
        const hasPrintableContent = attachment.contentType.startsWith('text/') && attachment.body;
        if (!attachment.path && !hasPrintableContent)
          continue;
        resultLines.push('');
        resultLines.push(colors.cyan(pad(`    attachment #${i + 1}: ${attachment.name} (${attachment.contentType})`, '-')));
        if (attachment.path) {
          const relativePath = path.relative(process.cwd(), attachment.path);
          resultLines.push(colors.cyan(`    ${relativePath}`));
          // Make this extensible
          if (attachment.name === 'trace') {
            resultLines.push(colors.cyan(`    Usage:`));
            resultLines.push('');
            resultLines.push(colors.cyan(`        npx playwright show-trace ${relativePath}`));
            resultLines.push('');
          }
        } else {
          if (attachment.contentType.startsWith('text/') && attachment.body) {
            let text = attachment.body.toString();
            if (text.length > 300)
              text = text.slice(0, 300) + '...';
            resultLines.push(colors.cyan(`    ${text}`));
          }
        }
        resultLines.push(colors.cyan(pad('   ', '-')));
      }
    }
    const output = ((result as any)[kOutputSymbol] || []) as TestResultOutput[];
    if (includeStdio && output.length) {
      const outputText = output.map(({ chunk, type }) => {
        const text = chunk.toString('utf8');
        if (type === 'stderr')
          return colors.red(stripAnsiEscapes(text));
        return text;
      }).join('');
      resultLines.push('');
      resultLines.push(colors.gray(pad('--- Test output', '-')) + '\n\n' + outputText + '\n' + pad('', '-'));
    }
    for (const error of errors) {
      annotations.push({
        location: error.location,
        title,
        message: [header, ...retryLines, error.message].join('\n'),
      });
    }
    lines.push(...resultLines);
  }
  lines.push('');
  return {
    message: lines.join('\n'),
    annotations
  };
}

export function formatResultFailure(config: FullConfig, test: TestCase, result: TestResult, initialIndent: string, highlightCode: boolean): ErrorDetails[] {
  const errorDetails: ErrorDetails[] = [];

  if (result.status === 'passed' && test.expectedStatus === 'failed') {
    errorDetails.push({
      message: indent(colors.red(`Expected to fail, but passed.`), initialIndent),
    });
  }

  for (const error of result.errors) {
    const formattedError = formatError(config, error, highlightCode, test.location.file);
    errorDetails.push({
      message: indent(formattedError.message, initialIndent),
      location: formattedError.location,
    });
  }
  return errorDetails;
}

function relativeFilePath(config: FullConfig, file: string): string {
  return path.relative(config.rootDir, file) || path.basename(file);
}

function relativeTestPath(config: FullConfig, test: TestCase): string {
  return relativeFilePath(config, test.location.file);
}

function stepSuffix(step: TestStep | undefined) {
  const stepTitles = step ? step.titlePath() : [];
  return stepTitles.map(t => ' › ' + t).join('');
}

export function formatTestTitle(config: FullConfig, test: TestCase, step?: TestStep): string {
  // root, project, file, ...describes, test
  const [, projectName, , ...titles] = test.titlePath();
  const location = `${relativeTestPath(config, test)}:${test.location.line}:${test.location.column}`;
  const projectTitle = projectName ? `[${projectName}] › ` : '';
  return `${projectTitle}${location} › ${titles.join(' › ')}${stepSuffix(step)}`;
}

function formatTestHeader(config: FullConfig, test: TestCase, indent: string, index?: number): string {
  const title = formatTestTitle(config, test);
  const header = `${indent}${index ? index + ') ' : ''}${title}`;
  return pad(header, '=');
}

export function formatError(config: FullConfig, error: TestError, highlightCode: boolean, file?: string): ErrorDetails {
  const stack = error.stack;
  const tokens = [];
  let location: Location | undefined;
  if (stack) {
    const parsed = prepareErrorStack(stack, file);
    tokens.push(parsed.message);
    location = parsed.location;
    if (location) {
      try {
        const source = fs.readFileSync(location.file, 'utf8');
        const codeFrame = codeFrameColumns(source, { start: location }, { highlightCode });
        // Convert /var/folders to /private/var/folders on Mac.
        if (!file || fs.realpathSync(file) !== location.file) {
          tokens.push('');
          tokens.push(colors.gray(`   at `) + `${relativeFilePath(config, location.file)}:${location.line}`);
        }
        tokens.push('');
        tokens.push(codeFrame);
      } catch (e) {
        // Failed to read the source file - that's ok.
      }
    }
    tokens.push('');
    tokens.push(colors.dim(parsed.stackLines.join('\n')));
  } else if (error.message) {
    tokens.push(error.message);
  } else if (error.value) {
    tokens.push(error.value);
  }
  return {
    location,
    message: tokens.join('\n'),
  };
}

function pad(line: string, char: string): string {
  if (line)
    line += ' ';
  return line + colors.gray(char.repeat(Math.max(0, 100 - line.length)));
}

function indent(lines: string, tab: string) {
  return lines.replace(/^(?=.+$)/gm, tab);
}

export function prepareErrorStack(stack: string, file?: string): {
  message: string;
  stackLines: string[];
  location?: Location;
} {
  if (file) {
    // Stack will have /private/var/folders instead of /var/folders on Mac.
    file = fs.realpathSync(file);
  }
  const lines = stack.split('\n');
  let firstStackLine = lines.findIndex(line => line.startsWith('    at '));
  if (firstStackLine === -1)
    firstStackLine = lines.length;
  const message = lines.slice(0, firstStackLine).join('\n');
  const stackLines = lines.slice(firstStackLine);
  let location: Location | undefined;
  for (const line of stackLines) {
    const parsed = stackUtils.parseLine(line);
    if (!parsed || !parsed.file)
      continue;
    const resolvedFile = path.join(process.cwd(), parsed.file);
    if (!file || resolvedFile === file) {
      location = { file: resolvedFile, column: parsed.column || 0, line: parsed.line || 0 };
      break;
    }
  }
  return { message, stackLines, location };
}

function monotonicTime(): number {
  const [seconds, nanoseconds] = process.hrtime();
  return seconds * 1000 + (nanoseconds / 1000000 | 0);
}

const ansiRegex = new RegExp('[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))', 'g');
export function stripAnsiEscapes(str: string): string {
  return str.replace(ansiRegex, '');
}

// Leaves enough space for the "suffix" to also fit.
function fitToWidth(line: string, width: number, suffix?: string): string {
  const suffixLength = suffix ? stripAnsiEscapes(suffix).length : 0;
  width -= suffixLength;
  if (line.length <= width)
    return line;
  let m;
  let ansiLen = 0;
  ansiRegex.lastIndex = 0;
  while ((m = ansiRegex.exec(line)) !== null) {
    const visibleLen = m.index - ansiLen;
    if (visibleLen >= width)
      break;
    ansiLen += m[0].length;
  }
  // Truncate and reset all colors.
  return line.substr(0, width + ansiLen) + '\u001b[0m';
}
