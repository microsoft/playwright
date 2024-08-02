"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Browser = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _browserContext = require("./browserContext");
var _channelOwner = require("./channelOwner");
var _events = require("./events");
var _errors = require("./errors");
var _cdpSession = require("./cdpSession");
var _artifact = require("./artifact");
var _utils = require("../utils");
let _Symbol$asyncDispose;
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
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
_Symbol$asyncDispose = Symbol.asyncDispose;
class Browser extends _channelOwner.ChannelOwner {
  static from(browser) {
    return browser._object;
  }
  constructor(parent, type, guid, initializer) {
    super(parent, type, guid, initializer);
    this._contexts = new Set();
    this._isConnected = true;
    this._closedPromise = void 0;
    this._shouldCloseConnectionOnClose = false;
    this._browserType = void 0;
    this._options = {};
    this._name = void 0;
    this._path = void 0;
    // Used from @playwright/test fixtures.
    this._connectHeaders = void 0;
    this._closeReason = void 0;
    this._name = initializer.name;
    this._channel.on('close', () => this._didClose());
    this._closedPromise = new Promise(f => this.once(_events.Events.Browser.Disconnected, f));
  }
  browserType() {
    return this._browserType;
  }
  async newContext(options = {}) {
    return await this._innerNewContext(options, false);
  }
  async _newContextForReuse(options = {}) {
    return await this._wrapApiCall(async () => {
      for (const context of this._contexts) {
        await this._browserType._willCloseContext(context);
        for (const page of context.pages()) page._onClose();
        context._onClose();
      }
      return await this._innerNewContext(options, true);
    }, true);
  }
  async _stopPendingOperations(reason) {
    return await this._wrapApiCall(async () => {
      await this._channel.stopPendingOperations({
        reason
      });
    }, true);
  }
  async _innerNewContext(options = {}, forReuse) {
    options = {
      ...this._browserType._defaultContextOptions,
      ...options
    };
    const contextOptions = await (0, _browserContext.prepareBrowserContextParams)(options);
    const response = forReuse ? await this._channel.newContextForReuse(contextOptions) : await this._channel.newContext(contextOptions);
    const context = _browserContext.BrowserContext.from(response.context);
    await this._browserType._didCreateContext(context, contextOptions, this._options, options.logger || this._logger);
    if (!forReuse && !!process.env.PW_FREEZE_TIME) {
      await this._wrapApiCall(async () => {
        await context.clock.install({
          time: 0
        });
        await context.clock.pauseAt(1000);
      }, true);
    }
    return context;
  }
  contexts() {
    return [...this._contexts];
  }
  version() {
    return this._initializer.version;
  }
  async newPage(options = {}) {
    return await this._wrapApiCall(async () => {
      const context = await this.newContext(options);
      const page = await context.newPage();
      page._ownedContext = context;
      context._ownerPage = page;
      return page;
    });
  }
  isConnected() {
    return this._isConnected;
  }
  async newBrowserCDPSession() {
    return _cdpSession.CDPSession.from((await this._channel.newBrowserCDPSession()).session);
  }
  async startTracing(page, options = {}) {
    this._path = options.path;
    await this._channel.startTracing({
      ...options,
      page: page ? page._channel : undefined
    });
  }
  async stopTracing() {
    const artifact = _artifact.Artifact.from((await this._channel.stopTracing()).artifact);
    const buffer = await artifact.readIntoBuffer();
    await artifact.delete();
    if (this._path) {
      await (0, _utils.mkdirIfNeeded)(this._path);
      await _fs.default.promises.writeFile(this._path, buffer);
      this._path = undefined;
    }
    return buffer;
  }
  async [_Symbol$asyncDispose]() {
    await this.close();
  }
  async close(options = {}) {
    this._closeReason = options.reason;
    try {
      if (this._shouldCloseConnectionOnClose) this._connection.close();else await this._channel.close(options);
      await this._closedPromise;
    } catch (e) {
      if ((0, _errors.isTargetClosedError)(e)) return;
      throw e;
    }
  }
  _didClose() {
    this._isConnected = false;
    this.emit(_events.Events.Browser.Disconnected, this);
  }
}
exports.Browser = Browser;