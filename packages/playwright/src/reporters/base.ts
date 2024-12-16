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

import { colors as realColors, ms as milliseconds, parseStackTraceLine } from 'playwright-core/lib/utilsBundle';
import path from 'path';
import type { FullConfig, TestCase, Suite, TestResult, TestError, FullResult, TestStep, Location } from '../../types/testReporter';
import { getPackageManagerExecCommand } from 'playwright-core/lib/utils';
import { getEastAsianWidth } from '../utilsBundle';
import type { ReporterV2 } from './reporterV2';
import { resolveReporterOutputPath } from '../util';
export type TestResultOutput = { chunk: string | Buffer, type: 'stdout' | 'stderr' };
export const kOutputSymbol = Symbol('output');

type ErrorDetails = {
  message: string;
  location?: Location;
};

type TestSummary = {
  didNotRun: number;
  skipped: number;
  expected: number;
  interrupted: TestCase[];
  unexpected: TestCase[];
  flaky: TestCase[];
  failuresToPrint: TestCase[];
  fatalErrors: TestError[];
};

export const { isTTY, ttyWidth, colors } = (() => {
  let isTTY = !!process.stdout.isTTY;
  let ttyWidth = process.stdout.columns || 0;
  if (process.env.PLAYWRIGHT_FORCE_TTY === 'false' || process.env.PLAYWRIGHT_FORCE_TTY === '0') {
    isTTY = false;
    ttyWidth = 0;
  } else if (process.env.PLAYWRIGHT_FORCE_TTY === 'true' || process.env.PLAYWRIGHT_FORCE_TTY === '1') {
    isTTY = true;
    ttyWidth = process.stdout.columns || 100;
  } else if (process.env.PLAYWRIGHT_FORCE_TTY) {
    isTTY = true;
    ttyWidth = +process.env.PLAYWRIGHT_FORCE_TTY;
    if (isNaN(ttyWidth))
      ttyWidth = 100;
  }

  let useColors = isTTY;
  if (process.env.DEBUG_COLORS === '0' || process.env.DEBUG_COLORS === 'false' ||
      process.env.FORCE_COLOR === '0' || process.env.FORCE_COLOR === 'false')
    useColors = false;
  else if (process.env.DEBUG_COLORS || process.env.FORCE_COLOR)
    useColors = true;

  const colors = useColors ? realColors : {
    bold: (t: string) => t,
    cyan: (t: string) => t,
    dim: (t: string) => t,
    gray: (t: string) => t,
    green: (t: string) => t,
    red: (t: string) => t,
    yellow: (t: string) => t,
    enabled: false,
  };
  return { isTTY, ttyWidth, colors };
})();

export class BaseReporter implements ReporterV2 {
  config!: FullConfig;
  suite!: Suite;
  totalTestCount = 0;
  result!: FullResult;
  private fileDurations = new Map<string, { duration: number, workers: Set<number> }>();
  private _omitFailures: boolean;
  private _fatalErrors: TestError[] = [];
  private _failureCount: number = 0;

  constructor(options: { omitFailures?: boolean } = {}) {
    this._omitFailures = options.omitFailures || false;
  }

  version(): 'v2' {
    return 'v2';
  }

  onConfigure(config: FullConfig) {
    this.config = config;
  }

  onBegin(suite: Suite) {
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
    if (result.status !== 'skipped' && result.status !== test.expectedStatus)
      ++this._failureCount;
    const projectName = test.titlePath()[1];
    const relativePath = relativeTestPath(this.config, test);
    const fileAndProject = (projectName ? `[${projectName}] › ` : '') + relativePath;
    const entry = this.fileDurations.get(fileAndProject) || { duration: 0, workers: new Set() };
    entry.duration += result.duration;
    entry.workers.add(result.workerIndex);
    this.fileDurations.set(fileAndProject, entry);
  }

  onError(error: TestError) {
    this._fatalErrors.push(error);
  }

  async onEnd(result: FullResult) {
    this.result = result;
  }

  protected fitToScreen(line: string, prefix?: string): string {
    if (!ttyWidth) {
      // Guard against the case where we cannot determine available width.
      return line;
    }
    return fitToWidth(line, ttyWidth, prefix);
  }

  protected generateStartingMessage() {
    const jobs = this.config.metadata.actualWorkers ?? this.config.workers;
    const shardDetails = this.config.shard ? `, shard ${this.config.shard.current} of ${this.config.shard.total}` : '';
    if (!this.totalTestCount)
      return '';
    return '\n' + colors.dim('Running ') + this.totalTestCount + colors.dim(` test${this.totalTestCount !== 1 ? 's' : ''} using `) + jobs + colors.dim(` worker${jobs !== 1 ? 's' : ''}${shardDetails}`);
  }

  protected getSlowTests(): [string, number][] {
    if (!this.config.reportSlowTests)
      return [];
    // Only pick durations that were served by single worker.
    const fileDurations = [...this.fileDurations.entries()].filter(([key, value]) => value.workers.size === 1).map(([key, value]) => [key, value.duration]) as [string, number][];
    fileDurations.sort((a, b) => b[1] - a[1]);
    const count = Math.min(fileDurations.length, this.config.reportSlowTests.max || Number.POSITIVE_INFINITY);
    const threshold =  this.config.reportSlowTests.threshold;
    return fileDurations.filter(([, duration]) => duration > threshold).slice(0, count);
  }

  protected generateSummaryMessage({ didNotRun, skipped, expected, interrupted, unexpected, flaky, fatalErrors }: TestSummary) {
    const tokens: string[] = [];
    if (unexpected.length) {
      tokens.push(colors.red(`  ${unexpected.length} failed`));
      for (const test of unexpected)
        tokens.push(colors.red(formatTestHeader(this.config, test, { indent: '    ' })));
    }
    if (interrupted.length) {
      tokens.push(colors.yellow(`  ${interrupted.length} interrupted`));
      for (const test of interrupted)
        tokens.push(colors.yellow(formatTestHeader(this.config, test, { indent: '    ' })));
    }
    if (flaky.length) {
      tokens.push(colors.yellow(`  ${flaky.length} flaky`));
      for (const test of flaky)
        tokens.push(colors.yellow(formatTestHeader(this.config, test, { indent: '    ' })));
    }
    if (skipped)
      tokens.push(colors.yellow(`  ${skipped} skipped`));
    if (didNotRun)
      tokens.push(colors.yellow(`  ${didNotRun} did not run`));
    if (expected)
      tokens.push(colors.green(`  ${expected} passed`) + colors.dim(` (${milliseconds(this.result.duration)})`));
    if (fatalErrors.length && expected + unexpected.length + interrupted.length + flaky.length > 0)
      tokens.push(colors.red(`  ${fatalErrors.length === 1 ? '1 error was not a part of any test' : fatalErrors.length + ' errors were not a part of any test'}, see above for details`));

    return tokens.join('\n');
  }

  protected generateSummary(): TestSummary {
    let didNotRun = 0;
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
          } else if (!test.results.length || test.expectedStatus !== 'skipped') {
            ++didNotRun;
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
      didNotRun,
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
      console.log(formatFailure(this.config, test, index + 1));
    });
  }

  private _printSlowTests() {
    const slowTests = this.getSlowTests();
    slowTests.forEach(([file, duration]) => {
      console.log(colors.yellow('  Slow test file: ') + file + colors.yellow(` (${milliseconds(duration)})`));
    });
    if (slowTests.length)
      console.log(colors.yellow('  Consider running tests from slow files in parallel, see https://playwright.dev/docs/test-parallel.'));
  }

  private _printSummary(summary: string) {
    if (summary.trim())
      console.log(summary);
  }

  willRetry(test: TestCase): boolean {
    return test.outcome() === 'unexpected' && test.results.length <= test.retries;
  }
}

export function formatFailure(config: FullConfig, test: TestCase, index?: number): string {
  const lines: string[] = [];
  const header = formatTestHeader(config, test, { indent: '  ', index, mode: 'error' });
  lines.push(colors.red(header));
  for (const result of test.results) {
    const resultLines: string[] = [];
    const errors = formatResultFailure(test, result, '    ', colors.enabled);
    if (!errors.length)
      continue;
    const retryLines = [];
    if (result.retry) {
      retryLines.push('');
      retryLines.push(colors.gray(separator(`    Retry #${result.retry}`)));
    }
    resultLines.push(...retryLines);
    resultLines.push(...errors.map(error => '\n' + error.message));
    for (let i = 0; i < result.attachments.length; ++i) {
      const attachment = result.attachments[i];
      const hasPrintableContent = attachment.contentType.startsWith('text/');
      if (!attachment.path && !hasPrintableContent)
        continue;
      resultLines.push('');
      resultLines.push(colors.cyan(separator(`    attachment #${i + 1}: ${attachment.name} (${attachment.contentType})`)));
      if (attachment.path) {
        const relativePath = path.relative(process.cwd(), attachment.path);
        resultLines.push(colors.cyan(`    ${relativePath}`));
        // Make this extensible
        if (attachment.name === 'trace') {
          const packageManagerCommand = getPackageManagerExecCommand();
          resultLines.push(colors.cyan(`    Usage:`));
          resultLines.push('');
          resultLines.push(colors.cyan(`        ${packageManagerCommand} playwright show-trace ${quotePathIfNeeded(relativePath)}`));
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
    lines.push(...resultLines);
  }
  lines.push('');
  return lines.join('\n');
}

export function formatRetry(result: TestResult) {
  const retryLines = [];
  if (result.retry) {
    retryLines.push('');
    retryLines.push(colors.gray(separator(`    Retry #${result.retry}`)));
  }
  return retryLines;
}

function quotePathIfNeeded(path: string): string {
  if (/\s/.test(path))
    return `"${path}"`;
  return path;
}

export function formatResultFailure(test: TestCase, result: TestResult, initialIndent: string, highlightCode: boolean): ErrorDetails[] {
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
    const formattedError = formatError(error, highlightCode);
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
  return stepTitles.map(t => t.split('\n')[0]).map(t => ' › ' + t).join('');
}

export function formatTestTitle(config: FullConfig, test: TestCase, step?: TestStep, omitLocation: boolean = false): string {
  // root, project, file, ...describes, test
  const [, projectName, , ...titles] = test.titlePath();
  let location;
  if (omitLocation)
    location = `${relativeTestPath(config, test)}`;
  else
    location = `${relativeTestPath(config, test)}:${test.location.line}:${test.location.column}`;
  const projectTitle = projectName ? `[${projectName}] › ` : '';
  const testTitle = `${projectTitle}${location} › ${titles.join(' › ')}`;
  const extraTags = test.tags.filter(t => !testTitle.includes(t));
  return `${testTitle}${stepSuffix(step)}${extraTags.length ? ' ' + extraTags.join(' ') : ''}`;
}

export function formatTestHeader(config: FullConfig, test: TestCase, options: { indent?: string, index?: number, mode?: 'default' | 'error' } = {}): string {
  const title = formatTestTitle(config, test);
  const header = `${options.indent || ''}${options.index ? options.index + ') ' : ''}${title}`;
  let fullHeader = header;

  // Render the path to the deepest failing test.step.
  if (options.mode === 'error') {
    const stepPaths = new Set<string>();
    for (const result of test.results.filter(r => !!r.errors.length)) {
      const stepPath: string[] = [];
      const visit = (steps: TestStep[]) => {
        const errors = steps.filter(s => s.error);
        if (errors.length > 1)
          return;
        if (errors.length === 1 && errors[0].category === 'test.step') {
          stepPath.push(errors[0].title);
          visit(errors[0].steps);
        }
      };
      visit(result.steps);
      stepPaths.add(['', ...stepPath].join(' › '));
    }
    fullHeader = header + (stepPaths.size === 1 ? stepPaths.values().next().value : '');
  }
  return separator(fullHeader);
}

export function formatError(error: TestError, highlightCode: boolean): ErrorDetails {
  const message = error.message || error.value || '';
  const stack = error.stack;
  if (!stack && !error.location)
    return { message };

  const tokens = [];

  // Now that we filter out internals from our stack traces, we can safely render
  // the helper / original exception locations.
  const parsedStack = stack ? prepareErrorStack(stack) : undefined;
  tokens.push(parsedStack?.message || message);

  if (error.snippet) {
    let snippet = error.snippet;
    if (!highlightCode)
      snippet = stripAnsiEscapes(snippet);
    tokens.push('');
    tokens.push(snippet);
  }

  if (parsedStack && parsedStack.stackLines.length)
    tokens.push(colors.dim(parsedStack.stackLines.join('\n')));

  let location = error.location;
  if (parsedStack && !location)
    location = parsedStack.location;

  if (error.cause)
    tokens.push(colors.dim('[cause]: ') + formatError(error.cause, highlightCode).message);

  return {
    location,
    message: tokens.join('\n'),
  };
}

export function separator(text: string = ''): string {
  if (text)
    text += ' ';
  const columns = Math.min(100, ttyWidth || 100);
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

function characterWidth(c: string) {
  return getEastAsianWidth.eastAsianWidth(c.codePointAt(0)!);
}

function stringWidth(v: string) {
  let width = 0;
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(v))
    width += characterWidth(segment);
  return width;
}

function suffixOfWidth(v: string, width: number) {
  const segments = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(v)];
  let suffixBegin = v.length;
  for (const { segment, index } of segments.reverse()) {
    const segmentWidth = stringWidth(segment);
    if (segmentWidth > width)
      break;
    width -= segmentWidth;
    suffixBegin = index;
  }
  return v.substring(suffixBegin);
}

// Leaves enough space for the "prefix" to also fit.
export function fitToWidth(line: string, width: number, prefix?: string): string {
  const prefixLength = prefix ? stripAnsiEscapes(prefix).length : 0;
  width -= prefixLength;
  if (stringWidth(line) <= width)
    return line;

  // Even items are plain text, odd items are control sequences.
  const parts = line.split(ansiRegex);
  const taken: string[] = [];
  for (let i = parts.length - 1; i >= 0; i--) {
    if (i % 2) {
      // Include all control sequences to preserve formatting.
      taken.push(parts[i]);
    } else {
      let part = suffixOfWidth(parts[i], width);
      const wasTruncated = part.length < parts[i].length;
      if (wasTruncated && parts[i].length > 0) {
        // Add ellipsis if we are truncating.
        part = '\u2026' + suffixOfWidth(parts[i], width - 1);
      }
      taken.push(part);
      width -= stringWidth(part);
    }
  }
  return taken.reverse().join('');
}

function belongsToNodeModules(file: string) {
  return file.includes(`${path.sep}node_modules${path.sep}`);
}

function resolveFromEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value)
    return path.resolve(process.cwd(), value);
  return undefined;
}

// In addition to `outputFile` the function returns `outputDir` which should
// be cleaned up if present by some reporters contract.
export function resolveOutputFile(reporterName: string, options: {
    configDir: string,
    outputDir?: string,
    fileName?: string,
    outputFile?: string,
    default?: {
      fileName: string,
      outputDir: string,
    }
  }):  { outputFile: string, outputDir?: string } |undefined {
  const name = reporterName.toUpperCase();
  let outputFile = resolveFromEnv(`PLAYWRIGHT_${name}_OUTPUT_FILE`);
  if (!outputFile && options.outputFile)
    outputFile = path.resolve(options.configDir, options.outputFile);
  if (outputFile)
    return { outputFile };

  let outputDir = resolveFromEnv(`PLAYWRIGHT_${name}_OUTPUT_DIR`);
  if (!outputDir && options.outputDir)
    outputDir = path.resolve(options.configDir, options.outputDir);
  if (!outputDir && options.default)
    outputDir = resolveReporterOutputPath(options.default.outputDir, options.configDir, undefined);
  if (!outputDir)
    outputDir = options.configDir;

  const reportName = process.env[`PLAYWRIGHT_${name}_OUTPUT_NAME`] ?? options.fileName ?? options.default?.fileName;
  if (!reportName)
    return undefined;
  outputFile = path.resolve(outputDir, reportName);

  return { outputFile, outputDir };
}
