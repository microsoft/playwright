"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WKPage = void 0;
var _path = _interopRequireDefault(require("path"));
var _os = _interopRequireDefault(require("os"));
var _utilsBundle = require("../../utilsBundle");
var _stackTrace = require("../../utils/stackTrace");
var _utils = require("../../utils");
var _hostPlatform = require("../../utils/hostPlatform");
var dialog = _interopRequireWildcard(require("../dialog"));
var dom = _interopRequireWildcard(require("../dom"));
var _eventsHelper = require("../../utils/eventsHelper");
var _helper = require("../helper");
var network = _interopRequireWildcard(require("../network"));
var _page = require("../page");
var _wkAccessibility = require("./wkAccessibility");
var _wkConnection = require("./wkConnection");
var _wkExecutionContext = require("./wkExecutionContext");
var _wkInput = require("./wkInput");
var _wkInterceptableRequest = require("./wkInterceptableRequest");
var _wkProvisionalPage = require("./wkProvisionalPage");
var _wkWorkers = require("./wkWorkers");
var _debugLogger = require("../../utils/debugLogger");
var _manualPromise = require("../../utils/manualPromise");
var _browserContext = require("../browserContext");
var _errors = require("../errors");
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
class WKPage {
  constructor(browserContext, pageProxySession, opener) {
    this.rawMouse = void 0;
    this.rawKeyboard = void 0;
    this.rawTouchscreen = void 0;
    this._session = void 0;
    this._provisionalPage = null;
    this._page = void 0;
    this._pagePromise = new _manualPromise.ManualPromise();
    this._pageProxySession = void 0;
    this._opener = void 0;
    this._requestIdToRequest = new Map();
    this._requestIdToRequestWillBeSentEvent = new Map();
    this._workers = void 0;
    this._contextIdToContext = void 0;
    this._sessionListeners = [];
    this._eventListeners = void 0;
    this._browserContext = void 0;
    this._initializedPage = null;
    this._firstNonInitialNavigationCommittedPromise = void 0;
    this._firstNonInitialNavigationCommittedFulfill = () => {};
    this._firstNonInitialNavigationCommittedReject = e => {};
    this._lastConsoleMessage = null;
    this._requestIdToResponseReceivedPayloadEvent = new Map();
    // Holds window features for the next popup being opened via window.open,
    // until the popup page proxy arrives.
    this._nextWindowOpenPopupFeatures = void 0;
    this._recordingVideoFile = null;
    this._screencastGeneration = 0;
    this._pageProxySession = pageProxySession;
    this._opener = opener;
    this.rawKeyboard = new _wkInput.RawKeyboardImpl(pageProxySession);
    this.rawMouse = new _wkInput.RawMouseImpl(pageProxySession);
    this.rawTouchscreen = new _wkInput.RawTouchscreenImpl(pageProxySession);
    this._contextIdToContext = new Map();
    this._page = new _page.Page(this, browserContext);
    this.rawMouse.setPage(this._page);
    this._workers = new _wkWorkers.WKWorkers(this._page);
    this._session = undefined;
    this._browserContext = browserContext;
    this._page.on(_page.Page.Events.FrameDetached, frame => this._removeContextsForFrame(frame, false));
    this._eventListeners = [_eventsHelper.eventsHelper.addEventListener(this._pageProxySession, 'Target.targetCreated', this._onTargetCreated.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._pageProxySession, 'Target.targetDestroyed', this._onTargetDestroyed.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._pageProxySession, 'Target.dispatchMessageFromTarget', this._onDispatchMessageFromTarget.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._pageProxySession, 'Target.didCommitProvisionalTarget', this._onDidCommitProvisionalTarget.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._pageProxySession, 'Screencast.screencastFrame', this._onScreencastFrame.bind(this))];
    this._firstNonInitialNavigationCommittedPromise = new Promise((f, r) => {
      this._firstNonInitialNavigationCommittedFulfill = f;
      this._firstNonInitialNavigationCommittedReject = r;
    });
    if (opener && !browserContext._options.noDefaultViewport && opener._nextWindowOpenPopupFeatures) {
      const viewportSize = _helper.helper.getViewportSizeFromWindowFeatures(opener._nextWindowOpenPopupFeatures);
      opener._nextWindowOpenPopupFeatures = undefined;
      if (viewportSize) this._page._emulatedSize = {
        viewport: viewportSize,
        screen: viewportSize
      };
    }
  }
  potentiallyUninitializedPage() {
    return this._page;
  }
  async _initializePageProxySession() {
    if (this._page._browserContext.isSettingStorageState()) return;
    const promises = [this._pageProxySession.send('Dialog.enable'), this._pageProxySession.send('Emulation.setActiveAndFocused', {
      active: true
    })];
    const contextOptions = this._browserContext._options;
    if (contextOptions.javaScriptEnabled === false) promises.push(this._pageProxySession.send('Emulation.setJavaScriptEnabled', {
      enabled: false
    }));
    promises.push(this._updateViewport());
    promises.push(this.updateHttpCredentials());
    if (this._browserContext._permissions.size) {
      for (const [key, value] of this._browserContext._permissions) promises.push(this._grantPermissions(key, value));
    }
    if (this._browserContext._options.recordVideo) {
      const outputFile = _path.default.join(this._browserContext._options.recordVideo.dir, (0, _utils.createGuid)() + '.webm');
      promises.push(this._browserContext._ensureVideosPath().then(() => {
        return this._startVideo({
          // validateBrowserContextOptions ensures correct video size.
          ...this._browserContext._options.recordVideo.size,
          outputFile
        });
      }));
    }
    await Promise.all(promises);
  }
  _setSession(session) {
    _eventsHelper.eventsHelper.removeEventListeners(this._sessionListeners);
    this._session = session;
    this.rawKeyboard.setSession(session);
    this.rawMouse.setSession(session);
    this._addSessionListeners();
    this._workers.setSession(session);
  }

  // This method is called for provisional targets as well. The session passed as the parameter
  // may be different from the current session and may be destroyed without becoming current.
  async _initializeSession(session, provisional, resourceTreeHandler) {
    await this._initializeSessionMayThrow(session, resourceTreeHandler).catch(e => {
      // Provisional session can be disposed at any time, for example due to new navigation initiating
      // a new provisional page.
      if (provisional && session.isDisposed()) return;
      // Swallow initialization errors due to newer target swap in,
      // since we will reinitialize again.
      if (this._session === session) throw e;
    });
  }
  async _initializeSessionMayThrow(session, resourceTreeHandler) {
    const [, frameTree] = await Promise.all([
    // Page agent must be enabled before Runtime.
    session.send('Page.enable'), session.send('Page.getResourceTree')]);
    resourceTreeHandler(frameTree);
    const promises = [
    // Resource tree should be received before first execution context.
    session.send('Runtime.enable'), session.send('Page.createUserWorld', {
      name: UTILITY_WORLD_NAME
    }).catch(_ => {}),
    // Worlds are per-process
    session.send('Console.enable'), session.send('Network.enable'), this._workers.initializeSession(session)];
    if (this._page.needsRequestInterception()) {
      promises.push(session.send('Network.setInterceptionEnabled', {
        enabled: true
      }));
      promises.push(session.send('Network.setResourceCachingDisabled', {
        disabled: true
      }));
      promises.push(session.send('Network.addInterception', {
        url: '.*',
        stage: 'request',
        isRegex: true
      }));
    }
    if (this._page._browserContext.isSettingStorageState()) {
      await Promise.all(promises);
      return;
    }
    const contextOptions = this._browserContext._options;
    if (contextOptions.userAgent) promises.push(this.updateUserAgent());
    const emulatedMedia = this._page.emulatedMedia();
    if (emulatedMedia.media || emulatedMedia.colorScheme || emulatedMedia.reducedMotion || emulatedMedia.forcedColors) promises.push(WKPage._setEmulateMedia(session, emulatedMedia.media, emulatedMedia.colorScheme, emulatedMedia.reducedMotion, emulatedMedia.forcedColors));
    for (const binding of this._page.allBindings()) promises.push(session.send('Runtime.addBinding', {
      name: binding.name
    }));
    const bootstrapScript = this._calculateBootstrapScript();
    if (bootstrapScript.length) promises.push(session.send('Page.setBootstrapScript', {
      source: bootstrapScript
    }));
    this._page.frames().map(frame => frame.evaluateExpression(bootstrapScript).catch(e => {}));
    if (contextOptions.bypassCSP) promises.push(session.send('Page.setBypassCSP', {
      enabled: true
    }));
    const emulatedSize = this._page.emulatedSize();
    if (emulatedSize) {
      promises.push(session.send('Page.setScreenSizeOverride', {
        width: emulatedSize.screen.width,
        height: emulatedSize.screen.height
      }));
    }
    promises.push(this.updateEmulateMedia());
    promises.push(session.send('Network.setExtraHTTPHeaders', {
      headers: (0, _utils.headersArrayToObject)(this._calculateExtraHTTPHeaders(), false /* lowerCase */)
    }));
    if (contextOptions.offline) promises.push(session.send('Network.setEmulateOfflineState', {
      offline: true
    }));
    promises.push(session.send('Page.setTouchEmulationEnabled', {
      enabled: !!contextOptions.hasTouch
    }));
    if (contextOptions.timezoneId) {
      promises.push(session.send('Page.setTimeZone', {
        timeZone: contextOptions.timezoneId
      }).catch(e => {
        throw new Error(`Invalid timezone ID: ${contextOptions.timezoneId}`);
      }));
    }
    if (this._page.fileChooserIntercepted()) promises.push(session.send('Page.setInterceptFileChooserDialog', {
      enabled: true
    }));
    promises.push(session.send('Page.overrideSetting', {
      setting: 'DeviceOrientationEventEnabled',
      value: contextOptions.isMobile
    }));
    promises.push(session.send('Page.overrideSetting', {
      setting: 'FullScreenEnabled',
      value: !contextOptions.isMobile
    }));
    promises.push(session.send('Page.overrideSetting', {
      setting: 'NotificationsEnabled',
      value: !contextOptions.isMobile
    }));
    promises.push(session.send('Page.overrideSetting', {
      setting: 'PointerLockEnabled',
      value: !contextOptions.isMobile
    }));
    promises.push(session.send('Page.overrideSetting', {
      setting: 'InputTypeMonthEnabled',
      value: contextOptions.isMobile
    }));
    promises.push(session.send('Page.overrideSetting', {
      setting: 'InputTypeWeekEnabled',
      value: contextOptions.isMobile
    }));
    await Promise.all(promises);
  }
  _onDidCommitProvisionalTarget(event) {
    const {
      oldTargetId,
      newTargetId
    } = event;
    (0, _utils.assert)(this._provisionalPage);
    (0, _utils.assert)(this._provisionalPage._session.sessionId === newTargetId, 'Unknown new target: ' + newTargetId);
    (0, _utils.assert)(this._session.sessionId === oldTargetId, 'Unknown old target: ' + oldTargetId);
    const newSession = this._provisionalPage._session;
    this._provisionalPage.commit();
    this._provisionalPage.dispose();
    this._provisionalPage = null;
    this._setSession(newSession);
  }
  _onTargetDestroyed(event) {
    const {
      targetId,
      crashed
    } = event;
    if (this._provisionalPage && this._provisionalPage._session.sessionId === targetId) {
      this._provisionalPage._session.dispose();
      this._provisionalPage.dispose();
      this._provisionalPage = null;
    } else if (this._session.sessionId === targetId) {
      this._session.dispose();
      _eventsHelper.eventsHelper.removeEventListeners(this._sessionListeners);
      if (crashed) {
        this._session.markAsCrashed();
        this._page._didCrash();
      }
    }
  }
  didClose() {
    this._pageProxySession.dispose();
    _eventsHelper.eventsHelper.removeEventListeners(this._sessionListeners);
    _eventsHelper.eventsHelper.removeEventListeners(this._eventListeners);
    if (this._session) this._session.dispose();
    if (this._provisionalPage) {
      this._provisionalPage._session.dispose();
      this._provisionalPage.dispose();
      this._provisionalPage = null;
    }
    this._firstNonInitialNavigationCommittedReject(new _errors.TargetClosedError());
    this._page._didClose();
  }
  dispatchMessageToSession(message) {
    this._pageProxySession.dispatchMessage(message);
  }
  handleProvisionalLoadFailed(event) {
    if (!this._initializedPage) {
      this._firstNonInitialNavigationCommittedReject(new Error('Initial load failed'));
      return;
    }
    if (!this._provisionalPage) return;
    let errorText = event.error;
    if (errorText.includes('cancelled')) errorText += '; maybe frame was detached?';
    this._page._frameManager.frameAbortedNavigation(this._page.mainFrame()._id, errorText, event.loaderId);
  }
  handleWindowOpen(event) {
    (0, _utils.debugAssert)(!this._nextWindowOpenPopupFeatures);
    this._nextWindowOpenPopupFeatures = event.windowFeatures;
  }
  async pageOrError() {
    return this._pagePromise;
  }
  async _onTargetCreated(event) {
    const {
      targetInfo
    } = event;
    const session = new _wkConnection.WKSession(this._pageProxySession.connection, targetInfo.targetId, message => {
      this._pageProxySession.send('Target.sendMessageToTarget', {
        message: JSON.stringify(message),
        targetId: targetInfo.targetId
      }).catch(e => {
        session.dispatchMessage({
          id: message.id,
          error: {
            message: e.message
          }
        });
      });
    });
    (0, _utils.assert)(targetInfo.type === 'page', 'Only page targets are expected in WebKit, received: ' + targetInfo.type);
    if (!targetInfo.isProvisional) {
      (0, _utils.assert)(!this._initializedPage);
      let pageOrError;
      try {
        this._setSession(session);
        await Promise.all([this._initializePageProxySession(), this._initializeSession(session, false, ({
          frameTree
        }) => this._handleFrameTree(frameTree))]);
        pageOrError = this._page;
      } catch (e) {
        pageOrError = e;
      }
      if (targetInfo.isPaused) this._pageProxySession.sendMayFail('Target.resume', {
        targetId: targetInfo.targetId
      });
      if (pageOrError instanceof _page.Page && this._page.mainFrame().url() === '') {
        try {
          // Initial empty page has an empty url. We should wait until the first real url has been loaded,
          // even if that url is about:blank. This is especially important for popups, where we need the
          // actual url before interacting with it.
          await this._firstNonInitialNavigationCommittedPromise;
        } catch (e) {
          pageOrError = e;
        }
      } else {
        // Avoid rejection on disconnect.
        this._firstNonInitialNavigationCommittedPromise.catch(() => {});
      }
      await this._page.initOpener(this._opener);
      // Note: it is important to call |reportAsNew| before resolving pageOrError promise,
      // so that anyone who awaits pageOrError got a ready and reported page.
      this._initializedPage = pageOrError instanceof _page.Page ? pageOrError : null;
      this._page.reportAsNew(pageOrError instanceof _page.Page ? undefined : pageOrError);
      this._pagePromise.resolve(pageOrError);
    } else {
      (0, _utils.assert)(targetInfo.isProvisional);
      (0, _utils.assert)(!this._provisionalPage);
      this._provisionalPage = new _wkProvisionalPage.WKProvisionalPage(session, this);
      if (targetInfo.isPaused) {
        this._provisionalPage.initializationPromise.then(() => {
          this._pageProxySession.sendMayFail('Target.resume', {
            targetId: targetInfo.targetId
          });
        });
      }
    }
  }
  _onDispatchMessageFromTarget(event) {
    const {
      targetId,
      message
    } = event;
    if (this._provisionalPage && this._provisionalPage._session.sessionId === targetId) this._provisionalPage._session.dispatchMessage(JSON.parse(message));else if (this._session.sessionId === targetId) this._session.dispatchMessage(JSON.parse(message));else throw new Error('Unknown target: ' + targetId);
  }
  _addSessionListeners() {
    this._sessionListeners = [_eventsHelper.eventsHelper.addEventListener(this._session, 'Page.frameNavigated', event => this._onFrameNavigated(event.frame, false)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.navigatedWithinDocument', event => this._onFrameNavigatedWithinDocument(event.frameId, event.url)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.frameAttached', event => this._onFrameAttached(event.frameId, event.parentFrameId)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.frameDetached', event => this._onFrameDetached(event.frameId)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.willCheckNavigationPolicy', event => this._onWillCheckNavigationPolicy(event.frameId)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.didCheckNavigationPolicy', event => this._onDidCheckNavigationPolicy(event.frameId, event.cancel)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.frameScheduledNavigation', event => this._onFrameScheduledNavigation(event.frameId, event.delay, event.targetIsCurrentFrame)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.loadEventFired', event => this._page._frameManager.frameLifecycleEvent(event.frameId, 'load')), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.domContentEventFired', event => this._page._frameManager.frameLifecycleEvent(event.frameId, 'domcontentloaded')), _eventsHelper.eventsHelper.addEventListener(this._session, 'Runtime.executionContextCreated', event => this._onExecutionContextCreated(event.context)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Runtime.bindingCalled', event => this._onBindingCalled(event.contextId, event.argument)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Console.messageAdded', event => this._onConsoleMessage(event)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Console.messageRepeatCountUpdated', event => this._onConsoleRepeatCountUpdated(event)), _eventsHelper.eventsHelper.addEventListener(this._pageProxySession, 'Dialog.javascriptDialogOpening', event => this._onDialog(event)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Page.fileChooserOpened', event => this._onFileChooserOpened(event)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Network.requestWillBeSent', e => this._onRequestWillBeSent(this._session, e)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Network.requestIntercepted', e => this._onRequestIntercepted(this._session, e)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Network.responseReceived', e => this._onResponseReceived(this._session, e)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Network.loadingFinished', e => this._onLoadingFinished(e)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Network.loadingFailed', e => this._onLoadingFailed(this._session, e)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Network.webSocketCreated', e => this._page._frameManager.onWebSocketCreated(e.requestId, e.url)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Network.webSocketWillSendHandshakeRequest', e => this._page._frameManager.onWebSocketRequest(e.requestId)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Network.webSocketHandshakeResponseReceived', e => this._page._frameManager.onWebSocketResponse(e.requestId, e.response.status, e.response.statusText)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Network.webSocketFrameSent', e => e.response.payloadData && this._page._frameManager.onWebSocketFrameSent(e.requestId, e.response.opcode, e.response.payloadData)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Network.webSocketFrameReceived', e => e.response.payloadData && this._page._frameManager.webSocketFrameReceived(e.requestId, e.response.opcode, e.response.payloadData)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Network.webSocketClosed', e => this._page._frameManager.webSocketClosed(e.requestId)), _eventsHelper.eventsHelper.addEventListener(this._session, 'Network.webSocketFrameError', e => this._page._frameManager.webSocketError(e.requestId, e.errorMessage))];
  }
  async _updateState(method, params) {
    await this._forAllSessions(session => session.send(method, params).then());
  }
  async _forAllSessions(callback) {
    const sessions = [this._session];
    // If the state changes during provisional load, push it to the provisional page
    // as well to always be in sync with the backend.
    if (this._provisionalPage) sessions.push(this._provisionalPage._session);
    await Promise.all(sessions.map(session => callback(session).catch(e => {})));
  }
  _onWillCheckNavigationPolicy(frameId) {
    // It may happen that new policy check occurs while there is an ongoing
    // provisional load, in this case it should be safe to ignore it as it will
    // either:
    // - end up canceled, e.g. ctrl+click opening link in new tab, having no effect
    //   on this page
    // - start new provisional load which we will miss in our signal trackers but
    //   we certainly won't hang waiting for it to finish and there is high chance
    //   that the current provisional page will commit navigation canceling the new
    //   one.
    if (this._provisionalPage) return;
    this._page._frameManager.frameRequestedNavigation(frameId);
  }
  _onDidCheckNavigationPolicy(frameId, cancel) {
    if (!cancel) return;
    // This is a cross-process navigation that is canceled in the original page and continues in
    // the provisional page. Bail out as we are tracking it.
    if (this._provisionalPage) return;
    this._page._frameManager.frameAbortedNavigation(frameId, 'Navigation canceled by policy check');
  }
  _onFrameScheduledNavigation(frameId, delay, targetIsCurrentFrame) {
    if (targetIsCurrentFrame) this._page._frameManager.frameRequestedNavigation(frameId);
  }
  _handleFrameTree(frameTree) {
    this._onFrameAttached(frameTree.frame.id, frameTree.frame.parentId || null);
    this._onFrameNavigated(frameTree.frame, true);
    this._page._frameManager.frameLifecycleEvent(frameTree.frame.id, 'domcontentloaded');
    this._page._frameManager.frameLifecycleEvent(frameTree.frame.id, 'load');
    if (!frameTree.childFrames) return;
    for (const child of frameTree.childFrames) this._handleFrameTree(child);
  }
  _onFrameAttached(frameId, parentFrameId) {
    return this._page._frameManager.frameAttached(frameId, parentFrameId);
  }
  _onFrameNavigated(framePayload, initial) {
    const frame = this._page._frameManager.frame(framePayload.id);
    (0, _utils.assert)(frame);
    this._removeContextsForFrame(frame, true);
    if (!framePayload.parentId) this._workers.clear();
    this._page._frameManager.frameCommittedNewDocumentNavigation(framePayload.id, framePayload.url, framePayload.name || '', framePayload.loaderId, initial);
    if (!initial) this._firstNonInitialNavigationCommittedFulfill();
  }
  _onFrameNavigatedWithinDocument(frameId, url) {
    this._page._frameManager.frameCommittedSameDocumentNavigation(frameId, url);
  }
  _onFrameDetached(frameId) {
    this._page._frameManager.frameDetached(frameId);
  }
  _removeContextsForFrame(frame, notifyFrame) {
    for (const [contextId, context] of this._contextIdToContext) {
      if (context.frame === frame) {
        this._contextIdToContext.delete(contextId);
        if (notifyFrame) frame._contextDestroyed(context);
      }
    }
  }
  _onExecutionContextCreated(contextPayload) {
    if (this._contextIdToContext.has(contextPayload.id)) return;
    const frame = this._page._frameManager.frame(contextPayload.frameId);
    if (!frame) return;
    const delegate = new _wkExecutionContext.WKExecutionContext(this._session, contextPayload.id);
    let worldName = null;
    if (contextPayload.type === 'normal') worldName = 'main';else if (contextPayload.type === 'user' && contextPayload.name === UTILITY_WORLD_NAME) worldName = 'utility';
    const context = new dom.FrameExecutionContext(delegate, frame, worldName);
    context[contextDelegateSymbol] = delegate;
    if (worldName) frame._contextCreated(worldName, context);
    this._contextIdToContext.set(contextPayload.id, context);
  }
  async _onBindingCalled(contextId, argument) {
    const pageOrError = await this.pageOrError();
    if (!(pageOrError instanceof Error)) {
      const context = this._contextIdToContext.get(contextId);
      if (context) await this._page._onBindingCalled(argument, context);
    }
  }
  async navigateFrame(frame, url, referrer) {
    if (this._pageProxySession.isDisposed()) throw new _errors.TargetClosedError();
    const pageProxyId = this._pageProxySession.sessionId;
    const result = await this._pageProxySession.connection.browserSession.send('Playwright.navigate', {
      url,
      pageProxyId,
      frameId: frame._id,
      referrer
    });
    return {
      newDocumentId: result.loaderId
    };
  }
  _onConsoleMessage(event) {
    // Note: do no introduce await in this function, otherwise we lose the ordering.
    // For example, frame.setContent relies on this.
    const {
      type,
      level,
      text,
      parameters,
      url,
      line: lineNumber,
      column: columnNumber,
      source
    } = event.message;
    if (level === 'error' && source === 'javascript') {
      const {
        name,
        message
      } = (0, _stackTrace.splitErrorMessage)(text);
      let stack;
      if (event.message.stackTrace) {
        stack = text + '\n' + event.message.stackTrace.callFrames.map(callFrame => {
          return `    at ${callFrame.functionName || 'unknown'} (${callFrame.url}:${callFrame.lineNumber}:${callFrame.columnNumber})`;
        }).join('\n');
      } else {
        stack = '';
      }
      this._lastConsoleMessage = null;
      const error = new Error(message);
      error.stack = stack;
      error.name = name;
      this._page.emitOnContextOnceInitialized(_browserContext.BrowserContext.Events.PageError, error, this._page);
      return;
    }
    let derivedType = type || '';
    if (type === 'log') derivedType = level;else if (type === 'timing') derivedType = 'timeEnd';
    const handles = [];
    for (const p of parameters || []) {
      let context;
      if (p.objectId) {
        const objectId = JSON.parse(p.objectId);
        context = this._contextIdToContext.get(objectId.injectedScriptId);
      } else {
        // Pick any context if the parameter is a value.
        context = [...this._contextIdToContext.values()].find(c => c.frame === this._page.mainFrame());
      }
      if (!context) return;
      handles.push(context.createHandle(p));
    }
    this._lastConsoleMessage = {
      derivedType,
      text,
      handles,
      count: 0,
      location: {
        url: url || '',
        lineNumber: (lineNumber || 1) - 1,
        columnNumber: (columnNumber || 1) - 1
      }
    };
    this._onConsoleRepeatCountUpdated({
      count: 1
    });
  }
  _onConsoleRepeatCountUpdated(event) {
    if (this._lastConsoleMessage) {
      const {
        derivedType,
        text,
        handles,
        count,
        location
      } = this._lastConsoleMessage;
      for (let i = count; i < event.count; ++i) this._page._addConsoleMessage(derivedType, handles, location, handles.length ? undefined : text);
      this._lastConsoleMessage.count = event.count;
    }
  }
  _onDialog(event) {
    this._page.emitOnContext(_browserContext.BrowserContext.Events.Dialog, new dialog.Dialog(this._page, event.type, event.message, async (accept, promptText) => {
      await this._pageProxySession.send('Dialog.handleJavaScriptDialog', {
        accept,
        promptText
      });
    }, event.defaultPrompt));
  }
  async _onFileChooserOpened(event) {
    let handle;
    try {
      const context = await this._page._frameManager.frame(event.frameId)._mainContext();
      handle = context.createHandle(event.element).asElement();
    } catch (e) {
      // During async processing, frame/context may go away. We should not throw.
      return;
    }
    await this._page._onFileChooserOpened(handle);
  }
  static async _setEmulateMedia(session, mediaType, colorScheme, reducedMotion, forcedColors) {
    const promises = [];
    promises.push(session.send('Page.setEmulatedMedia', {
      media: mediaType === 'no-override' ? '' : mediaType
    }));
    let appearance = undefined;
    switch (colorScheme) {
      case 'light':
        appearance = 'Light';
        break;
      case 'dark':
        appearance = 'Dark';
        break;
      case 'no-override':
        appearance = undefined;
        break;
    }
    promises.push(session.send('Page.overrideUserPreference', {
      name: 'PrefersColorScheme',
      value: appearance
    }));
    let reducedMotionWk = undefined;
    switch (reducedMotion) {
      case 'reduce':
        reducedMotionWk = 'Reduce';
        break;
      case 'no-preference':
        reducedMotionWk = 'NoPreference';
        break;
      case 'no-override':
        reducedMotionWk = undefined;
        break;
    }
    promises.push(session.send('Page.overrideUserPreference', {
      name: 'PrefersReducedMotion',
      value: reducedMotionWk
    }));
    let forcedColorsWk = undefined;
    switch (forcedColors) {
      case 'active':
        forcedColorsWk = 'Active';
        break;
      case 'none':
        forcedColorsWk = 'None';
        break;
      case 'no-override':
        forcedColorsWk = undefined;
        break;
    }
    promises.push(session.send('Page.setForcedColors', {
      forcedColors: forcedColorsWk
    }));
    await Promise.all(promises);
  }
  async updateExtraHTTPHeaders() {
    await this._updateState('Network.setExtraHTTPHeaders', {
      headers: (0, _utils.headersArrayToObject)(this._calculateExtraHTTPHeaders(), false /* lowerCase */)
    });
  }
  _calculateExtraHTTPHeaders() {
    const locale = this._browserContext._options.locale;
    const headers = network.mergeHeaders([this._browserContext._options.extraHTTPHeaders, this._page.extraHTTPHeaders(), locale ? network.singleHeader('Accept-Language', locale) : undefined]);
    return headers;
  }
  async updateEmulateMedia() {
    const emulatedMedia = this._page.emulatedMedia();
    const colorScheme = emulatedMedia.colorScheme;
    const reducedMotion = emulatedMedia.reducedMotion;
    const forcedColors = emulatedMedia.forcedColors;
    await this._forAllSessions(session => WKPage._setEmulateMedia(session, emulatedMedia.media, colorScheme, reducedMotion, forcedColors));
  }
  async updateEmulatedViewportSize() {
    this._browserContext._validateEmulatedViewport(this._page.viewportSize());
    await this._updateViewport();
  }
  async updateUserAgent() {
    const contextOptions = this._browserContext._options;
    this._updateState('Page.overrideUserAgent', {
      value: contextOptions.userAgent
    });
  }
  async bringToFront() {
    this._pageProxySession.send('Target.activate', {
      targetId: this._session.sessionId
    });
  }
  async _updateViewport() {
    const options = this._browserContext._options;
    const deviceSize = this._page.emulatedSize();
    if (deviceSize === null) return;
    const viewportSize = deviceSize.viewport;
    const screenSize = deviceSize.screen;
    const promises = [this._pageProxySession.send('Emulation.setDeviceMetricsOverride', {
      width: viewportSize.width,
      height: viewportSize.height,
      fixedLayout: !!options.isMobile,
      deviceScaleFactor: options.deviceScaleFactor || 1
    }), this._session.send('Page.setScreenSizeOverride', {
      width: screenSize.width,
      height: screenSize.height
    })];
    if (options.isMobile) {
      const angle = viewportSize.width > viewportSize.height ? 90 : 0;
      // Special handling for macOS 12.
      const useLegacySetOrientationOverrideMethod = _os.default.platform() === 'darwin' && parseInt(_os.default.release().split('.')[0], 10) <= 21;
      if (useLegacySetOrientationOverrideMethod) promises.push(this._session.send('Page.setOrientationOverride', {
        angle
      }));else promises.push(this._pageProxySession.send('Emulation.setOrientationOverride', {
        angle
      }));
    }
    await Promise.all(promises);
  }
  async updateRequestInterception() {
    const enabled = this._page.needsRequestInterception();
    await Promise.all([this._updateState('Network.setInterceptionEnabled', {
      enabled
    }), this._updateState('Network.setResourceCachingDisabled', {
      disabled: enabled
    }), this._updateState('Network.addInterception', {
      url: '.*',
      stage: 'request',
      isRegex: true
    })]);
  }
  async updateOffline() {
    await this._updateState('Network.setEmulateOfflineState', {
      offline: !!this._browserContext._options.offline
    });
  }
  async updateHttpCredentials() {
    const credentials = this._browserContext._options.httpCredentials || {
      username: '',
      password: '',
      origin: ''
    };
    await this._pageProxySession.send('Emulation.setAuthCredentials', {
      username: credentials.username,
      password: credentials.password,
      origin: credentials.origin
    });
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
  goBack() {
    return this._session.send('Page.goBack').then(() => true).catch(error => {
      if (error instanceof Error && error.message.includes(`Protocol error (Page.goBack): Failed to go`)) return false;
      throw error;
    });
  }
  goForward() {
    return this._session.send('Page.goForward').then(() => true).catch(error => {
      if (error instanceof Error && error.message.includes(`Protocol error (Page.goForward): Failed to go`)) return false;
      throw error;
    });
  }
  async exposeBinding(binding) {
    this._session.send('Runtime.addBinding', {
      name: binding.name
    });
    await this._updateBootstrapScript();
    await Promise.all(this._page.frames().map(frame => frame.evaluateExpression(binding.source).catch(e => {})));
  }
  async removeExposedBindings() {
    await this._updateBootstrapScript();
  }
  async addInitScript(initScript) {
    await this._updateBootstrapScript();
  }
  async removeInitScripts() {
    await this._updateBootstrapScript();
  }
  _calculateBootstrapScript() {
    const scripts = [];
    if (!this._page.context()._options.isMobile) {
      scripts.push('delete window.orientation');
      scripts.push('delete window.ondevicemotion');
      scripts.push('delete window.ondeviceorientation');
    }
    scripts.push('if (!window.safari) window.safari = { pushNotification: { toString() { return "[object SafariRemoteNotification]"; } } };');
    scripts.push('if (!window.GestureEvent) window.GestureEvent = function GestureEvent() {};');
    for (const binding of this._page.allBindings()) scripts.push(binding.source);
    scripts.push(...this._browserContext.initScripts.map(s => s.source));
    scripts.push(...this._page.initScripts.map(s => s.source));
    return scripts.join(';\n');
  }
  async _updateBootstrapScript() {
    await this._updateState('Page.setBootstrapScript', {
      source: this._calculateBootstrapScript()
    });
  }
  async closePage(runBeforeUnload) {
    await this._stopVideo();
    await this._pageProxySession.sendMayFail('Target.close', {
      targetId: this._session.sessionId,
      runBeforeUnload
    });
  }
  async setBackgroundColor(color) {
    await this._session.send('Page.setDefaultBackgroundColorOverride', {
      color
    });
  }
  _toolbarHeight() {
    var _this$_page$_browserC;
    if ((_this$_page$_browserC = this._page._browserContext._browser) !== null && _this$_page$_browserC !== void 0 && _this$_page$_browserC.options.headful) return _hostPlatform.hostPlatform === 'mac10.15' ? 55 : 59;
    return 0;
  }
  async _startVideo(options) {
    (0, _utils.assert)(!this._recordingVideoFile);
    const {
      screencastId
    } = await this._pageProxySession.send('Screencast.startVideo', {
      file: options.outputFile,
      width: options.width,
      height: options.height,
      toolbarHeight: this._toolbarHeight()
    });
    this._recordingVideoFile = options.outputFile;
    this._browserContext._browser._videoStarted(this._browserContext, screencastId, options.outputFile, this.pageOrError());
  }
  async _stopVideo() {
    if (!this._recordingVideoFile) return;
    await this._pageProxySession.sendMayFail('Screencast.stopVideo');
    this._recordingVideoFile = null;
  }
  validateScreenshotDimension(side, omitDeviceScaleFactor) {
    // Cairo based implementations (Linux and Windows) have hard limit of 32767
    // (see https://github.com/microsoft/playwright/issues/16727).
    if (process.platform === 'darwin') return;
    if (!omitDeviceScaleFactor && this._page._browserContext._options.deviceScaleFactor) side = Math.ceil(side * this._page._browserContext._options.deviceScaleFactor);
    if (side > 32767) throw new Error('Cannot take screenshot larger than 32767 pixels on any dimension');
  }
  async takeScreenshot(progress, format, documentRect, viewportRect, quality, fitsViewport, scale) {
    const rect = documentRect || viewportRect;
    const omitDeviceScaleFactor = scale === 'css';
    this.validateScreenshotDimension(rect.width, omitDeviceScaleFactor);
    this.validateScreenshotDimension(rect.height, omitDeviceScaleFactor);
    const result = await this._session.send('Page.snapshotRect', {
      ...rect,
      coordinateSystem: documentRect ? 'Page' : 'Viewport',
      omitDeviceScaleFactor
    });
    const prefix = 'data:image/png;base64,';
    let buffer = Buffer.from(result.dataURL.substr(prefix.length), 'base64');
    if (format === 'jpeg') buffer = _utilsBundle.jpegjs.encode(_utilsBundle.PNG.sync.read(buffer), quality).data;
    return buffer;
  }
  async getContentFrame(handle) {
    const nodeInfo = await this._session.send('DOM.describeNode', {
      objectId: handle._objectId
    });
    if (!nodeInfo.contentFrameId) return null;
    return this._page._frameManager.frame(nodeInfo.contentFrameId);
  }
  async getOwnerFrame(handle) {
    if (!handle._objectId) return null;
    const nodeInfo = await this._session.send('DOM.describeNode', {
      objectId: handle._objectId
    });
    return nodeInfo.ownerFrameId || null;
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
    return await this._session.send('DOM.scrollIntoViewIfNeeded', {
      objectId: handle._objectId,
      rect
    }).then(() => 'done').catch(e => {
      if (e instanceof Error && e.message.includes('Node does not have a layout object')) return 'error:notvisible';
      if (e instanceof Error && e.message.includes('Node is detached from document')) return 'error:notconnected';
      throw e;
    });
  }
  async setScreencastOptions(options) {
    if (options) {
      const so = {
        ...options,
        toolbarHeight: this._toolbarHeight()
      };
      const {
        generation
      } = await this._pageProxySession.send('Screencast.startScreencast', so);
      this._screencastGeneration = generation;
    } else {
      await this._pageProxySession.send('Screencast.stopScreencast');
    }
  }
  _onScreencastFrame(event) {
    const generation = this._screencastGeneration;
    this._page.throttleScreencastFrameAck(() => {
      this._pageProxySession.send('Screencast.screencastFrameAck', {
        generation
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
    return process.platform === 'win32' ? 5 : 1;
  }
  async getContentQuads(handle) {
    const result = await this._session.sendMayFail('DOM.getContentQuads', {
      objectId: handle._objectId
    });
    if (!result) return null;
    return result.quads.map(quad => [{
      x: quad[0],
      y: quad[1]
    }, {
      x: quad[2],
      y: quad[3]
    }, {
      x: quad[4],
      y: quad[5]
    }, {
      x: quad[6],
      y: quad[7]
    }]);
  }
  async setInputFiles(handle, files) {
    const objectId = handle._objectId;
    const protocolFiles = files.map(file => ({
      name: file.name,
      type: file.mimeType,
      data: file.buffer
    }));
    await this._session.send('DOM.setInputFiles', {
      objectId,
      files: protocolFiles
    });
  }
  async setInputFilePaths(handle, paths) {
    const pageProxyId = this._pageProxySession.sessionId;
    const objectId = handle._objectId;
    await Promise.all([this._pageProxySession.connection.browserSession.send('Playwright.grantFileReadAccess', {
      pageProxyId,
      paths
    }), this._session.send('DOM.setInputFiles', {
      objectId,
      paths
    })]);
  }
  async adoptElementHandle(handle, to) {
    const result = await this._session.sendMayFail('DOM.resolveNode', {
      objectId: handle._objectId,
      executionContextId: to[contextDelegateSymbol]._contextId
    });
    if (!result || result.object.subtype === 'null') throw new Error(dom.kUnableToAdoptErrorMessage);
    return to.createHandle(result.object);
  }
  async getAccessibilityTree(needle) {
    return (0, _wkAccessibility.getAccessibilityTree)(this._session, needle);
  }
  async inputActionEpilogue() {}
  async resetForReuse() {}
  async getFrameElement(frame) {
    const parent = frame.parentFrame();
    if (!parent) throw new Error('Frame has been detached.');
    const context = await parent._mainContext();
    const result = await this._session.send('DOM.resolveNode', {
      frameId: frame._id,
      executionContextId: context[contextDelegateSymbol]._contextId
    });
    if (!result || result.object.subtype === 'null') throw new Error('Frame has been detached.');
    return context.createHandle(result.object);
  }
  _onRequestWillBeSent(session, event) {
    if (event.request.url.startsWith('data:')) return;

    // We do not support intercepting redirects.
    if (this._page.needsRequestInterception() && !event.redirectResponse) this._requestIdToRequestWillBeSentEvent.set(event.requestId, event);else this._onRequest(session, event, false);
  }
  _onRequest(session, event, intercepted) {
    let redirectedFrom = null;
    if (event.redirectResponse) {
      const request = this._requestIdToRequest.get(event.requestId);
      // If we connect late to the target, we could have missed the requestWillBeSent event.
      if (request) {
        this._handleRequestRedirect(request, event.redirectResponse, event.timestamp);
        redirectedFrom = request;
      }
    }
    const frame = redirectedFrom ? redirectedFrom.request.frame() : this._page._frameManager.frame(event.frameId);
    // sometimes we get stray network events for detached frames
    // TODO(einbinder) why?
    if (!frame) return;

    // TODO(einbinder) this will fail if we are an XHR document request
    const isNavigationRequest = event.type === 'Document';
    const documentId = isNavigationRequest ? event.loaderId : undefined;
    const request = new _wkInterceptableRequest.WKInterceptableRequest(session, frame, event, redirectedFrom, documentId);
    let route;
    if (intercepted) {
      route = new _wkInterceptableRequest.WKRouteImpl(session, request._requestId);
      // There is no point in waiting for the raw headers in Network.responseReceived when intercepting.
      // Use provisional headers as raw headers, so that client can call allHeaders() from the route handler.
      request.request.setRawRequestHeaders(null);
    }
    this._requestIdToRequest.set(event.requestId, request);
    this._page._frameManager.requestStarted(request.request, route);
  }
  _handleRequestRedirect(request, responsePayload, timestamp) {
    const response = request.createResponse(responsePayload);
    response._securityDetailsFinished();
    response._serverAddrFinished();
    response.setResponseHeadersSize(null);
    response.setEncodedBodySize(null);
    response._requestFinished(responsePayload.timing ? _helper.helper.secondsToRoundishMillis(timestamp - request._timestamp) : -1);
    this._requestIdToRequest.delete(request._requestId);
    this._page._frameManager.requestReceivedResponse(response);
    this._page._frameManager.reportRequestFinished(request.request, response);
  }
  _onRequestIntercepted(session, event) {
    const requestWillBeSentEvent = this._requestIdToRequestWillBeSentEvent.get(event.requestId);
    if (!requestWillBeSentEvent) {
      // Intercepted, although we do not intend to allow interception.
      // Just continue.
      session.sendMayFail('Network.interceptWithRequest', {
        requestId: event.requestId
      });
      return;
    }
    this._requestIdToRequestWillBeSentEvent.delete(event.requestId);
    this._onRequest(session, requestWillBeSentEvent, true);
  }
  _onResponseReceived(session, event) {
    const requestWillBeSentEvent = this._requestIdToRequestWillBeSentEvent.get(event.requestId);
    if (requestWillBeSentEvent) {
      this._requestIdToRequestWillBeSentEvent.delete(event.requestId);
      // We received a response, so the request won't be intercepted (e.g. it was handled by a
      // service worker and we don't intercept service workers).
      this._onRequest(session, requestWillBeSentEvent, false);
    }
    const request = this._requestIdToRequest.get(event.requestId);
    // FileUpload sends a response without a matching request.
    if (!request) return;
    this._requestIdToResponseReceivedPayloadEvent.set(request._requestId, event);
    const response = request.createResponse(event.response);
    this._page._frameManager.requestReceivedResponse(response);
    if (response.status() === 204) {
      this._onLoadingFailed(session, {
        requestId: event.requestId,
        errorText: 'Aborted: 204 No Content',
        timestamp: event.timestamp
      });
    }
  }
  _onLoadingFinished(event) {
    const request = this._requestIdToRequest.get(event.requestId);
    // For certain requestIds we never receive requestWillBeSent event.
    // @see https://crbug.com/750469
    if (!request) return;

    // Under certain conditions we never get the Network.responseReceived
    // event from protocol. @see https://crbug.com/883475
    const response = request.request._existingResponse();
    if (response) {
      var _event$metrics, _event$metrics2, _responseReceivedPayl, _responseReceivedPayl2, _responseReceivedPayl3, _event$metrics3, _event$metrics$respon, _event$metrics4, _event$metrics$respon2, _event$metrics5;
      const responseReceivedPayload = this._requestIdToResponseReceivedPayloadEvent.get(request._requestId);
      response._serverAddrFinished(parseRemoteAddress(event === null || event === void 0 || (_event$metrics = event.metrics) === null || _event$metrics === void 0 ? void 0 : _event$metrics.remoteAddress));
      response._securityDetailsFinished({
        protocol: isLoadedSecurely(response.url(), response.timing()) ? (_event$metrics2 = event.metrics) === null || _event$metrics2 === void 0 || (_event$metrics2 = _event$metrics2.securityConnection) === null || _event$metrics2 === void 0 ? void 0 : _event$metrics2.protocol : undefined,
        subjectName: responseReceivedPayload === null || responseReceivedPayload === void 0 || (_responseReceivedPayl = responseReceivedPayload.response.security) === null || _responseReceivedPayl === void 0 || (_responseReceivedPayl = _responseReceivedPayl.certificate) === null || _responseReceivedPayl === void 0 ? void 0 : _responseReceivedPayl.subject,
        validFrom: responseReceivedPayload === null || responseReceivedPayload === void 0 || (_responseReceivedPayl2 = responseReceivedPayload.response.security) === null || _responseReceivedPayl2 === void 0 || (_responseReceivedPayl2 = _responseReceivedPayl2.certificate) === null || _responseReceivedPayl2 === void 0 ? void 0 : _responseReceivedPayl2.validFrom,
        validTo: responseReceivedPayload === null || responseReceivedPayload === void 0 || (_responseReceivedPayl3 = responseReceivedPayload.response.security) === null || _responseReceivedPayl3 === void 0 || (_responseReceivedPayl3 = _responseReceivedPayl3.certificate) === null || _responseReceivedPayl3 === void 0 ? void 0 : _responseReceivedPayl3.validUntil
      });
      if ((_event$metrics3 = event.metrics) !== null && _event$metrics3 !== void 0 && _event$metrics3.protocol) response._setHttpVersion(event.metrics.protocol);
      response.setEncodedBodySize((_event$metrics$respon = (_event$metrics4 = event.metrics) === null || _event$metrics4 === void 0 ? void 0 : _event$metrics4.responseBodyBytesReceived) !== null && _event$metrics$respon !== void 0 ? _event$metrics$respon : null);
      response.setResponseHeadersSize((_event$metrics$respon2 = (_event$metrics5 = event.metrics) === null || _event$metrics5 === void 0 ? void 0 : _event$metrics5.responseHeaderBytesReceived) !== null && _event$metrics$respon2 !== void 0 ? _event$metrics$respon2 : null);
      response._requestFinished(_helper.helper.secondsToRoundishMillis(event.timestamp - request._timestamp));
    } else {
      // Use provisional headers if we didn't have the response with raw headers.
      request.request.setRawRequestHeaders(null);
    }
    this._requestIdToResponseReceivedPayloadEvent.delete(request._requestId);
    this._requestIdToRequest.delete(request._requestId);
    this._page._frameManager.reportRequestFinished(request.request, response);
  }
  _onLoadingFailed(session, event) {
    const requestWillBeSentEvent = this._requestIdToRequestWillBeSentEvent.get(event.requestId);
    if (requestWillBeSentEvent) {
      this._requestIdToRequestWillBeSentEvent.delete(event.requestId);
      // If loading failed, the request won't be intercepted (e.g. it was handled by a
      // service worker and we don't intercept service workers).
      this._onRequest(session, requestWillBeSentEvent, false);
    }
    const request = this._requestIdToRequest.get(event.requestId);
    // For certain requestIds we never receive requestWillBeSent event.
    // @see https://crbug.com/750469
    if (!request) return;
    const response = request.request._existingResponse();
    if (response) {
      response._serverAddrFinished();
      response._securityDetailsFinished();
      response.setResponseHeadersSize(null);
      response.setEncodedBodySize(null);
      response._requestFinished(_helper.helper.secondsToRoundishMillis(event.timestamp - request._timestamp));
    } else {
      // Use provisional headers if we didn't have the response with raw headers.
      request.request.setRawRequestHeaders(null);
    }
    this._requestIdToRequest.delete(request._requestId);
    request.request._setFailureText(event.errorText);
    this._page._frameManager.requestFailed(request.request, event.errorText.includes('cancelled'));
  }
  async _grantPermissions(origin, permissions) {
    const webPermissionToProtocol = new Map([['geolocation', 'geolocation'], ['clipboard-read', 'clipboard-read']]);
    const filtered = permissions.map(permission => {
      const protocolPermission = webPermissionToProtocol.get(permission);
      if (!protocolPermission) throw new Error('Unknown permission: ' + permission);
      return protocolPermission;
    });
    await this._pageProxySession.send('Emulation.grantPermissions', {
      origin,
      permissions: filtered
    });
  }
  async _clearPermissions() {
    await this._pageProxySession.send('Emulation.resetPermissions', {});
  }
  shouldToggleStyleSheetToSyncAnimations() {
    return true;
  }
}

/**
 * WebKit Remote Addresses look like:
 *
 * macOS:
 * ::1.8911
 * 2606:2800:220:1:248:1893:25c8:1946.443
 * 127.0.0.1:8000
 *
 * ubuntu:
 * ::1:8907
 * 127.0.0.1:8000
 *
 * NB: They look IPv4 and IPv6's with ports but use an alternative notation.
 */
exports.WKPage = WKPage;
function parseRemoteAddress(value) {
  if (!value) return;
  try {
    const colon = value.lastIndexOf(':');
    const dot = value.lastIndexOf('.');
    if (dot < 0) {
      // IPv6ish:port
      return {
        ipAddress: `[${value.slice(0, colon)}]`,
        port: +value.slice(colon + 1)
      };
    }
    if (colon > dot) {
      // IPv4:port
      const [address, port] = value.split(':');
      return {
        ipAddress: address,
        port: +port
      };
    } else {
      // IPv6ish.port
      const [address, port] = value.split('.');
      return {
        ipAddress: `[${address}]`,
        port: +port
      };
    }
  } catch (_) {}
}

/**
 * Adapted from Source/WebInspectorUI/UserInterface/Models/Resource.js in
 * WebKit codebase.
 */
function isLoadedSecurely(url, timing) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'wss:' && u.protocol !== 'sftp:') return false;
    if (timing.secureConnectionStart === -1 && timing.connectStart !== -1) return false;
    return true;
  } catch (_) {}
}
const contextDelegateSymbol = Symbol('delegate');