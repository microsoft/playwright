"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _base = require("./base");
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

class LineReporter extends _base.BaseReporter {
  constructor(...args) {
    super(...args);
    this._current = 0;
    this._failures = 0;
    this._lastTest = void 0;
    this._didBegin = false;
  }
  printsToStdio() {
    return true;
  }
  onBegin(suite) {
    super.onBegin(suite);
    const startingMessage = this.generateStartingMessage();
    if (startingMessage) {
      console.log(startingMessage);
      console.log();
    }
    this._didBegin = true;
  }
  onStdOut(chunk, test, result) {
    super.onStdOut(chunk, test, result);
    this._dumpToStdio(test, chunk, process.stdout);
  }
  onStdErr(chunk, test, result) {
    super.onStdErr(chunk, test, result);
    this._dumpToStdio(test, chunk, process.stderr);
  }
  _dumpToStdio(test, chunk, stream) {
    if (this.config.quiet) return;
    if (!process.env.PW_TEST_DEBUG_REPORTERS) stream.write(`\u001B[1A\u001B[2K`);
    if (test && this._lastTest !== test) {
      // Write new header for the output.
      const title = _base.colors.dim((0, _base.formatTestTitle)(this.config, test));
      stream.write(this.fitToScreen(title) + `\n`);
      this._lastTest = test;
    }
    stream.write(chunk);
    if (chunk[chunk.length - 1] !== '\n') console.log();
    console.log();
  }
  onTestBegin(test, result) {
    super.onTestBegin(test, result);
    ++this._current;
    this._updateLine(test, result, undefined);
  }
  onStepBegin(test, result, step) {
    super.onStepBegin(test, result, step);
    if (step.category === 'test.step') this._updateLine(test, result, step);
  }
  onStepEnd(test, result, step) {
    super.onStepEnd(test, result, step);
    if (step.category === 'test.step') this._updateLine(test, result, step.parent);
  }
  onTestEnd(test, result) {
    super.onTestEnd(test, result);
    if (!this.willRetry(test) && (test.outcome() === 'flaky' || test.outcome() === 'unexpected' || result.status === 'interrupted')) {
      if (!process.env.PW_TEST_DEBUG_REPORTERS) process.stdout.write(`\u001B[1A\u001B[2K`);
      console.log((0, _base.formatFailure)(this.config, test, {
        index: ++this._failures
      }).message);
      console.log();
    }
  }
  _updateLine(test, result, step) {
    const retriesPrefix = this.totalTestCount < this._current ? ` (retries)` : ``;
    const prefix = `[${this._current}/${this.totalTestCount}]${retriesPrefix} `;
    const currentRetrySuffix = result.retry ? _base.colors.yellow(` (retry #${result.retry})`) : '';
    const title = (0, _base.formatTestTitle)(this.config, test, step) + currentRetrySuffix;
    if (process.env.PW_TEST_DEBUG_REPORTERS) process.stdout.write(`${prefix + title}\n`);else process.stdout.write(`\u001B[1A\u001B[2K${prefix + this.fitToScreen(title, prefix)}\n`);
  }
  onError(error) {
    super.onError(error);
    const message = (0, _base.formatError)(error, _base.colors.enabled).message + '\n';
    if (!process.env.PW_TEST_DEBUG_REPORTERS && this._didBegin) process.stdout.write(`\u001B[1A\u001B[2K`);
    process.stdout.write(message);
    console.log();
  }
  async onEnd(result) {
    if (!process.env.PW_TEST_DEBUG_REPORTERS && this._didBegin) process.stdout.write(`\u001B[1A\u001B[2K`);
    await super.onEnd(result);
    this.epilogue(false);
  }
}
var _default = exports.default = LineReporter;