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
import * as path from 'path';
import { Test, Suite, Configuration, TestResult } from '../test';
import { BaseReporter } from './base';
import { RunnerConfig } from '../runnerConfig';

const cursorPrevLine = '\u001B[F';
const eraseLine = '\u001B[2K';

type Row = {
  id: string;
  relativeFile: string;
  configuration: string;
  ordinal: number;
  track: string[];
  total: number;
  failed: boolean;
  startTime: number;
  finishTime: number;
};

const statusRows = 2;

class PytestReporter extends BaseReporter {
  private _rows = new Map<string, Row>();
  private _suiteIds = new Map<Suite, string>();
  private _lastOrdinal = 0;
  private _visibleRows: number;
  private _total: number;
  private _progress: string[] = [];
  private _throttler = new Throttler(250, () => this._repaint());

  onBegin(config: RunnerConfig, rootSuite: Suite) {
    super.onBegin(config, rootSuite);
    this._total = rootSuite.total();

    const jobs = Math.min(config.jobs, rootSuite.suites.length);
    this._visibleRows = jobs + Math.min(jobs, 3);  // 3 buffer rows for completed (green) workers.
    for (let i = 0; i < this._visibleRows + statusRows; ++i)  // 4 rows for status
      process.stdout.write('\n');

    for (const s of rootSuite.suites) {
      const relativeFile = path.relative(this.config.testDir, s.file);
      const configurationString = serializeConfiguration(s.configuration);
      const id = relativeFile + `::[${configurationString}]`;
      this._suiteIds.set(s, id);
      const row = {
        id,
        relativeFile,
        configuration: configurationString,
        ordinal: this._lastOrdinal++,
        track: [],
        total: s.total(),
        failed: false,
        startTime: 0,
        finishTime: 0,
      };
      this._rows.set(id, row);
    }
  }

  onTestBegin(test: Test) {
    super.onTestBegin(test);
    const row = this._rows.get(this._id(test));
    if (!row.startTime)
      row.startTime = Date.now();
  }

  onTestStdOut(test: Test, chunk: string | Buffer) {
    this._repaint(chunk);
  }

  onTestStdErr(test: Test, chunk: string | Buffer) {
    this._repaint(chunk);
  }

  onTestEnd(test: Test, result: TestResult) {
    super.onTestEnd(test, result);
    switch (result.status) {
      case 'skipped': {
        this._append(test, colors.yellow('∘'));
        this._progress.push('S');
        this._throttler.schedule();
        break;
      }
      case 'passed': {
        this._append(test, colors.green('✓'));
        this._progress.push('P');
        this._throttler.schedule();
        break;
      }
      case 'failed':
        // fall through
      case 'timedOut': {
        const title = result.status === 'timedOut' ? colors.red('T') : colors.red('F');
        const row = this._append(test, title);
        row.failed = true;
        this._progress.push('F');
        this._repaint(this.formatFailure(test) + '\n');
        break;
      }
    }
  }

  private _append(test: Test, s: string): Row {
    const testId = this._id(test);
    const row = this._rows.get(testId);
    row.track.push(s);
    if (row.track.length === row.total)
      row.finishTime = Date.now();
    return row;
  }

  private _repaint(prependChunk?: string | Buffer) {
    const rowList = [...this._rows.values()];
    const running = rowList.filter(r => r.startTime && !r.finishTime);
    const finished = rowList.filter(r => r.finishTime).sort((a, b) => b.finishTime - a.finishTime);
    const finishedToPrint = finished.slice(0, this._visibleRows - running.length);
    const lines = [];
    for (const row of finishedToPrint.concat(running)) {
      const remaining = row.total - row.track.length;
      const remainder = '·'.repeat(remaining);
      let title = row.relativeFile;
      if (row.finishTime) {
        if (row.failed)
          title = colors.red(row.relativeFile);
        else
          title = colors.green(row.relativeFile);
      }
      const configuration = ` [${colors.gray(row.configuration)}]`;
      lines.push(' ' + title + configuration + ' ' + row.track.join('') + colors.gray(remainder));
    }

    const status = [];
    if (this.asExpected.length)
      status.push(colors.green(`${this.asExpected.length} as expected`));
    if (this.skipped.length)
      status.push(colors.yellow(`${this.skipped.length} skipped`));
    const timedOut = this.unexpected.filter(t => t._hasResultWithStatus('timedOut'));
    if (this.unexpected.length - timedOut.length)
      status.push(colors.red(`${this.unexpected.length - timedOut.length} unexpected failures`));
    if (timedOut.length)
      status.push(colors.red(`${timedOut.length} timed out`));
    status.push(colors.dim(`(${milliseconds(Date.now() - this.startTime)})`));

    for (let i = lines.length; i < this._visibleRows; ++i)
      lines.push('');
    lines.push(this._paintProgress(this._progress.length, this._total));
    lines.push(status.join('  '));
    lines.push('');

    process.stdout.write((cursorPrevLine + eraseLine).repeat(this._visibleRows + statusRows));
    if (prependChunk)
      process.stdout.write(prependChunk);
    process.stdout.write(lines.join('\n'));
  }

  private _id(test: Test): string {
    for (let suite = test.suite; suite; suite = suite.parent) {
      if (this._suiteIds.has(suite))
        return this._suiteIds.get(suite);
    }
    return '';
  }

  private _paintProgress(worked: number, total: number) {
    const length = Math.min(total, 80);
    const cellSize = Math.ceil(total / length);
    const cellNum = (total / cellSize) | 0;
    const bars: string[] = [];
    for (let i = 0; i < cellNum; ++i) {
      let bar = blankBar;
      if (worked < cellSize * i) {
        bars.push(bar);
        continue;
      }
      bar = greenBar;
      for (let j = i * cellSize; j < worked && j < (i + 1) * cellSize; ++j) {
        if (worked < j)
          continue;
        if (this._progress[j] === 'F') {
          bar = redBar;
          break;
        }
        if (this._progress[j] === 'S') {
          bar = yellowBar;
          break;
        }
      }
      bars.push(bar);
    }
    return '[' + bars.join('') + '] ' + worked + '/' + total;
  }
}

const blankBar = '-';
const redBar = colors.red('▇');
const greenBar = colors.green('▇');
const yellowBar = colors.yellow('▇');

function serializeConfiguration(configuration: Configuration): string {
  const tokens = [];
  for (const { name, value } of configuration)
    tokens.push(`${name}=${value}`);
  return tokens.join(', ');
}

class Throttler {
  private _timeout: number;
  private _callback: () => void;
  private _lastFire = 0;
  private _timer: NodeJS.Timeout | null = null;

  constructor(timeout: number, callback: () => void) {
    this._timeout = timeout;
    this._callback = callback;
  }

  schedule() {
    const time = Date.now();
    const timeRemaining = this._lastFire + this._timeout - time;
    if (timeRemaining <= 0) {
      this._fire();
      return;
    }
    if (!this._timer)
      this._timer = setTimeout(() => this._fire(), timeRemaining);
  }

  private _fire() {
    this._timer = null;
    this._lastFire = Date.now();
    this._callback();
  }
}

export default PytestReporter;
