"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Playwright = void 0;
exports.createPlaywright = createPlaywright;
var _android = require("./android/android");
var _backendAdb = require("./android/backendAdb");
var _chromium = require("./chromium/chromium");
var _electron = require("./electron/electron");
var _firefox = require("./firefox/firefox");
var _selectors = require("./selectors");
var _webkit = require("./webkit/webkit");
var _instrumentation = require("./instrumentation");
var _debugLogger = require("../utils/debugLogger");
var _debugController = require("./debugController");
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

class Playwright extends _instrumentation.SdkObject {
  constructor(options) {
    super({
      attribution: {},
      instrumentation: (0, _instrumentation.createInstrumentation)()
    }, undefined, 'Playwright');
    this.selectors = void 0;
    this.chromium = void 0;
    this.android = void 0;
    this.electron = void 0;
    this.firefox = void 0;
    this.webkit = void 0;
    this.options = void 0;
    this.debugController = void 0;
    this._allPages = new Set();
    this._allBrowsers = new Set();
    this.options = options;
    this.attribution.playwright = this;
    this.instrumentation.addListener({
      onBrowserOpen: browser => this._allBrowsers.add(browser),
      onBrowserClose: browser => this._allBrowsers.delete(browser),
      onPageOpen: page => this._allPages.add(page),
      onPageClose: page => this._allPages.delete(page),
      onCallLog: (sdkObject, metadata, logName, message) => {
        _debugLogger.debugLogger.log(logName, message);
      }
    }, null);
    this.chromium = new _chromium.Chromium(this);
    this.firefox = new _firefox.Firefox(this);
    this.webkit = new _webkit.WebKit(this);
    this.electron = new _electron.Electron(this);
    this.android = new _android.Android(this, new _backendAdb.AdbBackend());
    this.selectors = new _selectors.Selectors();
    this.debugController = new _debugController.DebugController(this);
  }
  async hideHighlight() {
    await Promise.all([...this._allPages].map(p => p.hideHighlight().catch(() => {})));
  }
  allBrowsers() {
    return [...this._allBrowsers];
  }
  allPages() {
    return [...this._allPages];
  }
}
exports.Playwright = Playwright;
function createPlaywright(options) {
  return new Playwright(options);
}