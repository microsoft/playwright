"use strict";

var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _network = require("../../utils/network");
var _manualPromise = require("../../utils/manualPromise");
var _zipBundle = require("../../zipBundle");
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

function log(message) {
  var _process$send, _process;
  (_process$send = (_process = process).send) === null || _process$send === void 0 || _process$send.call(_process, {
    method: 'log',
    params: {
      message
    }
  });
}
function progress(done, total) {
  var _process$send2, _process2;
  (_process$send2 = (_process2 = process).send) === null || _process$send2 === void 0 || _process$send2.call(_process2, {
    method: 'progress',
    params: {
      done,
      total
    }
  });
}
function browserDirectoryToMarkerFilePath(browserDirectory) {
  return _path.default.join(browserDirectory, 'INSTALLATION_COMPLETE');
}
function downloadFile(options) {
  let downloadedBytes = 0;
  let totalBytes = 0;
  const promise = new _manualPromise.ManualPromise();
  (0, _network.httpRequest)({
    url: options.url,
    headers: {
      'User-Agent': options.userAgent
    },
    timeout: options.connectionTimeout
  }, response => {
    log(`-- response status code: ${response.statusCode}`);
    if (response.statusCode !== 200) {
      let content = '';
      const handleError = () => {
        const error = new Error(`Download failed: server returned code ${response.statusCode} body '${content}'. URL: ${options.url}`);
        // consume response data to free up memory
        response.resume();
        promise.reject(error);
      };
      response.on('data', chunk => content += chunk).on('end', handleError).on('error', handleError);
      return;
    }
    totalBytes = parseInt(response.headers['content-length'] || '0', 10);
    log(`-- total bytes: ${totalBytes}`);
    const file = _fs.default.createWriteStream(options.zipPath);
    file.on('finish', () => {
      if (downloadedBytes !== totalBytes) {
        log(`-- download failed, size mismatch: ${downloadedBytes} != ${totalBytes}`);
        promise.reject(new Error(`Download failed: size mismatch, file size: ${downloadedBytes}, expected size: ${totalBytes} URL: ${options.url}`));
      } else {
        log(`-- download complete, size: ${downloadedBytes}`);
        promise.resolve();
      }
    });
    file.on('error', error => promise.reject(error));
    response.pipe(file);
    response.on('data', onData);
    response.on('error', error => {
      file.close();
      if ((error === null || error === void 0 ? void 0 : error.code) === 'ECONNRESET') {
        log(`-- download failed, server closed connection`);
        promise.reject(new Error(`Download failed: server closed connection. URL: ${options.url}`));
      } else {
        var _error$message;
        log(`-- download failed, unexpected error`);
        promise.reject(new Error(`Download failed: ${(_error$message = error === null || error === void 0 ? void 0 : error.message) !== null && _error$message !== void 0 ? _error$message : error}. URL: ${options.url}`));
      }
    });
  }, error => promise.reject(error));
  return promise;
  function onData(chunk) {
    downloadedBytes += chunk.length;
    progress(downloadedBytes, totalBytes);
  }
}
async function main(options) {
  await downloadFile(options);
  log(`SUCCESS downloading ${options.title}`);
  log(`extracting archive`);
  await (0, _zipBundle.extract)(options.zipPath, {
    dir: options.browserDirectory
  });
  if (options.executablePath) {
    log(`fixing permissions at ${options.executablePath}`);
    await _fs.default.promises.chmod(options.executablePath, 0o755);
  }
  await _fs.default.promises.writeFile(browserDirectoryToMarkerFilePath(options.browserDirectory), '');
}
process.on('message', async message => {
  const {
    method,
    params
  } = message;
  if (method === 'download') {
    try {
      await main(params);
      // eslint-disable-next-line no-restricted-properties
      process.exit(0);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      // eslint-disable-next-line no-restricted-properties
      process.exit(1);
    }
  }
});

// eslint-disable-next-line no-restricted-properties
process.on('disconnect', () => {
  process.exit(0);
});