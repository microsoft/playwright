"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SerializedFS = void 0;
exports.canAccessFile = canAccessFile;
exports.copyFileAndMakeWritable = copyFileAndMakeWritable;
exports.fileUploadSizeLimit = exports.existsAsync = void 0;
exports.mkdirIfNeeded = mkdirIfNeeded;
exports.removeFolders = removeFolders;
exports.sanitizeForFilePath = sanitizeForFilePath;
exports.toPosixPath = toPosixPath;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _manualPromise = require("./manualPromise");
var _zipBundle = require("../zipBundle");
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

const fileUploadSizeLimit = exports.fileUploadSizeLimit = 50 * 1024 * 1024;
const existsAsync = path => new Promise(resolve => _fs.default.stat(path, err => resolve(!err)));
exports.existsAsync = existsAsync;
async function mkdirIfNeeded(filePath) {
  // This will harmlessly throw on windows if the dirname is the root directory.
  await _fs.default.promises.mkdir(_path.default.dirname(filePath), {
    recursive: true
  }).catch(() => {});
}
async function removeFolders(dirs) {
  return await Promise.all(dirs.map(dir => _fs.default.promises.rm(dir, {
    recursive: true,
    force: true,
    maxRetries: 10
  }).catch(e => e)));
}
function canAccessFile(file) {
  if (!file) return false;
  try {
    _fs.default.accessSync(file);
    return true;
  } catch (e) {
    return false;
  }
}
async function copyFileAndMakeWritable(from, to) {
  await _fs.default.promises.copyFile(from, to);
  await _fs.default.promises.chmod(to, 0o664);
}
function sanitizeForFilePath(s) {
  return s.replace(/[\x00-\x2C\x2E-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g, '-');
}
function toPosixPath(aPath) {
  return aPath.split(_path.default.sep).join(_path.default.posix.sep);
}
class SerializedFS {
  constructor() {
    this._buffers = new Map();
    // Should never be accessed from within appendOperation.
    this._error = void 0;
    this._operations = [];
    this._operationsDone = void 0;
    this._operationsDone = new _manualPromise.ManualPromise();
    this._operationsDone.resolve(); // No operations scheduled yet.
  }
  mkdir(dir) {
    this._appendOperation({
      op: 'mkdir',
      dir
    });
  }
  writeFile(file, content, skipIfExists) {
    this._buffers.delete(file); // No need to flush the buffer since we'll overwrite anyway.
    this._appendOperation({
      op: 'writeFile',
      file,
      content,
      skipIfExists
    });
  }
  appendFile(file, text, flush) {
    if (!this._buffers.has(file)) this._buffers.set(file, []);
    this._buffers.get(file).push(text);
    if (flush) this._flushFile(file);
  }
  _flushFile(file) {
    const buffer = this._buffers.get(file);
    if (buffer === undefined) return;
    const content = buffer.join('');
    this._buffers.delete(file);
    this._appendOperation({
      op: 'appendFile',
      file,
      content
    });
  }
  copyFile(from, to) {
    this._flushFile(from);
    this._buffers.delete(to); // No need to flush the buffer since we'll overwrite anyway.
    this._appendOperation({
      op: 'copyFile',
      from,
      to
    });
  }
  async syncAndGetError() {
    for (const file of this._buffers.keys()) this._flushFile(file);
    await this._operationsDone;
    return this._error;
  }
  zip(entries, zipFileName) {
    for (const file of this._buffers.keys()) this._flushFile(file);

    // Chain the export operation against write operations,
    // so that files do not change during the export.
    this._appendOperation({
      op: 'zip',
      entries,
      zipFileName
    });
  }

  // This method serializes all writes to the trace.
  _appendOperation(op) {
    const last = this._operations[this._operations.length - 1];
    if ((last === null || last === void 0 ? void 0 : last.op) === 'appendFile' && op.op === 'appendFile' && last.file === op.file) {
      // Merge pending appendFile operations for performance.
      last.content += op.content;
      return;
    }
    this._operations.push(op);
    if (this._operationsDone.isDone()) this._performOperations();
  }
  async _performOperations() {
    this._operationsDone = new _manualPromise.ManualPromise();
    while (this._operations.length) {
      const op = this._operations.shift();
      // Ignore all operations after the first error.
      if (this._error) continue;
      try {
        await this._performOperation(op);
      } catch (e) {
        this._error = e;
      }
    }
    this._operationsDone.resolve();
  }
  async _performOperation(op) {
    switch (op.op) {
      case 'mkdir':
        {
          await _fs.default.promises.mkdir(op.dir, {
            recursive: true
          });
          return;
        }
      case 'writeFile':
        {
          // Note: 'wx' flag only writes when the file does not exist.
          // See https://nodejs.org/api/fs.html#file-system-flags.
          // This way tracing never have to write the same resource twice.
          if (op.skipIfExists) await _fs.default.promises.writeFile(op.file, op.content, {
            flag: 'wx'
          }).catch(() => {});else await _fs.default.promises.writeFile(op.file, op.content);
          return;
        }
      case 'copyFile':
        {
          await _fs.default.promises.copyFile(op.from, op.to);
          return;
        }
      case 'appendFile':
        {
          await _fs.default.promises.appendFile(op.file, op.content);
          return;
        }
      case 'zip':
        {
          const zipFile = new _zipBundle.yazl.ZipFile();
          const result = new _manualPromise.ManualPromise();
          zipFile.on('error', error => result.reject(error));
          for (const entry of op.entries) zipFile.addFile(entry.value, entry.name);
          zipFile.end();
          zipFile.outputStream.pipe(_fs.default.createWriteStream(op.zipFileName)).on('close', () => result.resolve()).on('error', error => result.reject(error));
          await result;
          return;
        }
    }
  }
}
exports.SerializedFS = SerializedFS;