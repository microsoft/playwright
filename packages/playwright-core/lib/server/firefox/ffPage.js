"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.UTILITY_WORLD_NAME = exports.FFPage = void 0;
var dialog = _interopRequireWildcard(require("../dialog"));
var dom = _interopRequireWildcard(require("../dom"));
var _eventsHelper = require("../../utils/eventsHelper");
var _page = require("../page");
var _ffAccessibility = require("./ffAccessibility");
var _ffConnection = require("./ffConnection");
var _ffExecutionContext = require("./ffExecutionContext");
var _ffInput = require("./ffInput");
var _ffNetworkManager = require("./ffNetworkManager");
var _stackTrace = require("../../utils/stackTrace");
var _debugLogger = require("../../utils/debugLogger");
var _manualPromise = require("../../utils/manualPromise");
var _browserContext = require("../browserContext");
var _errors = require("../errors");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
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

const UTILITY_WORLD_NAME = exports.UTILITY_WORLD_NAME = '__playwright_utility_world__';
class FFPage {
  constructor(session, browserContext, opener) {
    this.cspErrorsAsynchronousForInlineScripts = true;
    this.rawMouse = void 0;
    this.rawKeyboard = void 0;
    this.rawTouchscreen = void 0;
    this._session = void 0;
    this._page = void 0;
    this._networkManager = void 0;
    this._browserContext = void 0;
    this._pagePromise = new _manualPromise.ManualPromise();
    this._initializedPage = null;
    this._initializationFailed = false;
    this._opener = void 0;
    this._contextIdToContext = void 0;
    this._eventListeners = void 0;
    this._workers = new Map();
    this._screencastId = void 0;
    this._initScripts = [];
    this._session = session;
    this._opener = opener;
    this.rawKeyboard = new _ffInput.RawKeyboardImpl(session);
    this.rawMouse = new _ffInput.RawMouseImpl(session);
    this.rawTouchscreen = new _ffInput.RawTouchscreenImpl(session);
    this._contextIdToContext = new Map();
    this._browserContext = browserContext;
    this._page = new _page.Page(this, browserContext);
    this.rawMouse.setPage(this._page);
    this._networkManager = new _ffNetworkManager.FFNetworkManager(session, this._page);
    this._page.on(_page.Page.Events.FrameDetached, frame => this._removeContextsForFrame(frame));
    // TODO: remove Page.willOpenNewWindowAsynchronously from the protocol.
    this._eventListeners = [_eventsHelper.eventsHelper.addEventListener(this._session, 'Page.eventFired', this._onEventFired.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.frameAttached', this._onFrameAttached.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.frameDetached', this._onFrameDetached.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.navigationAborted', this._onNavigationAborted.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.navigationCommitted', this._onNavigationCommitted.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.navigationStarted', this._onNavigationStarted.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.sameDocumentNavigation', this._onSameDocumentNavigation.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Runtime.executionContextCreated', this._onExecutionContextCreated.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Runtime.executionContextDestroyed', this._onExecutionContextDestroyed.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Runtime.executionContextsCleared', this._onExecutionContextsCleared.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.linkClicked', event => this._onLinkClicked(event.phase)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.uncaughtError', this._onUncaughtError.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Runtime.console', this._onConsole.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.dialogOpened', this._onDialogOpened.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.bindingCalled', this._onBindingCalled.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.fileChooserOpened', this._onFileChooserOpened.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.workerCreated', this._onWorkerCreated.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.workerDestroyed', this._onWorkerDestroyed.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.dispatchMessageFromWorker', this._onDispatchMessageFromWorker.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.crashed', this._onCrashed.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.videoRecordingStarted', this._onVideoRecordingStarted.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.webSocketCreated', this._onWebSocketCreated.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.webSocketClosed', this._onWebSocketClosed.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.webSocketFrameReceived', this._onWebSocketFrameReceived.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.webSocketFrameSent', this._onWebSocketFrameSent.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.screencastFrame', this._onScreencastFrame.bind(this))];
    this._session.once('Page.ready', async () => {
      await this._page.initOpener(this._opener);
      if (this._initializationFailed) return;
      // Note: it is important to call |reportAsNew| before resolving pageOrError promise,
      // so that anyone who awaits pageOrError got a ready and reported page.
      this._initializedPage = this._page;
      this._page.reportAsNew();
      this._pagePromise.resolve(this._page);
    });
    // Ideally, we somehow ensure that utility world is created before Page.ready arrives, but currently it is racy.
    // Therefore, we can end up with an initialized page without utility world, although very unlikely.
    this.addInitScript(new _page.InitScript(''), UTILITY_WORLD_NAME).catch(e => this._markAsError(e));
  }
  potentiallyUninitializedPage() {
    return this._page;
  }
  async _markAsError(error) {
    // Same error may be report twice: channer disconnected and session.send fails.
    if (this._initializationFailed) return;
    this._initializationFailed = true;
    if (!this._initializedPage) {
      await this._page.initOpener(this._opener);
      this._page.reportAsNew(error);
      this._pagePromise.resolve(error);
    }
  }
  async pageOrError() {
    return this._pagePromise;
  }
  _onWebSocketCreated(event) {
    this._page._frameManager.onWebSocketCreated(webSocketId(event.frameId, event.wsid), event.requestURL);
    this._page._frameManager.onWebSocketRequest(webSocketId(event.frameId, event.wsid));
  }
  _onWebSocketClosed(event) {
    if (event.error) this._page._frameManager.webSocketError(webSocketId(event.frameId, event.wsid), event.error);
    this._page._frameManager.webSocketClosed(webSocketId(event.frameId, event.wsid));
  }
  _onWebSocketFrameReceived(event) {
    this._page._frameManager.webSocketFrameReceived(webSocketId(event.frameId, event.wsid), event.opcode, event.data);
  }
  _onWebSocketFrameSent(event) {
    this._page._frameManager.onWebSocketFrameSent(webSocketId(event.frameId, event.wsid), event.opcode, event.data);
  }
  _onExecutionContextCreated(payload) {
    const {
      executionContextId,
      auxData
    } = payload;
    const frame = this._page._frameManager.frame(auxData.frameId);
    if (!frame) return;
    const delegate = new _ffExecutionContext.FFExecutionContext(this._session, executionContextId);
    let worldName = null;
    if (auxData.name === UTILITY_WORLD_NAME) worldName = 'utility';else if (!auxData.name) worldName = 'main';
    const context = new dom.FrameExecutionContext(delegate, frame, worldName);
    context[contextDelegateSymbol] = delegate;
    if (worldName) frame._contextCreated(worldName, context);
    this._contextIdToContext.set(executionContextId, context);
  }
  _onExecutionContextDestroyed(payload) {
    const {
      executionContextId
    } = payload;
    const context = this._contextIdToContext.get(executionContextId);
    if (!context) return;
    this._contextIdToContext.delete(executionContextId);
    context.frame._contextDestroyed(context);
  }
  _onExecutionContextsCleared() {
    for (const executionContextId of Array.from(this._contextIdToContext.keys())) this._onExecutionContextDestroyed({
      executionContextId
    });
  }
  _removeContextsForFrame(frame) {
    for (const [contextId, context] of this._contextIdToContext) {
      if (context.frame === frame) this._contextIdToContext.delete(contextId);
    }
  }
  _onLinkClicked(phase) {
    if (phase === 'before') this._page._frameManager.frameWillPotentiallyRequestNavigation();else this._page._frameManager.frameDidPotentiallyRequestNavigation();
  }
  _onNavigationStarted(params) {
    this._page._frameManager.frameRequestedNavigation(params.frameId, params.navigationId);
  }
  _onNavigationAborted(params) {
    this._page._frameManager.frameAbortedNavigation(params.frameId, params.errorText, params.navigationId);
  }
  _onNavigationCommitted(params) {
    for (const [workerId, worker] of this._workers) {
      if (worker.frameId === params.frameId) this._onWorkerDestroyed({
        workerId
      });
    }
    this._page._frameManager.frameCommittedNewDocumentNavigation(params.frameId, params.url, params.name || '', params.navigationId || '', false);
  }
  _onSameDocumentNavigation(params) {
    this._page._frameManager.frameCommittedSameDocumentNavigation(params.frameId, params.url);
  }
  _onFrameAttached(params) {
    this._page._frameManager.frameAttached(params.frameId, params.parentFrameId);
  }
  _onFrameDetached(params) {
    this._page._frameManager.frameDetached(params.frameId);
  }
  _onEventFired(payload) {
    const {
      frameId,
      name
    } = payload;
    if (name === 'load') this._page._frameManager.frameLifecycleEvent(frameId, 'load');
    if (name === 'DOMContentLoaded') this._page._frameManager.frameLifecycleEvent(frameId, 'domcontentloaded');
  }
  _onUncaughtError(params) {
    const {
      name,
      message
    } = (0, _stackTrace.splitErrorMessage)(params.message);
    const error = new Error(message);
    error.stack = params.message + '\n' + params.stack.split('\n').filter(Boolean).map(a => a.replace(/([^@]*)@(.*)/, '    at $1 ($2)')).join('\n');
    error.name = name;
    this._page.emitOnContextOnceInitialized(_browserContext.BrowserContext.Events.PageError, error, this._page);
  }
  _onConsole(payload) {
    const {
      type,
      args,
      executionContextId,
      location
    } = payload;
    const context = this._contextIdToContext.get(executionContextId);
    if (!context) return;
    // Juggler reports 'warn' for some internal messages generated by the browser.
    this._page._addConsoleMessage(type === 'warn' ? 'warning' : type, args.map(arg => context.createHandle(arg)), location);
  }
  _onDialogOpened(params) {
    this._page.emitOnContext(_browserContext.BrowserContext.Events.Dialog, new dialog.Dialog(this._page, params.type, params.message, async (accept, promptText) => {
      await this._session.sendMayFail('Page.handleDialog', {
        dialogId: params.dialogId,
        accept,
        promptText
      });
    }, params.defaultValue));
  }
  async _onBindingCalled(event) {
    const pageOrError = await this.pageOrError();
    if (!(pageOrError instanceof Error)) {
      const context = this._contextIdToContext.get(event.executionContextId);
      if (context) await this._page._onBindingCalled(event.payload, context);
    }
  }
  async _onFileChooserOpened(payload) {
    const {
      executionContextId,
      element
    } = payload;
    const context = this._contextIdToContext.get(executionContextId);
    if (!context) return;
    const handle = context.createHandle(element).asElement();
    await this._page._onFileChooserOpened(handle);
  }
  async _onWorkerCreated(event) {
    const workerId = event.workerId;
    const worker = new _page.Worker(this._page, event.url);
    const workerSession = new _ffConnection.FFSession(this._session._connection, workerId, message => {
      this._session.send('Page.sendMessageToWorker', {
        frameId: event.frameId,
        workerId: workerId,
        message: JSON.stringify(message)
      }).catch(e => {
        workerSession.dispatchMessage({
          id: message.id,
          method: '',
          params: {},
          error: {
            message: e.message,
            data: undefined
          }
        });
      });
    });
    this._workers.set(workerId, {
      session: workerSession,
      frameId: event.frameId
    });
    this._page._addWorker(workerId, worker);
    workerSession.once('Runtime.executionContextCreated', event => {
      worker._createExecutionContext(new _ffExecutionContext.FFExecutionContext(workerSession, event.executionContextId));
    });
    workerSession.on('Runtime.console', event => {
      const {
        type,
        args,
        location
      } = event;
      const context = worker._existingExecutionContext;
      this._page._addConsoleMessage(type, args.map(arg => context.createHandle(arg)), location);
    });
    // Note: we receive worker exceptions directly from the page.
  }
  _onWorkerDestroyed(event) {
    const workerId = event.workerId;
    const worker = this._workers.get(workerId);
    if (!worker) return;
    worker.session.dispose();
    this._workers.delete(workerId);
    this._page._removeWorker(workerId);
  }
  async _onDispatchMessageFromWorker(event) {
    const worker = this._workers.get(event.workerId);
    if (!worker) return;
    worker.session.dispatchMessage(JSON.parse(event.message));
  }
  async _onCrashed(event) {
    this._session.markAsCrashed();
    this._page._didCrash();
  }
  _onVideoRecordingStarted(event) {
    this._browserContext._browser._videoStarted(this._browserContext, event.screencastId, event.file, this.pageOrError());
  }
  async exposeBinding(binding) {
    await this._session.send('Page.addBinding', {
      name: binding.name,
      script: binding.source
    });
  }
  async removeExposedBindings() {
    // TODO: implement me.
  }
  didClose() {
    this._markAsError(new _errors.TargetClosedError());
    this._session.dispose();
    _eventsHelper.eventsHelper.removeEventListeners(this._eventListeners);
    this._networkManager.dispose();
    this._page._didClose();
  }
  async navigateFrame(frame, url, referer) {
    const response = await this._session.send('Page.navigate', {
      url,
      referer,
      frameId: frame._id
    });
    return {
      newDocumentId: response.navigationId || undefined
    };
  }
  async updateExtraHTTPHeaders() {
    await this._session.send('Network.setExtraHTTPHeaders', {
      headers: this._page.extraHTTPHeaders() || []
    });
  }
  async updateEmulatedViewportSize() {
    const viewportSize = this._page.viewportSize();
    await this._session.send('Page.setViewportSize', {
      viewportSize
    });
  }
  async bringToFront() {
    await this._session.send('Page.bringToFront', {});
  }
  async updateEmulateMedia() {
    const emulatedMedia = this._page.emulatedMedia();
    const colorScheme = emulatedMedia.colorScheme === 'no-override' ? undefined : emulatedMedia.colorScheme;
    const reducedMotion = emulatedMedia.reducedMotion === 'no-override' ? undefined : emulatedMedia.reducedMotion;
    const forcedColors = emulatedMedia.forcedColors === 'no-override' ? undefined : emulatedMedia.forcedColors;
    await this._session.send('Page.setEmulatedMedia', {
      // Empty string means reset.
      type: emulatedMedia.media === 'no-override' ? '' : emulatedMedia.media,
      colorScheme,
      reducedMotion,
      forcedColors
    });
  }
  async updateRequestInterception() {
    await this._networkManager.setRequestInterception(this._page.needsRequestInterception());
  }
  async updateFileChooserInterception() {
    const enabled = this._page.fileChooserIntercepted();
    await this._session.send('Page.setInterceptFileChooserDialog', {
      enabled
    }).catch(() => {}); // target can be closed.
  }
  async reload() {
    await this._session.send('Page.reload');
  }
  async goBack() {
    const {
      success
    } = await this._session.send('Page.goBack', {
      frameId: this._page.mainFrame()._id
    });
    return success;
  }
  async goForward() {
    const {
      success
    } = await this._session.send('Page.goForward', {
      frameId: this._page.mainFrame()._id
    });
    return success;
  }
  async addInitScript(initScript, worldName) {
    this._initScripts.push({
      initScript,
      worldName
    });
    await this._session.send('Page.setInitScripts', {
      scripts: this._initScripts.map(s => ({
        script: s.initScript.source,
        worldName: s.worldName
      }))
    });
  }
  async removeInitScripts() {
    this._initScripts = [];
    await this._session.send('Page.setInitScripts', {
      scripts: []
    });
  }
  async closePage(runBeforeUnload) {
    await this._session.send('Page.close', {
      runBeforeUnload
    });
  }
  async setBackgroundColor(color) {
    if (color) throw new Error('Not implemented');
  }
  async takeScreenshot(progress, format, documentRect, viewportRect, quality, fitsViewport, scale) {
    if (!documentRect) {
      const scrollOffset = await this._page.mainFrame().waitForFunctionValueInUtility(progress, () => ({
        x: window.scrollX,
        y: window.scrollY
      }));
      documentRect = {
        x: viewportRect.x + scrollOffset.x,
        y: viewportRect.y + scrollOffset.y,
        width: viewportRect.width,
        height: viewportRect.height
      };
    }
    progress.throwIfAborted();
    const {
      data
    } = await this._session.send('Page.screenshot', {
      mimeType: 'image/' + format,
      clip: documentRect,
      quality,
      omitDeviceScaleFactor: scale === 'css'
    });
    return Buffer.from(data, 'base64');
  }
  async getContentFrame(handle) {
    const {
      contentFrameId
    } = await this._session.send('Page.describeNode', {
      frameId: handle._context.frame._id,
      objectId: handle._objectId
    });
    if (!contentFrameId) return null;
    return this._page._frameManager.frame(contentFrameId);
  }
  async getOwnerFrame(handle) {
    const {
      ownerFrameId
    } = await this._session.send('Page.describeNode', {
      frameId: handle._context.frame._id,
      objectId: handle._objectId
    });
    return ownerFrameId || null;
  }
  isElementHandle(remoteObject) {
    return remoteObject.subtype === 'node';
  }
  async getBoundingBox(handle) {
    const quads = await this.getContentQuads(handle);
    if (!quads || !quads.length) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const quad of quads) {
      for (const point of quad) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }
    }
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
  async scrollRectIntoViewIfNeeded(handle, rect) {
    return await this._session.send('Page.scrollIntoViewIfNeeded', {
      frameId: handle._context.frame._id,
      objectId: handle._objectId,
      rect
    }).then(() => 'done').catch(e => {
      if (e instanceof Error && e.message.includes('Node is detached from document')) return 'error:notconnected';
      if (e instanceof Error && e.message.includes('Node does not have a layout object')) return 'error:notvisible';
      throw e;
    });
  }
  async setScreencastOptions(options) {
    if (options) {
      const {
        screencastId
      } = await this._session.send('Page.startScreencast', options);
      this._screencastId = screencastId;
    } else {
      await this._session.send('Page.stopScreencast');
    }
  }
  _onScreencastFrame(event) {
    if (!this._screencastId) return;
    const screencastId = this._screencastId;
    this._page.throttleScreencastFrameAck(() => {
      this._session.send('Page.screencastFrameAck', {
        screencastId
      }).catch(e => _debugLogger.debugLogger.log('error', e));
    });
    const buffer = Buffer.from(event.data, 'base64');
    this._page.emit(_page.Page.Events.ScreencastFrame, {
      buffer,
      width: event.deviceWidth,
      height: event.deviceHeight
    });
  }
  rafCountForStablePosition() {
    return 1;
  }
  async getContentQuads(handle) {
    const result = await this._session.sendMayFail('Page.getContentQuads', {
      frameId: handle._context.frame._id,
      objectId: handle._objectId
    });
    if (!result) return null;
    return result.quads.map(quad => [quad.p1, quad.p2, quad.p3, quad.p4]);
  }
  async setInputFiles(handle, files) {
    await handle.evaluateInUtility(([injected, node, files]) => injected.setInputFiles(node, files), files);
  }
  async setInputFilePaths(handle, files) {
    await this._session.send('Page.setFileInputFiles', {
      frameId: handle._context.frame._id,
      objectId: handle._objectId,
      files
    });
  }
  async adoptElementHandle(handle, to) {
    const result = await this._session.send('Page.adoptNode', {
      frameId: handle._context.frame._id,
      objectId: handle._objectId,
      executionContextId: to[contextDelegateSymbol]._executionContextId
    });
    if (!result.remoteObject) throw new Error(dom.kUnableToAdoptErrorMessage);
    return to.createHandle(result.remoteObject);
  }
  async getAccessibilityTree(needle) {
    return (0, _ffAccessibility.getAccessibilityTree)(this._session, needle);
  }
  async inputActionEpilogue() {}
  async resetForReuse() {
    // Firefox sometimes keeps the last mouse position in the page,
    // which affects things like hovered state.
    // See https://github.com/microsoft/playwright/issues/22432.
    // Move mouse to (-1, -1) to avoid anything being hovered.
    await this.rawMouse.move(-1, -1, 'none', new Set(), new Set(), false);
  }
  async getFrameElement(frame) {
    const parent = frame.parentFrame();
    if (!parent) throw new Error('Frame has been detached.');
    const context = await parent._mainContext();
    const result = await this._session.send('Page.adoptNode', {
      frameId: frame._id,
      executionContextId: context[contextDelegateSymbol]._executionContextId
    });
    if (!result.remoteObject) throw new Error('Frame has been detached.');
    return context.createHandle(result.remoteObject);
  }
  shouldToggleStyleSheetToSyncAnimations() {
    return false;
  }
}
exports.FFPage = FFPage;
function webSocketId(frameId, wsid) {
  return `${frameId}---${wsid}`;
}
const contextDelegateSymbol = Symbol('delegate');