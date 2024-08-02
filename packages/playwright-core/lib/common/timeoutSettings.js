"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TimeoutSettings = exports.DEFAULT_TIMEOUT = exports.DEFAULT_LAUNCH_TIMEOUT = void 0;
var _utils = require("../utils");
/**
 * Copyright 2019 Google Inc. All rights reserved.
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

const DEFAULT_TIMEOUT = exports.DEFAULT_TIMEOUT = 30000;
const DEFAULT_LAUNCH_TIMEOUT = exports.DEFAULT_LAUNCH_TIMEOUT = 3 * 60 * 1000; // 3 minutes

class TimeoutSettings {
  constructor(parent) {
    this._parent = void 0;
    this._defaultTimeout = void 0;
    this._defaultNavigationTimeout = void 0;
    this._parent = parent;
  }
  setDefaultTimeout(timeout) {
    this._defaultTimeout = timeout;
  }
  setDefaultNavigationTimeout(timeout) {
    this._defaultNavigationTimeout = timeout;
  }
  defaultNavigationTimeout() {
    return this._defaultNavigationTimeout;
  }
  defaultTimeout() {
    return this._defaultTimeout;
  }
  navigationTimeout(options) {
    if (typeof options.timeout === 'number') return options.timeout;
    if (this._defaultNavigationTimeout !== undefined) return this._defaultNavigationTimeout;
    if ((0, _utils.debugMode)()) return 0;
    if (this._defaultTimeout !== undefined) return this._defaultTimeout;
    if (this._parent) return this._parent.navigationTimeout(options);
    return DEFAULT_TIMEOUT;
  }
  timeout(options) {
    if (typeof options.timeout === 'number') return options.timeout;
    if ((0, _utils.debugMode)()) return 0;
    if (this._defaultTimeout !== undefined) return this._defaultTimeout;
    if (this._parent) return this._parent.timeout(options);
    return DEFAULT_TIMEOUT;
  }
  static timeout(options) {
    if (typeof options.timeout === 'number') return options.timeout;
    if ((0, _utils.debugMode)()) return 0;
    return DEFAULT_TIMEOUT;
  }
  static launchTimeout(options) {
    if (typeof options.timeout === 'number') return options.timeout;
    if ((0, _utils.debugMode)()) return 0;
    return DEFAULT_LAUNCH_TIMEOUT;
  }
}
exports.TimeoutSettings = TimeoutSettings;