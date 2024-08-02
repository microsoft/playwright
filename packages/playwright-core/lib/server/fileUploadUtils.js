"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.prepareFilesForUpload = prepareFilesForUpload;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _utils = require("../utils");
var _utilsBundle = require("../utilsBundle");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright (c) Microsoft Corporation.
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

async function filesExceedUploadLimit(files) {
  const sizes = await Promise.all(files.map(async file => (await _fs.default.promises.stat(file)).size));
  return sizes.reduce((total, size) => total + size, 0) >= _utils.fileUploadSizeLimit;
}
async function prepareFilesForUpload(frame, params) {
  var _fileBuffers;
  const {
    payloads,
    streams,
    directoryStream
  } = params;
  let {
    localPaths,
    localDirectory
  } = params;
  if ([payloads, localPaths, localDirectory, streams, directoryStream].filter(Boolean).length !== 1) throw new Error('Exactly one of payloads, localPaths and streams must be provided');
  if (streams) localPaths = streams.map(c => c.path());
  if (directoryStream) localDirectory = directoryStream.path();
  if (localPaths) {
    for (const p of localPaths) (0, _utils.assert)(_path.default.isAbsolute(p) && _path.default.resolve(p) === p, 'Paths provided to localPaths must be absolute and fully resolved.');
  }
  let fileBuffers = payloads;
  if (!frame._page._browserContext._browser._isCollocatedWithServer) {
    // If the browser is on a different machine read files into buffers.
    if (localPaths) {
      if (await filesExceedUploadLimit(localPaths)) throw new Error('Cannot transfer files larger than 50Mb to a browser not co-located with the server');
      fileBuffers = await Promise.all(localPaths.map(async item => {
        return {
          name: _path.default.basename(item),
          buffer: await _fs.default.promises.readFile(item),
          lastModifiedMs: (await _fs.default.promises.stat(item)).mtimeMs
        };
      }));
      localPaths = undefined;
    }
  }
  const filePayloads = (_fileBuffers = fileBuffers) === null || _fileBuffers === void 0 ? void 0 : _fileBuffers.map(payload => ({
    name: payload.name,
    mimeType: payload.mimeType || _utilsBundle.mime.getType(payload.name) || 'application/octet-stream',
    buffer: payload.buffer.toString('base64'),
    lastModifiedMs: payload.lastModifiedMs
  }));
  return {
    localPaths,
    localDirectory,
    filePayloads
  };
}