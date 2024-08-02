"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _util = require("../util");
var _base = require("./base");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
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

class MarkdownReporter extends _base.BaseReporter {
  constructor(options) {
    super();
    this._options = void 0;
    this._options = options;
  }
  printsToStdio() {
    return false;
  }
  async onEnd(result) {
    await super.onEnd(result);
    const summary = this.generateSummary();
    const lines = [];
    if (summary.fatalErrors.length) lines.push(`**${summary.fatalErrors.length} fatal errors, not part of any test**`);
    if (summary.unexpected.length) {
      lines.push(`**${summary.unexpected.length} failed**`);
      this._printTestList(':x:', summary.unexpected, lines);
    }
    if (summary.flaky.length) {
      lines.push(`<details>`);
      lines.push(`<summary><b>${summary.flaky.length} flaky</b></summary>`);
      this._printTestList(':warning:', summary.flaky, lines, ' <br/>');
      lines.push(`</details>`);
      lines.push(``);
    }
    if (summary.interrupted.length) {
      lines.push(`<details>`);
      lines.push(`<summary><b>${summary.interrupted.length} interrupted</b></summary>`);
      this._printTestList(':warning:', summary.interrupted, lines, ' <br/>');
      lines.push(`</details>`);
      lines.push(``);
    }
    const skipped = summary.skipped ? `, ${summary.skipped} skipped` : '';
    const didNotRun = summary.didNotRun ? `, ${summary.didNotRun} did not run` : '';
    lines.push(`**${summary.expected} passed${skipped}${didNotRun}**`);
    lines.push(`:heavy_check_mark::heavy_check_mark::heavy_check_mark:`);
    lines.push(``);
    const reportFile = (0, _util.resolveReporterOutputPath)('report.md', this._options.configDir, this._options.outputFile);
    await _fs.default.promises.mkdir(_path.default.dirname(reportFile), {
      recursive: true
    });
    await _fs.default.promises.writeFile(reportFile, lines.join('\n'));
  }
  _printTestList(prefix, tests, lines, suffix) {
    for (const test of tests) lines.push(`${prefix} ${(0, _base.formatTestTitle)(this.config, test)}${suffix || ''}`);
    lines.push(``);
  }
}
var _default = exports.default = MarkdownReporter;