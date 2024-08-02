"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Multiplexer = void 0;
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

class Multiplexer {
  constructor(reporters) {
    this._reporters = void 0;
    this._reporters = reporters;
  }
  version() {
    return 'v2';
  }
  onConfigure(config) {
    for (const reporter of this._reporters) wrap(() => reporter.onConfigure(config));
  }
  onBegin(suite) {
    for (const reporter of this._reporters) wrap(() => reporter.onBegin(suite));
  }
  onTestBegin(test, result) {
    for (const reporter of this._reporters) wrap(() => reporter.onTestBegin(test, result));
  }
  onStdOut(chunk, test, result) {
    for (const reporter of this._reporters) wrap(() => reporter.onStdOut(chunk, test, result));
  }
  onStdErr(chunk, test, result) {
    for (const reporter of this._reporters) wrap(() => reporter.onStdErr(chunk, test, result));
  }
  onTestEnd(test, result) {
    for (const reporter of this._reporters) wrap(() => reporter.onTestEnd(test, result));
  }
  async onEnd(result) {
    for (const reporter of this._reporters) {
      const outResult = await wrapAsync(() => reporter.onEnd(result));
      if (outResult !== null && outResult !== void 0 && outResult.status) result.status = outResult.status;
    }
    return result;
  }
  async onExit() {
    for (const reporter of this._reporters) await wrapAsync(() => reporter.onExit());
  }
  onError(error) {
    for (const reporter of this._reporters) wrap(() => reporter.onError(error));
  }
  onStepBegin(test, result, step) {
    for (const reporter of this._reporters) wrap(() => reporter.onStepBegin(test, result, step));
  }
  onStepEnd(test, result, step) {
    for (const reporter of this._reporters) wrap(() => reporter.onStepEnd(test, result, step));
  }
  printsToStdio() {
    return this._reporters.some(r => {
      let prints = true;
      wrap(() => prints = r.printsToStdio());
      return prints;
    });
  }
}
exports.Multiplexer = Multiplexer;
async function wrapAsync(callback) {
  try {
    return await callback();
  } catch (e) {
    console.error('Error in reporter', e);
  }
}
function wrap(callback) {
  try {
    callback();
  } catch (e) {
    console.error('Error in reporter', e);
  }
}