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

class DotReporter extends _base.BaseReporter {
  constructor(...args) {
    super(...args);
    this._counter = 0;
  }
  printsToStdio() {
    return true;
  }
  onBegin(suite) {
    super.onBegin(suite);
    console.log(this.generateStartingMessage());
  }
  onStdOut(chunk, test, result) {
    super.onStdOut(chunk, test, result);
    if (!this.config.quiet) process.stdout.write(chunk);
  }
  onStdErr(chunk, test, result) {
    super.onStdErr(chunk, test, result);
    if (!this.config.quiet) process.stderr.write(chunk);
  }
  onTestEnd(test, result) {
    super.onTestEnd(test, result);
    if (this._counter === 80) {
      process.stdout.write('\n');
      this._counter = 0;
    }
    ++this._counter;
    if (result.status === 'skipped') {
      process.stdout.write(_base.colors.yellow('°'));
      return;
    }
    if (this.willRetry(test)) {
      process.stdout.write(_base.colors.gray('×'));
      return;
    }
    switch (test.outcome()) {
      case 'expected':
        process.stdout.write(_base.colors.green('·'));
        break;
      case 'unexpected':
        process.stdout.write(_base.colors.red(result.status === 'timedOut' ? 'T' : 'F'));
        break;
      case 'flaky':
        process.stdout.write(_base.colors.yellow('±'));
        break;
    }
  }
  onError(error) {
    super.onError(error);
    console.log('\n' + (0, _base.formatError)(error, _base.colors.enabled).message);
    this._counter = 0;
  }
  async onEnd(result) {
    await super.onEnd(result);
    process.stdout.write('\n');
    this.epilogue(true);
  }
}
var _default = exports.default = DotReporter;