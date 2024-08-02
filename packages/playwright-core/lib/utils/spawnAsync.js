"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.spawnAsync = spawnAsync;
var _child_process = require("child_process");
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

function spawnAsync(cmd, args, options = {}) {
  const process = (0, _child_process.spawn)(cmd, args, Object.assign({
    windowsHide: true
  }, options));
  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    if (process.stdout) process.stdout.on('data', data => stdout += data.toString());
    if (process.stderr) process.stderr.on('data', data => stderr += data.toString());
    process.on('close', code => resolve({
      stdout,
      stderr,
      code
    }));
    process.on('error', error => resolve({
      stdout,
      stderr,
      code: 0,
      error
    }));
  });
}