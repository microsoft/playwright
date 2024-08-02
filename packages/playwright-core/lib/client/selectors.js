"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SelectorsOwner = exports.Selectors = void 0;
var _clientHelper = require("./clientHelper");
var _channelOwner = require("./channelOwner");
var _locator = require("./locator");
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

class Selectors {
  constructor() {
    this._channels = new Set();
    this._registrations = [];
  }
  async register(name, script, options = {}) {
    const source = await (0, _clientHelper.evaluationScript)(script, undefined, false);
    const params = {
      ...options,
      name,
      source
    };
    for (const channel of this._channels) await channel._channel.register(params);
    this._registrations.push(params);
  }
  setTestIdAttribute(attributeName) {
    (0, _locator.setTestIdAttribute)(attributeName);
    for (const channel of this._channels) channel._channel.setTestIdAttributeName({
      testIdAttributeName: attributeName
    }).catch(() => {});
  }
  _addChannel(channel) {
    this._channels.add(channel);
    for (const params of this._registrations) {
      // This should not fail except for connection closure, but just in case we catch.
      channel._channel.register(params).catch(() => {});
      channel._channel.setTestIdAttributeName({
        testIdAttributeName: (0, _locator.testIdAttributeName)()
      }).catch(() => {});
    }
  }
  _removeChannel(channel) {
    this._channels.delete(channel);
  }
}
exports.Selectors = Selectors;
class SelectorsOwner extends _channelOwner.ChannelOwner {
  static from(browser) {
    return browser._object;
  }
}
exports.SelectorsOwner = SelectorsOwner;