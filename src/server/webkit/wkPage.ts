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

import * as jpeg from 'jpeg-js';
import * as path from 'path';
import * as png from 'pngjs';
import { assert, createGuid, debugAssert, headersArrayToObject } from '../../utils/utils';
import * as accessibility from '../accessibility';
import * as dialog from '../dialog';
import * as dom from '../dom';
import * as frames from '../frames';
import { helper, RegisteredListener } from '../helper';
import { JSHandle } from '../javascript';
import * as network from '../network';
import { Page, PageBinding, PageDelegate } from '../page';
import * as types from '../types';
import { Protocol } from './protocol';
import { getAccessibilityTree } from './wkAccessibility';
import { WKBrowserContext } from './wkBrowser';
import { WKSession } from './wkConnection';
import { WKExecutionContext } from './wkExecutionContext';
import { RawKeyboardImpl, RawMouseImpl } from './wkInput';
import { WKInterceptableRequest } from './wkInterceptableRequest';
import { WKProvisionalPage } from './wkProvisionalPage';
import { WKWorkers } from './wkWorkers';

const UTILITY_WORLD_NAME = '__playwright_utility_world__';
const BINDING_CALL_MESSAGE = '__playwright_binding_call__';

export class WKPage implements PageDelegate {
  readonly rawMouse: RawMouseImpl;
  readonly rawKeyboard: RawKeyboardImpl;
  _session: WKSession;
  private _provisionalPage: WKProvisionalPage | null = null;
  readonly _page: Page;
  private readonly _pagePromise: Promise<Page | Error>;
  private _pagePromiseCallback: (page: Page | Error) => void = () => {};
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

  // Holds window features for the next popup being opened via window.open,
  // until the popup page proxy arrives.
  private _nextWindowOpenPopupFeatures?: string[];
  private _recordingVideoFile: string | null = null;

  constructor(browserContext: WKBrowserContext, pageProxySession: WKSession, opener: WKPage | null) {
    this._pageProxySession = pageProxySession;
    this._opener = opener;
    this.rawKeyboard = new RawKeyboardImpl(pageProxySession);
    this.rawMouse = new RawMouseImpl(pageProxySession);
    this._contextIdToContext = new Map();
    this._page = new Page(this, browserContext);
    this._workers = new WKWorkers(this._page);
    this._session = undefined as any as WKSession;
    this._browserContext = browserContext;
    this._page.on(Page.Events.FrameDetached, (frame: frames.Frame) => this._removeContextsForFrame(frame, false));
    this._eventListeners = [
      helper.addEventListener(this._pageProxySession, 'Target.targetCreated', this._onTargetCreated.bind(this)),
      helper.addEventListener(this._pageProxySession, 'Target.targetDestroyed', this._onTargetDestroyed.bind(this)),
      helper.addEventListener(this._pageProxySession, 'Target.dispatchMessageFromTarget', this._onDispatchMessageFromTarget.bind(this)),
      helper.addEventListener(this._pageProxySession, 'Target.didCommitProvisionalTarget', this._onDidCommitProvisionalTarget.bind(this)),
    ];
    this._pagePromise = new Promise(f => this._pagePromiseCallback = f);
    this._firstNonInitialNavigationCommittedPromise = new Promise((f, r) => {
      this._firstNonInitialNavigationCommittedFulfill = f;
      this._firstNonInitialNavigationCommittedReject = r;
    });
    if (opener && !browserContext._options.noDefaultViewport && opener._nextWindowOpenPopupFeatures) {
      const viewportSize = helper.getViewportSizeFromWindowFeatures(opener._nextWindowOpenPopupFeatures);
      opener._nextWindowOpenPopupFeatures = undefined;
      if (viewportSize)
        this._page._state.viewportSize = viewportSize;
    }
  }

  private async _initializePageProxySession() {
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
        this._grantPermissions(key, value);
    }
    if (this._browserContext._options.videosPath) {
      const size = this._browserContext._options.videoSize || this._browserContext._options.viewport || { width: 1280, height: 720 };
      const outputFile = path.join(this._browserContext._options.videosPath, createGuid() + '.webm');
      promises.push(this._browserContext._ensureVideosPath().then(() => {
        return this.startScreencast({
          ...size,
          outputFile,
        });
      }));
    }
    await Promise.all(promises);
  }

  private _setSession(session: WKSession) {
    helper.removeEventListeners(this._sessionListeners);
    this._session = session;
    this.rawKeyboard.setSession(session);
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

    const contextOptions = this._browserContext._options;
    if (contextOptions.userAgent)
      promises.push(session.send('Page.overrideUserAgent', { value: contextOptions.userAgent }));
    if (this._page._state.mediaType || this._page._state.colorScheme)
      promises.push(WKPage._setEmulateMedia(session, this._page._state.mediaType, this._page._state.colorScheme));
    promises.push(session.send('Page.setBootstrapScript', { source: this._calculateBootstrapScript() }));
    for (const binding of this._browserContext._pageBindings.values())
      promises.push(this._evaluateBindingScript(binding));
    if (contextOptions.bypassCSP)
      promises.push(session.send('Page.setBypassCSP', { enabled: true }));
    if (this._page._state.viewportSize) {
      promises.push(session.send('Page.setScreenSizeOverride', {
        width: this._page._state.viewportSize.width,
        height: this._page._state.viewportSize.height,
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
    await Promise.all(promises);
  }

  private _onDidCommitProvisionalTarget(event: Protocol.Target.didCommitProvisionalTargetPayload) {
    const { oldTargetId, newTargetId } = event;
    assert(this._provisionalPage);
    assert(this._provisionalPage._session.sessionId === newTargetId, 'Unknown new target: ' + newTargetId);
    assert(this._session.sessionId === oldTargetId, 'Unknown old target: ' + oldTargetId);
    this._session.errorText = 'Target was swapped out.';
    const newSession = this._provisionalPage._session;
    this._provisionalPage.commit();
    this._provisionalPage.dispose();
    this._provisionalPage = null;
    this._setSession(newSession);
  }

  private _onTargetDestroyed(event: Protocol.Target.targetDestroyedPayload) {
    const { targetId, crashed } = event;
    if (this._provisionalPage && this._provisionalPage._session.sessionId === targetId) {
      this._provisionalPage._session.dispose();
      this._provisionalPage.dispose();
      this._provisionalPage = null;
    } else if (this._session.sessionId === targetId) {
      this._session.dispose();
      helper.removeEventListeners(this._sessionListeners);
      if (crashed) {
        this._session.markAsCrashed();
        this._page._didCrash();
      }
    }
  }

  didClose() {
    this._page._didClose();
  }

  dispose() {
    this._pageProxySession.dispose();
    helper.removeEventListeners(this._sessionListeners);
    helper.removeEventListeners(this._eventListeners);
    if (this._session)
      this._session.dispose();
    if (this._provisionalPage) {
      this._provisionalPage._session.dispose();
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
    const session = new WKSession(this._pageProxySession.connection, targetInfo.targetId, `The ${targetInfo.type} has been closed.`, (message: any) => {
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
          this._initializeSession(session, false, ({frameTree}) => this._handleFrameTree(frameTree)),
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
      this._initializedPage = pageOrError instanceof Page ? pageOrError : null;
      this._pagePromiseCallback(pageOrError);
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
    // TODO: remove Page.willRequestOpenWindow and Page.didRequestOpenWindow from the protocol.
    this._sessionListeners = [
      helper.addEventListener(this._session, 'Page.frameNavigated', event => this._onFrameNavigated(event.frame, false)),
      helper.addEventListener(this._session, 'Page.navigatedWithinDocument', event => this._onFrameNavigatedWithinDocument(event.frameId, event.url)),
      helper.addEventListener(this._session, 'Page.frameAttached', event => this._onFrameAttached(event.frameId, event.parentFrameId)),
      helper.addEventListener(this._session, 'Page.frameDetached', event => this._onFrameDetached(event.frameId)),
      helper.addEventListener(this._session, 'Page.frameScheduledNavigation', event => this._onFrameScheduledNavigation(event.frameId)),
      helper.addEventListener(this._session, 'Page.frameStoppedLoading', event => this._onFrameStoppedLoading(event.frameId)),
      helper.addEventListener(this._session, 'Page.loadEventFired', event => this._onLifecycleEvent(event.frameId, 'load')),
      helper.addEventListener(this._session, 'Page.domContentEventFired', event => this._onLifecycleEvent(event.frameId, 'domcontentloaded')),
      helper.addEventListener(this._session, 'Runtime.executionContextCreated', event => this._onExecutionContextCreated(event.context)),
      helper.addEventListener(this._session, 'Console.messageAdded', event => this._onConsoleMessage(event)),
      helper.addEventListener(this._session, 'Console.messageRepeatCountUpdated', event => this._onConsoleRepeatCountUpdated(event)),
      helper.addEventListener(this._pageProxySession, 'Dialog.javascriptDialogOpening', event => this._onDialog(event)),
      helper.addEventListener(this._session, 'Page.fileChooserOpened', event => this._onFileChooserOpened(event)),
      helper.addEventListener(this._session, 'Network.requestWillBeSent', e => this._onRequestWillBeSent(this._session, e)),
      helper.addEventListener(this._session, 'Network.requestIntercepted', e => this._onRequestIntercepted(e)),
      helper.addEventListener(this._session, 'Network.responseReceived', e => this._onResponseReceived(e)),
      helper.addEventListener(this._session, 'Network.loadingFinished', e => this._onLoadingFinished(e)),
      helper.addEventListener(this._session, 'Network.loadingFailed', e => this._onLoadingFailed(e)),
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
        (context._delegate as WKExecutionContext)._dispose();
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
    const context = new dom.FrameExecutionContext(delegate, frame);
    if (contextPayload.type === 'normal')
      frame._contextCreated('main', context);
    else if (contextPayload.type === 'user' && contextPayload.name === UTILITY_WORLD_NAME)
      frame._contextCreated('utility', context);
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
      const context = this._contextIdToContext.get(parsedObjectId.injectedScriptId)!;
      this.pageOrError().then(pageOrError => {
        if (!(pageOrError instanceof Error))
          this._page._onBindingCalled(parameters[2].value, context);
      });
      return;
    }
    if (level === 'error' && source === 'javascript') {
      const message = text.startsWith('Error: ') ? text.substring(7) : text;
      const error = new Error(message);
      if (event.message.stackTrace) {
        error.stack = event.message.stackTrace.map(callFrame => {
          return `${callFrame.functionName}@${callFrame.url}:${callFrame.lineNumber}:${callFrame.columnNumber}`;
        }).join('\n');
      } else {
        error.stack = '';
      }
      this._page.emit(Page.Events.PageError, error);
      return;
    }

    let derivedType: string = type || '';
    if (type === 'log')
      derivedType = level;
    else if (type === 'timing')
      derivedType = 'timeEnd';

    const handles = (parameters || []).map(p => {
      let context: dom.FrameExecutionContext | null = null;
      if (p.objectId) {
        const objectId = JSON.parse(p.objectId);
        context = this._contextIdToContext.get(objectId.injectedScriptId)!;
      } else {
        context = this._contextIdToContext.get(this._mainFrameContextId!)!;
      }
      return context.createHandle(p);
    });
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
    this._onConsoleRepeatCountUpdated({ count: 1});
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
        event.type as dialog.DialogType,
        event.message,
        async (accept: boolean, promptText?: string) => {
          await this._pageProxySession.send('Dialog.handleJavaScriptDialog', { accept, promptText });
        },
        event.defaultPrompt));
  }

  private async _onFileChooserOpened(event: {frameId: Protocol.Network.FrameId, element: Protocol.Runtime.RemoteObject}) {
    const context = await this._page._frameManager.frame(event.frameId)!._mainContext();
    const handle = context.createHandle(event.element).asElement()!;
    this._page._onFileChooserOpened(handle);
  }

  private static async _setEmulateMedia(session: WKSession, mediaType: types.MediaType | null, colorScheme: types.ColorScheme | null): Promise<void> {
    const promises = [];
    promises.push(session.send('Page.setEmulatedMedia', { media: mediaType || '' }));
    if (colorScheme !== null) {
      let appearance: any = '';
      switch (colorScheme) {
        case 'light': appearance = 'Light'; break;
        case 'dark': appearance = 'Dark'; break;
      }
      promises.push(session.send('Page.setForcedAppearance', { appearance }));
    }
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
    const colorScheme = this._page._state.colorScheme || this._browserContext._options.colorScheme || 'light';
    await this._forAllSessions(session => WKPage._setEmulateMedia(session, this._page._state.mediaType, colorScheme));
  }

  async setViewportSize(viewportSize: types.Size): Promise<void> {
    assert(this._page._state.viewportSize === viewportSize);
    await this._updateViewport();
  }

  async bringToFront(): Promise<void> {
    this._pageProxySession.send('Target.activate', {
      targetId: this._session.sessionId
    });
  }

  async _updateViewport(): Promise<void> {
    const options = this._browserContext._options;
    const viewportSize = this._page._state.viewportSize;
    if (viewportSize === null)
      return;
    const promises: Promise<any>[] = [
      this._pageProxySession.send('Emulation.setDeviceMetricsOverride', {
        width: viewportSize.width,
        height: viewportSize.height,
        fixedLayout: !!options.isMobile,
        deviceScaleFactor: options.deviceScaleFactor || 1
      }),
      this._session.send('Page.setScreenSizeOverride', {
        width: viewportSize.width,
        height: viewportSize.height,
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
      this._updateState('Network.addInterception', { url: '.*', stage: 'request', isRegex: true })
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
    await this._session.send('Page.setInterceptFileChooserDialog', { enabled }).catch(e => {}); // target can be closed.
  }

  async opener(): Promise<Page | null> {
    if (!this._opener)
      return null;
    const openerPage = await this._opener.pageOrError();
    if (openerPage instanceof Page && !openerPage.isClosed())
      return openerPage;
    return null;
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

  private async _evaluateBindingScript(binding: PageBinding): Promise<void> {
    const script = this._bindingToScript(binding);
    await Promise.all(this._page.frames().map(frame => frame._evaluateExpression(script, false, {}).catch(e => {})));
  }

  async evaluateOnNewDocument(script: string): Promise<void> {
    await this._updateBootstrapScript();
  }

  private _bindingToScript(binding: PageBinding): string {
    return `self.${binding.name} = (param) => console.debug('${BINDING_CALL_MESSAGE}', {}, param); ${binding.source}`;
  }

  private _calculateBootstrapScript(): string {
    const scripts: string[] = [];
    for (const binding of this._browserContext._pageBindings.values())
      scripts.push(this._bindingToScript(binding));
    for (const binding of this._page._pageBindings.values())
      scripts.push(this._bindingToScript(binding));
    scripts.push(...this._browserContext._evaluateOnNewDocumentSources);
    scripts.push(...this._page._evaluateOnNewDocumentSources);
    return scripts.join(';');
  }

  async _updateBootstrapScript(): Promise<void> {
    await this._updateState('Page.setBootstrapScript', { source: this._calculateBootstrapScript() });
  }

  async closePage(runBeforeUnload: boolean): Promise<void> {
    if (this._recordingVideoFile)
      await this.stopScreencast();
    await this._pageProxySession.sendMayFail('Target.close', {
      targetId: this._session.sessionId,
      runBeforeUnload
    });
  }

  canScreenshotOutsideViewport(): boolean {
    return true;
  }

  async setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void> {
    await this._session.send('Page.setDefaultBackgroundColorOverride', { color });
  }

  async startScreencast(options: types.PageScreencastOptions): Promise<void> {
    if (this._recordingVideoFile)
      throw new Error('Already recording');
    this._recordingVideoFile = options.outputFile;
    try {
      const {screencastId} = await this._pageProxySession.send('Screencast.start', {
        file: options.outputFile,
        width: options.width,
        height: options.height,
      }) as any;
      this._browserContext._browser._videoStarted(this._browserContext, screencastId, options.outputFile, this.pageOrError());
    } catch (e) {
      this._recordingVideoFile = null;
      throw e;
    }
  }

  async stopScreencast(): Promise<void> {
    if (!this._recordingVideoFile)
      throw new Error('No video recording in progress');
    this._recordingVideoFile = null;
    await this._pageProxySession.send('Screencast.stop');
  }

  async takeScreenshot(format: string, documentRect: types.Rect | undefined, viewportRect: types.Rect | undefined, quality: number | undefined): Promise<Buffer> {
    const rect = (documentRect || viewportRect)!;
    const result = await this._session.send('Page.snapshotRect', { ...rect, coordinateSystem: documentRect ? 'Page' : 'Viewport' });
    const prefix = 'data:image/png;base64,';
    let buffer = Buffer.from(result.dataURL.substr(prefix.length), 'base64');
    if (format === 'jpeg')
      buffer = jpeg.encode(png.PNG.sync.read(buffer), quality).data;
    return buffer;
  }

  async resetViewport(): Promise<void> {
    assert(false, 'Should not be called');
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

  async adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>> {
    const result = await this._session.sendMayFail('DOM.resolveNode', {
      objectId: handle._objectId,
      executionContextId: (to._delegate as WKExecutionContext)._contextId
    });
    if (!result || result.object.subtype === 'null')
      throw new Error('Unable to adopt element handle from a different document');
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
    const handles = await this._page.selectors._queryAll(parent, 'iframe', undefined);
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
    let redirectedFrom: network.Request | null = null;
    if (event.redirectResponse) {
      const request = this._requestIdToRequest.get(event.requestId);
      // If we connect late to the target, we could have missed the requestWillBeSent event.
      if (request) {
        this._handleRequestRedirect(request, event.redirectResponse);
        redirectedFrom = request.request;
      }
    }
    const frame = this._page._frameManager.frame(event.frameId)!;
    // TODO(einbinder) this will fail if we are an XHR document request
    const isNavigationRequest = event.type === 'Document';
    const documentId = isNavigationRequest ? event.loaderId : undefined;
    // We do not support intercepting redirects.
    const allowInterception = this._page._needsRequestInterception() && !redirectedFrom;
    const request = new WKInterceptableRequest(session, allowInterception, frame, event, redirectedFrom, documentId);
    this._requestIdToRequest.set(event.requestId, request);
    this._page._frameManager.requestStarted(request.request);
  }

  private _handleRequestRedirect(request: WKInterceptableRequest, responsePayload: Protocol.Network.Response) {
    const response = request.createResponse(responsePayload);
    response._requestFinished('Response body is unavailable for redirect responses');
    this._requestIdToRequest.delete(request._requestId);
    this._page._frameManager.requestReceivedResponse(response);
    this._page._frameManager.requestFinished(request.request);
  }

  _onRequestIntercepted(event: Protocol.Network.requestInterceptedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    if (!request)
      return;
    if (!request._allowInterception) {
      // Intercepted, although we do not intend to allow interception.
      // Just continue.
      this._session.sendMayFail('Network.interceptWithRequest', { requestId: request._requestId });
    } else {
      request._interceptedCallback();
    }
  }

  _onResponseReceived(event: Protocol.Network.responseReceivedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    // FileUpload sends a response without a matching request.
    if (!request)
      return;
    const response = request.createResponse(event.response);
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
    if (response)
      response._requestFinished();
    this._requestIdToRequest.delete(request._requestId);
    this._page._frameManager.requestFinished(request.request);
  }

  _onLoadingFailed(event: Protocol.Network.loadingFailedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    // For certain requestIds we never receive requestWillBeSent event.
    // @see https://crbug.com/750469
    if (!request)
      return;
    const response = request.request._existingResponse();
    if (response)
      response._requestFinished();
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
