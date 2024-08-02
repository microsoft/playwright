"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Playwright = void 0;
var _errors = require("./errors");
var _android = require("./android");
var _browserType = require("./browserType");
var _channelOwner = require("./channelOwner");
var _electron = require("./electron");
var _fetch = require("./fetch");
var _selectors = require("./selectors");
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

class Playwright extends _channelOwner.ChannelOwner {
  constructor(parent, type, guid, initializer) {
    var _this$_connection$loc, _this$_connection$loc2;
    super(parent, type, guid, initializer);
    this._android = void 0;
    this._electron = void 0;
    this.chromium = void 0;
    this.firefox = void 0;
    this.webkit = void 0;
    this.devices = void 0;
    this.selectors = void 0;
    this.request = void 0;
    this.errors = void 0;
    this.request = new _fetch.APIRequest(this);
    this.chromium = _browserType.BrowserType.from(initializer.chromium);
    this.chromium._playwright = this;
    this.firefox = _browserType.BrowserType.from(initializer.firefox);
    this.firefox._playwright = this;
    this.webkit = _browserType.BrowserType.from(initializer.webkit);
    this.webkit._playwright = this;
    this._android = _android.Android.from(initializer.android);
    this._electron = _electron.Electron.from(initializer.electron);
    this.devices = (_this$_connection$loc = (_this$_connection$loc2 = this._connection.localUtils()) === null || _this$_connection$loc2 === void 0 ? void 0 : _this$_connection$loc2.devices) !== null && _this$_connection$loc !== void 0 ? _this$_connection$loc : {};
    this.selectors = new _selectors.Selectors();
    this.errors = {
      TimeoutError: _errors.TimeoutError
    };
    const selectorsOwner = _selectors.SelectorsOwner.from(initializer.selectors);
    this.selectors._addChannel(selectorsOwner);
    this._connection.on('close', () => {
      this.selectors._removeChannel(selectorsOwner);
    });
    global._playwrightInstance = this;
  }
  _setSelectors(selectors) {
    const selectorsOwner = _selectors.SelectorsOwner.from(this._initializer.selectors);
    this.selectors._removeChannel(selectorsOwner);
    this.selectors = selectors;
    this.selectors._addChannel(selectorsOwner);
  }
  static from(channel) {
    return channel._object;
  }
}
exports.Playwright = Playwright;