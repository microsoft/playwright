"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Artifact = void 0;
var fs = _interopRequireWildcard(require("fs"));
var _stream = require("./stream");
var _fileUtils = require("../utils/fileUtils");
var _channelOwner = require("./channelOwner");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
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

class Artifact extends _channelOwner.ChannelOwner {
  static from(channel) {
    return channel._object;
  }
  async pathAfterFinished() {
    if (this._connection.isRemote()) throw new Error(`Path is not available when connecting remotely. Use saveAs() to save a local copy.`);
    return (await this._channel.pathAfterFinished()).value;
  }
  async saveAs(path) {
    if (!this._connection.isRemote()) {
      await this._channel.saveAs({
        path
      });
      return;
    }
    const result = await this._channel.saveAsStream();
    const stream = _stream.Stream.from(result.stream);
    await (0, _fileUtils.mkdirIfNeeded)(path);
    await new Promise((resolve, reject) => {
      stream.stream().pipe(fs.createWriteStream(path)).on('finish', resolve).on('error', reject);
    });
  }
  async failure() {
    return (await this._channel.failure()).error || null;
  }
  async createReadStream() {
    const result = await this._channel.stream();
    const stream = _stream.Stream.from(result.stream);
    return stream.stream();
  }
  async readIntoBuffer() {
    const stream = await this.createReadStream();
    return await new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', chunk => {
        chunks.push(chunk);
      });
      stream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      stream.on('error', reject);
    });
  }
  async cancel() {
    return await this._channel.cancel();
  }
  async delete() {
    return await this._channel.delete();
  }
}
exports.Artifact = Artifact;