"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.calculateSha1 = calculateSha1;
exports.createGuid = createGuid;
var _crypto = _interopRequireDefault(require("crypto"));
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

function createGuid() {
  return _crypto.default.randomBytes(16).toString('hex');
}
function calculateSha1(buffer) {
  const hash = _crypto.default.createHash('sha1');
  hash.update(buffer);
  return hash.digest('hex');
}