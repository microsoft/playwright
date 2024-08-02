"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Coverage = void 0;
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

class Coverage {
  constructor(channel) {
    this._channel = void 0;
    this._channel = channel;
  }
  async startJSCoverage(options = {}) {
    await this._channel.startJSCoverage(options);
  }
  async stopJSCoverage() {
    return (await this._channel.stopJSCoverage()).entries;
  }
  async startCSSCoverage(options = {}) {
    await this._channel.startCSSCoverage(options);
  }
  async stopCSSCoverage() {
    return (await this._channel.stopCSSCoverage()).entries;
  }
}
exports.Coverage = Coverage;