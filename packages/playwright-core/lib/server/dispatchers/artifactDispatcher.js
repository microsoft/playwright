"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ArtifactDispatcher = void 0;
var _dispatcher = require("./dispatcher");
var _streamDispatcher = require("./streamDispatcher");
var _fs = _interopRequireDefault(require("fs"));
var _fileUtils = require("../../utils/fileUtils");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

class ArtifactDispatcher extends _dispatcher.Dispatcher {
  static from(parentScope, artifact) {
    return ArtifactDispatcher.fromNullable(parentScope, artifact);
  }
  static fromNullable(parentScope, artifact) {
    if (!artifact) return undefined;
    const result = (0, _dispatcher.existingDispatcher)(artifact);
    return result || new ArtifactDispatcher(parentScope, artifact);
  }
  constructor(scope, artifact) {
    super(scope, artifact, 'Artifact', {
      absolutePath: artifact.localPath()
    });
    this._type_Artifact = true;
  }
  async pathAfterFinished() {
    const path = await this._object.localPathAfterFinished();
    return {
      value: path
    };
  }
  async saveAs(params) {
    return await new Promise((resolve, reject) => {
      this._object.saveAs(async (localPath, error) => {
        if (error) {
          reject(error);
          return;
        }
        try {
          await (0, _fileUtils.mkdirIfNeeded)(params.path);
          await _fs.default.promises.copyFile(localPath, params.path);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  }
  async saveAsStream() {
    return await new Promise((resolve, reject) => {
      this._object.saveAs(async (localPath, error) => {
        if (error) {
          reject(error);
          return;
        }
        try {
          const readable = _fs.default.createReadStream(localPath, {
            highWaterMark: 1024 * 1024
          });
          const stream = new _streamDispatcher.StreamDispatcher(this, readable);
          // Resolve with a stream, so that client starts saving the data.
          resolve({
            stream
          });
          // Block the Artifact until the stream is consumed.
          await new Promise(resolve => {
            readable.on('close', resolve);
            readable.on('end', resolve);
            readable.on('error', resolve);
          });
        } catch (e) {
          reject(e);
        }
      });
    });
  }
  async stream() {
    const fileName = await this._object.localPathAfterFinished();
    const readable = _fs.default.createReadStream(fileName, {
      highWaterMark: 1024 * 1024
    });
    return {
      stream: new _streamDispatcher.StreamDispatcher(this, readable)
    };
  }
  async failure() {
    const error = await this._object.failureError();
    return {
      error: error || undefined
    };
  }
  async cancel() {
    await this._object.cancel();
  }
  async delete(_, metadata) {
    metadata.potentiallyClosesScope = true;
    await this._object.delete();
    this._dispose();
  }
}
exports.ArtifactDispatcher = ArtifactDispatcher;