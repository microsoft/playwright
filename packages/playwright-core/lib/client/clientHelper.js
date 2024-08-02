"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addSourceUrlToScript = addSourceUrlToScript;
exports.envObjectToArray = envObjectToArray;
exports.evaluationScript = evaluationScript;
var _fs = _interopRequireDefault(require("fs"));
var _utils = require("../utils");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

function envObjectToArray(env) {
  const result = [];
  for (const name in env) {
    if (!Object.is(env[name], undefined)) result.push({
      name,
      value: String(env[name])
    });
  }
  return result;
}
async function evaluationScript(fun, arg, addSourceUrl = true) {
  if (typeof fun === 'function') {
    const source = fun.toString();
    const argString = Object.is(arg, undefined) ? 'undefined' : JSON.stringify(arg);
    return `(${source})(${argString})`;
  }
  if (arg !== undefined) throw new Error('Cannot evaluate a string with arguments');
  if ((0, _utils.isString)(fun)) return fun;
  if (fun.content !== undefined) return fun.content;
  if (fun.path !== undefined) {
    let source = await _fs.default.promises.readFile(fun.path, 'utf8');
    if (addSourceUrl) source = addSourceUrlToScript(source, fun.path);
    return source;
  }
  throw new Error('Either path or content property must be present');
}
function addSourceUrlToScript(source, path) {
  return `${source}\n//# sourceURL=${path.replace(/\n/g, '')}`;
}