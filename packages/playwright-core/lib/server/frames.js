"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NavigationAbortedError = exports.FrameManager = exports.Frame = void 0;
var dom = _interopRequireWildcard(require("./dom"));
var _helper = require("./helper");
var _eventsHelper = require("../utils/eventsHelper");
var js = _interopRequireWildcard(require("./javascript"));
var network = _interopRequireWildcard(require("./network"));
var _page = require("./page");
var types = _interopRequireWildcard(require("./types"));
var _browserContext = require("./browserContext");
var _progress = require("./progress");
var _utils = require("../utils");
var _manualPromise = require("../utils/manualPromise");
var _debugLogger = require("../utils/debugLogger");
var _instrumentation = require("./instrumentation");
var _protocolError = require("./protocolError");
var _selectorParser = require("../utils/isomorphic/selectorParser");
var _locatorGenerators = require("../utils/isomorphic/locatorGenerators");
var _frameSelectors = require("./frameSelectors");
var _errors = require("./errors");
var _fileUploadUtils = require("./fileUploadUtils");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
/**
 * Copyright 2017 Google Inc. All rights reserved.
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

class NavigationAbortedError extends Error {
  constructor(documentId, message) {
    super(message);
    this.documentId = void 0;
    this.documentId = documentId;
  }
}
exports.NavigationAbortedError = NavigationAbortedError;
const kDummyFrameId = '<dummy>';
class FrameManager {
  constructor(page) {
    this._page = void 0;
    this._frames = new Map();
    this._mainFrame = void 0;
    this._consoleMessageTags = new Map();
    this._signalBarriers = new Set();
    this._webSockets = new Map();
    this._openedDialogs = new Set();
    this._closeAllOpeningDialogs = false;
    this._page = page;
    this._mainFrame = undefined;
  }
  createDummyMainFrameIfNeeded() {
    if (!this._mainFrame) this.frameAttached(kDummyFrameId, null);
  }
  dispose() {
    for (const frame of this._frames.values()) {
      frame._stopNetworkIdleTimer();
      frame._invalidateNonStallingEvaluations('Target crashed');
    }
  }
  mainFrame() {
    return this._mainFrame;
  }
  frames() {
    const frames = [];
    collect(this._mainFrame);
    return frames;
    function collect(frame) {
      frames.push(frame);
      for (const subframe of frame.childFrames()) collect(subframe);
    }
  }
  frame(frameId) {
    return this._frames.get(frameId) || null;
  }
  frameAttached(frameId, parentFrameId) {
    const parentFrame = parentFrameId ? this._frames.get(parentFrameId) : null;
    if (!parentFrame) {
      if (this._mainFrame) {
        // Update frame id to retain frame identity on cross-process navigation.
        this._frames.delete(this._mainFrame._id);
        this._mainFrame._id = frameId;
      } else {
        (0, _utils.assert)(!this._frames.has(frameId));
        this._mainFrame = new Frame(this._page, frameId, parentFrame);
      }
      this._frames.set(frameId, this._mainFrame);
      return this._mainFrame;
    } else {
      (0, _utils.assert)(!this._frames.has(frameId));
      const frame = new Frame(this._page, frameId, parentFrame);
      this._frames.set(frameId, frame);
      this._page.emit(_page.Page.Events.FrameAttached, frame);
      return frame;
    }
  }
  async waitForSignalsCreatedBy(progress, noWaitAfter, action, source) {
    if (noWaitAfter) return action();
    const barrier = new SignalBarrier(progress);
    this._signalBarriers.add(barrier);
    if (progress) progress.cleanupWhenAborted(() => this._signalBarriers.delete(barrier));
    const result = await action();
    if (source === 'input') await this._page._delegate.inputActionEpilogue();
    await barrier.waitFor();
    this._signalBarriers.delete(barrier);
    // Resolve in the next task, after all waitForNavigations.
    await new Promise((0, _utils.makeWaitForNextTask)());
    return result;
  }
  frameWillPotentiallyRequestNavigation() {
    for (const barrier of this._signalBarriers) barrier.retain();
  }
  frameDidPotentiallyRequestNavigation() {
    for (const barrier of this._signalBarriers) barrier.release();
  }
  frameRequestedNavigation(frameId, documentId) {
    const frame = this._frames.get(frameId);
    if (!frame) return;
    for (const barrier of this._signalBarriers) barrier.addFrameNavigation(frame);
    if (frame.pendingDocument() && frame.pendingDocument().documentId === documentId) {
      // Do not override request with undefined.
      return;
    }
    const request = documentId ? Array.from(frame._inflightRequests).find(request => request._documentId === documentId) : undefined;
    frame.setPendingDocument({
      documentId,
      request
    });
  }
  frameCommittedNewDocumentNavigation(frameId, url, name, documentId, initial) {
    const frame = this._frames.get(frameId);
    this.removeChildFramesRecursively(frame);
    this.clearWebSockets(frame);
    frame._url = url;
    frame._name = name;
    let keepPending;
    const pendingDocument = frame.pendingDocument();
    if (pendingDocument) {
      if (pendingDocument.documentId === undefined) {
        // Pending with unknown documentId - assume it is the one being committed.
        pendingDocument.documentId = documentId;
      }
      if (pendingDocument.documentId === documentId) {
        // Committing a pending document.
        frame._currentDocument = pendingDocument;
      } else {
        // Sometimes, we already have a new pending when the old one commits.
        // An example would be Chromium error page followed by a new navigation request,
        // where the error page commit arrives after Network.requestWillBeSent for the
        // new navigation.
        // We commit, but keep the pending request since it's not done yet.
        keepPending = pendingDocument;
        frame._currentDocument = {
          documentId,
          request: undefined
        };
      }
      frame.setPendingDocument(undefined);
    } else {
      // No pending - just commit a new document.
      frame._currentDocument = {
        documentId,
        request: undefined
      };
    }
    frame._onClearLifecycle();
    const navigationEvent = {
      url,
      name,
      newDocument: frame._currentDocument,
      isPublic: true
    };
    this._fireInternalFrameNavigation(frame, navigationEvent);
    if (!initial) {
      _debugLogger.debugLogger.log('api', `  navigated to "${url}"`);
      this._page.frameNavigatedToNewDocument(frame);
    }
    // Restore pending if any - see comments above about keepPending.
    frame.setPendingDocument(keepPending);
  }
  frameCommittedSameDocumentNavigation(frameId, url) {
    const frame = this._frames.get(frameId);
    if (!frame) return;
    frame._url = url;
    const navigationEvent = {
      url,
      name: frame._name,
      isPublic: true
    };
    this._fireInternalFrameNavigation(frame, navigationEvent);
    _debugLogger.debugLogger.log('api', `  navigated to "${url}"`);
  }
  frameAbortedNavigation(frameId, errorText, documentId) {
    const frame = this._frames.get(frameId);
    if (!frame || !frame.pendingDocument()) return;
    if (documentId !== undefined && frame.pendingDocument().documentId !== documentId) return;
    const navigationEvent = {
      url: frame._url,
      name: frame._name,
      newDocument: frame.pendingDocument(),
      error: new NavigationAbortedError(documentId, errorText),
      isPublic: !(documentId && frame._redirectedNavigations.has(documentId))
    };
    frame.setPendingDocument(undefined);
    this._fireInternalFrameNavigation(frame, navigationEvent);
  }
  frameDetached(frameId) {
    const frame = this._frames.get(frameId);
    if (frame) {
      this._removeFramesRecursively(frame);
      this._page.mainFrame()._recalculateNetworkIdle();
    }
  }
  frameLifecycleEvent(frameId, event) {
    const frame = this._frames.get(frameId);
    if (frame) frame._onLifecycleEvent(event);
  }
  requestStarted(request, route) {
    const frame = request.frame();
    this._inflightRequestStarted(request);
    if (request._documentId) frame.setPendingDocument({
      documentId: request._documentId,
      request
    });
    if (request._isFavicon) {
      if (route) route.continue(request, {
        isFallback: true
      }).catch(() => {});
      return;
    }
    this._page.emitOnContext(_browserContext.BrowserContext.Events.Request, request);
    if (route) {
      var _this$_page$_serverRe, _this$_page, _this$_page$_clientRe, _this$_page2, _this$_page$_browserC, _this$_page$_browserC2;
      const r = new network.Route(request, route);
      if ((_this$_page$_serverRe = (_this$_page = this._page)._serverRequestInterceptor) !== null && _this$_page$_serverRe !== void 0 && _this$_page$_serverRe.call(_this$_page, r, request)) return;
      if ((_this$_page$_clientRe = (_this$_page2 = this._page)._clientRequestInterceptor) !== null && _this$_page$_clientRe !== void 0 && _this$_page$_clientRe.call(_this$_page2, r, request)) return;
      if ((_this$_page$_browserC = (_this$_page$_browserC2 = this._page._browserContext)._requestInterceptor) !== null && _this$_page$_browserC !== void 0 && _this$_page$_browserC.call(_this$_page$_browserC2, r, request)) return;
      r.continue({
        isFallback: true
      }).catch(() => {});
    }
  }
  requestReceivedResponse(response) {
    if (response.request()._isFavicon) return;
    this._page.emitOnContext(_browserContext.BrowserContext.Events.Response, response);
  }
  reportRequestFinished(request, response) {
    this._inflightRequestFinished(request);
    if (request._isFavicon) return;
    this._page.emitOnContext(_browserContext.BrowserContext.Events.RequestFinished, {
      request,
      response
    });
  }
  requestFailed(request, canceled) {
    const frame = request.frame();
    this._inflightRequestFinished(request);
    if (frame.pendingDocument() && frame.pendingDocument().request === request) {
      let errorText = request.failure().errorText;
      if (canceled) errorText += '; maybe frame was detached?';
      this.frameAbortedNavigation(frame._id, errorText, frame.pendingDocument().documentId);
    }
    if (request._isFavicon) return;
    this._page.emitOnContext(_browserContext.BrowserContext.Events.RequestFailed, request);
  }
  dialogDidOpen(dialog) {
    // Any ongoing evaluations will be stalled until the dialog is closed.
    for (const frame of this._frames.values()) frame._invalidateNonStallingEvaluations('JavaScript dialog interrupted evaluation');
    if (this._closeAllOpeningDialogs) dialog.close().then(() => {});else this._openedDialogs.add(dialog);
  }
  dialogWillClose(dialog) {
    this._openedDialogs.delete(dialog);
  }
  async closeOpenDialogs() {
    await Promise.all([...this._openedDialogs].map(dialog => dialog.close())).catch(() => {});
    this._openedDialogs.clear();
  }
  setCloseAllOpeningDialogs(closeDialogs) {
    this._closeAllOpeningDialogs = closeDialogs;
  }
  removeChildFramesRecursively(frame) {
    for (const child of frame.childFrames()) this._removeFramesRecursively(child);
  }
  _removeFramesRecursively(frame) {
    this.removeChildFramesRecursively(frame);
    frame._onDetached();
    this._frames.delete(frame._id);
    if (!this._page.isClosed()) this._page.emit(_page.Page.Events.FrameDetached, frame);
  }
  _inflightRequestFinished(request) {
    const frame = request.frame();
    if (request._isFavicon) return;
    if (!frame._inflightRequests.has(request)) return;
    frame._inflightRequests.delete(request);
    if (frame._inflightRequests.size === 0) frame._startNetworkIdleTimer();
  }
  _inflightRequestStarted(request) {
    const frame = request.frame();
    if (request._isFavicon) return;
    frame._inflightRequests.add(request);
    if (frame._inflightRequests.size === 1) frame._stopNetworkIdleTimer();
  }
  interceptConsoleMessage(message) {
    if (message.type() !== 'debug') return false;
    const tag = message.text();
    const handler = this._consoleMessageTags.get(tag);
    if (!handler) return false;
    this._consoleMessageTags.delete(tag);
    handler();
    return true;
  }
  clearWebSockets(frame) {
    // TODO: attribute sockets to frames.
    if (frame.parentFrame()) return;
    this._webSockets.clear();
  }
  onWebSocketCreated(requestId, url) {
    const ws = new network.WebSocket(this._page, url);
    this._webSockets.set(requestId, ws);
  }
  onWebSocketRequest(requestId) {
    const ws = this._webSockets.get(requestId);
    if (ws && ws.markAsNotified()) this._page.emit(_page.Page.Events.WebSocket, ws);
  }
  onWebSocketResponse(requestId, status, statusText) {
    const ws = this._webSockets.get(requestId);
    if (status < 400) return;
    if (ws) ws.error(`${statusText}: ${status}`);
  }
  onWebSocketFrameSent(requestId, opcode, data) {
    const ws = this._webSockets.get(requestId);
    if (ws) ws.frameSent(opcode, data);
  }
  webSocketFrameReceived(requestId, opcode, data) {
    const ws = this._webSockets.get(requestId);
    if (ws) ws.frameReceived(opcode, data);
  }
  webSocketClosed(requestId) {
    const ws = this._webSockets.get(requestId);
    if (ws) ws.closed();
    this._webSockets.delete(requestId);
  }
  webSocketError(requestId, errorMessage) {
    const ws = this._webSockets.get(requestId);
    if (ws) ws.error(errorMessage);
  }
  _fireInternalFrameNavigation(frame, event) {
    frame.emit(Frame.Events.InternalNavigation, event);
  }
}
exports.FrameManager = FrameManager;
class Frame extends _instrumentation.SdkObject {
  constructor(page, id, parentFrame) {
    super(page, 'frame');
    this._id = void 0;
    this._firedLifecycleEvents = new Set();
    this._firedNetworkIdleSelf = false;
    this._currentDocument = void 0;
    this._pendingDocument = void 0;
    this._page = void 0;
    this._parentFrame = void 0;
    this._url = '';
    this._contextData = new Map();
    this._childFrames = new Set();
    this._name = '';
    this._inflightRequests = new Set();
    this._networkIdleTimer = void 0;
    this._setContentCounter = 0;
    this._detachedScope = new _utils.LongStandingScope();
    this._raceAgainstEvaluationStallingEventsPromises = new Set();
    this._redirectedNavigations = new Map();
    // documentId -> data
    this.selectors = void 0;
    this.attribution.frame = this;
    this._id = id;
    this._page = page;
    this._parentFrame = parentFrame;
    this._currentDocument = {
      documentId: undefined,
      request: undefined
    };
    this.selectors = new _frameSelectors.FrameSelectors(this);
    this._contextData.set('main', {
      contextPromise: new _manualPromise.ManualPromise(),
      context: null
    });
    this._contextData.set('utility', {
      contextPromise: new _manualPromise.ManualPromise(),
      context: null
    });
    this._setContext('main', null);
    this._setContext('utility', null);
    if (this._parentFrame) this._parentFrame._childFrames.add(this);
    this._firedLifecycleEvents.add('commit');
    if (id !== kDummyFrameId) this._startNetworkIdleTimer();
  }
  isDetached() {
    return this._detachedScope.isClosed();
  }
  _onLifecycleEvent(event) {
    if (this._firedLifecycleEvents.has(event)) return;
    this._firedLifecycleEvents.add(event);
    this.emit(Frame.Events.AddLifecycle, event);
    if (this === this._page.mainFrame() && this._url !== 'about:blank') _debugLogger.debugLogger.log('api', `  "${event}" event fired`);
    this._page.mainFrame()._recalculateNetworkIdle();
  }
  _onClearLifecycle() {
    for (const event of this._firedLifecycleEvents) this.emit(Frame.Events.RemoveLifecycle, event);
    this._firedLifecycleEvents.clear();
    // Keep the current navigation request if any.
    this._inflightRequests = new Set(Array.from(this._inflightRequests).filter(request => request === this._currentDocument.request));
    this._stopNetworkIdleTimer();
    if (this._inflightRequests.size === 0) this._startNetworkIdleTimer();
    this._page.mainFrame()._recalculateNetworkIdle(this);
    this._onLifecycleEvent('commit');
  }
  setPendingDocument(documentInfo) {
    this._pendingDocument = documentInfo;
    if (documentInfo) this._invalidateNonStallingEvaluations('Navigation interrupted the evaluation');
  }
  pendingDocument() {
    return this._pendingDocument;
  }
  _invalidateNonStallingEvaluations(message) {
    if (!this._raceAgainstEvaluationStallingEventsPromises.size) return;
    const error = new Error(message);
    for (const promise of this._raceAgainstEvaluationStallingEventsPromises) promise.reject(error);
  }
  async raceAgainstEvaluationStallingEvents(cb) {
    if (this._pendingDocument) throw new Error('Frame is currently attempting a navigation');
    if (this._page._frameManager._openedDialogs.size) throw new Error('Open JavaScript dialog prevents evaluation');
    const promise = new _manualPromise.ManualPromise();
    this._raceAgainstEvaluationStallingEventsPromises.add(promise);
    try {
      return await Promise.race([cb(), promise]);
    } finally {
      this._raceAgainstEvaluationStallingEventsPromises.delete(promise);
    }
  }
  nonStallingRawEvaluateInExistingMainContext(expression) {
    return this.raceAgainstEvaluationStallingEvents(() => {
      const context = this._existingMainContext();
      if (!context) throw new Error('Frame does not yet have a main execution context');
      return context.rawEvaluateJSON(expression);
    });
  }
  nonStallingEvaluateInExistingContext(expression, isFunction, world) {
    return this.raceAgainstEvaluationStallingEvents(() => {
      var _this$_contextData$ge;
      const context = (_this$_contextData$ge = this._contextData.get(world)) === null || _this$_contextData$ge === void 0 ? void 0 : _this$_contextData$ge.context;
      if (!context) throw new Error('Frame does not yet have the execution context');
      return context.evaluateExpression(expression, {
        isFunction
      });
    });
  }
  _recalculateNetworkIdle(frameThatAllowsRemovingNetworkIdle) {
    let isNetworkIdle = this._firedNetworkIdleSelf;
    for (const child of this._childFrames) {
      child._recalculateNetworkIdle(frameThatAllowsRemovingNetworkIdle);
      // We require networkidle event to be fired in the whole frame subtree, and then consider it done.
      if (!child._firedLifecycleEvents.has('networkidle')) isNetworkIdle = false;
    }
    if (isNetworkIdle && !this._firedLifecycleEvents.has('networkidle')) {
      this._firedLifecycleEvents.add('networkidle');
      this.emit(Frame.Events.AddLifecycle, 'networkidle');
      if (this === this._page.mainFrame() && this._url !== 'about:blank') _debugLogger.debugLogger.log('api', `  "networkidle" event fired`);
    }
    if (frameThatAllowsRemovingNetworkIdle !== this && this._firedLifecycleEvents.has('networkidle') && !isNetworkIdle) {
      // Usually, networkidle is fired once and not removed after that.
      // However, when we clear them right before a new commit, this is allowed for a particular frame.
      this._firedLifecycleEvents.delete('networkidle');
      this.emit(Frame.Events.RemoveLifecycle, 'networkidle');
    }
  }
  async raceNavigationAction(progress, options, action) {
    return _utils.LongStandingScope.raceMultiple([this._detachedScope, this._page.openScope], action().catch(e => {
      if (e instanceof NavigationAbortedError && e.documentId) {
        const data = this._redirectedNavigations.get(e.documentId);
        if (data) {
          progress.log(`waiting for redirected navigation to "${data.url}"`);
          return data.gotoPromise;
        }
      }
      throw e;
    }));
  }
  redirectNavigation(url, documentId, referer) {
    const controller = new _progress.ProgressController((0, _instrumentation.serverSideCallMetadata)(), this);
    const data = {
      url,
      gotoPromise: controller.run(progress => this._gotoAction(progress, url, {
        referer
      }), 0)
    };
    this._redirectedNavigations.set(documentId, data);
    data.gotoPromise.finally(() => this._redirectedNavigations.delete(documentId));
  }
  async goto(metadata, url, options = {}) {
    const constructedNavigationURL = (0, _utils.constructURLBasedOnBaseURL)(this._page._browserContext._options.baseURL, url);
    const controller = new _progress.ProgressController(metadata, this);
    return controller.run(progress => this._goto(progress, constructedNavigationURL, options), this._page._timeoutSettings.navigationTimeout(options));
  }
  async _goto(progress, url, options) {
    return this.raceNavigationAction(progress, options, async () => this._gotoAction(progress, url, options));
  }
  async _gotoAction(progress, url, options) {
    const waitUntil = verifyLifecycle('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
    progress.log(`navigating to "${url}", waiting until "${waitUntil}"`);
    const headers = this._page.extraHTTPHeaders() || [];
    const refererHeader = headers.find(h => h.name.toLowerCase() === 'referer');
    let referer = refererHeader ? refererHeader.value : undefined;
    if (options.referer !== undefined) {
      if (referer !== undefined && referer !== options.referer) throw new Error('"referer" is already specified as extra HTTP header');
      referer = options.referer;
    }
    url = _helper.helper.completeUserURL(url);
    const sameDocument = _helper.helper.waitForEvent(progress, this, Frame.Events.InternalNavigation, e => !e.newDocument);
    const navigateResult = await this._page._delegate.navigateFrame(this, url, referer);
    let event;
    if (navigateResult.newDocumentId) {
      sameDocument.dispose();
      event = await _helper.helper.waitForEvent(progress, this, Frame.Events.InternalNavigation, event => {
        // We are interested either in this specific document, or any other document that
        // did commit and replaced the expected document.
        return event.newDocument && (event.newDocument.documentId === navigateResult.newDocumentId || !event.error);
      }).promise;
      if (event.newDocument.documentId !== navigateResult.newDocumentId) {
        // This is just a sanity check. In practice, new navigation should
        // cancel the previous one and report "request cancelled"-like error.
        throw new NavigationAbortedError(navigateResult.newDocumentId, `Navigation to "${url}" is interrupted by another navigation to "${event.url}"`);
      }
      if (event.error) throw event.error;
    } else {
      event = await sameDocument.promise;
    }
    if (!this._firedLifecycleEvents.has(waitUntil)) await _helper.helper.waitForEvent(progress, this, Frame.Events.AddLifecycle, e => e === waitUntil).promise;
    const request = event.newDocument ? event.newDocument.request : undefined;
    const response = request ? request._finalRequest().response() : null;
    return response;
  }
  async _waitForNavigation(progress, requiresNewDocument, options) {
    const waitUntil = verifyLifecycle('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
    progress.log(`waiting for navigation until "${waitUntil}"`);
    const navigationEvent = await _helper.helper.waitForEvent(progress, this, Frame.Events.InternalNavigation, event => {
      // Any failed navigation results in a rejection.
      if (event.error) return true;
      if (requiresNewDocument && !event.newDocument) return false;
      progress.log(`  navigated to "${this._url}"`);
      return true;
    }).promise;
    if (navigationEvent.error) throw navigationEvent.error;
    if (!this._firedLifecycleEvents.has(waitUntil)) await _helper.helper.waitForEvent(progress, this, Frame.Events.AddLifecycle, e => e === waitUntil).promise;
    const request = navigationEvent.newDocument ? navigationEvent.newDocument.request : undefined;
    return request ? request._finalRequest().response() : null;
  }
  async _waitForLoadState(progress, state) {
    const waitUntil = verifyLifecycle('state', state);
    if (!this._firedLifecycleEvents.has(waitUntil)) await _helper.helper.waitForEvent(progress, this, Frame.Events.AddLifecycle, e => e === waitUntil).promise;
  }
  async frameElement() {
    return this._page._delegate.getFrameElement(this);
  }
  _context(world) {
    return this._contextData.get(world).contextPromise.then(contextOrDestroyedReason => {
      if (contextOrDestroyedReason instanceof js.ExecutionContext) return contextOrDestroyedReason;
      throw new Error(contextOrDestroyedReason.destroyedReason);
    });
  }
  _mainContext() {
    return this._context('main');
  }
  _existingMainContext() {
    var _this$_contextData$ge2;
    return ((_this$_contextData$ge2 = this._contextData.get('main')) === null || _this$_contextData$ge2 === void 0 ? void 0 : _this$_contextData$ge2.context) || null;
  }
  _utilityContext() {
    return this._context('utility');
  }
  async evaluateExpression(expression, options = {}, arg) {
    var _options$world;
    const context = await this._context((_options$world = options.world) !== null && _options$world !== void 0 ? _options$world : 'main');
    const value = await context.evaluateExpression(expression, options, arg);
    return value;
  }
  async evaluateExpressionHandle(expression, options = {}, arg) {
    var _options$world2;
    const context = await this._context((_options$world2 = options.world) !== null && _options$world2 !== void 0 ? _options$world2 : 'main');
    const value = await context.evaluateExpressionHandle(expression, options, arg);
    return value;
  }
  async querySelector(selector, options) {
    _debugLogger.debugLogger.log('api', `    finding element using the selector "${selector}"`);
    return this.selectors.query(selector, options);
  }
  async waitForSelector(metadata, selector, options, scope) {
    const controller = new _progress.ProgressController(metadata, this);
    if (options.visibility) throw new Error('options.visibility is not supported, did you mean options.state?');
    if (options.waitFor && options.waitFor !== 'visible') throw new Error('options.waitFor is not supported, did you mean options.state?');
    const {
      state = 'visible'
    } = options;
    if (!['attached', 'detached', 'visible', 'hidden'].includes(state)) throw new Error(`state: expected one of (attached|detached|visible|hidden)`);
    return controller.run(async progress => {
      progress.log(`waiting for ${this._asLocator(selector)}${state === 'attached' ? '' : ' to be ' + state}`);
      return await this.waitForSelectorInternal(progress, selector, options, scope);
    }, this._page._timeoutSettings.timeout(options));
  }
  async waitForSelectorInternal(progress, selector, options, scope) {
    const {
      state = 'visible'
    } = options;
    const promise = this.retryWithProgressAndTimeouts(progress, [0, 20, 50, 100, 100, 500], async continuePolling => {
      const resolved = await this.selectors.resolveInjectedForSelector(selector, options, scope);
      progress.throwIfAborted();
      if (!resolved) {
        if (state === 'hidden' || state === 'detached') return null;
        return continuePolling;
      }
      const result = await resolved.injected.evaluateHandle((injected, {
        info,
        root
      }) => {
        const elements = injected.querySelectorAll(info.parsed, root || document);
        const element = elements[0];
        const visible = element ? injected.isVisible(element) : false;
        let log = '';
        if (elements.length > 1) {
          if (info.strict) throw injected.strictModeViolationError(info.parsed, elements);
          log = `  locator resolved to ${elements.length} elements. Proceeding with the first one: ${injected.previewNode(elements[0])}`;
        } else if (element) {
          log = `  locator resolved to ${visible ? 'visible' : 'hidden'} ${injected.previewNode(element)}`;
        }
        return {
          log,
          element,
          visible,
          attached: !!element
        };
      }, {
        info: resolved.info,
        root: resolved.frame === this ? scope : undefined
      });
      const {
        log,
        visible,
        attached
      } = await result.evaluate(r => ({
        log: r.log,
        visible: r.visible,
        attached: r.attached
      }));
      if (log) progress.log(log);
      const success = {
        attached,
        detached: !attached,
        visible,
        hidden: !visible
      }[state];
      if (!success) {
        result.dispose();
        return continuePolling;
      }
      if (options.omitReturnValue) {
        result.dispose();
        return null;
      }
      const element = state === 'attached' || state === 'visible' ? await result.evaluateHandle(r => r.element) : null;
      result.dispose();
      if (!element) return null;
      if (options.__testHookBeforeAdoptNode) await options.__testHookBeforeAdoptNode();
      try {
        return await element._adoptTo(await resolved.frame._mainContext());
      } catch (e) {
        return continuePolling;
      }
    });
    return scope ? scope._context._raceAgainstContextDestroyed(promise) : promise;
  }
  async dispatchEvent(metadata, selector, type, eventInit = {}, options = {}, scope) {
    await this._callOnElementOnceMatches(metadata, selector, (injectedScript, element, data) => {
      injectedScript.dispatchEvent(element, data.type, data.eventInit);
    }, {
      type,
      eventInit
    }, {
      mainWorld: true,
      ...options
    }, scope);
  }
  async evalOnSelector(selector, strict, expression, isFunction, arg, scope) {
    const handle = await this.selectors.query(selector, {
      strict
    }, scope);
    if (!handle) throw new Error(`Failed to find element matching selector "${selector}"`);
    const result = await handle.evaluateExpression(expression, {
      isFunction
    }, arg);
    handle.dispose();
    return result;
  }
  async evalOnSelectorAll(selector, expression, isFunction, arg, scope) {
    const arrayHandle = await this.selectors.queryArrayInMainWorld(selector, scope);
    const result = await arrayHandle.evaluateExpression(expression, {
      isFunction
    }, arg);
    arrayHandle.dispose();
    return result;
  }
  async maskSelectors(selectors, color) {
    const context = await this._utilityContext();
    const injectedScript = await context.injectedScript();
    await injectedScript.evaluate((injected, {
      parsed,
      color
    }) => {
      injected.maskSelectors(parsed, color);
    }, {
      parsed: selectors,
      color: color
    });
  }
  async querySelectorAll(selector) {
    return this.selectors.queryAll(selector);
  }
  async queryCount(selector) {
    return await this.selectors.queryCount(selector);
  }
  async content() {
    try {
      const context = await this._utilityContext();
      return await context.evaluate(() => {
        let retVal = '';
        if (document.doctype) retVal = new XMLSerializer().serializeToString(document.doctype);
        if (document.documentElement) retVal += document.documentElement.outerHTML;
        return retVal;
      });
    } catch (e) {
      if (js.isJavaScriptErrorInEvaluate(e) || (0, _protocolError.isSessionClosedError)(e)) throw e;
      throw new Error(`Unable to retrieve content because the page is navigating and changing the content.`);
    }
  }
  async setContent(metadata, html, options = {}) {
    const controller = new _progress.ProgressController(metadata, this);
    return controller.run(async progress => {
      await this.raceNavigationAction(progress, options, async () => {
        const waitUntil = options.waitUntil === undefined ? 'load' : options.waitUntil;
        progress.log(`setting frame content, waiting until "${waitUntil}"`);
        const tag = `--playwright--set--content--${this._id}--${++this._setContentCounter}--`;
        const context = await this._utilityContext();
        const lifecyclePromise = new Promise((resolve, reject) => {
          this._page._frameManager._consoleMessageTags.set(tag, () => {
            // Clear lifecycle right after document.open() - see 'tag' below.
            this._onClearLifecycle();
            this._waitForLoadState(progress, waitUntil).then(resolve).catch(reject);
          });
        });
        const contentPromise = context.evaluate(({
          html,
          tag
        }) => {
          document.open();
          console.debug(tag); // eslint-disable-line no-console
          document.write(html);
          document.close();
        }, {
          html,
          tag
        });
        await Promise.all([contentPromise, lifecyclePromise]);
        return null;
      });
    }, this._page._timeoutSettings.navigationTimeout(options));
  }
  name() {
    return this._name || '';
  }
  url() {
    return this._url;
  }
  origin() {
    var _network$parsedURL;
    if (!this._url.startsWith('http')) return;
    return (_network$parsedURL = network.parsedURL(this._url)) === null || _network$parsedURL === void 0 ? void 0 : _network$parsedURL.origin;
  }
  parentFrame() {
    return this._parentFrame;
  }
  childFrames() {
    return Array.from(this._childFrames);
  }
  async addScriptTag(params) {
    const {
      url = null,
      content = null,
      type = ''
    } = params;
    if (!url && !content) throw new Error('Provide an object with a `url`, `path` or `content` property');
    const context = await this._mainContext();
    return this._raceWithCSPError(async () => {
      if (url !== null) return (await context.evaluateHandle(addScriptUrl, {
        url,
        type
      })).asElement();
      const result = (await context.evaluateHandle(addScriptContent, {
        content: content,
        type
      })).asElement();
      // Another round trip to the browser to ensure that we receive CSP error messages
      // (if any) logged asynchronously in a separate task on the content main thread.
      if (this._page._delegate.cspErrorsAsynchronousForInlineScripts) await context.evaluate(() => true);
      return result;
    });
    async function addScriptUrl(params) {
      const script = document.createElement('script');
      script.src = params.url;
      if (params.type) script.type = params.type;
      const promise = new Promise((res, rej) => {
        script.onload = res;
        script.onerror = e => rej(typeof e === 'string' ? new Error(e) : new Error(`Failed to load script at ${script.src}`));
      });
      document.head.appendChild(script);
      await promise;
      return script;
    }
    function addScriptContent(params) {
      const script = document.createElement('script');
      script.type = params.type || 'text/javascript';
      script.text = params.content;
      let error = null;
      script.onerror = e => error = e;
      document.head.appendChild(script);
      if (error) throw error;
      return script;
    }
  }
  async addStyleTag(params) {
    const {
      url = null,
      content = null
    } = params;
    if (!url && !content) throw new Error('Provide an object with a `url`, `path` or `content` property');
    const context = await this._mainContext();
    return this._raceWithCSPError(async () => {
      if (url !== null) return (await context.evaluateHandle(addStyleUrl, url)).asElement();
      return (await context.evaluateHandle(addStyleContent, content)).asElement();
    });
    async function addStyleUrl(url) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      const promise = new Promise((res, rej) => {
        link.onload = res;
        link.onerror = rej;
      });
      document.head.appendChild(link);
      await promise;
      return link;
    }
    async function addStyleContent(content) {
      const style = document.createElement('style');
      style.type = 'text/css';
      style.appendChild(document.createTextNode(content));
      const promise = new Promise((res, rej) => {
        style.onload = res;
        style.onerror = rej;
      });
      document.head.appendChild(style);
      await promise;
      return style;
    }
  }
  async _raceWithCSPError(func) {
    const listeners = [];
    let result;
    let error;
    let cspMessage;
    const actionPromise = func().then(r => result = r).catch(e => error = e);
    const errorPromise = new Promise(resolve => {
      listeners.push(_eventsHelper.eventsHelper.addEventListener(this._page._browserContext, _browserContext.BrowserContext.Events.Console, message => {
        if (message.page() !== this._page || message.type() !== 'error') return;
        if (message.text().includes('Content-Security-Policy') || message.text().includes('Content Security Policy')) {
          cspMessage = message;
          resolve();
        }
      }));
    });
    await Promise.race([actionPromise, errorPromise]);
    _eventsHelper.eventsHelper.removeEventListeners(listeners);
    if (cspMessage) throw new Error(cspMessage.text());
    if (error) throw error;
    return result;
  }
  async retryWithProgressAndTimeouts(progress, timeouts, action) {
    const continuePolling = Symbol('continuePolling');
    timeouts = [0, ...timeouts];
    let timeoutIndex = 0;
    while (progress.isRunning()) {
      const timeout = timeouts[Math.min(timeoutIndex++, timeouts.length - 1)];
      if (timeout) {
        // Make sure we react immediately upon page close or frame detach.
        // We need this to show expected/received values in time.
        const actionPromise = new Promise(f => setTimeout(f, timeout));
        await _utils.LongStandingScope.raceMultiple([this._page.openScope, this._detachedScope], actionPromise);
      }
      progress.throwIfAborted();
      try {
        const result = await action(continuePolling);
        if (result === continuePolling) continue;
        return result;
      } catch (e) {
        if (this._isErrorThatCannotBeRetried(e)) throw e;
        continue;
      }
    }
    progress.throwIfAborted();
    return undefined;
  }
  _isErrorThatCannotBeRetried(e) {
    // Always fail on JavaScript errors or when the main connection is closed.
    if (js.isJavaScriptErrorInEvaluate(e) || (0, _protocolError.isSessionClosedError)(e)) return true;
    // Certain errors opt-out of the retries, throw.
    if (dom.isNonRecoverableDOMError(e) || (0, _selectorParser.isInvalidSelectorError)(e)) return true;
    // If the call is made on the detached frame - throw.
    if (this.isDetached()) return true;
    // Retry upon all other errors.
    return false;
  }
  async _retryWithProgressIfNotConnected(progress, selector, strict, performLocatorHandlersCheckpoint, action) {
    progress.log(`waiting for ${this._asLocator(selector)}`);
    return this.retryWithProgressAndTimeouts(progress, [0, 20, 50, 100, 100, 500], async continuePolling => {
      if (performLocatorHandlersCheckpoint) await this._page.performLocatorHandlersCheckpoint(progress);
      const resolved = await this.selectors.resolveInjectedForSelector(selector, {
        strict
      });
      progress.throwIfAborted();
      if (!resolved) return continuePolling;
      const result = await resolved.injected.evaluateHandle((injected, {
        info
      }) => {
        const elements = injected.querySelectorAll(info.parsed, document);
        const element = elements[0];
        let log = '';
        if (elements.length > 1) {
          if (info.strict) throw injected.strictModeViolationError(info.parsed, elements);
          log = `  locator resolved to ${elements.length} elements. Proceeding with the first one: ${injected.previewNode(elements[0])}`;
        } else if (element) {
          log = `  locator resolved to ${injected.previewNode(element)}`;
        }
        return {
          log,
          success: !!element,
          element
        };
      }, {
        info: resolved.info
      });
      const {
        log,
        success
      } = await result.evaluate(r => ({
        log: r.log,
        success: r.success
      }));
      if (log) progress.log(log);
      if (!success) {
        result.dispose();
        return continuePolling;
      }
      const element = await result.evaluateHandle(r => r.element);
      result.dispose();
      try {
        const result = await action(element);
        if (result === 'error:notconnected') {
          progress.log('element was detached from the DOM, retrying');
          return continuePolling;
        }
        return result;
      } finally {
        element === null || element === void 0 || element.dispose();
      }
    });
  }
  async rafrafTimeoutScreenshotElementWithProgress(progress, selector, timeout, options) {
    return await this._retryWithProgressIfNotConnected(progress, selector, true /* strict */, true /* performLocatorHandlersCheckpoint */, async handle => {
      await handle._frame.rafrafTimeout(timeout);
      return await this._page._screenshotter.screenshotElement(progress, handle, options);
    });
  }
  async click(metadata, selector, options) {
    const controller = new _progress.ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, options.strict, !options.force /* performLocatorHandlersCheckpoint */, handle => handle._click(progress, options)));
    }, this._page._timeoutSettings.timeout(options));
  }
  async dblclick(metadata, selector, options = {}) {
    const controller = new _progress.ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, options.strict, !options.force /* performLocatorHandlersCheckpoint */, handle => handle._dblclick(progress, options)));
    }, this._page._timeoutSettings.timeout(options));
  }
  async dragAndDrop(metadata, source, target, options = {}) {
    const controller = new _progress.ProgressController(metadata, this);
    await controller.run(async progress => {
      dom.assertDone(await this._retryWithProgressIfNotConnected(progress, source, options.strict, !options.force /* performLocatorHandlersCheckpoint */, async handle => {
        return handle._retryPointerAction(progress, 'move and down', false, async point => {
          await this._page.mouse.move(point.x, point.y);
          await this._page.mouse.down();
        }, {
          ...options,
          position: options.sourcePosition,
          timeout: progress.timeUntilDeadline()
        });
      }));
      // Note: do not perform locator handlers checkpoint to avoid moving the mouse in the middle of a drag operation.
      dom.assertDone(await this._retryWithProgressIfNotConnected(progress, target, options.strict, false /* performLocatorHandlersCheckpoint */, async handle => {
        return handle._retryPointerAction(progress, 'move and up', false, async point => {
          await this._page.mouse.move(point.x, point.y);
          await this._page.mouse.up();
        }, {
          ...options,
          position: options.targetPosition,
          timeout: progress.timeUntilDeadline()
        });
      }));
    }, this._page._timeoutSettings.timeout(options));
  }
  async tap(metadata, selector, options) {
    if (!this._page._browserContext._options.hasTouch) throw new Error('The page does not support tap. Use hasTouch context option to enable touch support.');
    const controller = new _progress.ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, options.strict, !options.force /* performLocatorHandlersCheckpoint */, handle => handle._tap(progress, options)));
    }, this._page._timeoutSettings.timeout(options));
  }
  async fill(metadata, selector, value, options) {
    const controller = new _progress.ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, options.strict, !options.force /* performLocatorHandlersCheckpoint */, handle => handle._fill(progress, value, options)));
    }, this._page._timeoutSettings.timeout(options));
  }
  async focus(metadata, selector, options = {}) {
    const controller = new _progress.ProgressController(metadata, this);
    await controller.run(async progress => {
      dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, options.strict, true /* performLocatorHandlersCheckpoint */, handle => handle._focus(progress)));
    }, this._page._timeoutSettings.timeout(options));
  }
  async blur(metadata, selector, options = {}) {
    const controller = new _progress.ProgressController(metadata, this);
    await controller.run(async progress => {
      dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, options.strict, true /* performLocatorHandlersCheckpoint */, handle => handle._blur(progress)));
    }, this._page._timeoutSettings.timeout(options));
  }
  async textContent(metadata, selector, options = {}, scope) {
    return this._callOnElementOnceMatches(metadata, selector, (injected, element) => element.textContent, undefined, options, scope);
  }
  async innerText(metadata, selector, options = {}, scope) {
    return this._callOnElementOnceMatches(metadata, selector, (injectedScript, element) => {
      if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml') throw injectedScript.createStacklessError('Node is not an HTMLElement');
      return element.innerText;
    }, undefined, options, scope);
  }
  async innerHTML(metadata, selector, options = {}, scope) {
    return this._callOnElementOnceMatches(metadata, selector, (injected, element) => element.innerHTML, undefined, options, scope);
  }
  async getAttribute(metadata, selector, name, options = {}, scope) {
    return this._callOnElementOnceMatches(metadata, selector, (injected, element, data) => element.getAttribute(data.name), {
      name
    }, options, scope);
  }
  async inputValue(metadata, selector, options = {}, scope) {
    return this._callOnElementOnceMatches(metadata, selector, (injectedScript, node) => {
      const element = injectedScript.retarget(node, 'follow-label');
      if (!element || element.nodeName !== 'INPUT' && element.nodeName !== 'TEXTAREA' && element.nodeName !== 'SELECT') throw injectedScript.createStacklessError('Node is not an <input>, <textarea> or <select> element');
      return element.value;
    }, undefined, options, scope);
  }
  async highlight(selector) {
    const resolved = await this.selectors.resolveInjectedForSelector(selector);
    if (!resolved) return;
    return await resolved.injected.evaluate((injected, {
      info
    }) => {
      return injected.highlight(info.parsed);
    }, {
      info: resolved.info
    });
  }
  async hideHighlight() {
    return this.raceAgainstEvaluationStallingEvents(async () => {
      const context = await this._utilityContext();
      const injectedScript = await context.injectedScript();
      return await injectedScript.evaluate(injected => {
        return injected.hideHighlight();
      });
    });
  }
  async _elementState(metadata, selector, state, options = {}, scope) {
    const result = await this._callOnElementOnceMatches(metadata, selector, (injected, element, data) => {
      return injected.elementState(element, data.state);
    }, {
      state
    }, options, scope);
    return dom.throwRetargetableDOMError(result);
  }
  async isVisible(metadata, selector, options = {}, scope) {
    const controller = new _progress.ProgressController(metadata, this);
    return controller.run(async progress => {
      progress.log(`  checking visibility of ${this._asLocator(selector)}`);
      return await this.isVisibleInternal(selector, options, scope);
    }, this._page._timeoutSettings.timeout({}));
  }
  async isVisibleInternal(selector, options = {}, scope) {
    try {
      const resolved = await this.selectors.resolveInjectedForSelector(selector, options, scope);
      if (!resolved) return false;
      return await resolved.injected.evaluate((injected, {
        info,
        root
      }) => {
        const element = injected.querySelector(info.parsed, root || document, info.strict);
        const state = element ? injected.elementState(element, 'visible') : false;
        return state === 'error:notconnected' ? false : state;
      }, {
        info: resolved.info,
        root: resolved.frame === this ? scope : undefined
      });
    } catch (e) {
      if (js.isJavaScriptErrorInEvaluate(e) || (0, _selectorParser.isInvalidSelectorError)(e) || (0, _protocolError.isSessionClosedError)(e)) throw e;
      return false;
    }
  }
  async isHidden(metadata, selector, options = {}, scope) {
    return !(await this.isVisible(metadata, selector, options, scope));
  }
  async isDisabled(metadata, selector, options = {}, scope) {
    return this._elementState(metadata, selector, 'disabled', options, scope);
  }
  async isEnabled(metadata, selector, options = {}, scope) {
    return this._elementState(metadata, selector, 'enabled', options, scope);
  }
  async isEditable(metadata, selector, options = {}, scope) {
    return this._elementState(metadata, selector, 'editable', options, scope);
  }
  async isChecked(metadata, selector, options = {}, scope) {
    return this._elementState(metadata, selector, 'checked', options, scope);
  }
  async hover(metadata, selector, options = {}) {
    const controller = new _progress.ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, options.strict, !options.force /* performLocatorHandlersCheckpoint */, handle => handle._hover(progress, options)));
    }, this._page._timeoutSettings.timeout(options));
  }
  async selectOption(metadata, selector, elements, values, options = {}) {
    const controller = new _progress.ProgressController(metadata, this);
    return controller.run(async progress => {
      return await this._retryWithProgressIfNotConnected(progress, selector, options.strict, !options.force /* performLocatorHandlersCheckpoint */, handle => handle._selectOption(progress, elements, values, options));
    }, this._page._timeoutSettings.timeout(options));
  }
  async setInputFiles(metadata, selector, params) {
    const inputFileItems = await (0, _fileUploadUtils.prepareFilesForUpload)(this, params);
    const controller = new _progress.ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, params.strict, true /* performLocatorHandlersCheckpoint */, handle => handle._setInputFiles(progress, inputFileItems, params)));
    }, this._page._timeoutSettings.timeout(params));
  }
  async type(metadata, selector, text, options = {}) {
    const controller = new _progress.ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, options.strict, true /* performLocatorHandlersCheckpoint */, handle => handle._type(progress, text, options)));
    }, this._page._timeoutSettings.timeout(options));
  }
  async press(metadata, selector, key, options = {}) {
    const controller = new _progress.ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, options.strict, true /* performLocatorHandlersCheckpoint */, handle => handle._press(progress, key, options)));
    }, this._page._timeoutSettings.timeout(options));
  }
  async check(metadata, selector, options = {}) {
    const controller = new _progress.ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, options.strict, !options.force /* performLocatorHandlersCheckpoint */, handle => handle._setChecked(progress, true, options)));
    }, this._page._timeoutSettings.timeout(options));
  }
  async uncheck(metadata, selector, options = {}) {
    const controller = new _progress.ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, options.strict, !options.force /* performLocatorHandlersCheckpoint */, handle => handle._setChecked(progress, false, options)));
    }, this._page._timeoutSettings.timeout(options));
  }
  async waitForTimeout(metadata, timeout) {
    const controller = new _progress.ProgressController(metadata, this);
    return controller.run(async () => {
      await new Promise(resolve => setTimeout(resolve, timeout));
    });
  }
  async expect(metadata, selector, options) {
    const result = await this._expectImpl(metadata, selector, options);
    // Library mode special case for the expect errors which are return values, not exceptions.
    if (result.matches === options.isNot) metadata.error = {
      error: {
        name: 'Expect',
        message: 'Expect failed'
      }
    };
    return result;
  }
  async _expectImpl(metadata, selector, options) {
    let timeout = this._page._timeoutSettings.timeout(options);
    const start = timeout > 0 ? (0, _utils.monotonicTime)() : 0;
    const lastIntermediateResult = {
      isSet: false
    };
    const resultOneShot = await this._expectInternal(metadata, selector, options, true, timeout, lastIntermediateResult);
    if (resultOneShot.matches !== options.isNot) return resultOneShot;
    if (timeout > 0) {
      const elapsed = (0, _utils.monotonicTime)() - start;
      timeout -= elapsed;
    }
    if (timeout < 0) return {
      matches: options.isNot,
      log: metadata.log,
      timedOut: true,
      received: lastIntermediateResult.received
    };
    return await this._expectInternal(metadata, selector, options, false, timeout, lastIntermediateResult);
  }
  async _expectInternal(metadata, selector, options, oneShot, timeout, lastIntermediateResult) {
    const controller = new _progress.ProgressController(metadata, this);
    return controller.run(async progress => {
      if (oneShot) {
        progress.log(`${metadata.apiName}${timeout ? ` with timeout ${timeout}ms` : ''}`);
        progress.log(`waiting for ${this._asLocator(selector)}`);
      }
      return await this.retryWithProgressAndTimeouts(progress, [100, 250, 500, 1000], async continuePolling => {
        var _info$world;
        await this._page.performLocatorHandlersCheckpoint(progress);
        const selectorInFrame = await this.selectors.resolveFrameForSelector(selector, {
          strict: true
        });
        progress.throwIfAborted();
        const {
          frame,
          info
        } = selectorInFrame || {
          frame: this,
          info: undefined
        };
        const world = options.expression === 'to.have.property' ? 'main' : (_info$world = info === null || info === void 0 ? void 0 : info.world) !== null && _info$world !== void 0 ? _info$world : 'utility';
        const context = await frame._context(world);
        const injected = await context.injectedScript();
        progress.throwIfAborted();
        const {
          log,
          matches,
          received,
          missingReceived
        } = await injected.evaluate(async (injected, {
          info,
          options,
          callId
        }) => {
          const elements = info ? injected.querySelectorAll(info.parsed, document) : [];
          const isArray = options.expression === 'to.have.count' || options.expression.endsWith('.array');
          let log = '';
          if (isArray) log = `  locator resolved to ${elements.length} element${elements.length === 1 ? '' : 's'}`;else if (elements.length > 1) throw injected.strictModeViolationError(info.parsed, elements);else if (elements.length) log = `  locator resolved to ${injected.previewNode(elements[0])}`;
          if (callId) injected.markTargetElements(new Set(elements), callId);
          return {
            log,
            ...(await injected.expect(elements[0], options, elements))
          };
        }, {
          info,
          options,
          callId: metadata.id
        });
        if (log) progress.log(log);
        // Note: missingReceived avoids `unexpected value "undefined"` when element was not found.
        if (matches === options.isNot) {
          lastIntermediateResult.received = missingReceived ? '<element(s) not found>' : received;
          lastIntermediateResult.isSet = true;
          if (!missingReceived && !Array.isArray(received)) progress.log(`  unexpected value "${renderUnexpectedValue(options.expression, received)}"`);
        }
        if (!oneShot && matches === options.isNot) {
          // Keep waiting in these cases:
          // expect(locator).conditionThatDoesNotMatch
          // expect(locator).not.conditionThatDoesMatch
          return continuePolling;
        }
        return {
          matches,
          received
        };
      });
    }, oneShot ? 0 : timeout).catch(e => {
      // Q: Why not throw upon isSessionClosedError(e) as in other places?
      // A: We want user to receive a friendly message containing the last intermediate result.
      if (js.isJavaScriptErrorInEvaluate(e) || (0, _selectorParser.isInvalidSelectorError)(e)) throw e;
      const result = {
        matches: options.isNot,
        log: metadata.log
      };
      if (lastIntermediateResult.isSet) result.received = lastIntermediateResult.received;
      if (e instanceof _errors.TimeoutError) result.timedOut = true;
      return result;
    });
  }
  async _waitForFunctionExpression(metadata, expression, isFunction, arg, options, world = 'main') {
    const controller = new _progress.ProgressController(metadata, this);
    if (typeof options.pollingInterval === 'number') (0, _utils.assert)(options.pollingInterval > 0, 'Cannot poll with non-positive interval: ' + options.pollingInterval);
    expression = js.normalizeEvaluationExpression(expression, isFunction);
    return controller.run(async progress => {
      return this.retryWithProgressAndTimeouts(progress, [100], async () => {
        const context = world === 'main' ? await this._mainContext() : await this._utilityContext();
        const injectedScript = await context.injectedScript();
        const handle = await injectedScript.evaluateHandle((injected, {
          expression,
          isFunction,
          polling,
          arg
        }) => {
          const predicate = () => {
            // NOTE: make sure to use `globalThis.eval` instead of `self.eval` due to a bug with sandbox isolation
            // in firefox.
            // See https://bugzilla.mozilla.org/show_bug.cgi?id=1814898
            let result = globalThis.eval(expression);
            if (isFunction === true) {
              result = result(arg);
            } else if (isFunction === false) {
              result = result;
            } else {
              // auto detect.
              if (typeof result === 'function') result = result(arg);
            }
            return result;
          };
          let fulfill;
          let reject;
          let aborted = false;
          const result = new Promise((f, r) => {
            fulfill = f;
            reject = r;
          });
          const next = () => {
            if (aborted) return;
            try {
              const success = predicate();
              if (success) {
                fulfill(success);
                return;
              }
              if (typeof polling !== 'number') injected.builtinRequestAnimationFrame(next);else injected.builtinSetTimeout(next, polling);
            } catch (e) {
              reject(e);
            }
          };
          next();
          return {
            result,
            abort: () => aborted = true
          };
        }, {
          expression,
          isFunction,
          polling: options.pollingInterval,
          arg
        });
        progress.cleanupWhenAborted(() => handle.evaluate(h => h.abort()).catch(() => {}));
        return handle.evaluateHandle(h => h.result);
      });
    }, this._page._timeoutSettings.timeout(options));
  }
  async waitForFunctionValueInUtility(progress, pageFunction) {
    const expression = `() => {
      const result = (${pageFunction})();
      if (!result)
        return result;
      return JSON.stringify(result);
    }`;
    const handle = await this._waitForFunctionExpression((0, _instrumentation.serverSideCallMetadata)(), expression, true, undefined, {
      timeout: progress.timeUntilDeadline()
    }, 'utility');
    return JSON.parse(handle.rawValue());
  }
  async title() {
    const context = await this._utilityContext();
    return context.evaluate(() => document.title);
  }
  async rafrafTimeout(timeout) {
    if (timeout === 0) return;
    const context = await this._utilityContext();
    await Promise.all([
    // wait for double raf
    context.evaluate(() => new Promise(x => {
      requestAnimationFrame(() => {
        requestAnimationFrame(x);
      });
    })), new Promise(fulfill => setTimeout(fulfill, timeout))]);
  }
  _onDetached() {
    this._stopNetworkIdleTimer();
    this._detachedScope.close(new Error('Frame was detached'));
    for (const data of this._contextData.values()) {
      if (data.context) data.context.contextDestroyed('Frame was detached');
      data.contextPromise.resolve({
        destroyedReason: 'Frame was detached'
      });
    }
    if (this._parentFrame) this._parentFrame._childFrames.delete(this);
    this._parentFrame = null;
  }
  async _callOnElementOnceMatches(metadata, selector, body, taskData, options = {}, scope) {
    const callbackText = body.toString();
    const controller = new _progress.ProgressController(metadata, this);
    return controller.run(async progress => {
      progress.log(`waiting for ${this._asLocator(selector)}`);
      const promise = this.retryWithProgressAndTimeouts(progress, [0, 20, 50, 100, 100, 500], async continuePolling => {
        const resolved = await this.selectors.resolveInjectedForSelector(selector, options, scope);
        progress.throwIfAborted();
        if (!resolved) return continuePolling;
        const {
          log,
          success,
          value
        } = await resolved.injected.evaluate((injected, {
          info,
          callbackText,
          taskData,
          callId,
          root
        }) => {
          const callback = injected.eval(callbackText);
          const element = injected.querySelector(info.parsed, root || document, info.strict);
          if (!element) return {
            success: false
          };
          const log = `  locator resolved to ${injected.previewNode(element)}`;
          if (callId) injected.markTargetElements(new Set([element]), callId);
          return {
            log,
            success: true,
            value: callback(injected, element, taskData)
          };
        }, {
          info: resolved.info,
          callbackText,
          taskData,
          callId: progress.metadata.id,
          root: resolved.frame === this ? scope : undefined
        });
        if (log) progress.log(log);
        if (!success) return continuePolling;
        return value;
      });
      return scope ? scope._context._raceAgainstContextDestroyed(promise) : promise;
    }, this._page._timeoutSettings.timeout(options));
  }
  _setContext(world, context) {
    const data = this._contextData.get(world);
    data.context = context;
    if (context) data.contextPromise.resolve(context);else data.contextPromise = new _manualPromise.ManualPromise();
  }
  _contextCreated(world, context) {
    const data = this._contextData.get(world);
    // In case of multiple sessions to the same target, there's a race between
    // connections so we might end up creating multiple isolated worlds.
    // We can use either.
    if (data.context) {
      data.context.contextDestroyed('Execution context was destroyed, most likely because of a navigation');
      this._setContext(world, null);
    }
    this._setContext(world, context);
  }
  _contextDestroyed(context) {
    // Sometimes we get this after detach, in which case we should not reset
    // our already destroyed contexts to something that will never resolve.
    if (this._detachedScope.isClosed()) return;
    context.contextDestroyed('Execution context was destroyed, most likely because of a navigation');
    for (const [world, data] of this._contextData) {
      if (data.context === context) this._setContext(world, null);
    }
  }
  _startNetworkIdleTimer() {
    (0, _utils.assert)(!this._networkIdleTimer);
    // We should not start a timer and report networkidle in detached frames.
    // This happens at least in Firefox for child frames, where we may get requestFinished
    // after the frame was detached - probably a race in the Firefox itself.
    if (this._firedLifecycleEvents.has('networkidle') || this._detachedScope.isClosed()) return;
    this._networkIdleTimer = setTimeout(() => {
      this._firedNetworkIdleSelf = true;
      this._page.mainFrame()._recalculateNetworkIdle();
    }, 500);
  }
  _stopNetworkIdleTimer() {
    if (this._networkIdleTimer) clearTimeout(this._networkIdleTimer);
    this._networkIdleTimer = undefined;
    this._firedNetworkIdleSelf = false;
  }
  async extendInjectedScript(source, arg) {
    const context = await this._context('main');
    const injectedScriptHandle = await context.injectedScript();
    return injectedScriptHandle.evaluateHandle((injectedScript, {
      source,
      arg
    }) => {
      return injectedScript.extend(source, arg);
    }, {
      source,
      arg
    });
  }
  async resetStorageForCurrentOriginBestEffort(newStorage) {
    const context = await this._utilityContext();
    await context.evaluate(async ({
      ls
    }) => {
      // Clean DOMStorage.
      sessionStorage.clear();
      localStorage.clear();

      // Add new DOM Storage values.
      for (const entry of ls || []) localStorage[entry.name] = entry.value;

      // Clean Service Workers
      const registrations = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
      await Promise.all(registrations.map(async r => {
        // Heuristic for service workers that stalled during main script fetch or importScripts:
        // Waiting for them to finish unregistering takes ages so we do not await.
        // However, they will unregister immediately after fetch finishes and should not affect next page load.
        // Unfortunately, loading next page in Chromium still takes 5 seconds waiting for
        // some operation on this bogus service worker to finish.
        if (!r.installing && !r.waiting && !r.active) r.unregister().catch(() => {});else await r.unregister().catch(() => {});
      }));

      // Clean IndexedDB
      for (const db of (await ((_indexedDB$databases = (_indexedDB = indexedDB).databases) === null || _indexedDB$databases === void 0 ? void 0 : _indexedDB$databases.call(_indexedDB))) || []) {
        var _indexedDB$databases, _indexedDB;
        // Do not wait for the callback - it is called on timer in Chromium (slow).
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
    }, {
      ls: newStorage === null || newStorage === void 0 ? void 0 : newStorage.localStorage
    }).catch(() => {});
  }
  _asLocator(selector) {
    return (0, _locatorGenerators.asLocator)(this._page.attribution.playwright.options.sdkLanguage, selector);
  }
}
exports.Frame = Frame;
Frame.Events = {
  InternalNavigation: 'internalnavigation',
  AddLifecycle: 'addlifecycle',
  RemoveLifecycle: 'removelifecycle'
};
class SignalBarrier {
  constructor(progress) {
    this._progress = void 0;
    this._protectCount = 0;
    this._promise = new _manualPromise.ManualPromise();
    this._progress = progress;
    this.retain();
  }
  waitFor() {
    this.release();
    return this._promise;
  }
  async addFrameNavigation(frame) {
    // Auto-wait top-level navigations only.
    if (frame.parentFrame()) return;
    this.retain();
    const waiter = _helper.helper.waitForEvent(null, frame, Frame.Events.InternalNavigation, e => {
      if (!e.isPublic) return false;
      if (!e.error && this._progress) this._progress.log(`  navigated to "${frame._url}"`);
      return true;
    });
    await _utils.LongStandingScope.raceMultiple([frame._page.openScope, frame._detachedScope], waiter.promise).catch(() => {});
    waiter.dispose();
    this.release();
  }
  retain() {
    ++this._protectCount;
  }
  release() {
    --this._protectCount;
    if (!this._protectCount) this._promise.resolve();
  }
}
function verifyLifecycle(name, waitUntil) {
  if (waitUntil === 'networkidle0') waitUntil = 'networkidle';
  if (!types.kLifecycleEvents.has(waitUntil)) throw new Error(`${name}: expected one of (load|domcontentloaded|networkidle|commit)`);
  return waitUntil;
}
function renderUnexpectedValue(expression, received) {
  if (expression === 'to.be.checked') return received ? 'checked' : 'unchecked';
  if (expression === 'to.be.unchecked') return received ? 'unchecked' : 'checked';
  if (expression === 'to.be.visible') return received ? 'visible' : 'hidden';
  if (expression === 'to.be.hidden') return received ? 'hidden' : 'visible';
  if (expression === 'to.be.enabled') return received ? 'enabled' : 'disabled';
  if (expression === 'to.be.disabled') return received ? 'disabled' : 'enabled';
  if (expression === 'to.be.editable') return received ? 'editable' : 'readonly';
  if (expression === 'to.be.readonly') return received ? 'readonly' : 'editable';
  if (expression === 'to.be.empty') return received ? 'empty' : 'not empty';
  if (expression === 'to.be.focused') return received ? 'focused' : 'not focused';
  return received;
}