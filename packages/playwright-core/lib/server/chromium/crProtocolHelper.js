"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.exceptionToError = exceptionToError;
exports.getExceptionMessage = getExceptionMessage;
exports.readProtocolStream = readProtocolStream;
exports.releaseObject = releaseObject;
exports.saveProtocolStream = saveProtocolStream;
exports.toButtonsMask = toButtonsMask;
exports.toConsoleMessageLocation = toConsoleMessageLocation;
exports.toModifiersMask = toModifiersMask;
var _fs = _interopRequireDefault(require("fs"));
var _fileUtils = require("../../utils/fileUtils");
var _stackTrace = require("../../utils/stackTrace");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

function getExceptionMessage(exceptionDetails) {
  if (exceptionDetails.exception) return exceptionDetails.exception.description || String(exceptionDetails.exception.value);
  let message = exceptionDetails.text;
  if (exceptionDetails.stackTrace) {
    for (const callframe of exceptionDetails.stackTrace.callFrames) {
      const location = callframe.url + ':' + callframe.lineNumber + ':' + callframe.columnNumber;
      const functionName = callframe.functionName || '<anonymous>';
      message += `\n    at ${functionName} (${location})`;
    }
  }
  return message;
}
async function releaseObject(client, objectId) {
  await client.send('Runtime.releaseObject', {
    objectId
  }).catch(error => {});
}
async function saveProtocolStream(client, handle, path) {
  let eof = false;
  await (0, _fileUtils.mkdirIfNeeded)(path);
  const fd = await _fs.default.promises.open(path, 'w');
  while (!eof) {
    const response = await client.send('IO.read', {
      handle
    });
    eof = response.eof;
    const buf = Buffer.from(response.data, response.base64Encoded ? 'base64' : undefined);
    await fd.write(buf);
  }
  await fd.close();
  await client.send('IO.close', {
    handle
  });
}
async function readProtocolStream(client, handle) {
  let eof = false;
  const chunks = [];
  while (!eof) {
    const response = await client.send('IO.read', {
      handle
    });
    eof = response.eof;
    const buf = Buffer.from(response.data, response.base64Encoded ? 'base64' : undefined);
    chunks.push(buf);
  }
  await client.send('IO.close', {
    handle
  });
  return Buffer.concat(chunks);
}
function toConsoleMessageLocation(stackTrace) {
  return stackTrace && stackTrace.callFrames.length ? {
    url: stackTrace.callFrames[0].url,
    lineNumber: stackTrace.callFrames[0].lineNumber,
    columnNumber: stackTrace.callFrames[0].columnNumber
  } : {
    url: '',
    lineNumber: 0,
    columnNumber: 0
  };
}
function exceptionToError(exceptionDetails) {
  const messageWithStack = getExceptionMessage(exceptionDetails);
  const lines = messageWithStack.split('\n');
  const firstStackTraceLine = lines.findIndex(line => line.startsWith('    at'));
  let messageWithName = '';
  let stack = '';
  if (firstStackTraceLine === -1) {
    messageWithName = messageWithStack;
  } else {
    messageWithName = lines.slice(0, firstStackTraceLine).join('\n');
    stack = messageWithStack;
  }
  const {
    name,
    message
  } = (0, _stackTrace.splitErrorMessage)(messageWithName);
  const err = new Error(message);
  err.stack = stack;
  err.name = name;
  return err;
}
function toModifiersMask(modifiers) {
  let mask = 0;
  if (modifiers.has('Alt')) mask |= 1;
  if (modifiers.has('Control')) mask |= 2;
  if (modifiers.has('Meta')) mask |= 4;
  if (modifiers.has('Shift')) mask |= 8;
  return mask;
}
function toButtonsMask(buttons) {
  let mask = 0;
  if (buttons.has('left')) mask |= 1;
  if (buttons.has('right')) mask |= 2;
  if (buttons.has('middle')) mask |= 4;
  return mask;
}