"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WorkerDispatcher = exports.PageDispatcher = exports.BindingCallDispatcher = void 0;
var _page = require("../page");
var _dispatcher = require("./dispatcher");
var _errors = require("../errors");
var _frameDispatcher = require("./frameDispatcher");
var _networkDispatchers = require("./networkDispatchers");
var _jsHandleDispatcher = require("./jsHandleDispatcher");
var _elementHandlerDispatcher = require("./elementHandlerDispatcher");
var _artifactDispatcher = require("./artifactDispatcher");
var _utils = require("../../utils");
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class PageDispatcher extends _dispatcher.Dispatcher {
  static from(parentScope, page) {
    return PageDispatcher.fromNullable(parentScope, page);
  }
  static fromNullable(parentScope, page) {
    if (!page) return undefined;
    const result = (0, _dispatcher.existingDispatcher)(page);
    return result || new PageDispatcher(parentScope, page);
  }
  constructor(parentScope, page) {
    // TODO: theoretically, there could be more than one frame already.
    // If we split pageCreated and pageReady, there should be no main frame during pageCreated.

    // We will reparent it to the page below using adopt.
    const mainFrame = _frameDispatcher.FrameDispatcher.from(parentScope, page.mainFrame());
    super(parentScope, page, 'Page', {
      mainFrame,
      viewportSize: page.viewportSize() || undefined,
      isClosed: page.isClosed(),
      opener: PageDispatcher.fromNullable(parentScope, page.opener())
    });
    this._type_EventTarget = true;
    this._type_Page = true;
    this._page = void 0;
    this._subscriptions = new Set();
    this.adopt(mainFrame);
    this._page = page;
    this.addObjectListener(_page.Page.Events.Close, () => {
      this._dispatchEvent('close');
      this._dispose();
    });
    this.addObjectListener(_page.Page.Events.Crash, () => this._dispatchEvent('crash'));
    this.addObjectListener(_page.Page.Events.Download, download => {
      // Artifact can outlive the page, so bind to the context scope.
      this._dispatchEvent('download', {
        url: download.url,
        suggestedFilename: download.suggestedFilename(),
        artifact: _artifactDispatcher.ArtifactDispatcher.from(parentScope, download.artifact)
      });
    });
    this.addObjectListener(_page.Page.Events.FileChooser, fileChooser => this._dispatchEvent('fileChooser', {
      element: _elementHandlerDispatcher.ElementHandleDispatcher.from(mainFrame, fileChooser.element()),
      isMultiple: fileChooser.isMultiple()
    }));
    this.addObjectListener(_page.Page.Events.FrameAttached, frame => this._onFrameAttached(frame));
    this.addObjectListener(_page.Page.Events.FrameDetached, frame => this._onFrameDetached(frame));
    this.addObjectListener(_page.Page.Events.LocatorHandlerTriggered, uid => this._dispatchEvent('locatorHandlerTriggered', {
      uid
    }));
    this.addObjectListener(_page.Page.Events.WebSocket, webSocket => this._dispatchEvent('webSocket', {
      webSocket: new _networkDispatchers.WebSocketDispatcher(this, webSocket)
    }));
    this.addObjectListener(_page.Page.Events.Worker, worker => this._dispatchEvent('worker', {
      worker: new WorkerDispatcher(this, worker)
    }));
    this.addObjectListener(_page.Page.Events.Video, artifact => this._dispatchEvent('video', {
      artifact: _artifactDispatcher.ArtifactDispatcher.from(parentScope, artifact)
    }));
    if (page._video) this._dispatchEvent('video', {
      artifact: _artifactDispatcher.ArtifactDispatcher.from(this.parentScope(), page._video)
    });
    // Ensure client knows about all frames.
    const frames = page._frameManager.frames();
    for (let i = 1; i < frames.length; i++) this._onFrameAttached(frames[i]);
  }
  page() {
    return this._page;
  }
  async setDefaultNavigationTimeoutNoReply(params, metadata) {
    this._page.setDefaultNavigationTimeout(params.timeout);
  }
  async setDefaultTimeoutNoReply(params, metadata) {
    this._page.setDefaultTimeout(params.timeout);
  }
  async exposeBinding(params, metadata) {
    await this._page.exposeBinding(params.name, !!params.needsHandle, (source, ...args) => {
      // When reusing the context, we might have some bindings called late enough,
      // after context and page dispatchers have been disposed.
      if (this._disposed) return;
      const binding = new BindingCallDispatcher(this, params.name, !!params.needsHandle, source, args);
      this._dispatchEvent('bindingCall', {
        binding
      });
      return binding.promise();
    });
  }
  async setExtraHTTPHeaders(params, metadata) {
    await this._page.setExtraHTTPHeaders(params.headers);
  }
  async reload(params, metadata) {
    return {
      response: _networkDispatchers.ResponseDispatcher.fromNullable(this.parentScope(), await this._page.reload(metadata, params))
    };
  }
  async goBack(params, metadata) {
    return {
      response: _networkDispatchers.ResponseDispatcher.fromNullable(this.parentScope(), await this._page.goBack(metadata, params))
    };
  }
  async goForward(params, metadata) {
    return {
      response: _networkDispatchers.ResponseDispatcher.fromNullable(this.parentScope(), await this._page.goForward(metadata, params))
    };
  }
  async registerLocatorHandler(params, metadata) {
    const uid = this._page.registerLocatorHandler(params.selector, params.noWaitAfter);
    return {
      uid
    };
  }
  async resolveLocatorHandlerNoReply(params, metadata) {
    this._page.resolveLocatorHandler(params.uid, params.remove);
  }
  async unregisterLocatorHandler(params, metadata) {
    this._page.unregisterLocatorHandler(params.uid);
  }
  async emulateMedia(params, metadata) {
    await this._page.emulateMedia({
      media: params.media,
      colorScheme: params.colorScheme,
      reducedMotion: params.reducedMotion,
      forcedColors: params.forcedColors
    });
  }
  async setViewportSize(params, metadata) {
    await this._page.setViewportSize(params.viewportSize);
  }
  async addInitScript(params, metadata) {
    await this._page.addInitScript(params.source);
  }
  async setNetworkInterceptionPatterns(params, metadata) {
    if (!params.patterns.length) {
      await this._page.setClientRequestInterceptor(undefined);
      return;
    }
    const urlMatchers = params.patterns.map(pattern => pattern.regexSource ? new RegExp(pattern.regexSource, pattern.regexFlags) : pattern.glob);
    await this._page.setClientRequestInterceptor((route, request) => {
      const matchesSome = urlMatchers.some(urlMatch => (0, _utils.urlMatches)(this._page._browserContext._options.baseURL, request.url(), urlMatch));
      if (!matchesSome) return false;
      this._dispatchEvent('route', {
        route: _networkDispatchers.RouteDispatcher.from(_networkDispatchers.RequestDispatcher.from(this.parentScope(), request), route)
      });
      return true;
    });
  }
  async expectScreenshot(params, metadata) {
    const mask = (params.mask || []).map(({
      frame,
      selector
    }) => ({
      frame: frame._object,
      selector
    }));
    const locator = params.locator ? {
      frame: params.locator.frame._object,
      selector: params.locator.selector
    } : undefined;
    return await this._page.expectScreenshot(metadata, {
      ...params,
      locator,
      mask
    });
  }
  async screenshot(params, metadata) {
    const mask = (params.mask || []).map(({
      frame,
      selector
    }) => ({
      frame: frame._object,
      selector
    }));
    return {
      binary: await this._page.screenshot(metadata, {
        ...params,
        mask
      })
    };
  }
  async close(params, metadata) {
    if (!params.runBeforeUnload) metadata.potentiallyClosesScope = true;
    await this._page.close(metadata, params);
  }
  async updateSubscription(params) {
    if (params.event === 'fileChooser') await this._page.setFileChooserIntercepted(params.enabled);
    if (params.enabled) this._subscriptions.add(params.event);else this._subscriptions.delete(params.event);
  }
  async keyboardDown(params, metadata) {
    await this._page.keyboard.down(params.key);
  }
  async keyboardUp(params, metadata) {
    await this._page.keyboard.up(params.key);
  }
  async keyboardInsertText(params, metadata) {
    await this._page.keyboard.insertText(params.text);
  }
  async keyboardType(params, metadata) {
    await this._page.keyboard.type(params.text, params);
  }
  async keyboardPress(params, metadata) {
    await this._page.keyboard.press(params.key, params);
  }
  async mouseMove(params, metadata) {
    await this._page.mouse.move(params.x, params.y, params, metadata);
  }
  async mouseDown(params, metadata) {
    await this._page.mouse.down(params, metadata);
  }
  async mouseUp(params, metadata) {
    await this._page.mouse.up(params, metadata);
  }
  async mouseClick(params, metadata) {
    await this._page.mouse.click(params.x, params.y, params, metadata);
  }
  async mouseWheel(params, metadata) {
    await this._page.mouse.wheel(params.deltaX, params.deltaY);
  }
  async touchscreenTap(params, metadata) {
    await this._page.touchscreen.tap(params.x, params.y, metadata);
  }
  async accessibilitySnapshot(params, metadata) {
    const rootAXNode = await this._page.accessibility.snapshot({
      interestingOnly: params.interestingOnly,
      root: params.root ? params.root._elementHandle : undefined
    });
    return {
      rootAXNode: rootAXNode || undefined
    };
  }
  async pdf(params, metadata) {
    if (!this._page.pdf) throw new Error('PDF generation is only supported for Headless Chromium');
    const buffer = await this._page.pdf(params);
    return {
      pdf: buffer
    };
  }
  async bringToFront(params, metadata) {
    await this._page.bringToFront();
  }
  async startJSCoverage(params, metadata) {
    const coverage = this._page.coverage;
    await coverage.startJSCoverage(params);
  }
  async stopJSCoverage(params, metadata) {
    const coverage = this._page.coverage;
    return await coverage.stopJSCoverage();
  }
  async startCSSCoverage(params, metadata) {
    const coverage = this._page.coverage;
    await coverage.startCSSCoverage(params);
  }
  async stopCSSCoverage(params, metadata) {
    const coverage = this._page.coverage;
    return await coverage.stopCSSCoverage();
  }
  _onFrameAttached(frame) {
    this._dispatchEvent('frameAttached', {
      frame: _frameDispatcher.FrameDispatcher.from(this.parentScope(), frame)
    });
  }
  _onFrameDetached(frame) {
    this._dispatchEvent('frameDetached', {
      frame: _frameDispatcher.FrameDispatcher.from(this.parentScope(), frame)
    });
  }
  _onDispose() {
    // Avoid protocol calls for the closed page.
    if (!this._page.isClosedOrClosingOrCrashed()) this._page.setClientRequestInterceptor(undefined).catch(() => {});
  }
}
exports.PageDispatcher = PageDispatcher;
class WorkerDispatcher extends _dispatcher.Dispatcher {
  static fromNullable(scope, worker) {
    if (!worker) return undefined;
    const result = (0, _dispatcher.existingDispatcher)(worker);
    return result || new WorkerDispatcher(scope, worker);
  }
  constructor(scope, worker) {
    super(scope, worker, 'Worker', {
      url: worker.url()
    });
    this._type_Worker = true;
    this.addObjectListener(_page.Worker.Events.Close, () => this._dispatchEvent('close'));
  }
  async evaluateExpression(params, metadata) {
    return {
      value: (0, _jsHandleDispatcher.serializeResult)(await this._object.evaluateExpression(params.expression, params.isFunction, (0, _jsHandleDispatcher.parseArgument)(params.arg)))
    };
  }
  async evaluateExpressionHandle(params, metadata) {
    return {
      handle: _elementHandlerDispatcher.ElementHandleDispatcher.fromJSHandle(this, await this._object.evaluateExpressionHandle(params.expression, params.isFunction, (0, _jsHandleDispatcher.parseArgument)(params.arg)))
    };
  }
}
exports.WorkerDispatcher = WorkerDispatcher;
class BindingCallDispatcher extends _dispatcher.Dispatcher {
  constructor(scope, name, needsHandle, source, args) {
    super(scope, {
      guid: 'bindingCall@' + (0, _utils.createGuid)()
    }, 'BindingCall', {
      frame: _frameDispatcher.FrameDispatcher.from(scope.parentScope(), source.frame),
      name,
      args: needsHandle ? undefined : args.map(_jsHandleDispatcher.serializeResult),
      handle: needsHandle ? _elementHandlerDispatcher.ElementHandleDispatcher.fromJSHandle(scope, args[0]) : undefined
    });
    this._type_BindingCall = true;
    this._resolve = void 0;
    this._reject = void 0;
    this._promise = void 0;
    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }
  promise() {
    return this._promise;
  }
  async resolve(params, metadata) {
    this._resolve((0, _jsHandleDispatcher.parseArgument)(params.result));
    this._dispose();
  }
  async reject(params, metadata) {
    this._reject((0, _errors.parseError)(params.error));
    this._dispose();
  }
}
exports.BindingCallDispatcher = BindingCallDispatcher;