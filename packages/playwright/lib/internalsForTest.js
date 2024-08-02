"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.fileDependencies = fileDependencies;
var _path = _interopRequireDefault(require("path"));
var _compilationCache = require("./transform/compilationCache");
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

function fileDependencies() {
  return Object.fromEntries([...(0, _compilationCache.fileDependenciesForTest)().entries()].map(entry => [_path.default.basename(entry[0]), [...entry[1]].map(f => _path.default.basename(f)).sort()]));
}