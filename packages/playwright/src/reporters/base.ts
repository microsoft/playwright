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

import path from 'path';

import { getPackageManagerExecCommand, parseErrorStack } from 'playwright-core/lib/utils';
import { ms as milliseconds } from 'playwright-core/lib/utilsBundle';
import { colors as realColors, noColors } from 'playwright-core/lib/utils';

import { ansiRegex, resolveReporterOutputPath, stripAnsiEscapes } from '../util';
import { getEastAsianWidth } from '../utilsBundle';

import type { ReporterV2 } from './reporterV2';
import type { FullConfig, FullResult, Location, Suite, TestCase, TestError, TestResult, TestStep } from '../../types/testReporter';
import type { Colors } from '@isomorphic/colors';

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

export type CommonReporterOptions = {
  configDir: string,
  _mode: 'list' | 'test' | 'merge',
  _isTestServer: boolean,
  _commandHash: string,
};

export type Screen = {
  resolveFiles: 'cwd' | 'rootDir';
  colors: Colors;
  isTTY: boolean;
  ttyWidth: number;
  ttyHeight: number;
};

const DEFAULT_TTY_WIDTH = 100;
const DEFAULT_TTY_HEIGHT = 40;

// Output goes to terminal.
export const terminalScreen: Screen = (() => {
  let isTTY = !!process.stdout.isTTY;
  let ttyWidth = process.stdout.columns || 0;
  let ttyHeight = process.stdout.rows || 0;
  if (process.env.PLAYWRIGHT_FORCE_TTY === 'false' || process.env.PLAYWRIGHT_FORCE_TTY === '0') {
    isTTY = false;
    ttyWidth = 0;
    ttyHeight = 0;
  } else if (process.env.PLAYWRIGHT_FORCE_TTY === 'true' || process.env.PLAYWRIGHT_FORCE_TTY === '1') {
    isTTY = true;
    ttyWidth = process.stdout.columns || DEFAULT_TTY_WIDTH;
    ttyHeight = process.stdout.rows || DEFAULT_TTY_HEIGHT;
  } else if (process.env.PLAYWRIGHT_FORCE_TTY) {
    isTTY = true;
    const sizeMatch = process.env.PLAYWRIGHT_FORCE_TTY.match(/^(\d+)x(\d+)$/);
    if (sizeMatch) {
      ttyWidth = +sizeMatch[1];
      ttyHeight = +sizeMatch[2];
    } else {
      ttyWidth = +process.env.PLAYWRIGHT_FORCE_TTY;
      ttyHeight = DEFAULT_TTY_HEIGHT;
    }
    if (isNaN(ttyWidth))
      ttyWidth = DEFAULT_TTY_WIDTH;
    if (isNaN(ttyHeight))
      ttyHeight = DEFAULT_TTY_HEIGHT;
  }

  let useColors = isTTY;
  if (process.env.DEBUG_COLORS === '0' || process.env.DEBUG_COLORS === 'false' ||
      process.env.FORCE_COLOR === '0' || process.env.FORCE_COLOR === 'false')
    useColors = false;
  else if (process.env.DEBUG_COLORS || process.env.FORCE_COLOR)
    useColors = true;

  const colors = useColors ? realColors : noColors;
  return {
    resolveFiles: 'cwd',
    isTTY,
    ttyWidth,
    ttyHeight,
    colors
  };
})();

// Output does not go to terminal, but colors are controlled with terminal env vars.
export const nonTerminalScreen: Screen = {
  colors: terminalScreen.colors,
  isTTY: false,
  ttyWidth: 0,
  ttyHeight: 0,
  resolveFiles: 'rootDir',
};

// Internal output for post-processing, should always contain real colors.
export const internalScreen: Screen = {
  colors: realColors,
  isTTY: false,
  ttyWidth: 0,
  ttyHeight: 0,
  resolveFiles: 'rootDir',
};

export class TerminalReporter implements ReporterV2 {
  screen: Screen = terminalScreen;
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
    const relativePath = relativeTestPath(this.screen, this.config, test);
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
    if (!this.screen.ttyWidth) {
      // Guard against the case where we cannot determine available width.
      return line;
    }
    return fitToWidth(line, this.screen.ttyWidth, prefix);
  }

  protected generateStartingMessage() {
    const jobs = this.config.metadata.actualWorkers ?? this.config.workers;
    const shardDetails = this.config.shard ? `, shard ${this.config.shard.current} of ${this.config.shard.total}` : '';
    if (!this.totalTestCount)
      return '';
    return '\n' + this.screen.colors.dim('Running ') + this.totalTestCount + this.screen.colors.dim(` test${this.totalTestCount !== 1 ? 's' : ''} using `) + jobs + this.screen.colors.dim(` worker${jobs !== 1 ? 's' : ''}${shardDetails}`);
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
      tokens.push(this.screen.colors.red(`  ${unexpected.length} failed`));
      for (const test of unexpected)
        tokens.push(this.screen.colors.red(this.formatTestHeader(test, { indent: '    ' })));
    }
    if (interrupted.length) {
      tokens.push(this.screen.colors.yellow(`  ${interrupted.length} interrupted`));
      for (const test of interrupted)
        tokens.push(this.screen.colors.yellow(this.formatTestHeader(test, { indent: '    ' })));
    }
    if (flaky.length) {
      tokens.push(this.screen.colors.yellow(`  ${flaky.length} flaky`));
      for (const test of flaky)
        tokens.push(this.screen.colors.yellow(this.formatTestHeader(test, { indent: '    ' })));
    }
    if (skipped)
      tokens.push(this.screen.colors.yellow(`  ${skipped} skipped`));
    if (didNotRun)
      tokens.push(this.screen.colors.yellow(`  ${didNotRun} did not run`));
    if (expected)
      tokens.push(this.screen.colors.green(`  ${expected} passed`) + this.screen.colors.dim(` (${milliseconds(this.result.duration)})`));
    if (fatalErrors.length && expected + unexpected.length + interrupted.length + flaky.length > 0)
      tokens.push(this.screen.colors.red(`  ${fatalErrors.length === 1 ? '1 error was not a part of any test' : fatalErrors.length + ' errors were not a part of any test'}, see above for details`));

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
      console.log(this.formatFailure(test, index + 1));
    });
  }

  private _printSlowTests() {
    const slowTests = this.getSlowTests();
    slowTests.forEach(([file, duration]) => {
      console.log(this.screen.colors.yellow('  Slow test file: ') + file + this.screen.colors.yellow(` (${milliseconds(duration)})`));
    });
    if (slowTests.length)
      console.log(this.screen.colors.yellow('  Consider running tests from slow files in parallel. See: https://playwright.dev/docs/test-parallel'));
  }

  private _printSummary(summary: string) {
    if (summary.trim())
      console.log(summary);
  }

  willRetry(test: TestCase): boolean {
    return test.outcome() === 'unexpected' && test.results.length <= test.retries;
  }

  formatTestTitle(test: TestCase, step?: TestStep, omitLocation: boolean = false): string {
    return formatTestTitle(this.screen, this.config, test, step, omitLocation);
  }

  formatTestHeader(test: TestCase, options: { indent?: string, index?: number, mode?: 'default' | 'error' } = {}): string {
    return formatTestHeader(this.screen, this.config, test, options);
  }

  formatFailure(test: TestCase, index?: number): string {
    return formatFailure(this.screen, this.config, test, index);
  }

  formatError(error: TestError): ErrorDetails {
    return formatError(this.screen, error);
  }
}

export function formatFailure(screen: Screen, config: FullConfig, test: TestCase, index?: number): string {
  const lines: string[] = [];
  const header = formatTestHeader(screen, config, test, { indent: '  ', index, mode: 'error' });
  lines.push(screen.colors.red(header));
  for (const result of test.results) {
    const resultLines: string[] = [];
    const errors = formatResultFailure(screen, test, result, '    ');
    if (!errors.length)
      continue;
    if (result.retry) {
      resultLines.push('');
      resultLines.push(screen.colors.gray(separator(screen, `    Retry #${result.retry}`)));
    }
    resultLines.push(...errors.map(error => '\n' + error.message));
    const attachmentGroups = groupAttachments(result.attachments);
    for (let i = 0; i < attachmentGroups.length; ++i) {
      const attachment = attachmentGroups[i];
      if (attachment.name === 'error-context' && attachment.path) {
        resultLines.push('');
        resultLines.push(screen.colors.dim(`    Error Context: ${relativeFilePath(screen, config, attachment.path)}`));
        continue;
      }

      if (attachment.name.startsWith('_'))
        continue;

      const hasPrintableContent = attachment.contentType.startsWith('text/');
      if (!attachment.path && !hasPrintableContent)
        continue;

      resultLines.push('');
      resultLines.push(screen.colors.dim(separator(screen, `    attachment #${i + 1}: ${screen.colors.bold(attachment.name)} (${attachment.contentType})`)));

      if (attachment.actual?.path) {
        if (attachment.expected?.path) {
          const expectedPath = relativeFilePath(screen, config, attachment.expected.path);
          resultLines.push(screen.colors.dim(`    Expected: ${expectedPath}`));
        }
        const actualPath = relativeFilePath(screen, config, attachment.actual.path);
        resultLines.push(screen.colors.dim(`    Received: ${actualPath}`));
        if (attachment.previous?.path) {
          const previousPath = relativeFilePath(screen, config, attachment.previous.path);
          resultLines.push(screen.colors.dim(`    Previous: ${previousPath}`));
        }
        if (attachment.diff?.path) {
          const diffPath = relativeFilePath(screen, config, attachment.diff.path);
          resultLines.push(screen.colors.dim(`    Diff:     ${diffPath}`));
        }
      } else if (attachment.path) {
        const relativePath = relativeFilePath(screen, config, attachment.path);
        resultLines.push(screen.colors.dim(`    ${relativePath}`));
        // Make this extensible
        if (attachment.name === 'trace') {
          const packageManagerCommand = getPackageManagerExecCommand();
          resultLines.push(screen.colors.dim(`    Usage:`));
          resultLines.push('');
          resultLines.push(screen.colors.dim(`        ${packageManagerCommand} playwright show-trace ${quotePathIfNeeded(relativePath)}`));
          resultLines.push('');
        }
      } else {
        if (attachment.contentType.startsWith('text/') && attachment.body) {
          let text = attachment.body.toString();
          if (text.length > 300)
            text = text.slice(0, 300) + '...';
          for (const line of text.split('\n'))
            resultLines.push(screen.colors.dim(`    ${line}`));
        }
      }
      resultLines.push(screen.colors.dim(separator(screen, '   ')));
    }
    lines.push(...resultLines);
  }
  lines.push('');
  return lines.join('\n');
}

export function formatRetry(screen: Screen, result: TestResult) {
  const retryLines = [];
  if (result.retry) {
    retryLines.push('');
    retryLines.push(screen.colors.gray(separator(screen, `    Retry #${result.retry}`)));
  }
  return retryLines;
}

function quotePathIfNeeded(path: string): string {
  if (/\s/.test(path))
    return `"${path}"`;
  return path;
}

export function formatResultFailure(screen: Screen, test: TestCase, result: TestResult, initialIndent: string): ErrorDetails[] {
  const errorDetails: ErrorDetails[] = [];

  if (result.status === 'passed' && test.expectedStatus === 'failed') {
    errorDetails.push({
      message: indent(screen.colors.red(`Expected to fail, but passed.`), initialIndent),
    });
  }
  if (result.status === 'interrupted') {
    errorDetails.push({
      message: indent(screen.colors.red(`Test was interrupted.`), initialIndent),
    });
  }

  for (const error of result.errors) {
    const formattedError = formatError(screen, error);
    errorDetails.push({
      message: indent(formattedError.message, initialIndent),
      location: formattedError.location,
    });
  }
  return errorDetails;
}

export function relativeFilePath(screen: Screen, config: FullConfig, file: string): string {
  if (screen.resolveFiles === 'cwd')
    return path.relative(process.cwd(), file);
  return path.relative(config.rootDir, file);
}

function relativeTestPath(screen: Screen, config: FullConfig, test: TestCase): string {
  return relativeFilePath(screen, config, test.location.file);
}

export function stepSuffix(step: TestStep | undefined) {
  const stepTitles = step ? step.titlePath() : [];
  return stepTitles.map(t => t.split('\n')[0]).map(t => ' › ' + t).join('');
}

function formatTestTitle(screen: Screen, config: FullConfig, test: TestCase, step?: TestStep, omitLocation: boolean = false): string {
  // root, project, file, ...describes, test
  const [, projectName, , ...titles] = test.titlePath();
  let location;
  if (omitLocation)
    location = `${relativeTestPath(screen, config, test)}`;
  else
    location = `${relativeTestPath(screen, config, test)}:${test.location.line}:${test.location.column}`;
  const projectTitle = projectName ? `[${projectName}] › ` : '';
  const testTitle = `${projectTitle}${location} › ${titles.join(' › ')}`;
  const extraTags = test.tags.filter(t => !testTitle.includes(t));
  return `${testTitle}${stepSuffix(step)}${extraTags.length ? ' ' + extraTags.join(' ') : ''}`;
}

function formatTestHeader(screen: Screen, config: FullConfig, test: TestCase, options: { indent?: string, index?: number, mode?: 'default' | 'error' } = {}): string {
  const title = formatTestTitle(screen, config, test);
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
  return separator(screen, fullHeader);
}

export function formatError(screen: Screen, error: TestError): ErrorDetails {
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
    if (!screen.colors.enabled)
      snippet = stripAnsiEscapes(snippet);
    tokens.push('');
    tokens.push(snippet);
  }

  if (parsedStack && parsedStack.stackLines.length)
    tokens.push(screen.colors.dim(parsedStack.stackLines.join('\n')));

  let location = error.location;
  if (parsedStack && !location)
    location = parsedStack.location;

  if (error.cause)
    tokens.push(screen.colors.dim('[cause]: ') + formatError(screen, error.cause).message);

  return {
    location,
    message: tokens.join('\n'),
  };
}

export function separator(screen: Screen, text: string = ''): string {
  if (text)
    text += ' ';
  const columns = Math.min(100, screen.ttyWidth || 100);
  return text + screen.colors.dim('─'.repeat(Math.max(0, columns - stripAnsiEscapes(text).length)));
}

function indent(lines: string, tab: string) {
  return lines.replace(/^(?=.+$)/gm, tab);
}

export function prepareErrorStack(stack: string): {
  message: string;
  stackLines: string[];
  location?: Location;
} {
  return parseErrorStack(stack, path.sep, !!process.env.PWDEBUGIMPL);
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
  }): { outputFile: string, outputDir?: string } | undefined {
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

type TestAttachment = TestResult['attachments'][number];

type TestAttachmentGroup = TestAttachment & {
  expected?: TestAttachment;
  actual?: TestAttachment;
  diff?: TestAttachment;
  previous?: TestAttachment;
};

function groupAttachments(attachments: TestResult['attachments']): TestAttachmentGroup[] {
  const result: TestAttachmentGroup[] = [];
  const attachmentsByPrefix = new Map<string, TestAttachment>();
  for (const attachment of attachments) {
    if (!attachment.path) {
      result.push(attachment);
      continue;
    }

    const match = attachment.name.match(/^(.*)-(expected|actual|diff|previous)(\.[^.]+)?$/);
    if (!match) {
      result.push(attachment);
      continue;
    }

    const [, name, category] = match;
    let group: TestAttachmentGroup | undefined = attachmentsByPrefix.get(name);
    if (!group) {
      group = { ...attachment, name };
      attachmentsByPrefix.set(name, group);
      result.push(group);
    }
    if (category === 'expected')
      group.expected = attachment;
    else if (category === 'actual')
      group.actual = attachment;
    else if (category === 'diff')
      group.diff = attachment;
    else if (category === 'previous')
      group.previous = attachment;
  }
  return result;
}
