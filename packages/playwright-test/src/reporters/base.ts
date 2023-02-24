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

import { colors, ms as milliseconds, parseStackTraceLine } from 'playwright-core/lib/utilsBundle';
import fs from 'fs';
import path from 'path';
import type { FullConfig, TestCase, Suite, TestResult, TestError, FullResult, TestStep, Location, Reporter } from '../../types/testReporter';
import type { FullConfigInternal } from '../common/types';
import { codeFrameColumns } from '../common/babelBundle';
import { monotonicTime } from 'playwright-core/lib/utils';

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
  interrupted: TestCase[];
  unexpected: TestCase[];
  flaky: TestCase[];
  failuresToPrint: TestCase[];
  fatalErrors: TestError[];
};

export class BaseReporter implements Reporter {
  duration = 0;
  config!: FullConfigInternal;
  suite!: Suite;
  totalTestCount = 0;
  result!: FullResult;
  private fileDurations = new Map<string, number>();
  private monotonicStartTime: number = 0;
  private _omitFailures: boolean;
  private readonly _ttyWidthForTest: number;
  private _fatalErrors: TestError[] = [];

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
    this._fatalErrors.push(error);
  }

  async onEnd(result: FullResult) {
    this.duration = monotonicTime() - this.monotonicStartTime;
    this.result = result;
  }

  protected ttyWidth() {
    return this._ttyWidthForTest || process.stdout.columns || 0;
  }

  protected fitToScreen(line: string, prefix?: string): string {
    const ttyWidth = this.ttyWidth();
    if (!ttyWidth) {
      // Guard against the case where we cannot determine available width.
      return line;
    }
    return fitToWidth(line, ttyWidth, prefix);
  }

  protected generateStartingMessage() {
    const jobs = Math.min(this.config.workers, this.config._internal.maxConcurrentTestGroups);
    const shardDetails = this.config.shard ? `, shard ${this.config.shard.current} of ${this.config.shard.total}` : '';
    return '\n' + colors.dim('Running ') + this.totalTestCount + colors.dim(` test${this.totalTestCount !== 1 ? 's' : ''} using `) + jobs + colors.dim(` worker${jobs !== 1 ? 's' : ''}${shardDetails}`);
  }

  protected getSlowTests(): [string, number][] {
    if (!this.config.reportSlowTests)
      return [];
    const fileDurations = [...this.fileDurations.entries()];
    fileDurations.sort((a, b) => b[1] - a[1]);
    const count = Math.min(fileDurations.length, this.config.reportSlowTests.max || Number.POSITIVE_INFINITY);
    const threshold =  this.config.reportSlowTests.threshold;
    return fileDurations.filter(([, duration]) => duration > threshold).slice(0, count);
  }

  protected generateSummaryMessage({ skipped, expected, interrupted, unexpected, flaky, fatalErrors }: TestSummary) {
    const tokens: string[] = [];
    if (unexpected.length) {
      tokens.push(colors.red(`  ${unexpected.length} failed`));
      for (const test of unexpected)
        tokens.push(colors.red(formatTestHeader(this.config, test, '    ')));
    }
    if (interrupted.length) {
      tokens.push(colors.yellow(`  ${interrupted.length} interrupted`));
      for (const test of interrupted)
        tokens.push(colors.yellow(formatTestHeader(this.config, test, '    ')));
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
    if (fatalErrors.length && expected + unexpected.length + interrupted.length + flaky.length > 0)
      tokens.push(colors.red(`  ${fatalErrors.length === 1 ? '1 error was not a part of any test' : fatalErrors.length + ' errors were not a part of any test'}, see above for details`));

    return tokens.join('\n');
  }

  protected generateSummary(): TestSummary {
    let skipped = 0;
    let expected = 0;
    const interrupted: TestCase[] = [];
    const interruptedToPrint: TestCase[] = [];
    const unexpected: TestCase[] = [];
    const flaky: TestCase[] = [];

    this.suite.allTests().forEach(test => {
      switch (test.outcome()) {
        case 'skipped': {
          if (test.results.some(result => result.status === 'interrupted')) {
            if (test.results.some(result => !!result.error))
              interruptedToPrint.push(test);
            interrupted.push(test);
          } else {
            ++skipped;
          }
          break;
        }
        case 'expected': ++expected; break;
        case 'unexpected': unexpected.push(test); break;
        case 'flaky': flaky.push(test); break;
      }
    });

    const failuresToPrint = [...unexpected, ...flaky, ...interruptedToPrint];
    return {
      skipped,
      expected,
      interrupted,
      unexpected,
      flaky,
      failuresToPrint,
      fatalErrors: this._fatalErrors,
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
    if (summary.trim())
      console.log(summary);
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
      retryLines.push(colors.gray(separator(`    Retry #${result.retry}`)));
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
        resultLines.push(colors.cyan(separator(`    attachment #${i + 1}: ${attachment.name} (${attachment.contentType})`)));
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
            for (const line of text.split('\n'))
              resultLines.push(colors.cyan(`    ${line}`));
          }
        }
        resultLines.push(colors.cyan(separator('   ')));
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
      resultLines.push(colors.gray(separator('--- Test output')) + '\n\n' + outputText + '\n' + separator());
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
  if (result.status === 'interrupted') {
    errorDetails.push({
      message: indent(colors.red(`Test was interrupted.`), initialIndent),
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

export function relativeFilePath(config: FullConfig, file: string): string {
  return path.relative(config.rootDir, file) || path.basename(file);
}

function relativeTestPath(config: FullConfig, test: TestCase): string {
  return relativeFilePath(config, test.location.file);
}

export function stepSuffix(step: TestStep | undefined) {
  const stepTitles = step ? step.titlePath() : [];
  return stepTitles.map(t => ' › ' + t).join('');
}

export function formatTestTitle(config: FullConfig, test: TestCase, step?: TestStep, omitLocation: boolean = false): string {
  // root, project, file, ...describes, test
  const [, projectName, , ...titles] = test.titlePath();
  let location;
  if (omitLocation)
    location = `${relativeTestPath(config, test)}`;
  else
    location = `${relativeTestPath(config, test)}:${step?.location?.line ?? test.location.line}:${step?.location?.column ?? test.location.column}`;
  const projectTitle = projectName ? `[${projectName}] › ` : '';
  return `${projectTitle}${location} › ${titles.join(' › ')}${stepSuffix(step)}`;
}

function formatTestHeader(config: FullConfig, test: TestCase, indent: string, index?: number): string {
  const title = formatTestTitle(config, test);
  const header = `${indent}${index ? index + ') ' : ''}${title}`;
  return separator(header);
}

export function formatError(config: FullConfig, error: TestError, highlightCode: boolean, file?: string): ErrorDetails {
  const message = error.message || error.value || '';
  const stack = error.stack;
  if (!stack && !error.location)
    return { message };

  const tokens = [];

  // Now that we filter out internals from our stack traces, we can safely render
  // the helper / original exception locations.
  const parsedStack = stack ? prepareErrorStack(stack) : undefined;
  tokens.push(parsedStack?.message || message);

  let location = error.location;
  if (parsedStack && !location)
    location = parsedStack.location;

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
  if (parsedStack) {
    tokens.push('');
    tokens.push(colors.dim(parsedStack.stackLines.join('\n')));
  }

  return {
    location,
    message: tokens.join('\n'),
  };
}

export function separator(text: string = ''): string {
  if (text)
    text += ' ';
  const columns = Math.min(100, process.stdout?.columns || 100);
  return text + colors.dim('─'.repeat(Math.max(0, columns - text.length)));
}

function indent(lines: string, tab: string) {
  return lines.replace(/^(?=.+$)/gm, tab);
}

export function prepareErrorStack(stack: string): {
  message: string;
  stackLines: string[];
  location?: Location;
} {
  const lines = stack.split('\n');
  let firstStackLine = lines.findIndex(line => line.startsWith('    at '));
  if (firstStackLine === -1)
    firstStackLine = lines.length;
  const message = lines.slice(0, firstStackLine).join('\n');
  const stackLines = lines.slice(firstStackLine);
  let location: Location | undefined;
  for (const line of stackLines) {
    const frame = parseStackTraceLine(line);
    if (!frame || !frame.file)
      continue;
    if (belongsToNodeModules(frame.file))
      continue;
    location = { file: frame.file, column: frame.column || 0, line: frame.line || 0 };
    break;
  }
  return { message, stackLines, location };
}

const ansiRegex = new RegExp('([\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~])))', 'g');
export function stripAnsiEscapes(str: string): string {
  return str.replace(ansiRegex, '');
}

// Leaves enough space for the "prefix" to also fit.
function fitToWidth(line: string, width: number, prefix?: string): string {
  const prefixLength = prefix ? stripAnsiEscapes(prefix).length : 0;
  width -= prefixLength;
  if (line.length <= width)
    return line;

  // Even items are plain text, odd items are control sequences.
  const parts = line.split(ansiRegex);
  const taken: string[] = [];
  for (let i = parts.length - 1; i >= 0; i--) {
    if (i % 2) {
      // Include all control sequences to preserve formatting.
      taken.push(parts[i]);
    } else {
      let part = parts[i].substring(parts[i].length - width);
      if (part.length < parts[i].length && part.length > 0) {
        // Add ellipsis if we are truncating.
        part = '\u2026' + part.substring(1);
      }
      taken.push(part);
      width -= part.length;
    }
  }
  return taken.reverse().join('');
}

function belongsToNodeModules(file: string) {
  return file.includes(`${path.sep}node_modules${path.sep}`);
}
