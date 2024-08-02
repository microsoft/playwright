"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ConnectedBrowserDispatcher = exports.BrowserDispatcher = void 0;
var _browser = require("../browser");
var _browserContextDispatcher = require("./browserContextDispatcher");
var _cdpSessionDispatcher = require("./cdpSessionDispatcher");
var _dispatcher = require("./dispatcher");
var _browserContext = require("../browserContext");
var _selectors = require("../selectors");
var _artifactDispatcher = require("./artifactDispatcher");
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

class BrowserDispatcher extends _dispatcher.Dispatcher {
  constructor(scope, browser) {
    super(scope, browser, 'Browser', {
      version: browser.version(),
      name: browser.options.name
    });
    this._type_Browser = true;
    this.addObjectListener(_browser.Browser.Events.Disconnected, () => this._didClose());
  }
  _didClose() {
    this._dispatchEvent('close');
    this._dispose();
  }
  async newContext(params, metadata) {
    const context = await this._object.newContext(metadata, params);
    return {
      context: new _browserContextDispatcher.BrowserContextDispatcher(this, context)
    };
  }
  async newContextForReuse(params, metadata) {
    return await newContextForReuse(this._object, this, params, null, metadata);
  }
  async stopPendingOperations(params, metadata) {
    await this._object.stopPendingOperations(params.reason);
  }
  async close(params, metadata) {
    metadata.potentiallyClosesScope = true;
    await this._object.close(params);
  }
  async killForTests(_, metadata) {
    metadata.potentiallyClosesScope = true;
    await this._object.killForTests();
  }
  async defaultUserAgentForTest() {
    return {
      userAgent: this._object.userAgent()
    };
  }
  async newBrowserCDPSession() {
    if (!this._object.options.isChromium) throw new Error(`CDP session is only available in Chromium`);
    const crBrowser = this._object;
    return {
      session: new _cdpSessionDispatcher.CDPSessionDispatcher(this, await crBrowser.newBrowserCDPSession())
    };
  }
  async startTracing(params) {
    if (!this._object.options.isChromium) throw new Error(`Tracing is only available in Chromium`);
    const crBrowser = this._object;
    await crBrowser.startTracing(params.page ? params.page._object : undefined, params);
  }
  async stopTracing() {
    if (!this._object.options.isChromium) throw new Error(`Tracing is only available in Chromium`);
    const crBrowser = this._object;
    return {
      artifact: _artifactDispatcher.ArtifactDispatcher.from(this, await crBrowser.stopTracing())
    };
  }
}

// This class implements multiplexing browser dispatchers over a single Browser instance.
exports.BrowserDispatcher = BrowserDispatcher;
class ConnectedBrowserDispatcher extends _dispatcher.Dispatcher {
  constructor(scope, browser) {
    super(scope, browser, 'Browser', {
      version: browser.version(),
      name: browser.options.name
    });
    // When we have a remotely-connected browser, each client gets a fresh Selector instance,
    // so that two clients do not interfere between each other.
    this._type_Browser = true;
    this._contexts = new Set();
    this.selectors = void 0;
    this.selectors = new _selectors.Selectors();
  }
  async newContext(params, metadata) {
    if (params.recordVideo) params.recordVideo.dir = this._object.options.artifactsDir;
    const context = await this._object.newContext(metadata, params);
    this._contexts.add(context);
    context.setSelectors(this.selectors);
    context.on(_browserContext.BrowserContext.Events.Close, () => this._contexts.delete(context));
    return {
      context: new _browserContextDispatcher.BrowserContextDispatcher(this, context)
    };
  }
  async newContextForReuse(params, metadata) {
    return await newContextForReuse(this._object, this, params, this.selectors, metadata);
  }
  async stopPendingOperations(params, metadata) {
    await this._object.stopPendingOperations(params.reason);
  }
  async close() {
    // Client should not send us Browser.close.
  }
  async killForTests() {
    // Client should not send us Browser.killForTests.
  }
  async defaultUserAgentForTest() {
    throw new Error('Client should not send us Browser.defaultUserAgentForTest');
  }
  async newBrowserCDPSession() {
    if (!this._object.options.isChromium) throw new Error(`CDP session is only available in Chromium`);
    const crBrowser = this._object;
    return {
      session: new _cdpSessionDispatcher.CDPSessionDispatcher(this, await crBrowser.newBrowserCDPSession())
    };
  }
  async startTracing(params) {
    if (!this._object.options.isChromium) throw new Error(`Tracing is only available in Chromium`);
    const crBrowser = this._object;
    await crBrowser.startTracing(params.page ? params.page._object : undefined, params);
  }
  async stopTracing() {
    if (!this._object.options.isChromium) throw new Error(`Tracing is only available in Chromium`);
    const crBrowser = this._object;
    return {
      artifact: _artifactDispatcher.ArtifactDispatcher.from(this, await crBrowser.stopTracing())
    };
  }
  async cleanupContexts() {
    await Promise.all(Array.from(this._contexts).map(context => context.close({
      reason: 'Global context cleanup (connection terminated)'
    })));
  }
}
exports.ConnectedBrowserDispatcher = ConnectedBrowserDispatcher;
async function newContextForReuse(browser, scope, params, selectors, metadata) {
  const {
    context,
    needsReset
  } = await browser.newContextForReuse(params, metadata);
  if (needsReset) {
    const oldContextDispatcher = (0, _dispatcher.existingDispatcher)(context);
    if (oldContextDispatcher) oldContextDispatcher._dispose();
    await context.resetForReuse(metadata, params);
  }
  if (selectors) context.setSelectors(selectors);
  const contextDispatcher = new _browserContextDispatcher.BrowserContextDispatcher(scope, context);
  return {
    context: contextDispatcher
  };
}