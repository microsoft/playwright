"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.headersArrayToObject = headersArrayToObject;
exports.headersObjectToArray = headersObjectToArray;
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

function headersObjectToArray(headers, separator, setCookieSeparator) {
  if (!setCookieSeparator) setCookieSeparator = separator;
  const result = [];
  for (const name in headers) {
    const values = headers[name];
    if (values === undefined) continue;
    if (separator) {
      const sep = name.toLowerCase() === 'set-cookie' ? setCookieSeparator : separator;
      for (const value of values.split(sep)) result.push({
        name,
        value: value.trim()
      });
    } else {
      result.push({
        name,
        value: values
      });
    }
  }
  return result;
}
function headersArrayToObject(headers, lowerCase) {
  const result = {};
  for (const {
    name,
    value
  } of headers) result[lowerCase ? name.toLowerCase() : name] = value;
  return result;
}