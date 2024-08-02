"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WritableStream = void 0;
var _stream = require("stream");
var _channelOwner = require("./channelOwner");
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

class WritableStream extends _channelOwner.ChannelOwner {
  static from(Stream) {
    return Stream._object;
  }
  constructor(parent, type, guid, initializer) {
    super(parent, type, guid, initializer);
  }
  stream() {
    return new WritableStreamImpl(this._channel);
  }
}
exports.WritableStream = WritableStream;
class WritableStreamImpl extends _stream.Writable {
  constructor(channel) {
    super();
    this._channel = void 0;
    this._channel = channel;
  }
  async _write(chunk, encoding, callback) {
    const error = await this._channel.write({
      binary: typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    }).catch(e => e);
    callback(error || null);
  }
  async _final(callback) {
    // Stream might be destroyed after the connection was closed.
    const error = await this._channel.close().catch(e => e);
    callback(error || null);
  }
}