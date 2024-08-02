"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.kNoElementsFoundError = exports.ExpectError = void 0;
exports.matcherHint = matcherHint;
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _utils = require("playwright-core/lib/utils");
/**
 * Copyright Microsoft Corporation. All rights reserved.
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

const kNoElementsFoundError = exports.kNoElementsFoundError = '<element(s) not found>';
function matcherHint(state, locator, matcherName, expression, actual, matcherOptions, timeout) {
  let header = state.utils.matcherHint(matcherName, expression, actual, matcherOptions).replace(/ \/\/ deep equality/, '') + '\n\n';
  if (timeout) header = _utilsBundle.colors.red(`Timed out ${timeout}ms waiting for `) + header;
  if (locator) header += `Locator: ${String(locator)}\n`;
  return header;
}
class ExpectError extends Error {
  constructor(jestError, customMessage, stackFrames) {
    super('');
    // Copy to erase the JestMatcherError constructor name from the console.log(error).
    this.matcherResult = void 0;
    this.name = jestError.name;
    this.message = jestError.message;
    this.matcherResult = jestError.matcherResult;
    if (customMessage) this.message = customMessage + '\n\n' + this.message;
    this.stack = this.name + ': ' + this.message + '\n' + (0, _utils.stringifyStackFrames)(stackFrames).join('\n');
  }
}
exports.ExpectError = ExpectError;