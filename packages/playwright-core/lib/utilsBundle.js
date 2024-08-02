"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.minimatch = exports.mime = exports.lockfile = exports.jpegjs = exports.getProxyForUrl = exports.debug = exports.colors = exports.SocksProxyAgent = exports.PNG = exports.HttpsProxyAgent = void 0;
exports.ms = ms;
exports.open = void 0;
exports.parseStackTraceLine = parseStackTraceLine;
exports.wsServer = exports.wsSender = exports.wsReceiver = exports.ws = exports.progress = exports.program = void 0;
var _url = _interopRequireDefault(require("url"));
var _path = _interopRequireDefault(require("path"));
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

const colors = exports.colors = require('./utilsBundleImpl').colors;
const debug = exports.debug = require('./utilsBundleImpl').debug;
const getProxyForUrl = exports.getProxyForUrl = require('./utilsBundleImpl').getProxyForUrl;
const HttpsProxyAgent = exports.HttpsProxyAgent = require('./utilsBundleImpl').HttpsProxyAgent;
const jpegjs = exports.jpegjs = require('./utilsBundleImpl').jpegjs;
const lockfile = exports.lockfile = require('./utilsBundleImpl').lockfile;
const mime = exports.mime = require('./utilsBundleImpl').mime;
const minimatch = exports.minimatch = require('./utilsBundleImpl').minimatch;
const open = exports.open = require('./utilsBundleImpl').open;
const PNG = exports.PNG = require('./utilsBundleImpl').PNG;
const program = exports.program = require('./utilsBundleImpl').program;
const progress = exports.progress = require('./utilsBundleImpl').progress;
const SocksProxyAgent = exports.SocksProxyAgent = require('./utilsBundleImpl').SocksProxyAgent;
const ws = exports.ws = require('./utilsBundleImpl').ws;
const wsServer = exports.wsServer = require('./utilsBundleImpl').wsServer;
const wsReceiver = exports.wsReceiver = require('./utilsBundleImpl').wsReceiver;
const wsSender = exports.wsSender = require('./utilsBundleImpl').wsSender;
const StackUtils = require('./utilsBundleImpl').StackUtils;
const stackUtils = new StackUtils({
  internals: StackUtils.nodeInternals()
});
const nodeInternals = StackUtils.nodeInternals();
const nodeMajorVersion = +process.versions.node.split('.')[0];
function parseStackTraceLine(line) {
  var _frame$file, _frame$file2;
  if (!process.env.PWDEBUGIMPL && nodeMajorVersion < 16 && nodeInternals.some(internal => internal.test(line))) return null;
  const frame = stackUtils.parseLine(line);
  if (!frame) return null;
  if (!process.env.PWDEBUGIMPL && ((_frame$file = frame.file) !== null && _frame$file !== void 0 && _frame$file.startsWith('internal') || (_frame$file2 = frame.file) !== null && _frame$file2 !== void 0 && _frame$file2.startsWith('node:'))) return null;
  if (!frame.file) return null;
  // ESM files return file:// URLs, see here: https://github.com/tapjs/stack-utils/issues/60
  const file = frame.file.startsWith('file://') ? _url.default.fileURLToPath(frame.file) : _path.default.resolve(process.cwd(), frame.file);
  return {
    file,
    line: frame.line || 0,
    column: frame.column || 0,
    function: frame.function
  };
}
function ms(ms) {
  if (!isFinite(ms)) return '-';
  if (ms === 0) return '0ms';
  if (ms < 1000) return ms.toFixed(0) + 'ms';
  const seconds = ms / 1000;
  if (seconds < 60) return seconds.toFixed(1) + 's';
  const minutes = seconds / 60;
  if (minutes < 60) return minutes.toFixed(1) + 'm';
  const hours = minutes / 60;
  if (hours < 24) return hours.toFixed(1) + 'h';
  const days = hours / 24;
  return days.toFixed(1) + 'd';
}