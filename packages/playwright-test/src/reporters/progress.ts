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
import { BaseReporter } from './base';
import { FullResult, TestCase, TestResult, FullConfig, Suite } from '../../types/testReporter';

const REFRESH_RATE_MS = 150;

class ProgressReporter extends BaseReporter {
  private _completeCount = 0;
  private _skippedCount = 0;
  private _successCount = 0;
  private _failedCount = 0;
  private _timedOutCount = 0;
  private _lastRenderedCount = -1;
  private _lastRenderedPercent = -1;
  private _lastRenderTime = 0;
  private _isLiveTerminal;

  constructor() {
    super();
    this._isLiveTerminal = process.stdout.isTTY;
  }

  printsToStdio() {
    return true;
  }

  override onBegin(config: FullConfig, suite: Suite) {
    super.onBegin(config, suite);
    console.log(this.generateStartingMessage());
  }

  override onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdOut(chunk, test, result);
    if (!this.config.quiet)
      process.stdout.write(chunk);
  }

  override onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    super.onStdErr(chunk, test, result);
    if (!this.config.quiet)
      process.stderr.write(chunk);
  }

  override onTestEnd(test: TestCase, result: TestResult) {
    super.onTestEnd(test, result);
    if (this.willRetry(test))
      return;
    ++this._completeCount;
    if (result.status === 'skipped') {
      ++this._skippedCount;
    } else {
      const outcome = test.outcome();
      if (outcome === 'expected' || outcome === 'flaky') {
        ++this._successCount;
      } else if (outcome === 'unexpected') {
        if (result.status === 'timedOut')
          ++this._timedOutCount;
        else
          ++this._failedCount;
      }
    }
    const currentTime = Date.now();
    if (currentTime - this._lastRenderTime < REFRESH_RATE_MS)
      return;
    this._lastRenderTime = currentTime;
    this._maybeRenderUpdate();
  }

  _maybeRenderUpdate() {
    const percent = Math.round(this._completeCount / this.totalTestCount * 100);

    const shouldSkipRender = (this._isLiveTerminal && this._completeCount === this._lastRenderTime) ||
                             (!this._isLiveTerminal && percent === this._lastRenderedPercent);
    if (shouldSkipRender)
      return;
    this._lastRenderedCount = this._lastRenderedCount;
    this._lastRenderedPercent = percent;

    const maybeRewriteLine = this._isLiveTerminal ? `\u001B[1A\u001B[2K` : '';
    console.log(maybeRewriteLine + [
      `${percent}% [${this._completeCount}/${this.totalTestCount}]`,
      maybeColorColumn(colors.green, `Ok:`, this._successCount),
      maybeColorColumn(colors.yellow, `Skipped:`, this._skippedCount),
      maybeColorColumn(colors.red, `Failed:`, this._failedCount),
      maybeColorColumn(colors.red, `TimedOut:`, this._timedOutCount),
    ].join(' '));
  }

  override async onEnd(result: FullResult) {
    await super.onEnd(result);
    this._maybeRenderUpdate();
    process.stdout.write('\n');
    this.epilogue(true);
  }
}

function maybeColorColumn(color: (x: string) => string, prefix: string, value: number) {
  if (!value)
    color = colors.gray;
  return color(prefix + ' ' + value);
}

export default ProgressReporter;
