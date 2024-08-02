"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.debugLogger = exports.RecentLogsCollector = void 0;
var _utilsBundle = require("../utilsBundle");
var _fs = _interopRequireDefault(require("fs"));
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

const debugLoggerColorMap = {
  'api': 45,
  // cyan
  'protocol': 34,
  // green
  'install': 34,
  // green
  'download': 34,
  // green
  'browser': 0,
  // reset
  'socks': 92,
  // purple
  'error': 160,
  // red,
  'channel': 33,
  // blue
  'server': 45,
  // cyan
  'server:channel': 34,
  // green
  'server:metadata': 33 // blue
};
class DebugLogger {
  constructor() {
    this._debuggers = new Map();
    if (process.env.DEBUG_FILE) {
      const ansiRegex = new RegExp(['[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)', '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'].join('|'), 'g');
      const stream = _fs.default.createWriteStream(process.env.DEBUG_FILE);
      _utilsBundle.debug.log = data => {
        stream.write(data.replace(ansiRegex, ''));
        stream.write('\n');
      };
    }
  }
  log(name, message) {
    let cachedDebugger = this._debuggers.get(name);
    if (!cachedDebugger) {
      cachedDebugger = (0, _utilsBundle.debug)(`pw:${name}`);
      this._debuggers.set(name, cachedDebugger);
      cachedDebugger.color = debugLoggerColorMap[name] || 0;
    }
    cachedDebugger(message);
  }
  isEnabled(name) {
    return _utilsBundle.debug.enabled(`pw:${name}`);
  }
}
const debugLogger = exports.debugLogger = new DebugLogger();
const kLogCount = 150;
class RecentLogsCollector {
  constructor() {
    this._logs = [];
  }
  log(message) {
    this._logs.push(message);
    if (this._logs.length === kLogCount * 2) this._logs.splice(0, kLogCount);
  }
  recentLogs() {
    if (this._logs.length > kLogCount) return this._logs.slice(-kLogCount);
    return this._logs;
  }
}
exports.RecentLogsCollector = RecentLogsCollector;