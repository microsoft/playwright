"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addInternalStackPrefix = void 0;
exports.captureLibraryStackText = captureLibraryStackText;
exports.captureLibraryStackTrace = captureLibraryStackTrace;
exports.captureRawStack = captureRawStack;
exports.formatCallLog = formatCallLog;
exports.rewriteErrorMessage = rewriteErrorMessage;
exports.splitErrorMessage = splitErrorMessage;
exports.stringifyStackFrames = stringifyStackFrames;
var _path = _interopRequireDefault(require("path"));
var _utilsBundle = require("../utilsBundle");
var _ = require("./");
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

function rewriteErrorMessage(e, newMessage) {
  var _e$stack;
  const lines = (((_e$stack = e.stack) === null || _e$stack === void 0 ? void 0 : _e$stack.split('\n')) || []).filter(l => l.startsWith('    at '));
  e.message = newMessage;
  const errorTitle = `${e.name}: ${e.message}`;
  if (lines.length) e.stack = `${errorTitle}\n${lines.join('\n')}`;
  return e;
}
const CORE_DIR = _path.default.resolve(__dirname, '..', '..');
const internalStackPrefixes = [CORE_DIR];
const addInternalStackPrefix = prefix => internalStackPrefixes.push(prefix);
exports.addInternalStackPrefix = addInternalStackPrefix;
function captureRawStack() {
  const stackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 50;
  const error = new Error();
  const stack = error.stack || '';
  Error.stackTraceLimit = stackTraceLimit;
  return stack.split('\n');
}
function captureLibraryStackTrace() {
  const stack = captureRawStack();
  const isTesting = (0, _.isUnderTest)();
  let parsedFrames = stack.map(line => {
    const frame = (0, _utilsBundle.parseStackTraceLine)(line);
    if (!frame || !frame.file) return null;
    const isPlaywrightLibrary = frame.file.startsWith(CORE_DIR);
    const parsed = {
      frame,
      frameText: line,
      isPlaywrightLibrary
    };
    return parsed;
  }).filter(Boolean);
  let apiName = '';

  // Deepest transition between non-client code calling into client
  // code is the api entry.
  for (let i = 0; i < parsedFrames.length - 1; i++) {
    const parsedFrame = parsedFrames[i];
    if (parsedFrame.isPlaywrightLibrary && !parsedFrames[i + 1].isPlaywrightLibrary) {
      apiName = apiName || normalizeAPIName(parsedFrame.frame.function);
      break;
    }
  }
  function normalizeAPIName(name) {
    if (!name) return '';
    const match = name.match(/(API|JS|CDP|[A-Z])(.*)/);
    if (!match) return name;
    return match[1].toLowerCase() + match[2];
  }

  // This is for the inspector so that it did not include the test runner stack frames.
  parsedFrames = parsedFrames.filter(f => {
    if (process.env.PWDEBUGIMPL) return true;
    if (internalStackPrefixes.some(prefix => f.frame.file.startsWith(prefix))) return false;
    return true;
  });
  return {
    frames: parsedFrames.map(p => p.frame),
    apiName
  };
}
function stringifyStackFrames(frames) {
  const stackLines = [];
  for (const frame of frames) {
    if (frame.function) stackLines.push(`    at ${frame.function} (${frame.file}:${frame.line}:${frame.column})`);else stackLines.push(`    at ${frame.file}:${frame.line}:${frame.column}`);
  }
  return stackLines;
}
function captureLibraryStackText() {
  const parsed = captureLibraryStackTrace();
  return stringifyStackFrames(parsed.frames).join('\n');
}
function splitErrorMessage(message) {
  const separationIdx = message.indexOf(':');
  return {
    name: separationIdx !== -1 ? message.slice(0, separationIdx) : '',
    message: separationIdx !== -1 && separationIdx + 2 <= message.length ? message.substring(separationIdx + 2) : message
  };
}
function formatCallLog(log) {
  if (!log || !log.some(l => !!l)) return '';
  return `
Call log:
  ${_utilsBundle.colors.dim('- ' + (log || []).join('\n  - '))}
`;
}