"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ZipFile = void 0;
var _zipBundle = require("../zipBundle");
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

class ZipFile {
  constructor(fileName) {
    this._fileName = void 0;
    this._zipFile = void 0;
    this._entries = new Map();
    this._openedPromise = void 0;
    this._fileName = fileName;
    this._openedPromise = this._open();
  }
  async _open() {
    await new Promise((fulfill, reject) => {
      _zipBundle.yauzl.open(this._fileName, {
        autoClose: false
      }, (e, z) => {
        if (e) {
          reject(e);
          return;
        }
        this._zipFile = z;
        this._zipFile.on('entry', entry => {
          this._entries.set(entry.fileName, entry);
        });
        this._zipFile.on('end', fulfill);
      });
    });
  }
  async entries() {
    await this._openedPromise;
    return [...this._entries.keys()];
  }
  async read(entryPath) {
    await this._openedPromise;
    const entry = this._entries.get(entryPath);
    if (!entry) throw new Error(`${entryPath} not found in file ${this._fileName}`);
    return new Promise((resolve, reject) => {
      this._zipFile.openReadStream(entry, (error, readStream) => {
        if (error || !readStream) {
          reject(error || 'Entry not found');
          return;
        }
        const buffers = [];
        readStream.on('data', data => buffers.push(data));
        readStream.on('end', () => resolve(Buffer.concat(buffers)));
      });
    });
  }
  close() {
    var _this$_zipFile;
    (_this$_zipFile = this._zipFile) === null || _this$_zipFile === void 0 || _this$_zipFile.close();
  }
}
exports.ZipFile = ZipFile;