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

import path from 'path';
import { PNG, jpegjs } from '../../utilsBundle';
import { splitErrorMessage } from '../../utils/stackTrace';
import { assert, createGuid, debugAssert, headersArrayToObject, headersObjectToArray } from '../../utils';
import { hostPlatform } from '../../utils/hostPlatform';
import type * as accessibility from '../accessibility';
import * as dialog from '../dialog';
import * as dom from '../dom';
import type * as frames from '../frames';
import type { RegisteredListener } from '../../utils/eventsHelper';
import { eventsHelper } from '../../utils/eventsHelper';
import { helper } from '../helper';
import type { JSHandle } from '../javascript';
import * as network from '../network';
import type { PageBinding, PageDelegate } from '../page';
import { Page } from '../page';
import type { Progress } from '../progress';
import type * as types from '../types';
import type { Protocol } from './protocol';
import { getAccessibilityTree } from './wkAccessibility';
import type { WKBrowserContext } from './wkBrowser';
import { WKSession } from './wkConnection';
import { WKExecutionContext } from './wkExecutionContext';
import { RawKeyboardImpl, RawMouseImpl, RawTouchscreenImpl } from './wkInput';
import { WKInterceptableRequest, WKRouteImpl } from './wkInterceptableRequest';
import { WKProvisionalPage } from './wkProvisionalPage';
import { WKWorkers } from './wkWorkers';
import { debugLogger } from '../../common/debugLogger';
import { ManualPromise } from '../../utils/manualPromise';

const UTILITY_WORLD_NAME = '__playwright_utility_world__';
const BINDING_CALL_MESSAGE = '__playwright_binding_call__';

export class WKPage implements PageDelegate {
  readonly rawMouse: RawMouseImpl;
  readonly rawKeyboard: RawKeyboardImpl;
  readonly rawTouchscreen: RawTouchscreenImpl;
  _session: WKSession;
  private _provisionalPage: WKProvisionalPage | null = null;
  readonly _page: Page;
  private readonly _pagePromise = new ManualPromise<Page | Error>();
  private readonly _pageProxySession: WKSession;
  readonly _opener: WKPage | null;
  private readonly _requestIdToRequest = new Map<string, WKInterceptableRequest>();
  private readonly _workers: WKWorkers;
  private readonly _contextIdToContext: Map<number, dom.FrameExecutionContext>;
  private _mainFrameContextId?: number;
  private _sessionListeners: RegisteredListener[] = [];
  private _eventListeners: RegisteredListener[];
  readonly _browserContext: WKBrowserContext;
  _initializedPage: Page | null = null;
  private _firstNonInitialNavigationCommittedPromise: Promise<void>;
  private _firstNonInitialNavigationCommittedFulfill = () => {};
  _firstNonInitialNavigationCommittedReject = (e: Error) => {};
  private _lastConsoleMessage: { derivedType: string, text: string, handles: JSHandle[]; count: number, location: types.ConsoleMessageLocation; } | null = null;

  private readonly _requestIdToResponseReceivedPayloadEvent = new Map<string, Protocol.Network.responseReceivedPayload>();
  // Holds window features for the next popup being opened via window.open,
  // until the popup page proxy arrives.
  private _nextWindowOpenPopupFeatures?: string[];
  private _recordingVideoFile: string | null = null;
  private _screencastGeneration: number = 0;
  private _interceptingFileChooser = false;

  constructor(browserContext: WKBrowserContext, pageProxySession: WKSession, opener: WKPage | null) {
    this._pageProxySession = pageProxySession;
    this._opener = opener;
    this.rawKeyboard = new RawKeyboardImpl(pageProxySession);
    this.rawMouse = new RawMouseImpl(pageProxySession);
    this.rawTouchscreen = new RawTouchscreenImpl(pageProxySession);
    this._contextIdToContext = new Map();
    this._page = new Page(this, browserContext);
    this.rawMouse.setPage(this._page);
    this._workers = new WKWorkers(this._page);
    this._session = undefined as any as WKSession;
    this._browserContext = browserContext;
    this._page.on(Page.Events.FrameDetached, (frame: frames.Frame) => this._removeContextsForFrame(frame, false));
    this._eventListeners = [
      eventsHelper.addEventListener(this._pageProxySession, 'Target.targetCreated', this._onTargetCreated.bind(this)),
      eventsHelper.addEventListener(this._pageProxySession, 'Target.targetDestroyed', this._onTargetDestroyed.bind(this)),
      eventsHelper.addEventListener(this._pageProxySession, 'Target.dispatchMessageFromTarget', this._onDispatchMessageFromTarget.bind(this)),
      eventsHelper.addEventListener(this._pageProxySession, 'Target.didCommitProvisionalTarget', this._onDidCommitProvisionalTarget.bind(this)),
      eventsHelper.addEventListener(this._pageProxySession, 'Screencast.screencastFrame', this._onScreencastFrame.bind(this)),
    ];
    this._firstNonInitialNavigationCommittedPromise = new Promise((f, r) => {
      this._firstNonInitialNavigationCommittedFulfill = f;
      this._firstNonInitialNavigationCommittedReject = r;
    });
    if (opener && !browserContext._options.noDefaultViewport && opener._nextWindowOpenPopupFeatures) {
      const viewportSize = helper.getViewportSizeFromWindowFeatures(opener._nextWindowOpenPopupFeatures);
      opener._nextWindowOpenPopupFeatures = undefined;
      if (viewportSize)
        this._page._state.emulatedSize = { viewport: viewportSize, screen: viewportSize };
    }
  }

  potentiallyUninitializedPage(): Page {
    return this._page;
  }

  private async _initializePageProxySession() {
    if (this._page._browserContext.isSettingStorageState())
      return;
    const promises: Promise<any>[] = [
      this._pageProxySession.send('Dialog.enable'),
      this._pageProxySession.send('Emulation.setActiveAndFocused', { active: true }),
    ];
    const contextOptions = this._browserContext._options;
    if (contextOptions.javaScriptEnabled === false)
      promises.push(this._pageProxySession.send('Emulation.setJavaScriptEnabled', { enabled: false }));
    promises.push(this._updateViewport());
    promises.push(this.updateHttpCredentials());
    if (this._browserContext._permissions.size) {
      for (const [key, value] of this._browserContext._permissions)
        promises.push(this._grantPermissions(key, value));
    }
    if (this._browserContext._options.recordVideo) {
      const outputFile = path.join(this._browserContext._options.recordVideo.dir, createGuid() + '.webm');
      promises.push(this._browserContext._ensureVideosPath().then(() => {
        return this._startVideo({
          // validateBrowserContextOptions ensures correct video size.
          ...this._browserContext._options.recordVideo!.size!,
          outputFile,
        });
      }));
    }
    await Promise.all(promises);
  }

  private _setSession(session: WKSession) {
    eventsHelper.removeEventListeners(this._sessionListeners);
    this._session = session;
    this.rawKeyboard.setSession(session);
    this.rawMouse.setSession(session);
    this._addSessionListeners();
    this._workers.setSession(session);
  }

  // This method is called for provisional targets as well. The session passed as the parameter
  // may be different from the current session and may be destroyed without becoming current.
  async _initializeSession(session: WKSession, provisional: boolean, resourceTreeHandler: (r: Protocol.Page.getResourceTreeReturnValue) => void) {
    await this._initializeSessionMayThrow(session, resourceTreeHandler).catch(e => {
      // Provisional session can be disposed at any time, for example due to new navigation initiating
      // a new provisional page.
      if (provisional && session.isDisposed())
        return;
      // Swallow initialization errors due to newer target swap in,
      // since we will reinitialize again.
      if (this._session === session)
        throw e;
    });
  }

  private async _initializeSessionMayThrow(session: WKSession, resourceTreeHandler: (r: Protocol.Page.getResourceTreeReturnValue) => void) {
    const [, frameTree] = await Promise.all([
      // Page agent must be enabled before Runtime.
      session.send('Page.enable'),
      session.send('Page.getResourceTree'),
    ] as const);
    resourceTreeHandler(frameTree);
    const promises: Promise<any>[] = [
      // Resource tree should be received before first execution context.
      session.send('Runtime.enable'),
      session.send('Page.createUserWorld', { name: UTILITY_WORLD_NAME }).catch(_ => {}),  // Worlds are per-process
      session.send('Console.enable'),
      session.send('Network.enable'),
      this._workers.initializeSession(session)
    ];
    if (this._page._needsRequestInterception()) {
      promises.push(session.send('Network.setInterceptionEnabled', { enabled: true }));
      promises.push(session.send('Network.addInterception', { url: '.*', stage: 'request', isRegex: true }));
    }
    if (this._page._browserContext.isSettingStorageState()) {
      await Promise.all(promises);
      return;
    }

    const contextOptions = this._browserContext._options;
    if (contextOptions.userAgent)
      promises.push(session.send('Page.overrideUserAgent', { value: contextOptions.userAgent }));
    if (this._page._state.mediaType || this._page._state.colorScheme || this._page._state.reducedMotion)
      promises.push(WKPage._setEmulateMedia(session, this._page._state.mediaType, this._page._state.colorScheme, this._page._state.reducedMotion));
    const bootstrapScript = this._calculateBootstrapScript();
    if (bootstrapScript.length)
      promises.push(session.send('Page.setBootstrapScript', { source: bootstrapScript }));
    this._page.frames().map(frame => frame.evaluateExpression(bootstrapScript, false, undefined).catch(e => {}));
    if (contextOptions.bypassCSP)
      promises.push(session.send('Page.setBypassCSP', { enabled: true }));
    if (this._page._state.emulatedSize) {
      promises.push(session.send('Page.setScreenSizeOverride', {
        width: this._page._state.emulatedSize.screen.width,
        height: this._page._state.emulatedSize.screen.height,
      }));
    }
    promises.push(this.updateEmulateMedia());
    promises.push(session.send('Network.setExtraHTTPHeaders', { headers: headersArrayToObject(this._calculateExtraHTTPHeaders(), false /* lowerCase */) }));
    if (contextOptions.offline)
      promises.push(session.send('Network.setEmulateOfflineState', { offline: true }));
    promises.push(session.send('Page.setTouchEmulationEnabled', { enabled: !!contextOptions.hasTouch }));
    if (contextOptions.timezoneId) {
      promises.push(session.send('Page.setTimeZone', { timeZone: contextOptions.timezoneId }).
          catch(e => { throw new Error(`Invalid timezone ID: ${contextOptions.timezoneId}`); }));
    }
    if (this._interceptingFileChooser)
      promises.push(session.send('Page.setInterceptFileChooserDialog', { enabled: true }));
    promises.push(session.send('Page.overrideSetting', { setting: 'DeviceOrientationEventEnabled' as any, value: contextOptions.isMobile }));
    promises.push(session.send('Page.overrideSetting', { setting: 'FullScreenEnabled' as any, value: !contextOptions.isMobile }));
    promises.push(session.send('Page.overrideSetting', { setting: 'NotificationsEnabled' as any, value: !contextOptions.isMobile }));
    promises.push(session.send('Page.overrideSetting', { setting: 'PointerLockEnabled' as any, value: !contextOptions.isMobile }));
    promises.push(session.send('Page.overrideSetting', { setting: 'InputTypeMonthEnabled' as any, value: contextOptions.isMobile }));
    promises.push(session.send('Page.overrideSetting', { setting: 'InputTypeWeekEnabled' as any, value: contextOptions.isMobile }));
    await Promise.all(promises);
  }

  private _onDidCommitProvisionalTarget(event: Protocol.Target.didCommitProvisionalTargetPayload) {
    const { oldTargetId, newTargetId } = event;
    assert(this._provisionalPage);
    assert(this._provisionalPage._session.sessionId === newTargetId, 'Unknown new target: ' + newTargetId);
    assert(this._session.sessionId === oldTargetId, 'Unknown old target: ' + oldTargetId);
    const newSession = this._provisionalPage._session;
    this._provisionalPage.commit();
    this._provisionalPage.dispose();
    this._provisionalPage = null;
    this._setSession(newSession);
  }

  private _onTargetDestroyed(event: Protocol.Target.targetDestroyedPayload) {
    const { targetId, crashed } = event;
    if (this._provisionalPage && this._provisionalPage._session.sessionId === targetId) {
      this._provisionalPage._session.dispose(false);
      this._provisionalPage.dispose();
      this._provisionalPage = null;
    } else if (this._session.sessionId === targetId) {
      this._session.dispose(false);
      eventsHelper.removeEventListeners(this._sessionListeners);
      if (crashed) {
        this._session.markAsCrashed();
        this._page._didCrash();
      }
    }
  }

  didClose() {
    this._page._didClose();
  }

  dispose(disconnected: boolean) {
    this._pageProxySession.dispose(disconnected);
    eventsHelper.removeEventListeners(this._sessionListeners);
    eventsHelper.removeEventListeners(this._eventListeners);
    if (this._session)
      this._session.dispose(disconnected);
    if (this._provisionalPage) {
      this._provisionalPage._session.dispose(disconnected);
      this._provisionalPage.dispose();
      this._provisionalPage = null;
    }
    this._page._didDisconnect();
    this._firstNonInitialNavigationCommittedReject(new Error('Page closed'));
  }

  dispatchMessageToSession(message: any) {
    this._pageProxySession.dispatchMessage(message);
  }

  handleProvisionalLoadFailed(event: Protocol.Playwright.provisionalLoadFailedPayload) {
    if (!this._initializedPage) {
      this._firstNonInitialNavigationCommittedReject(new Error('Initial load failed'));
      return;
    }
    if (!this._provisionalPage)
      return;
    let errorText = event.error;
    if (errorText.includes('cancelled'))
      errorText += '; maybe frame was detached?';
    this._page._frameManager.frameAbortedNavigation(this._page.mainFrame()._id, errorText, event.loaderId);
  }

  handleWindowOpen(event: Protocol.Playwright.windowOpenPayload) {
    debugAssert(!this._nextWindowOpenPopupFeatures);
    this._nextWindowOpenPopupFeatures = event.windowFeatures;
  }

  async pageOrError(): Promise<Page | Error> {
    return this._pagePromise;
  }

  private async _onTargetCreated(event: Protocol.Target.targetCreatedPayload) {
    const { targetInfo } = event;
    const session = new WKSession(this._pageProxySession.connection, targetInfo.targetId, `Target closed`, (message: any) => {
      this._pageProxySession.send('Target.sendMessageToTarget', {
        message: JSON.stringify(message), targetId: targetInfo.targetId
      }).catch(e => {
        session.dispatchMessage({ id: message.id, error: { message: e.message } });
      });
    });
    assert(targetInfo.type === 'page', 'Only page targets are expected in WebKit, received: ' + targetInfo.type);

    if (!targetInfo.isProvisional) {
      assert(!this._initializedPage);
      let pageOrError: Page | Error;
      try {
        this._setSession(session);
        await Promise.all([
          this._initializePageProxySession(),
          this._initializeSession(session, false, ({ frameTree }) => this._handleFrameTree(frameTree)),
        ]);
        pageOrError = this._page;
      } catch (e) {
        pageOrError = e;
      }
      if (targetInfo.isPaused)
        this._pageProxySession.sendMayFail('Target.resume', { targetId: targetInfo.targetId });
      if ((pageOrError instanceof Page) && this._page.mainFrame().url() === '') {
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
      this._initializedPage = pageOrError instanceof Page ? pageOrError : null;
      this._page.reportAsNew(pageOrError instanceof Page ? undefined : pageOrError);
      this._pagePromise.resolve(pageOrError);
    } else {
      assert(targetInfo.isProvisional);
      assert(!this._provisionalPage);
      this._provisionalPage = new WKProvisionalPage(session, this);
      if (targetInfo.isPaused) {
        this._provisionalPage.initializationPromise.then(() => {
          this._pageProxySession.sendMayFail('Target.resume', { targetId: targetInfo.targetId });
        });
      }
    }
  }

  private _onDispatchMessageFromTarget(event: Protocol.Target.dispatchMessageFromTargetPayload) {
    const { targetId, message } = event;
    if (this._provisionalPage && this._provisionalPage._session.sessionId === targetId)
      this._provisionalPage._session.dispatchMessage(JSON.parse(message));
    else if (this._session.sessionId === targetId)
      this._session.dispatchMessage(JSON.parse(message));
    else
      throw new Error('Unknown target: ' + targetId);
  }

  private _addSessionListeners() {
    this._sessionListeners = [
      eventsHelper.addEventListener(this._session, 'Page.frameNavigated', event => this._onFrameNavigated(event.frame, false)),
      eventsHelper.addEventListener(this._session, 'Page.navigatedWithinDocument', event => this._onFrameNavigatedWithinDocument(event.frameId, event.url)),
      eventsHelper.addEventListener(this._session, 'Page.frameAttached', event => this._onFrameAttached(event.frameId, event.parentFrameId)),
      eventsHelper.addEventListener(this._session, 'Page.frameDetached', event => this._onFrameDetached(event.frameId)),
      eventsHelper.addEventListener(this._session, 'Page.willCheckNavigationPolicy', event => this._onWillCheckNavigationPolicy(event.frameId)),
      eventsHelper.addEventListener(this._session, 'Page.didCheckNavigationPolicy', event => this._onDidCheckNavigationPolicy(event.frameId, event.cancel)),
      eventsHelper.addEventListener(this._session, 'Page.frameScheduledNavigation', event => this._onFrameScheduledNavigation(event.frameId)),
      eventsHelper.addEventListener(this._session, 'Page.frameStoppedLoading', event => this._onFrameStoppedLoading(event.frameId)),
      eventsHelper.addEventListener(this._session, 'Page.loadEventFired', event => this._onLifecycleEvent(event.frameId, 'load')),
      eventsHelper.addEventListener(this._session, 'Page.domContentEventFired', event => this._onLifecycleEvent(event.frameId, 'domcontentloaded')),
      eventsHelper.addEventListener(this._session, 'Runtime.executionContextCreated', event => this._onExecutionContextCreated(event.context)),
      eventsHelper.addEventListener(this._session, 'Console.messageAdded', event => this._onConsoleMessage(event)),
      eventsHelper.addEventListener(this._session, 'Console.messageRepeatCountUpdated', event => this._onConsoleRepeatCountUpdated(event)),
      eventsHelper.addEventListener(this._pageProxySession, 'Dialog.javascriptDialogOpening', event => this._onDialog(event)),
      eventsHelper.addEventListener(this._session, 'Page.fileChooserOpened', event => this._onFileChooserOpened(event)),
      eventsHelper.addEventListener(this._session, 'Network.requestWillBeSent', e => this._onRequestWillBeSent(this._session, e)),
      eventsHelper.addEventListener(this._session, 'Network.requestIntercepted', e => this._onRequestIntercepted(this._session, e)),
      eventsHelper.addEventListener(this._session, 'Network.responseReceived', e => this._onResponseReceived(e)),
      eventsHelper.addEventListener(this._session, 'Network.loadingFinished', e => this._onLoadingFinished(e)),
      eventsHelper.addEventListener(this._session, 'Network.loadingFailed', e => this._onLoadingFailed(e)),
      eventsHelper.addEventListener(this._session, 'Network.webSocketCreated', e => this._page._frameManager.onWebSocketCreated(e.requestId, e.url)),
      eventsHelper.addEventListener(this._session, 'Network.webSocketWillSendHandshakeRequest', e => this._page._frameManager.onWebSocketRequest(e.requestId)),
      eventsHelper.addEventListener(this._session, 'Network.webSocketHandshakeResponseReceived', e => this._page._frameManager.onWebSocketResponse(e.requestId, e.response.status, e.response.statusText)),
      eventsHelper.addEventListener(this._session, 'Network.webSocketFrameSent', e => e.response.payloadData && this._page._frameManager.onWebSocketFrameSent(e.requestId, e.response.opcode, e.response.payloadData)),
      eventsHelper.addEventListener(this._session, 'Network.webSocketFrameReceived', e => e.response.payloadData && this._page._frameManager.webSocketFrameReceived(e.requestId, e.response.opcode, e.response.payloadData)),
      eventsHelper.addEventListener(this._session, 'Network.webSocketClosed', e => this._page._frameManager.webSocketClosed(e.requestId)),
      eventsHelper.addEventListener(this._session, 'Network.webSocketFrameError', e => this._page._frameManager.webSocketError(e.requestId, e.errorMessage)),
    ];
  }
  private async _updateState<T extends keyof Protocol.CommandParameters>(
    method: T,
    params?: Protocol.CommandParameters[T]
  ): Promise<void> {
    await this._forAllSessions(session => session.send(method, params).then());
  }

  private async _forAllSessions(callback: ((session: WKSession) => Promise<void>)): Promise<void> {
    const sessions = [
      this._session
    ];
    // If the state changes during provisional load, push it to the provisional page
    // as well to always be in sync with the backend.
    if (this._provisionalPage)
      sessions.push(this._provisionalPage._session);
    await Promise.all(sessions.map(session => callback(session).catch(e => {})));
  }

  private _onWillCheckNavigationPolicy(frameId: string) {
    // It may happen that new policy check occurs while there is an ongoing
    // provisional load, in this case it should be safe to ignore it as it will
    // either:
    // - end up canceled, e.g. ctrl+click opening link in new tab, having no effect
    //   on this page
    // - start new provisional load which we will miss in our signal trackers but
    //   we certainly won't hang waiting for it to finish and there is high chance
    //   that the current provisional page will commit navigation canceling the new
    //   one.
    if (this._provisionalPage)
      return;
    this._page._frameManager.frameRequestedNavigation(frameId);
  }

  private _onDidCheckNavigationPolicy(frameId: string, cancel?: boolean) {
    if (!cancel)
      return;
    // This is a cross-process navigation that is canceled in the original page and continues in
    // the provisional page. Bail out as we are tracking it.
    if (this._provisionalPage)
      return;
    this._page._frameManager.frameAbortedNavigation(frameId, 'Navigation canceled by policy check');
  }

  private _onFrameScheduledNavigation(frameId: string) {
    this._page._frameManager.frameRequestedNavigation(frameId);
  }

  private _onFrameStoppedLoading(frameId: string) {
    this._page._frameManager.frameStoppedLoading(frameId);
  }

  private _onLifecycleEvent(frameId: string, event: types.LifecycleEvent) {
    this._page._frameManager.frameLifecycleEvent(frameId, event);
  }

  private _handleFrameTree(frameTree: Protocol.Page.FrameResourceTree) {
    this._onFrameAttached(frameTree.frame.id, frameTree.frame.parentId || null);
    this._onFrameNavigated(frameTree.frame, true);
    this._page._frameManager.frameLifecycleEvent(frameTree.frame.id, 'domcontentloaded');
    this._page._frameManager.frameLifecycleEvent(frameTree.frame.id, 'load');

    if (!frameTree.childFrames)
      return;
    for (const child of frameTree.childFrames)
      this._handleFrameTree(child);
  }

  _onFrameAttached(frameId: string, parentFrameId: string | null): frames.Frame {
    return this._page._frameManager.frameAttached(frameId, parentFrameId);
  }

  private _onFrameNavigated(framePayload: Protocol.Page.Frame, initial: boolean) {
    const frame = this._page._frameManager.frame(framePayload.id);
    assert(frame);
    this._removeContextsForFrame(frame, true);
    if (!framePayload.parentId)
      this._workers.clear();
    this._page._frameManager.frameCommittedNewDocumentNavigation(framePayload.id, framePayload.url, framePayload.name || '', framePayload.loaderId, initial);
    if (!initial)
      this._firstNonInitialNavigationCommittedFulfill();
  }

  private _onFrameNavigatedWithinDocument(frameId: string, url: string) {
    this._page._frameManager.frameCommittedSameDocumentNavigation(frameId, url);
  }

  private _onFrameDetached(frameId: string) {
    this._page._frameManager.frameDetached(frameId);
  }

  private _removeContextsForFrame(frame: frames.Frame, notifyFrame: boolean) {
    for (const [contextId, context] of this._contextIdToContext) {
      if (context.frame === frame) {
        this._contextIdToContext.delete(contextId);
        if (notifyFrame)
          frame._contextDestroyed(context);
      }
    }
  }

  private _onExecutionContextCreated(contextPayload: Protocol.Runtime.ExecutionContextDescription) {
    if (this._contextIdToContext.has(contextPayload.id))
      return;
    const frame = this._page._frameManager.frame(contextPayload.frameId);
    if (!frame)
      return;
    const delegate = new WKExecutionContext(this._session, contextPayload.id);
    let worldName: types.World|null = null;
    if (contextPayload.type === 'normal')
      worldName = 'main';
    else if (contextPayload.type === 'user' && contextPayload.name === UTILITY_WORLD_NAME)
      worldName = 'utility';
    const context = new dom.FrameExecutionContext(delegate, frame, worldName);
    (context as any)[contextDelegateSymbol] = delegate;
    if (worldName)
      frame._contextCreated(worldName, context);
    if (contextPayload.type === 'normal' && frame === this._page.mainFrame())
      this._mainFrameContextId = contextPayload.id;
    this._contextIdToContext.set(contextPayload.id, context);
  }

  async navigateFrame(frame: frames.Frame, url: string, referrer: string | undefined): Promise<frames.GotoResult> {
    if (this._pageProxySession.isDisposed())
      throw new Error('Target closed');
    const pageProxyId = this._pageProxySession.sessionId;
    const result = await this._pageProxySession.connection.browserSession.send('Playwright.navigate', { url, pageProxyId, frameId: frame._id, referrer });
    return { newDocumentId: result.loaderId };
  }

  private _onConsoleMessage(event: Protocol.Console.messageAddedPayload) {
    // Note: do no introduce await in this function, otherwise we lose the ordering.
    // For example, frame.setContent relies on this.
    const { type, level, text, parameters, url, line: lineNumber, column: columnNumber, source } = event.message;
    if (level === 'debug' && parameters && parameters[0].value === BINDING_CALL_MESSAGE) {
      const parsedObjectId = JSON.parse(parameters[1].objectId!);
      this.pageOrError().then(pageOrError => {
        const context = this._contextIdToContext.get(parsedObjectId.injectedScriptId);
        if (!(pageOrError instanceof Error) && context)
          this._page._onBindingCalled(parameters[2].value, context);
      });
      return;
    }
    if (level === 'error' && source === 'javascript') {
      const { name, message } = splitErrorMessage(text);

      let stack: string;
      if (event.message.stackTrace) {
        stack = text + '\n' + event.message.stackTrace.map(callFrame => {
          return `    at ${callFrame.functionName || 'unknown'} (${callFrame.url}:${callFrame.lineNumber}:${callFrame.columnNumber})`;
        }).join('\n');
      } else {
        stack = '';
      }

      const error = new Error(message);
      error.stack = stack;
      error.name = name;

      this._page.firePageError(error);
      return;
    }

    let derivedType: string = type || '';
    if (type === 'log')
      derivedType = level;
    else if (type === 'timing')
      derivedType = 'timeEnd';

    const handles: JSHandle[] = [];
    for (const p of parameters || []) {
      let context: dom.FrameExecutionContext | undefined;
      if (p.objectId) {
        const objectId = JSON.parse(p.objectId);
        context = this._contextIdToContext.get(objectId.injectedScriptId);
      } else {
        context = this._contextIdToContext.get(this._mainFrameContextId!);
      }
      if (!context)
        return;
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
        columnNumber: (columnNumber || 1) - 1,
      }
    };
    this._onConsoleRepeatCountUpdated({ count: 1 });
  }

  _onConsoleRepeatCountUpdated(event: Protocol.Console.messageRepeatCountUpdatedPayload) {
    if (this._lastConsoleMessage) {
      const {
        derivedType,
        text,
        handles,
        count,
        location
      } = this._lastConsoleMessage;
      for (let i = count; i < event.count; ++i)
        this._page._addConsoleMessage(derivedType, handles, location, handles.length ? undefined : text);
      this._lastConsoleMessage.count = event.count;
    }
  }

  _onDialog(event: Protocol.Dialog.javascriptDialogOpeningPayload) {
    this._page.emit(Page.Events.Dialog, new dialog.Dialog(
        this._page,
        event.type as dialog.DialogType,
        event.message,
        async (accept: boolean, promptText?: string) => {
          await this._pageProxySession.send('Dialog.handleJavaScriptDialog', { accept, promptText });
        },
        event.defaultPrompt));
  }

  private async _onFileChooserOpened(event: {frameId: Protocol.Network.FrameId, element: Protocol.Runtime.RemoteObject}) {
    let handle;
    try {
      const context = await this._page._frameManager.frame(event.frameId)!._mainContext();
      handle = context.createHandle(event.element).asElement()!;
    } catch (e) {
      // During async processing, frame/context may go away. We should not throw.
      return;
    }
    await this._page._onFileChooserOpened(handle);
  }

  private static async _setEmulateMedia(session: WKSession, mediaType: types.MediaType | null, colorScheme: types.ColorScheme | null, reducedMotion: types.ReducedMotion | null): Promise<void> {
    const promises = [];
    promises.push(session.send('Page.setEmulatedMedia', { media: mediaType || '' }));
    let appearance: any = undefined;
    switch (colorScheme) {
      case 'light': appearance = 'Light'; break;
      case 'dark': appearance = 'Dark'; break;
    }
    promises.push(session.send('Page.setForcedAppearance', { appearance }));
    let reducedMotionWk: any = undefined;
    switch (reducedMotion) {
      case 'reduce': reducedMotionWk = 'Reduce'; break;
      case 'no-preference': reducedMotionWk = 'NoPreference'; break;
    }
    promises.push(session.send('Page.setForcedReducedMotion', { reducedMotion: reducedMotionWk }));
    await Promise.all(promises);
  }

  async updateExtraHTTPHeaders(): Promise<void> {
    await this._updateState('Network.setExtraHTTPHeaders', { headers: headersArrayToObject(this._calculateExtraHTTPHeaders(), false /* lowerCase */) });
  }

  _calculateExtraHTTPHeaders(): types.HeadersArray {
    const locale = this._browserContext._options.locale;
    const headers = network.mergeHeaders([
      this._browserContext._options.extraHTTPHeaders,
      this._page._state.extraHTTPHeaders,
      locale ? network.singleHeader('Accept-Language', locale) : undefined,
    ]);
    return headers;
  }

  async updateEmulateMedia(): Promise<void> {
    const colorScheme = this._page._state.colorScheme;
    const reducedMotion = this._page._state.reducedMotion;
    await this._forAllSessions(session => WKPage._setEmulateMedia(session, this._page._state.mediaType, colorScheme, reducedMotion));
  }

  async setEmulatedSize(emulatedSize: types.EmulatedSize): Promise<void> {
    assert(this._page._state.emulatedSize === emulatedSize);
    await this._updateViewport();
  }

  async bringToFront(): Promise<void> {
    this._pageProxySession.send('Target.activate', {
      targetId: this._session.sessionId
    });
  }

  async _updateViewport(): Promise<void> {
    const options = this._browserContext._options;
    const deviceSize = this._page._state.emulatedSize;
    if (deviceSize === null)
      return;
    const viewportSize = deviceSize.viewport;
    const screenSize = deviceSize.screen;
    const promises: Promise<any>[] = [
      this._pageProxySession.send('Emulation.setDeviceMetricsOverride', {
        width: viewportSize.width,
        height: viewportSize.height,
        fixedLayout: !!options.isMobile,
        deviceScaleFactor: options.deviceScaleFactor || 1
      }),
      this._session.send('Page.setScreenSizeOverride', {
        width: screenSize.width,
        height: screenSize.height,
      }),
    ];
    if (options.isMobile) {
      const angle = viewportSize.width > viewportSize.height ? 90 : 0;
      promises.push(this._session.send('Page.setOrientationOverride', { angle }));
    }
    await Promise.all(promises);
  }

  async updateRequestInterception(): Promise<void> {
    const enabled = this._page._needsRequestInterception();
    await Promise.all([
      this._updateState('Network.setInterceptionEnabled', { enabled }),
      this._updateState('Network.addInterception', { url: '.*', stage: 'request', isRegex: true }),
    ]);
  }

  async updateOffline() {
    await this._updateState('Network.setEmulateOfflineState', { offline: !!this._browserContext._options.offline });
  }

  async updateHttpCredentials() {
    const credentials = this._browserContext._options.httpCredentials || { username: '', password: '' };
    await this._pageProxySession.send('Emulation.setAuthCredentials', { username: credentials.username, password: credentials.password });
  }

  async setFileChooserIntercepted(enabled: boolean) {
    this._interceptingFileChooser = enabled;
    await this._session.send('Page.setInterceptFileChooserDialog', { enabled }).catch(e => {}); // target can be closed.
  }

  async reload(): Promise<void> {
    await this._session.send('Page.reload');
  }

  goBack(): Promise<boolean> {
    return this._session.send('Page.goBack').then(() => true).catch(error => {
      if (error instanceof Error && error.message.includes(`Protocol error (Page.goBack): Failed to go`))
        return false;
      throw error;
    });
  }

  goForward(): Promise<boolean> {
    return this._session.send('Page.goForward').then(() => true).catch(error => {
      if (error instanceof Error && error.message.includes(`Protocol error (Page.goForward): Failed to go`))
        return false;
      throw error;
    });
  }

  async exposeBinding(binding: PageBinding): Promise<void> {
    await this._updateBootstrapScript();
    await this._evaluateBindingScript(binding);
  }

  async removeExposedBindings(): Promise<void> {
    await this._updateBootstrapScript();
  }

  private async _evaluateBindingScript(binding: PageBinding): Promise<void> {
    const script = this._bindingToScript(binding);
    await Promise.all(this._page.frames().map(frame => frame.evaluateExpression(script, false, {}).catch(e => {})));
  }

  async addInitScript(script: string): Promise<void> {
    await this._updateBootstrapScript();
  }

  async removeInitScripts() {
    await this._updateBootstrapScript();
  }

  private _bindingToScript(binding: PageBinding): string {
    return `self.${binding.name} = (param) => console.debug('${BINDING_CALL_MESSAGE}', {}, param); ${binding.source}`;
  }

  private _calculateBootstrapScript(): string {
    const scripts: string[] = [];
    if (!this._page.context()._options.isMobile) {
      scripts.push('delete window.orientation');
      scripts.push('delete window.ondevicemotion');
      scripts.push('delete window.ondeviceorientation');
    }
    for (const binding of this._page.allBindings())
      scripts.push(this._bindingToScript(binding));
    scripts.push(...this._browserContext.initScripts);
    scripts.push(...this._page.initScripts);
    return scripts.join(';\n');
  }

  async _updateBootstrapScript(): Promise<void> {
    await this._updateState('Page.setBootstrapScript', { source: this._calculateBootstrapScript() });
  }

  async closePage(runBeforeUnload: boolean): Promise<void> {
    await this._stopVideo();
    await this._pageProxySession.sendMayFail('Target.close', {
      targetId: this._session.sessionId,
      runBeforeUnload
    });
  }

  async setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void> {
    await this._session.send('Page.setDefaultBackgroundColorOverride', { color });
  }

  private _toolbarHeight(): number {
    if (this._page._browserContext._browser?.options.headful)
      return hostPlatform === 'mac10.15' ? 55 : 59;
    return 0;
  }

  private async _startVideo(options: types.PageScreencastOptions): Promise<void> {
    assert(!this._recordingVideoFile);
    const { screencastId } = await this._pageProxySession.send('Screencast.startVideo', {
      file: options.outputFile,
      width: options.width,
      height: options.height,
      toolbarHeight: this._toolbarHeight()
    });
    this._recordingVideoFile = options.outputFile;
    this._browserContext._browser._videoStarted(this._browserContext, screencastId, options.outputFile, this.pageOrError());
  }

  private async _stopVideo(): Promise<void> {
    if (!this._recordingVideoFile)
      return;
    await this._pageProxySession.sendMayFail('Screencast.stopVideo');
    this._recordingVideoFile = null;
  }

  async takeScreenshot(progress: Progress, format: string, documentRect: types.Rect | undefined, viewportRect: types.Rect | undefined, quality: number | undefined, fitsViewport: boolean, scale: 'css' | 'device'): Promise<Buffer> {
    const rect = (documentRect || viewportRect)!;
    const result = await this._session.send('Page.snapshotRect', { ...rect, coordinateSystem: documentRect ? 'Page' : 'Viewport', omitDeviceScaleFactor: scale === 'css' });
    const prefix = 'data:image/png;base64,';
    let buffer = Buffer.from(result.dataURL.substr(prefix.length), 'base64');
    if (format === 'jpeg')
      buffer = jpegjs.encode(PNG.sync.read(buffer), quality).data;
    return buffer;
  }

  async getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    const nodeInfo = await this._session.send('DOM.describeNode', {
      objectId: handle._objectId
    });
    if (!nodeInfo.contentFrameId)
      return null;
    return this._page._frameManager.frame(nodeInfo.contentFrameId);
  }

  async getOwnerFrame(handle: dom.ElementHandle): Promise<string | null> {
    if (!handle._objectId)
      return null;
    const nodeInfo = await this._session.send('DOM.describeNode', {
      objectId: handle._objectId
    });
    return nodeInfo.ownerFrameId || null;
  }

  isElementHandle(remoteObject: any): boolean {
    return (remoteObject as Protocol.Runtime.RemoteObject).subtype === 'node';
  }

  async getBoundingBox(handle: dom.ElementHandle): Promise<types.Rect | null> {
    const quads = await this.getContentQuads(handle);
    if (!quads || !quads.length)
      return null;
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
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  async scrollRectIntoViewIfNeeded(handle: dom.ElementHandle, rect?: types.Rect): Promise<'error:notvisible' | 'error:notconnected' | 'done'> {
    return await this._session.send('DOM.scrollIntoViewIfNeeded', {
      objectId: handle._objectId,
      rect,
    }).then(() => 'done' as const).catch(e => {
      if (e instanceof Error && e.message.includes('Node does not have a layout object'))
        return 'error:notvisible';
      if (e instanceof Error && e.message.includes('Node is detached from document'))
        return 'error:notconnected';
      throw e;
    });
  }

  async setScreencastOptions(options: { width: number, height: number, quality: number } | null): Promise<void> {
    if (options) {
      const so = { ...options, toolbarHeight: this._toolbarHeight() };
      const { generation } = await this._pageProxySession.send('Screencast.startScreencast', so);
      this._screencastGeneration = generation;
    } else {
      await this._pageProxySession.send('Screencast.stopScreencast');
    }
  }

  private _onScreencastFrame(event: Protocol.Screencast.screencastFramePayload) {
    const generation = this._screencastGeneration;
    this._page.throttleScreencastFrameAck(() => {
      this._pageProxySession.send('Screencast.screencastFrameAck', { generation }).catch(e => debugLogger.log('error', e));
    });
    const buffer = Buffer.from(event.data, 'base64');
    this._page.emit(Page.Events.ScreencastFrame, {
      buffer,
      width: event.deviceWidth,
      height: event.deviceHeight,
    });
  }

  rafCountForStablePosition(): number {
    return process.platform === 'win32' ? 5 : 1;
  }

  async getContentQuads(handle: dom.ElementHandle): Promise<types.Quad[] | null> {
    const result = await this._session.sendMayFail('DOM.getContentQuads', {
      objectId: handle._objectId
    });
    if (!result)
      return null;
    return result.quads.map(quad => [
      { x: quad[0], y: quad[1] },
      { x: quad[2], y: quad[3] },
      { x: quad[4], y: quad[5] },
      { x: quad[6], y: quad[7] }
    ]);
  }

  async setInputFiles(handle: dom.ElementHandle<HTMLInputElement>, files: types.FilePayload[]): Promise<void> {
    const objectId = handle._objectId;
    const protocolFiles = files.map(file => ({
      name: file.name,
      type: file.mimeType,
      data: file.buffer,
    }));
    await this._session.send('DOM.setInputFiles', { objectId, files: protocolFiles });
  }

  async setInputFilePaths(handle: dom.ElementHandle<HTMLInputElement>, paths: string[]): Promise<void> {
    const pageProxyId = this._pageProxySession.sessionId;
    const objectId = handle._objectId;
    await Promise.all([
      this._pageProxySession.connection.browserSession.send('Playwright.grantFileReadAccess', { pageProxyId, paths }),
      this._session.send('DOM.setInputFiles', { objectId, paths })
    ]);
  }

  async adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>> {
    const result = await this._session.sendMayFail('DOM.resolveNode', {
      objectId: handle._objectId,
      executionContextId: ((to as any)[contextDelegateSymbol] as WKExecutionContext)._contextId
    });
    if (!result || result.object.subtype === 'null')
      throw new Error(dom.kUnableToAdoptErrorMessage);
    return to.createHandle(result.object) as dom.ElementHandle<T>;
  }

  async getAccessibilityTree(needle?: dom.ElementHandle): Promise<{tree: accessibility.AXNode, needle: accessibility.AXNode | null}> {
    return getAccessibilityTree(this._session, needle);
  }

  async inputActionEpilogue(): Promise<void> {
  }

  async getFrameElement(frame: frames.Frame): Promise<dom.ElementHandle> {
    const parent = frame.parentFrame();
    if (!parent)
      throw new Error('Frame has been detached.');
    const info = this._page.parseSelector('frame,iframe');
    const handles = await this._page.selectors._queryAll(parent, info);
    const items = await Promise.all(handles.map(async handle => {
      const frame = await handle.contentFrame().catch(e => null);
      return { handle, frame };
    }));
    const result = items.find(item => item.frame === frame);
    items.map(item => item === result ? Promise.resolve() : item.handle.dispose());
    if (!result)
      throw new Error('Frame has been detached.');
    return result.handle;
  }

  _onRequestWillBeSent(session: WKSession, event: Protocol.Network.requestWillBeSentPayload) {
    if (event.request.url.startsWith('data:'))
      return;
    let redirectedFrom: WKInterceptableRequest | null = null;
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
    if (!frame)
      return;

    // TODO(einbinder) this will fail if we are an XHR document request
    const isNavigationRequest = event.type === 'Document';
    const documentId = isNavigationRequest ? event.loaderId : undefined;
    let route = null;
    // We do not support intercepting redirects.
    if (this._page._needsRequestInterception() && !redirectedFrom)
      route = new WKRouteImpl(session, event.requestId);
    const request = new WKInterceptableRequest(session, route, frame, event, redirectedFrom, documentId);
    this._requestIdToRequest.set(event.requestId, request);
    this._page._frameManager.requestStarted(request.request, route || undefined);
  }

  private _handleRequestRedirect(request: WKInterceptableRequest, responsePayload: Protocol.Network.Response, timestamp: number) {
    const response = request.createResponse(responsePayload);
    response._securityDetailsFinished();
    response._serverAddrFinished();
    response._requestFinished(responsePayload.timing ? helper.secondsToRoundishMillis(timestamp - request._timestamp) : -1);
    this._requestIdToRequest.delete(request._requestId);
    this._page._frameManager.requestReceivedResponse(response);
    this._page._frameManager.reportRequestFinished(request.request, response);
  }

  _onRequestIntercepted(session: WKSession, event: Protocol.Network.requestInterceptedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    if (!request) {
      session.sendMayFail('Network.interceptRequestWithError', { errorType: 'Cancellation', requestId: event.requestId });
      return;
    }
    if (!request._route) {
      // Intercepted, although we do not intend to allow interception.
      // Just continue.
      session.sendMayFail('Network.interceptWithRequest', { requestId: request._requestId });
    } else {
      request._route._requestInterceptedPromise.resolve();
    }
  }

  _onResponseReceived(event: Protocol.Network.responseReceivedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    // FileUpload sends a response without a matching request.
    if (!request)
      return;
    this._requestIdToResponseReceivedPayloadEvent.set(request._requestId, event);
    const response = request.createResponse(event.response);
    if (event.response.requestHeaders && Object.keys(event.response.requestHeaders).length) {
      const headers = { ...event.response.requestHeaders };
      if (!headers['host'])
        headers['Host'] = new URL(request.request.url()).host;
      request.request.setRawRequestHeaders(headersObjectToArray(headers));
    }
    this._page._frameManager.requestReceivedResponse(response);

    if (response.status() === 204) {
      this._onLoadingFailed({
        requestId: event.requestId,
        errorText: 'Aborted: 204 No Content',
        timestamp: event.timestamp
      });
    }
  }

  _onLoadingFinished(event: Protocol.Network.loadingFinishedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    // For certain requestIds we never receive requestWillBeSent event.
    // @see https://crbug.com/750469
    if (!request)
      return;

    // Under certain conditions we never get the Network.responseReceived
    // event from protocol. @see https://crbug.com/883475
    const response = request.request._existingResponse();
    if (response) {
      const responseReceivedPayload = this._requestIdToResponseReceivedPayloadEvent.get(request._requestId);
      response._serverAddrFinished(parseRemoteAddress(event?.metrics?.remoteAddress));
      response._securityDetailsFinished({
        protocol: isLoadedSecurely(response.url(), response.timing()) ? event.metrics?.securityConnection?.protocol : undefined,
        subjectName: responseReceivedPayload?.response.security?.certificate?.subject,
        validFrom: responseReceivedPayload?.response.security?.certificate?.validFrom,
        validTo: responseReceivedPayload?.response.security?.certificate?.validUntil,
      });
      if (event.metrics?.protocol)
        response._setHttpVersion(event.metrics.protocol);
      if (event.metrics?.responseBodyBytesReceived)
        request.request.responseSize.encodedBodySize = event.metrics.responseBodyBytesReceived;
      if (event.metrics?.responseHeaderBytesReceived)
        request.request.responseSize.responseHeadersSize = event.metrics.responseHeaderBytesReceived;

      response._requestFinished(helper.secondsToRoundishMillis(event.timestamp - request._timestamp));
    }

    this._requestIdToResponseReceivedPayloadEvent.delete(request._requestId);
    this._requestIdToRequest.delete(request._requestId);
    this._page._frameManager.reportRequestFinished(request.request, response);
  }

  _onLoadingFailed(event: Protocol.Network.loadingFailedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    // For certain requestIds we never receive requestWillBeSent event.
    // @see https://crbug.com/750469
    if (!request)
      return;
    const response = request.request._existingResponse();
    if (response) {
      response._serverAddrFinished();
      response._securityDetailsFinished();
      response._requestFinished(helper.secondsToRoundishMillis(event.timestamp - request._timestamp));
    }
    this._requestIdToRequest.delete(request._requestId);
    request.request._setFailureText(event.errorText);
    this._page._frameManager.requestFailed(request.request, event.errorText.includes('cancelled'));
  }

  async _grantPermissions(origin: string, permissions: string[]) {
    const webPermissionToProtocol = new Map<string, string>([
      ['geolocation', 'geolocation'],
    ]);
    const filtered = permissions.map(permission => {
      const protocolPermission = webPermissionToProtocol.get(permission);
      if (!protocolPermission)
        throw new Error('Unknown permission: ' + permission);
      return protocolPermission;
    });
    await this._pageProxySession.send('Emulation.grantPermissions', { origin, permissions: filtered });
  }

  async _clearPermissions() {
    await this._pageProxySession.send('Emulation.resetPermissions', {});
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
function parseRemoteAddress(value?: string) {
  if (!value)
    return;

  try {
    const colon = value.lastIndexOf(':');
    const dot = value.lastIndexOf('.');
    if (dot < 0) { // IPv6ish:port
      return {
        ipAddress: `[${value.slice(0, colon)}]`,
        port: +value.slice(colon + 1)
      };
    }

    if (colon > dot) { // IPv4:port
      const [address, port] = value.split(':');
      return {
        ipAddress: address,
        port: +port,
      };
    } else { // IPv6ish.port
      const [address, port] = value.split('.');
      return {
        ipAddress: `[${address}]`,
        port: +port,
      };
    }
  } catch (_) {}
}


/**
 * Adapted from Source/WebInspectorUI/UserInterface/Models/Resource.js in
 * WebKit codebase.
 */
function isLoadedSecurely(url: string, timing: network.ResourceTiming) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'wss:' && u.protocol !== 'sftp:')
      return false;
    if (timing.secureConnectionStart === -1 && timing.connectStart !== -1)
      return false;
    return true;
  } catch (_) {}
}

const contextDelegateSymbol = Symbol('delegate');
