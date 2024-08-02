"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.GitHubReporter = void 0;
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _path = _interopRequireDefault(require("path"));
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

class GitHubLogger {
  _log(message, type = 'notice', options = {}) {
    message = message.replace(/\n/g, '%0A');
    const configs = Object.entries(options).map(([key, option]) => `${key}=${option}`).join(',');
    console.log((0, _base.stripAnsiEscapes)(`::${type} ${configs}::${message}`));
  }
  debug(message, options) {
    this._log(message, 'debug', options);
  }
  error(message, options) {
    this._log(message, 'error', options);
  }
  notice(message, options) {
    this._log(message, 'notice', options);
  }
  warning(message, options) {
    this._log(message, 'warning', options);
  }
}
class GitHubReporter extends _base.BaseReporter {
  constructor(...args) {
    super(...args);
    this.githubLogger = new GitHubLogger();
  }
  printsToStdio() {
    return false;
  }
  async onEnd(result) {
    await super.onEnd(result);
    this._printAnnotations();
  }
  onError(error) {
    const errorMessage = (0, _base.formatError)(error, false).message;
    this.githubLogger.error(errorMessage);
  }
  _printAnnotations() {
    const summary = this.generateSummary();
    const summaryMessage = this.generateSummaryMessage(summary);
    if (summary.failuresToPrint.length) this._printFailureAnnotations(summary.failuresToPrint);
    this._printSlowTestAnnotations();
    this._printSummaryAnnotation(summaryMessage);
  }
  _printSlowTestAnnotations() {
    this.getSlowTests().forEach(([file, duration]) => {
      const filePath = workspaceRelativePath(_path.default.join(process.cwd(), file));
      this.githubLogger.warning(`${filePath} took ${(0, _utilsBundle.ms)(duration)}`, {
        title: 'Slow Test',
        file: filePath
      });
    });
  }
  _printSummaryAnnotation(summary) {
    this.githubLogger.notice(summary, {
      title: '🎭 Playwright Run Summary'
    });
  }
  _printFailureAnnotations(failures) {
    failures.forEach((test, index) => {
      const {
        annotations
      } = (0, _base.formatFailure)(this.config, test, {
        index: index + 1,
        includeStdio: true,
        includeAttachments: false
      });
      annotations.forEach(({
        location,
        title,
        message
      }) => {
        const options = {
          file: workspaceRelativePath((location === null || location === void 0 ? void 0 : location.file) || test.location.file),
          title
        };
        if (location) {
          options.line = location.line;
          options.col = location.column;
        }
        this.githubLogger.error(message, options);
      });
    });
  }
}
exports.GitHubReporter = GitHubReporter;
function workspaceRelativePath(filePath) {
  var _process$env$GITHUB_W;
  return _path.default.relative((_process$env$GITHUB_W = process.env['GITHUB_WORKSPACE']) !== null && _process$env$GITHUB_W !== void 0 ? _process$env$GITHUB_W : '', filePath);
}
var _default = exports.default = GitHubReporter;