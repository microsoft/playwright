"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isError = isError;
exports.isLikelyNpxGlobal = void 0;
exports.isObject = isObject;
exports.isRegExp = isRegExp;
Object.defineProperty(exports, "isString", {
  enumerable: true,
  get: function () {
    return _stringUtils.isString;
  }
});
var _stringUtils = require("./isomorphic/stringUtils");
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

function isRegExp(obj) {
  return obj instanceof RegExp || Object.prototype.toString.call(obj) === '[object RegExp]';
}
function isObject(obj) {
  return typeof obj === 'object' && obj !== null;
}
function isError(obj) {
  var _Object$getPrototypeO;
  return obj instanceof Error || obj && ((_Object$getPrototypeO = Object.getPrototypeOf(obj)) === null || _Object$getPrototypeO === void 0 ? void 0 : _Object$getPrototypeO.name) === 'Error';
}
const isLikelyNpxGlobal = () => process.argv.length >= 2 && process.argv[1].includes('_npx');
exports.isLikelyNpxGlobal = isLikelyNpxGlobal;