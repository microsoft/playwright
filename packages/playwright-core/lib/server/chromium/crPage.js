"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CRPage = void 0;
var _path = _interopRequireDefault(require("path"));
var _eventsHelper = require("../../utils/eventsHelper");
var _registry = require("../registry");
var _stackTrace = require("../../utils/stackTrace");
var _utils = require("../../utils");
var dialog = _interopRequireWildcard(require("../dialog"));
var dom = _interopRequireWildcard(require("../dom"));
var frames = _interopRequireWildcard(require("../frames"));
var _helper = require("../helper");
var network = _interopRequireWildcard(require("../network"));
var _page = require("../page");
var _crAccessibility = require("./crAccessibility");
var _crBrowser = require("./crBrowser");
var _crCoverage = require("./crCoverage");
var _crDragDrop = require("./crDragDrop");
var _crExecutionContext = require("./crExecutionContext");
var _crInput = require("./crInput");
var _crNetworkManager = require("./crNetworkManager");
var _crPdf = require("./crPdf");
var _crProtocolHelper = require("./crProtocolHelper");
var _defaultFontFamilies = require("./defaultFontFamilies");
var _videoRecorder = require("./videoRecorder");
var _browserContext = require("../browserContext");
var _errors = require("../errors");
var _protocolError = require("../protocolError");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
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

const UTILITY_WORLD_NAME = '__playwright_utility_world__';
class CRPage {
  static mainFrameSession(page) {
    const crPage = page._delegate;
    return crPage._mainFrameSession;
  }
  constructor(client, targetId, browserContext, opener, bits) {
    this._mainFrameSession = void 0;
    this._sessions = new Map();
    this._page = void 0;
    this.rawMouse = void 0;
    this.rawKeyboard = void 0;
    this.rawTouchscreen = void 0;
    this._targetId = void 0;
    this._opener = void 0;
    this._networkManager = void 0;
    this._pdf = void 0;
    this._coverage = void 0;
    this._browserContext = void 0;
    this._pagePromise = void 0;
    this._initializedPage = null;
    this._isBackgroundPage = void 0;
    // Holds window features for the next popup being opened via window.open,
    // until the popup target arrives. This could be racy if two oopifs
    // simultaneously call window.open with window features: the order
    // of their Page.windowOpen events is not guaranteed to match the order
    // of new popup targets.
    this._nextWindowOpenPopupFeatures = [];
    this._targetId = targetId;
    this._opener = opener;
    this._isBackgroundPage = bits.isBackgroundPage;
    const dragManager = new _crDragDrop.DragManager(this);
    this.rawKeyboard = new _crInput.RawKeyboardImpl(client, browserContext._browser._platform() === 'mac', dragManager);
    this.rawMouse = new _crInput.RawMouseImpl(this, client, dragManager);
    this.rawTouchscreen = new _crInput.RawTouchscreenImpl(client);
    this._pdf = new _crPdf.CRPDF(client);
    this._coverage = new _crCoverage.CRCoverage(client);
    this._browserContext = browserContext;
    this._page = new _page.Page(this, browserContext);
    this._networkManager = new _crNetworkManager.CRNetworkManager(this._page, null);
    // Sync any browser context state to the network manager. This does not talk over CDP because
    // we have not connected any sessions to the network manager yet.
    this.updateOffline();
    this.updateExtraHTTPHeaders();
    this.updateHttpCredentials();
    this.updateRequestInterception();
    this._mainFrameSession = new FrameSession(this, client, targetId, null);
    this._sessions.set(targetId, this._mainFrameSession);
    if (opener && !browserContext._options.noDefaultViewport) {
      const features = opener._nextWindowOpenPopupFeatures.shift() || [];
      const viewportSize = _helper.helper.getViewportSizeFromWindowFeatures(features);
      if (viewportSize) this._page._emulatedSize = {
        viewport: viewportSize,
        screen: viewportSize
      };
    }
    // Note: it is important to call |reportAsNew| before resolving pageOrError promise,
    // so that anyone who awaits pageOrError got a ready and reported page.
    this._pagePromise = this._mainFrameSession._initialize(bits.hasUIWindow).then(async r => {
      await this._page.initOpener(this._opener);
      return r;
    }).catch(async e => {
      await this._page.initOpener(this._opener);
      throw e;
    }).then(() => {
      this._initializedPage = this._page;
      this._reportAsNew();
      return this._page;
    }).catch(e => {
      this._reportAsNew(e);
      return e;
    });
  }
  potentiallyUninitializedPage() {
    return this._page;
  }
  _reportAsNew(error) {
    this._page.reportAsNew(error, this._isBackgroundPage ? _crBrowser.CRBrowserContext.CREvents.BackgroundPage : _browserContext.BrowserContext.Events.Page);
  }
  async _forAllFrameSessions(cb) {
    const frameSessions = Array.from(this._sessions.values());
    await Promise.all(frameSessions.map(frameSession => {
      if (frameSession._isMainFrame()) return cb(frameSession);
      return cb(frameSession).catch(e => {
        // Broadcasting a message to the closed iframe should be a noop.
        if ((0, _protocolError.isSessionClosedError)(e)) return;
        throw e;
      });
    }));
  }
  _sessionForFrame(frame) {
    // Frame id equals target id.
    while (!this._sessions.has(frame._id)) {
      const parent = frame.parentFrame();
      if (!parent) throw new Error(`Frame has been detached.`);
      frame = parent;
    }
    return this._sessions.get(frame._id);
  }
  _sessionForHandle(handle) {
    const frame = handle._context.frame;
    return this._sessionForFrame(frame);
  }
  willBeginDownload() {
    this._mainFrameSession._willBeginDownload();
  }
  async pageOrError() {
    return this._pagePromise;
  }
  didClose() {
    for (const session of this._sessions.values()) session.dispose();
    this._page._didClose();
  }
  async navigateFrame(frame, url, referrer) {
    return this._sessionForFrame(frame)._navigate(frame, url, referrer);
  }
  async exposeBinding(binding) {
    await this._forAllFrameSessions(frame => frame._initBinding(binding));
    await Promise.all(this._page.frames().map(frame => frame.evaluateExpression(binding.source).catch(e => {})));
  }
  async removeExposedBindings() {
    await this._forAllFrameSessions(frame => frame._removeExposedBindings());
  }
  async updateExtraHTTPHeaders() {
    const headers = network.mergeHeaders([this._browserContext._options.extraHTTPHeaders, this._page.extraHTTPHeaders()]);
    await this._networkManager.setExtraHTTPHeaders(headers);
  }
  async updateGeolocation() {
    await this._forAllFrameSessions(frame => frame._updateGeolocation(false));
  }
  async updateOffline() {
    await this._networkManager.setOffline(!!this._browserContext._options.offline);
  }
  async updateHttpCredentials() {
    await this._networkManager.authenticate(this._browserContext._options.httpCredentials || null);
  }
  async updateEmulatedViewportSize(preserveWindowBoundaries) {
    await this._mainFrameSession._updateViewport(preserveWindowBoundaries);
  }
  async bringToFront() {
    await this._mainFrameSession._client.send('Page.bringToFront');
  }
  async updateEmulateMedia() {
    await this._forAllFrameSessions(frame => frame._updateEmulateMedia());
  }
  async updateUserAgent() {
    await this._forAllFrameSessions(frame => frame._updateUserAgent());
  }
  async updateRequestInterception() {
    await this._networkManager.setRequestInterception(this._page.needsRequestInterception());
  }
  async updateFileChooserInterception() {
    await this._forAllFrameSessions(frame => frame._updateFileChooserInterception(false));
  }
  async reload() {
    await this._mainFrameSession._client.send('Page.reload');
  }
  async _go(delta) {
    const history = await this._mainFrameSession._client.send('Page.getNavigationHistory');
    const entry = history.entries[history.currentIndex + delta];
    if (!entry) return false;
    await this._mainFrameSession._client.send('Page.navigateToHistoryEntry', {
      entryId: entry.id
    });
    return true;
  }
  goBack() {
    return this._go(-1);
  }
  goForward() {
    return this._go(+1);
  }
  async addInitScript(initScript, world = 'main') {
    await this._forAllFrameSessions(frame => frame._evaluateOnNewDocument(initScript, world));
  }
  async removeInitScripts() {
    await this._forAllFrameSessions(frame => frame._removeEvaluatesOnNewDocument());
  }
  async closePage(runBeforeUnload) {
    if (runBeforeUnload) await this._mainFrameSession._client.send('Page.close');else await this._browserContext._browser._closePage(this);
  }
  async setBackgroundColor(color) {
    await this._mainFrameSession._client.send('Emulation.setDefaultBackgroundColorOverride', {
      color
    });
  }
  async takeScreenshot(progress, format, documentRect, viewportRect, quality, fitsViewport, scale) {
    const {
      visualViewport
    } = await this._mainFrameSession._client.send('Page.getLayoutMetrics');
    if (!documentRect) {
      documentRect = {
        x: visualViewport.pageX + viewportRect.x,
        y: visualViewport.pageY + viewportRect.y,
        ..._helper.helper.enclosingIntSize({
          width: viewportRect.width / visualViewport.scale,
          height: viewportRect.height / visualViewport.scale
        })
      };
    }
    // When taking screenshots with documentRect (based on the page content, not viewport),
    // ignore current page scale.
    const clip = {
      ...documentRect,
      scale: viewportRect ? visualViewport.scale : 1
    };
    if (scale === 'css') {
      const deviceScaleFactor = this._browserContext._options.deviceScaleFactor || 1;
      clip.scale /= deviceScaleFactor;
    }
    progress.throwIfAborted();
    const result = await this._mainFrameSession._client.send('Page.captureScreenshot', {
      format,
      quality,
      clip,
      captureBeyondViewport: !fitsViewport
    });
    return Buffer.from(result.data, 'base64');
  }
  async getContentFrame(handle) {
    return this._sessionForHandle(handle)._getContentFrame(handle);
  }
  async getOwnerFrame(handle) {
    return this._sessionForHandle(handle)._getOwnerFrame(handle);
  }
  isElementHandle(remoteObject) {
    return remoteObject.subtype === 'node';
  }
  async getBoundingBox(handle) {
    return this._sessionForHandle(handle)._getBoundingBox(handle);
  }
  async scrollRectIntoViewIfNeeded(handle, rect) {
    return this._sessionForHandle(handle)._scrollRectIntoViewIfNeeded(handle, rect);
  }
  async setScreencastOptions(options) {
    if (options) {
      await this._mainFrameSession._startScreencast(this, {
        format: 'jpeg',
        quality: options.quality,
        maxWidth: options.width,
        maxHeight: options.height
      });
    } else {
      await this._mainFrameSession._stopScreencast(this);
    }
  }
  rafCountForStablePosition() {
    return 1;
  }
  async getContentQuads(handle) {
    return this._sessionForHandle(handle)._getContentQuads(handle);
  }
  async setInputFiles(handle, files) {
    await handle.evaluateInUtility(([injected, node, files]) => injected.setInputFiles(node, files), files);
  }
  async setInputFilePaths(handle, files) {
    const frame = await handle.ownerFrame();
    if (!frame) throw new Error('Cannot set input files to detached input element');
    const parentSession = this._sessionForFrame(frame);
    await parentSession._client.send('DOM.setFileInputFiles', {
      objectId: handle._objectId,
      files
    });
  }
  async adoptElementHandle(handle, to) {
    return this._sessionForHandle(handle)._adoptElementHandle(handle, to);
  }
  async getAccessibilityTree(needle) {
    return (0, _crAccessibility.getAccessibilityTree)(this._mainFrameSession._client, needle);
  }
  async inputActionEpilogue() {
    await this._mainFrameSession._client.send('Page.enable').catch(e => {});
  }
  async resetForReuse() {}
  async pdf(options) {
    return this._pdf.generate(options);
  }
  coverage() {
    return this._coverage;
  }
  async getFrameElement(frame) {
    let parent = frame.parentFrame();
    if (!parent) throw new Error('Frame has been detached.');
    const parentSession = this._sessionForFrame(parent);
    const {
      backendNodeId
    } = await parentSession._client.send('DOM.getFrameOwner', {
      frameId: frame._id
    }).catch(e => {
      if (e instanceof Error && e.message.includes('Frame with the given id was not found.')) (0, _stackTrace.rewriteErrorMessage)(e, 'Frame has been detached.');
      throw e;
    });
    parent = frame.parentFrame();
    if (!parent) throw new Error('Frame has been detached.');
    return parentSession._adoptBackendNodeId(backendNodeId, await parent._mainContext());
  }
  shouldToggleStyleSheetToSyncAnimations() {
    return false;
  }
}
exports.CRPage = CRPage;
class FrameSession {
  constructor(crPage, client, targetId, parentSession) {
    this._client = void 0;
    this._crPage = void 0;
    this._page = void 0;
    this._parentSession = void 0;
    this._childSessions = new Set();
    this._contextIdToContext = new Map();
    this._eventListeners = [];
    this._targetId = void 0;
    this._firstNonInitialNavigationCommittedPromise = void 0;
    this._firstNonInitialNavigationCommittedFulfill = () => {};
    this._firstNonInitialNavigationCommittedReject = e => {};
    this._windowId = void 0;
    // Marks the oopif session that remote -> local transition has happened in the parent.
    // See Target.detachedFromTarget handler for details.
    this._swappedIn = false;
    this._videoRecorder = null;
    this._screencastId = null;
    this._screencastClients = new Set();
    this._evaluateOnNewDocumentIdentifiers = [];
    this._exposedBindingNames = [];
    this._metricsOverride = void 0;
    this._workerSessions = new Map();
    this._client = client;
    this._crPage = crPage;
    this._page = crPage._page;
    this._targetId = targetId;
    this._parentSession = parentSession;
    if (parentSession) parentSession._childSessions.add(this);
    this._firstNonInitialNavigationCommittedPromise = new Promise((f, r) => {
      this._firstNonInitialNavigationCommittedFulfill = f;
      this._firstNonInitialNavigationCommittedReject = r;
    });
  }
  _isMainFrame() {
    return this._targetId === this._crPage._targetId;
  }
  _addRendererListeners() {
    this._eventListeners.push(...[_eventsHelper.eventsHelper.addEventListener(this._client, 'Log.entryAdded', event => this._onLogEntryAdded(event)), _eventsHelper.eventsHelper.addEventListener(this._client, 'Page.fileChooserOpened', event => this._onFileChooserOpened(event)), _eventsHelper.eventsHelper.addEventListener(this._client, 'Page.frameAttached', event => this._onFrameAttached(event.frameId, event.parentFrameId)), _eventsHelper.eventsHelper.addEventListener(this._client, 'Page.frameDetached', event => this._onFrameDetached(event.frameId, event.reason)), _eventsHelper.eventsHelper.addEventListener(this._client, 'Page.frameNavigated', event => this._onFrameNavigated(event.frame, false)), _eventsHelper.eventsHelper.addEventListener(this._client, 'Page.frameRequestedNavigation', event => this._onFrameRequestedNavigation(event)), _eventsHelper.eventsHelper.addEventListener(this._client, 'Page.javascriptDialogOpening', event => this._onDialog(event)), _eventsHelper.eventsHelper.addEventListener(this._client, 'Page.navigatedWithinDocument', event => this._onFrameNavigatedWithinDocument(event.frameId, event.url)), _eventsHelper.eventsHelper.addEventListener(this._client, 'Runtime.bindingCalled', event => this._onBindingCalled(event)), _eventsHelper.eventsHelper.addEventListener(this._client, 'Runtime.consoleAPICalled', event => this._onConsoleAPI(event)), _eventsHelper.eventsHelper.addEventListener(this._client, 'Runtime.exceptionThrown', exception => this._handleException(exception.exceptionDetails)), _eventsHelper.eventsHelper.addEventListener(this._client, 'Runtime.executionContextCreated', event => this._onExecutionContextCreated(event.context)), _eventsHelper.eventsHelper.addEventListener(this._client, 'Runtime.executionContextDestroyed', event => this._onExecutionContextDestroyed(event.executionContextId)), _eventsHelper.eventsHelper.addEventListener(this._client, 'Runtime.executionContextsCleared', event => this._onExecutionContextsCleared()), _eventsHelper.eventsHelper.addEventListener(this._client, 'Target.attachedToTarget', event => this._onAttachedToTarget(event)), _eventsHelper.eventsHelper.addEventListener(this._client, 'Target.detachedFromTarget', event => this._onDetachedFromTarget(event))]);
  }
  _addBrowserListeners() {
    this._eventListeners.push(...[_eventsHelper.eventsHelper.addEventListener(this._client, 'Inspector.targetCrashed', event => this._onTargetCrashed()), _eventsHelper.eventsHelper.addEventListener(this._client, 'Page.screencastFrame', event => this._onScreencastFrame(event)), _eventsHelper.eventsHelper.addEventListener(this._client, 'Page.windowOpen', event => this._onWindowOpen(event))]);
  }
  async _initialize(hasUIWindow) {
    const isSettingStorageState = this._page._browserContext.isSettingStorageState();
    if (!isSettingStorageState && hasUIWindow && !this._crPage._browserContext._browser.isClank() && !this._crPage._browserContext._options.noDefaultViewport) {
      const {
        windowId
      } = await this._client.send('Browser.getWindowForTarget');
      this._windowId = windowId;
    }
    let screencastOptions;
    if (!isSettingStorageState && this._isMainFrame() && this._crPage._browserContext._options.recordVideo && hasUIWindow) {
      const screencastId = (0, _utils.createGuid)();
      const outputFile = _path.default.join(this._crPage._browserContext._options.recordVideo.dir, screencastId + '.webm');
      screencastOptions = {
        // validateBrowserContextOptions ensures correct video size.
        ...this._crPage._browserContext._options.recordVideo.size,
        outputFile
      };
      await this._crPage._browserContext._ensureVideosPath();
      // Note: it is important to start video recorder before sending Page.startScreencast,
      // and it is equally important to send Page.startScreencast before sending Runtime.runIfWaitingForDebugger.
      await this._createVideoRecorder(screencastId, screencastOptions);
      this._crPage.pageOrError().then(p => {
        if (p instanceof Error) this._stopVideoRecording().catch(() => {});
      });
    }
    let lifecycleEventsEnabled;
    if (!this._isMainFrame()) this._addRendererListeners();
    this._addBrowserListeners();
    const promises = [this._client.send('Page.enable'), this._client.send('Page.getFrameTree').then(({
      frameTree
    }) => {
      if (this._isMainFrame()) {
        this._handleFrameTree(frameTree);
        this._addRendererListeners();
      }
      const localFrames = this._isMainFrame() ? this._page.frames() : [this._page._frameManager.frame(this._targetId)];
      for (const frame of localFrames) {
        // Note: frames might be removed before we send these.
        this._client._sendMayFail('Page.createIsolatedWorld', {
          frameId: frame._id,
          grantUniveralAccess: true,
          worldName: UTILITY_WORLD_NAME
        });
        for (const binding of this._crPage._browserContext._pageBindings.values()) frame.evaluateExpression(binding.source).catch(e => {});
        for (const initScript of this._crPage._browserContext.initScripts) frame.evaluateExpression(initScript.source).catch(e => {});
      }
      const isInitialEmptyPage = this._isMainFrame() && this._page.mainFrame().url() === ':';
      if (isInitialEmptyPage) {
        // Ignore lifecycle events, worlds and bindings for the initial empty page. It is never the final page
        // hence we are going to get more lifecycle updates after the actual navigation has
        // started (even if the target url is about:blank).
        lifecycleEventsEnabled.catch(e => {}).then(() => {
          this._eventListeners.push(_eventsHelper.eventsHelper.addEventListener(this._client, 'Page.lifecycleEvent', event => this._onLifecycleEvent(event)));
        });
      } else {
        this._firstNonInitialNavigationCommittedFulfill();
        this._eventListeners.push(_eventsHelper.eventsHelper.addEventListener(this._client, 'Page.lifecycleEvent', event => this._onLifecycleEvent(event)));
      }
    }), this._client.send('Log.enable', {}), lifecycleEventsEnabled = this._client.send('Page.setLifecycleEventsEnabled', {
      enabled: true
    }), this._client.send('Runtime.enable', {}), this._client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: '',
      worldName: UTILITY_WORLD_NAME
    }), this._crPage._networkManager.addSession(this._client, undefined, this._isMainFrame()), this._client.send('Target.setAutoAttach', {
      autoAttach: true,
      waitForDebuggerOnStart: true,
      flatten: true
    })];
    if (!isSettingStorageState) {
      if (this._isMainFrame()) promises.push(this._client.send('Emulation.setFocusEmulationEnabled', {
        enabled: true
      }));
      const options = this._crPage._browserContext._options;
      if (options.bypassCSP) promises.push(this._client.send('Page.setBypassCSP', {
        enabled: true
      }));
      if (options.ignoreHTTPSErrors) promises.push(this._client.send('Security.setIgnoreCertificateErrors', {
        ignore: true
      }));
      if (this._isMainFrame()) promises.push(this._updateViewport());
      if (options.hasTouch) promises.push(this._client.send('Emulation.setTouchEmulationEnabled', {
        enabled: true
      }));
      if (options.javaScriptEnabled === false) promises.push(this._client.send('Emulation.setScriptExecutionDisabled', {
        value: true
      }));
      if (options.userAgent || options.locale) promises.push(this._updateUserAgent());
      if (options.locale) promises.push(emulateLocale(this._client, options.locale));
      if (options.timezoneId) promises.push(emulateTimezone(this._client, options.timezoneId));
      if (!this._crPage._browserContext._browser.options.headful) promises.push(this._setDefaultFontFamilies(this._client));
      promises.push(this._updateGeolocation(true));
      promises.push(this._updateEmulateMedia());
      promises.push(this._updateFileChooserInterception(true));
      for (const binding of this._crPage._page.allBindings()) promises.push(this._initBinding(binding));
      for (const initScript of this._crPage._browserContext.initScripts) promises.push(this._evaluateOnNewDocument(initScript, 'main'));
      for (const initScript of this._crPage._page.initScripts) promises.push(this._evaluateOnNewDocument(initScript, 'main'));
      if (screencastOptions) promises.push(this._startVideoRecording(screencastOptions));
    }
    promises.push(this._client.send('Runtime.runIfWaitingForDebugger'));
    promises.push(this._firstNonInitialNavigationCommittedPromise);
    await Promise.all(promises);
  }
  dispose() {
    this._firstNonInitialNavigationCommittedReject(new _errors.TargetClosedError());
    for (const childSession of this._childSessions) childSession.dispose();
    if (this._parentSession) this._parentSession._childSessions.delete(this);
    _eventsHelper.eventsHelper.removeEventListeners(this._eventListeners);
    this._crPage._networkManager.removeSession(this._client);
    this._crPage._sessions.delete(this._targetId);
    this._client.dispose();
  }
  async _navigate(frame, url, referrer) {
    const response = await this._client.send('Page.navigate', {
      url,
      referrer,
      frameId: frame._id,
      referrerPolicy: 'unsafeUrl'
    });
    if (response.errorText) throw new frames.NavigationAbortedError(response.loaderId, `${response.errorText} at ${url}`);
    return {
      newDocumentId: response.loaderId
    };
  }
  _onLifecycleEvent(event) {
    if (this._eventBelongsToStaleFrame(event.frameId)) return;
    if (event.name === 'load') this._page._frameManager.frameLifecycleEvent(event.frameId, 'load');else if (event.name === 'DOMContentLoaded') this._page._frameManager.frameLifecycleEvent(event.frameId, 'domcontentloaded');
  }
  _handleFrameTree(frameTree) {
    this._onFrameAttached(frameTree.frame.id, frameTree.frame.parentId || null);
    this._onFrameNavigated(frameTree.frame, true);
    if (!frameTree.childFrames) return;
    for (const child of frameTree.childFrames) this._handleFrameTree(child);
  }
  _eventBelongsToStaleFrame(frameId) {
    const frame = this._page._frameManager.frame(frameId);
    // Subtree may be already gone because some ancestor navigation destroyed the oopif.
    if (!frame) return true;
    // When frame goes remote, parent process may still send some events
    // related to the local frame before it sends frameDetached.
    // In this case, we already have a new session for this frame, so events
    // in the old session should be ignored.
    const session = this._crPage._sessionForFrame(frame);
    return session && session !== this && !session._swappedIn;
  }
  _onFrameAttached(frameId, parentFrameId) {
    const frameSession = this._crPage._sessions.get(frameId);
    if (frameSession && frameId !== this._targetId) {
      // This is a remote -> local frame transition.
      frameSession._swappedIn = true;
      const frame = this._page._frameManager.frame(frameId);
      // Frame or even a whole subtree may be already gone, because some ancestor did navigate.
      if (frame) this._page._frameManager.removeChildFramesRecursively(frame);
      return;
    }
    if (parentFrameId && !this._page._frameManager.frame(parentFrameId)) {
      // Parent frame may be gone already because some ancestor frame navigated and
      // destroyed the whole subtree of some oopif, while oopif's process is still sending us events.
      // Be careful to not confuse this with "main frame navigated cross-process" scenario
      // where parentFrameId is null.
      return;
    }
    this._page._frameManager.frameAttached(frameId, parentFrameId);
  }
  _onFrameNavigated(framePayload, initial) {
    if (this._eventBelongsToStaleFrame(framePayload.id)) return;
    this._page._frameManager.frameCommittedNewDocumentNavigation(framePayload.id, framePayload.url + (framePayload.urlFragment || ''), framePayload.name || '', framePayload.loaderId, initial);
    if (!initial) this._firstNonInitialNavigationCommittedFulfill();
  }
  _onFrameRequestedNavigation(payload) {
    if (this._eventBelongsToStaleFrame(payload.frameId)) return;
    if (payload.disposition === 'currentTab') this._page._frameManager.frameRequestedNavigation(payload.frameId);
  }
  _onFrameNavigatedWithinDocument(frameId, url) {
    if (this._eventBelongsToStaleFrame(frameId)) return;
    this._page._frameManager.frameCommittedSameDocumentNavigation(frameId, url);
  }
  _onFrameDetached(frameId, reason) {
    if (this._crPage._sessions.has(frameId)) {
      // This is a local -> remote frame transition, where
      // Page.frameDetached arrives after Target.attachedToTarget.
      // We've already handled the new target and frame reattach - nothing to do here.
      return;
    }
    if (reason === 'swap') {
      // This is a local -> remote frame transition, where
      // Page.frameDetached arrives before Target.attachedToTarget.
      // We should keep the frame in the tree, and it will be used for the new target.
      const frame = this._page._frameManager.frame(frameId);
      if (frame) this._page._frameManager.removeChildFramesRecursively(frame);
      return;
    }
    // Just a regular frame detach.
    this._page._frameManager.frameDetached(frameId);
  }
  _onExecutionContextCreated(contextPayload) {
    const frame = contextPayload.auxData ? this._page._frameManager.frame(contextPayload.auxData.frameId) : null;
    if (!frame || this._eventBelongsToStaleFrame(frame._id)) return;
    const delegate = new _crExecutionContext.CRExecutionContext(this._client, contextPayload);
    let worldName = null;
    if (contextPayload.auxData && !!contextPayload.auxData.isDefault) worldName = 'main';else if (contextPayload.name === UTILITY_WORLD_NAME) worldName = 'utility';
    const context = new dom.FrameExecutionContext(delegate, frame, worldName);
    context[contextDelegateSymbol] = delegate;
    if (worldName) frame._contextCreated(worldName, context);
    this._contextIdToContext.set(contextPayload.id, context);
  }
  _onExecutionContextDestroyed(executionContextId) {
    const context = this._contextIdToContext.get(executionContextId);
    if (!context) return;
    this._contextIdToContext.delete(executionContextId);
    context.frame._contextDestroyed(context);
  }
  _onExecutionContextsCleared() {
    for (const contextId of Array.from(this._contextIdToContext.keys())) this._onExecutionContextDestroyed(contextId);
  }
  _onAttachedToTarget(event) {
    var _this$_page$_frameMan;
    const session = this._client.createChildSession(event.sessionId);
    if (event.targetInfo.type === 'iframe') {
      // Frame id equals target id.
      const targetId = event.targetInfo.targetId;
      const frame = this._page._frameManager.frame(targetId);
      if (!frame) return; // Subtree may be already gone due to renderer/browser race.
      this._page._frameManager.removeChildFramesRecursively(frame);
      const frameSession = new FrameSession(this._crPage, session, targetId, this);
      this._crPage._sessions.set(targetId, frameSession);
      frameSession._initialize(false).catch(e => e);
      return;
    }
    if (event.targetInfo.type !== 'worker') {
      session.detach().catch(() => {});
      return;
    }
    const url = event.targetInfo.url;
    const worker = new _page.Worker(this._page, url);
    this._page._addWorker(event.sessionId, worker);
    this._workerSessions.set(event.sessionId, session);
    session.once('Runtime.executionContextCreated', async event => {
      worker._createExecutionContext(new _crExecutionContext.CRExecutionContext(session, event.context));
    });
    // This might fail if the target is closed before we initialize.
    session._sendMayFail('Runtime.enable');
    // TODO: attribute workers to the right frame.
    this._crPage._networkManager.addSession(session, (_this$_page$_frameMan = this._page._frameManager.frame(this._targetId)) !== null && _this$_page$_frameMan !== void 0 ? _this$_page$_frameMan : undefined).catch(() => {});
    session._sendMayFail('Runtime.runIfWaitingForDebugger');
    session._sendMayFail('Target.setAutoAttach', {
      autoAttach: true,
      waitForDebuggerOnStart: true,
      flatten: true
    });
    session.on('Target.attachedToTarget', event => this._onAttachedToTarget(event));
    session.on('Target.detachedFromTarget', event => this._onDetachedFromTarget(event));
    session.on('Runtime.consoleAPICalled', event => {
      const args = event.args.map(o => worker._existingExecutionContext.createHandle(o));
      this._page._addConsoleMessage(event.type, args, (0, _crProtocolHelper.toConsoleMessageLocation)(event.stackTrace));
    });
    session.on('Runtime.exceptionThrown', exception => this._page.emitOnContextOnceInitialized(_browserContext.BrowserContext.Events.PageError, (0, _crProtocolHelper.exceptionToError)(exception.exceptionDetails), this._page));
  }
  _onDetachedFromTarget(event) {
    // This might be a worker...
    const workerSession = this._workerSessions.get(event.sessionId);
    if (workerSession) {
      workerSession.dispose();
      this._page._removeWorker(event.sessionId);
      return;
    }

    // ... or an oopif.
    const childFrameSession = this._crPage._sessions.get(event.targetId);
    if (!childFrameSession) return;

    // Usually, we get frameAttached in this session first and mark child as swappedIn.
    if (childFrameSession._swappedIn) {
      childFrameSession.dispose();
      return;
    }

    // However, sometimes we get detachedFromTarget before frameAttached.
    // In this case we don't know whether this is a remote frame detach,
    // or just a remote -> local transition. In the latter case, frameAttached
    // is already inflight, so let's make a safe roundtrip to ensure it arrives.
    this._client.send('Page.enable').catch(e => null).then(() => {
      // Child was not swapped in - that means frameAttached did not happen and
      // this is remote detach rather than remote -> local swap.
      if (!childFrameSession._swappedIn) this._page._frameManager.frameDetached(event.targetId);
      childFrameSession.dispose();
    });
  }
  _onWindowOpen(event) {
    this._crPage._nextWindowOpenPopupFeatures.push(event.windowFeatures);
  }
  async _onConsoleAPI(event) {
    if (event.executionContextId === 0) {
      // DevTools protocol stores the last 1000 console messages. These
      // messages are always reported even for removed execution contexts. In
      // this case, they are marked with executionContextId = 0 and are
      // reported upon enabling Runtime agent.
      //
      // Ignore these messages since:
      // - there's no execution context we can use to operate with message
      //   arguments
      // - these messages are reported before Playwright clients can subscribe
      //   to the 'console'
      //   page event.
      //
      // @see https://github.com/GoogleChrome/puppeteer/issues/3865
      return;
    }
    const context = this._contextIdToContext.get(event.executionContextId);
    if (!context) return;
    const values = event.args.map(arg => context.createHandle(arg));
    this._page._addConsoleMessage(event.type, values, (0, _crProtocolHelper.toConsoleMessageLocation)(event.stackTrace));
  }
  async _initBinding(binding) {
    const [, response] = await Promise.all([this._client.send('Runtime.addBinding', {
      name: binding.name
    }), this._client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: binding.source
    })]);
    this._exposedBindingNames.push(binding.name);
    if (!binding.name.startsWith('__pw')) this._evaluateOnNewDocumentIdentifiers.push(response.identifier);
  }
  async _removeExposedBindings() {
    const toRetain = [];
    const toRemove = [];
    for (const name of this._exposedBindingNames) (name.startsWith('__pw_') ? toRetain : toRemove).push(name);
    this._exposedBindingNames = toRetain;
    await Promise.all(toRemove.map(name => this._client.send('Runtime.removeBinding', {
      name
    })));
  }
  async _onBindingCalled(event) {
    const pageOrError = await this._crPage.pageOrError();
    if (!(pageOrError instanceof Error)) {
      const context = this._contextIdToContext.get(event.executionContextId);
      if (context) await this._page._onBindingCalled(event.payload, context);
    }
  }
  _onDialog(event) {
    if (!this._page._frameManager.frame(this._targetId)) return; // Our frame/subtree may be gone already.
    this._page.emitOnContext(_browserContext.BrowserContext.Events.Dialog, new dialog.Dialog(this._page, event.type, event.message, async (accept, promptText) => {
      await this._client.send('Page.handleJavaScriptDialog', {
        accept,
        promptText
      });
    }, event.defaultPrompt));
  }
  _handleException(exceptionDetails) {
    this._page.emitOnContextOnceInitialized(_browserContext.BrowserContext.Events.PageError, (0, _crProtocolHelper.exceptionToError)(exceptionDetails), this._page);
  }
  async _onTargetCrashed() {
    this._client._markAsCrashed();
    this._page._didCrash();
  }
  _onLogEntryAdded(event) {
    const {
      level,
      text,
      args,
      source,
      url,
      lineNumber
    } = event.entry;
    if (args) args.map(arg => (0, _crProtocolHelper.releaseObject)(this._client, arg.objectId));
    if (source !== 'worker') {
      const location = {
        url: url || '',
        lineNumber: lineNumber || 0,
        columnNumber: 0
      };
      this._page._addConsoleMessage(level, [], location, text);
    }
  }
  async _onFileChooserOpened(event) {
    if (!event.backendNodeId) return;
    const frame = this._page._frameManager.frame(event.frameId);
    if (!frame) return;
    let handle;
    try {
      const utilityContext = await frame._utilityContext();
      handle = await this._adoptBackendNodeId(event.backendNodeId, utilityContext);
    } catch (e) {
      // During async processing, frame/context may go away. We should not throw.
      return;
    }
    await this._page._onFileChooserOpened(handle);
  }
  _willBeginDownload() {
    const originPage = this._crPage._initializedPage;
    if (!originPage) {
      // Resume the page creation with an error. The page will automatically close right
      // after the download begins.
      this._firstNonInitialNavigationCommittedReject(new Error('Starting new page download'));
    }
  }
  _onScreencastFrame(payload) {
    this._page.throttleScreencastFrameAck(() => {
      this._client.send('Page.screencastFrameAck', {
        sessionId: payload.sessionId
      }).catch(() => {});
    });
    const buffer = Buffer.from(payload.data, 'base64');
    this._page.emit(_page.Page.Events.ScreencastFrame, {
      buffer,
      timestamp: payload.metadata.timestamp,
      width: payload.metadata.deviceWidth,
      height: payload.metadata.deviceHeight
    });
  }
  async _createVideoRecorder(screencastId, options) {
    (0, _utils.assert)(!this._screencastId);
    const ffmpegPath = _registry.registry.findExecutable('ffmpeg').executablePathOrDie(this._page.attribution.playwright.options.sdkLanguage);
    this._videoRecorder = await _videoRecorder.VideoRecorder.launch(this._crPage._page, ffmpegPath, options);
    this._screencastId = screencastId;
  }
  async _startVideoRecording(options) {
    const screencastId = this._screencastId;
    (0, _utils.assert)(screencastId);
    this._page.once(_page.Page.Events.Close, () => this._stopVideoRecording().catch(() => {}));
    const gotFirstFrame = new Promise(f => this._client.once('Page.screencastFrame', f));
    await this._startScreencast(this._videoRecorder, {
      format: 'jpeg',
      quality: 90,
      maxWidth: options.width,
      maxHeight: options.height
    });
    // Wait for the first frame before reporting video to the client.
    gotFirstFrame.then(() => {
      this._crPage._browserContext._browser._videoStarted(this._crPage._browserContext, screencastId, options.outputFile, this._crPage.pageOrError());
    });
  }
  async _stopVideoRecording() {
    if (!this._screencastId) return;
    const screencastId = this._screencastId;
    this._screencastId = null;
    const recorder = this._videoRecorder;
    this._videoRecorder = null;
    await this._stopScreencast(recorder);
    await recorder.stop().catch(() => {});
    // Keep the video artifact in the map until encoding is fully finished, if the context
    // starts closing before the video is fully written to disk it will wait for it.
    const video = this._crPage._browserContext._browser._takeVideo(screencastId);
    video === null || video === void 0 || video.reportFinished();
  }
  async _startScreencast(client, options = {}) {
    this._screencastClients.add(client);
    if (this._screencastClients.size === 1) await this._client.send('Page.startScreencast', options);
  }
  async _stopScreencast(client) {
    this._screencastClients.delete(client);
    if (!this._screencastClients.size) await this._client._sendMayFail('Page.stopScreencast');
  }
  async _updateGeolocation(initial) {
    const geolocation = this._crPage._browserContext._options.geolocation;
    if (!initial || geolocation) await this._client.send('Emulation.setGeolocationOverride', geolocation || {});
  }
  async _updateViewport(preserveWindowBoundaries) {
    if (this._crPage._browserContext._browser.isClank()) return;
    (0, _utils.assert)(this._isMainFrame());
    const options = this._crPage._browserContext._options;
    const emulatedSize = this._page.emulatedSize();
    if (emulatedSize === null) return;
    const viewportSize = emulatedSize.viewport;
    const screenSize = emulatedSize.screen;
    const isLandscape = screenSize.width > screenSize.height;
    const metricsOverride = {
      mobile: !!options.isMobile,
      width: viewportSize.width,
      height: viewportSize.height,
      screenWidth: screenSize.width,
      screenHeight: screenSize.height,
      deviceScaleFactor: options.deviceScaleFactor || 1,
      screenOrientation: !!options.isMobile ? isLandscape ? {
        angle: 90,
        type: 'landscapePrimary'
      } : {
        angle: 0,
        type: 'portraitPrimary'
      } : {
        angle: 0,
        type: 'landscapePrimary'
      },
      dontSetVisibleSize: preserveWindowBoundaries
    };
    if (JSON.stringify(this._metricsOverride) === JSON.stringify(metricsOverride)) return;
    const promises = [this._client.send('Emulation.setDeviceMetricsOverride', metricsOverride)];
    if (!preserveWindowBoundaries && this._windowId) {
      let insets = {
        width: 0,
        height: 0
      };
      if (this._crPage._browserContext._browser.options.headful) {
        // TODO: popup windows have their own insets.
        insets = {
          width: 24,
          height: 88
        };
        if (process.platform === 'win32') insets = {
          width: 16,
          height: 88
        };else if (process.platform === 'linux') insets = {
          width: 8,
          height: 85
        };else if (process.platform === 'darwin') insets = {
          width: 2,
          height: 80
        };
        if (this._crPage._browserContext.isPersistentContext()) {
          // FIXME: Chrome bug: OOPIF router is confused when hit target is
          // outside browser window.
          // Account for the infobar here to work around the bug.
          insets.height += 46;
        }
      }
      promises.push(this.setWindowBounds({
        width: viewportSize.width + insets.width,
        height: viewportSize.height + insets.height
      }));
    }
    await Promise.all(promises);
    this._metricsOverride = metricsOverride;
  }
  async windowBounds() {
    const {
      bounds
    } = await this._client.send('Browser.getWindowBounds', {
      windowId: this._windowId
    });
    return bounds;
  }
  async setWindowBounds(bounds) {
    return await this._client.send('Browser.setWindowBounds', {
      windowId: this._windowId,
      bounds
    });
  }
  async _updateEmulateMedia() {
    const emulatedMedia = this._page.emulatedMedia();
    // Empty string disables the override.
    const media = emulatedMedia.media === 'no-override' ? '' : emulatedMedia.media;
    const colorScheme = emulatedMedia.colorScheme === 'no-override' ? '' : emulatedMedia.colorScheme;
    const reducedMotion = emulatedMedia.reducedMotion === 'no-override' ? '' : emulatedMedia.reducedMotion;
    const forcedColors = emulatedMedia.forcedColors === 'no-override' ? '' : emulatedMedia.forcedColors;
    const features = [{
      name: 'prefers-color-scheme',
      value: colorScheme
    }, {
      name: 'prefers-reduced-motion',
      value: reducedMotion
    }, {
      name: 'forced-colors',
      value: forcedColors
    }];
    await this._client.send('Emulation.setEmulatedMedia', {
      media,
      features
    });
  }
  async _updateUserAgent() {
    const options = this._crPage._browserContext._options;
    await this._client.send('Emulation.setUserAgentOverride', {
      userAgent: options.userAgent || '',
      acceptLanguage: options.locale,
      userAgentMetadata: calculateUserAgentMetadata(options)
    });
  }
  async _setDefaultFontFamilies(session) {
    const fontFamilies = _defaultFontFamilies.platformToFontFamilies[this._crPage._browserContext._browser._platform()];
    await session.send('Page.setFontFamilies', fontFamilies);
  }
  async _updateFileChooserInterception(initial) {
    const enabled = this._page.fileChooserIntercepted();
    if (initial && !enabled) return;
    await this._client.send('Page.setInterceptFileChooserDialog', {
      enabled
    }).catch(() => {}); // target can be closed.
  }
  async _evaluateOnNewDocument(initScript, world) {
    const worldName = world === 'utility' ? UTILITY_WORLD_NAME : undefined;
    const {
      identifier
    } = await this._client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: initScript.source,
      worldName
    });
    this._evaluateOnNewDocumentIdentifiers.push(identifier);
  }
  async _removeEvaluatesOnNewDocument() {
    const identifiers = this._evaluateOnNewDocumentIdentifiers;
    this._evaluateOnNewDocumentIdentifiers = [];
    await Promise.all(identifiers.map(identifier => this._client.send('Page.removeScriptToEvaluateOnNewDocument', {
      identifier
    })));
  }
  async _getContentFrame(handle) {
    const nodeInfo = await this._client.send('DOM.describeNode', {
      objectId: handle._objectId
    });
    if (!nodeInfo || typeof nodeInfo.node.frameId !== 'string') return null;
    return this._page._frameManager.frame(nodeInfo.node.frameId);
  }
  async _getOwnerFrame(handle) {
    // document.documentElement has frameId of the owner frame.
    const documentElement = await handle.evaluateHandle(node => {
      const doc = node;
      if (doc.documentElement && doc.documentElement.ownerDocument === doc) return doc.documentElement;
      return node.ownerDocument ? node.ownerDocument.documentElement : null;
    });
    if (!documentElement) return null;
    if (!documentElement._objectId) return null;
    const nodeInfo = await this._client.send('DOM.describeNode', {
      objectId: documentElement._objectId
    });
    const frameId = nodeInfo && typeof nodeInfo.node.frameId === 'string' ? nodeInfo.node.frameId : null;
    documentElement.dispose();
    return frameId;
  }
  async _getBoundingBox(handle) {
    const result = await this._client._sendMayFail('DOM.getBoxModel', {
      objectId: handle._objectId
    });
    if (!result) return null;
    const quad = result.model.border;
    const x = Math.min(quad[0], quad[2], quad[4], quad[6]);
    const y = Math.min(quad[1], quad[3], quad[5], quad[7]);
    const width = Math.max(quad[0], quad[2], quad[4], quad[6]) - x;
    const height = Math.max(quad[1], quad[3], quad[5], quad[7]) - y;
    const position = await this._framePosition();
    if (!position) return null;
    return {
      x: x + position.x,
      y: y + position.y,
      width,
      height
    };
  }
  async _framePosition() {
    const frame = this._page._frameManager.frame(this._targetId);
    if (!frame) return null;
    if (frame === this._page.mainFrame()) return {
      x: 0,
      y: 0
    };
    const element = await frame.frameElement();
    const box = await element.boundingBox();
    return box;
  }
  async _scrollRectIntoViewIfNeeded(handle, rect) {
    return await this._client.send('DOM.scrollIntoViewIfNeeded', {
      objectId: handle._objectId,
      rect
    }).then(() => 'done').catch(e => {
      if (e instanceof Error && e.message.includes('Node does not have a layout object')) return 'error:notvisible';
      if (e instanceof Error && e.message.includes('Node is detached from document')) return 'error:notconnected';
      throw e;
    });
  }
  async _getContentQuads(handle) {
    const result = await this._client._sendMayFail('DOM.getContentQuads', {
      objectId: handle._objectId
    });
    if (!result) return null;
    const position = await this._framePosition();
    if (!position) return null;
    return result.quads.map(quad => [{
      x: quad[0] + position.x,
      y: quad[1] + position.y
    }, {
      x: quad[2] + position.x,
      y: quad[3] + position.y
    }, {
      x: quad[4] + position.x,
      y: quad[5] + position.y
    }, {
      x: quad[6] + position.x,
      y: quad[7] + position.y
    }]);
  }
  async _adoptElementHandle(handle, to) {
    const nodeInfo = await this._client.send('DOM.describeNode', {
      objectId: handle._objectId
    });
    return this._adoptBackendNodeId(nodeInfo.node.backendNodeId, to);
  }
  async _adoptBackendNodeId(backendNodeId, to) {
    const result = await this._client._sendMayFail('DOM.resolveNode', {
      backendNodeId,
      executionContextId: to[contextDelegateSymbol]._contextId
    });
    if (!result || result.object.subtype === 'null') throw new Error(dom.kUnableToAdoptErrorMessage);
    return to.createHandle(result.object).asElement();
  }
}
async function emulateLocale(session, locale) {
  try {
    await session.send('Emulation.setLocaleOverride', {
      locale
    });
  } catch (exception) {
    // All pages in the same renderer share locale. All such pages belong to the same
    // context and if locale is overridden for one of them its value is the same as
    // we are trying to set so it's not a problem.
    if (exception.message.includes('Another locale override is already in effect')) return;
    throw exception;
  }
}
async function emulateTimezone(session, timezoneId) {
  try {
    await session.send('Emulation.setTimezoneOverride', {
      timezoneId: timezoneId
    });
  } catch (exception) {
    if (exception.message.includes('Timezone override is already in effect')) return;
    if (exception.message.includes('Invalid timezone')) throw new Error(`Invalid timezone ID: ${timezoneId}`);
    throw exception;
  }
}
const contextDelegateSymbol = Symbol('delegate');

// Chromium reference: https://source.chromium.org/chromium/chromium/src/+/main:components/embedder_support/user_agent_utils.cc;l=434;drc=70a6711e08e9f9e0d8e4c48e9ba5cab62eb010c2
function calculateUserAgentMetadata(options) {
  const ua = options.userAgent;
  if (!ua) return undefined;
  const metadata = {
    mobile: !!options.isMobile,
    model: '',
    architecture: 'x64',
    platform: 'Windows',
    platformVersion: ''
  };
  const androidMatch = ua.match(/Android (\d+(\.\d+)?(\.\d+)?)/);
  const iPhoneMatch = ua.match(/iPhone OS (\d+(_\d+)?)/);
  const iPadMatch = ua.match(/iPad; CPU OS (\d+(_\d+)?)/);
  const macOSMatch = ua.match(/Mac OS X (\d+(_\d+)?(_\d+)?)/);
  const windowsMatch = ua.match(/Windows\D+(\d+(\.\d+)?(\.\d+)?)/);
  if (androidMatch) {
    metadata.platform = 'Android';
    metadata.platformVersion = androidMatch[1];
    metadata.architecture = 'arm';
  } else if (iPhoneMatch) {
    metadata.platform = 'iOS';
    metadata.platformVersion = iPhoneMatch[1];
    metadata.architecture = 'arm';
  } else if (iPadMatch) {
    metadata.platform = 'iOS';
    metadata.platformVersion = iPadMatch[1];
    metadata.architecture = 'arm';
  } else if (macOSMatch) {
    metadata.platform = 'macOS';
    metadata.platformVersion = macOSMatch[1];
    if (!ua.includes('Intel')) metadata.architecture = 'arm';
  } else if (windowsMatch) {
    metadata.platform = 'Windows';
    metadata.platformVersion = windowsMatch[1];
  } else if (ua.toLowerCase().includes('linux')) {
    metadata.platform = 'Linux';
  }
  if (ua.includes('ARM')) metadata.architecture = 'arm';
  return metadata;
}