"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createReporterForTestServer = createReporterForTestServer;
exports.createReporters = createReporters;
var _path = _interopRequireDefault(require("path"));
var _base = require("../reporters/base");
var _dot = _interopRequireDefault(require("../reporters/dot"));
var _empty = _interopRequireDefault(require("../reporters/empty"));
var _github = _interopRequireDefault(require("../reporters/github"));
var _html = _interopRequireDefault(require("../reporters/html"));
var _json = _interopRequireDefault(require("../reporters/json"));
var _junit = _interopRequireDefault(require("../reporters/junit"));
var _line = _interopRequireDefault(require("../reporters/line"));
var _list = _interopRequireDefault(require("../reporters/list"));
var _markdown = _interopRequireDefault(require("../reporters/markdown"));
var _loadUtils = require("./loadUtils");
var _blob = require("../reporters/blob");
var _reporterV = require("../reporters/reporterV2");
var _utils = require("playwright-core/lib/utils");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

async function createReporters(config, mode, isTestServer, descriptions) {
  var _descriptions;
  const defaultReporters = {
    blob: _blob.BlobReporter,
    dot: mode === 'list' ? ListModeReporter : _dot.default,
    line: mode === 'list' ? ListModeReporter : _line.default,
    list: mode === 'list' ? ListModeReporter : _list.default,
    github: _github.default,
    json: _json.default,
    junit: _junit.default,
    null: _empty.default,
    html: _html.default,
    markdown: _markdown.default
  };
  const reporters = [];
  (_descriptions = descriptions) !== null && _descriptions !== void 0 ? _descriptions : descriptions = config.config.reporter;
  if (config.configCLIOverrides.additionalReporters) descriptions = [...descriptions, ...config.configCLIOverrides.additionalReporters];
  const runOptions = reporterOptions(config, mode, isTestServer);
  for (const r of descriptions) {
    const [name, arg] = r;
    const options = {
      ...runOptions,
      ...arg
    };
    if (name in defaultReporters) {
      reporters.push(new defaultReporters[name](options));
    } else {
      const reporterConstructor = await (0, _loadUtils.loadReporter)(config, name);
      reporters.push((0, _reporterV.wrapReporterAsV2)(new reporterConstructor(options)));
    }
  }
  if (process.env.PW_TEST_REPORTER) {
    const reporterConstructor = await (0, _loadUtils.loadReporter)(config, process.env.PW_TEST_REPORTER);
    reporters.push((0, _reporterV.wrapReporterAsV2)(new reporterConstructor(runOptions)));
  }
  const someReporterPrintsToStdio = reporters.some(r => r.printsToStdio());
  if (reporters.length && !someReporterPrintsToStdio) {
    // Add a line/dot/list-mode reporter for convenience.
    // Important to put it first, just in case some other reporter stalls onEnd.
    if (mode === 'list') reporters.unshift(new ListModeReporter());else if (mode !== 'merge') reporters.unshift(!process.env.CI ? new _line.default({
      omitFailures: true
    }) : new _dot.default());
  }
  return reporters;
}
async function createReporterForTestServer(file, messageSink) {
  const reporterConstructor = await (0, _loadUtils.loadReporter)(null, file);
  return (0, _reporterV.wrapReporterAsV2)(new reporterConstructor({
    _send: messageSink
  }));
}
function reporterOptions(config, mode, isTestServer) {
  return {
    configDir: config.configDir,
    _mode: mode,
    _isTestServer: isTestServer,
    _commandHash: computeCommandHash(config)
  };
}
function computeCommandHash(config) {
  const parts = [];
  // Include project names for readability.
  if (config.cliProjectFilter) parts.push(...config.cliProjectFilter);
  const command = {};
  if (config.cliArgs.length) command.cliArgs = config.cliArgs;
  if (config.cliGrep) command.cliGrep = config.cliGrep;
  if (config.cliGrepInvert) command.cliGrepInvert = config.cliGrepInvert;
  if (Object.keys(command).length) parts.push((0, _utils.calculateSha1)(JSON.stringify(command)).substring(0, 7));
  return parts.join('-');
}
class ListModeReporter extends _empty.default {
  constructor(...args) {
    super(...args);
    this.config = void 0;
  }
  onConfigure(config) {
    this.config = config;
  }
  onBegin(suite) {
    // eslint-disable-next-line no-console
    console.log(`Listing tests:`);
    const tests = suite.allTests();
    const files = new Set();
    for (const test of tests) {
      // root, project, file, ...describes, test
      const [, projectName,, ...titles] = test.titlePath();
      const location = `${_path.default.relative(this.config.rootDir, test.location.file)}:${test.location.line}:${test.location.column}`;
      const projectTitle = projectName ? `[${projectName}] › ` : '';
      // eslint-disable-next-line no-console
      console.log(`  ${projectTitle}${location} › ${titles.join(' › ')}`);
      files.add(test.location.file);
    }
    // eslint-disable-next-line no-console
    console.log(`Total: ${tests.length} ${tests.length === 1 ? 'test' : 'tests'} in ${files.size} ${files.size === 1 ? 'file' : 'files'}`);
  }
  onError(error) {
    // eslint-disable-next-line no-console
    console.error('\n' + (0, _base.formatError)(error, false).message);
  }
  printsToStdio() {
    return true;
  }
}