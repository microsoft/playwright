"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PipeTransport = void 0;
var _utils = require("../utils");
var _debugLogger = require("../utils/debugLogger");
/**
 * Copyright 2018 Google Inc. All rights reserved.
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

class PipeTransport {
  constructor(pipeWrite, pipeRead) {
    this._pipeRead = void 0;
    this._pipeWrite = void 0;
    this._pendingBuffers = [];
    this._waitForNextTask = (0, _utils.makeWaitForNextTask)();
    this._closed = false;
    this._onclose = void 0;
    this.onmessage = void 0;
    this._pipeRead = pipeRead;
    this._pipeWrite = pipeWrite;
    pipeRead.on('data', buffer => this._dispatch(buffer));
    pipeRead.on('close', () => {
      this._closed = true;
      if (this._onclose) this._onclose.call(null);
    });
    pipeRead.on('error', e => _debugLogger.debugLogger.log('error', e));
    pipeWrite.on('error', e => _debugLogger.debugLogger.log('error', e));
    this.onmessage = undefined;
  }
  get onclose() {
    return this._onclose;
  }
  set onclose(onclose) {
    this._onclose = onclose;
    if (onclose && !this._pipeRead.readable) onclose();
  }
  send(message) {
    if (this._closed) throw new Error('Pipe has been closed');
    this._pipeWrite.write(JSON.stringify(message));
    this._pipeWrite.write('\0');
  }
  close() {
    throw new Error('unimplemented');
  }
  _dispatch(buffer) {
    let end = buffer.indexOf('\0');
    if (end === -1) {
      this._pendingBuffers.push(buffer);
      return;
    }
    this._pendingBuffers.push(buffer.slice(0, end));
    const message = Buffer.concat(this._pendingBuffers).toString();
    this._waitForNextTask(() => {
      if (this.onmessage) this.onmessage.call(null, JSON.parse(message));
    });
    let start = end + 1;
    end = buffer.indexOf('\0', start);
    while (end !== -1) {
      const message = buffer.toString(undefined, start, end);
      this._waitForNextTask(() => {
        if (this.onmessage) this.onmessage.call(null, JSON.parse(message));
      });
      start = end + 1;
      end = buffer.indexOf('\0', start);
    }
    this._pendingBuffers = [buffer.slice(start)];
  }
}
exports.PipeTransport = PipeTransport;