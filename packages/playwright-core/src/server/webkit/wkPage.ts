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

import { assert } from '../../utils';
import { headersArrayToObject } from '../../utils/isomorphic/headers';
import { createGuid } from '../utils/crypto';
import { eventsHelper } from '../utils/eventsHelper';
import { hostPlatform } from '../utils/hostPlatform';
import { splitErrorMessage } from '../../utils/isomorphic/stackTrace';
import { PNG, jpegjs } from '../../utilsBundle';
import { BrowserContext } from '../browserContext';
import * as dialog from '../dialog';
import * as dom from '../dom';
import { TargetClosedError } from '../errors';
import { helper } from '../helper';
import * as network from '../network';
import { Page, PageBinding } from '../page';
import { getAccessibilityTree } from './wkAccessibility';
import { WKSession } from './wkConnection';
import { createHandle, WKExecutionContext } from './wkExecutionContext';
import { RawKeyboardImpl, RawMouseImpl, RawTouchscreenImpl } from './wkInput';
import { WKInterceptableRequest, WKRouteImpl } from './wkInterceptableRequest';
import { WKProvisionalPage } from './wkProvisionalPage';
import { WKWorkers } from './wkWorkers';
import { debugLogger } from '../utils/debugLogger';

import type { Protocol } from './protocol';
import type { WKBrowserContext } from './wkBrowser';
import type { RegisteredListener } from '../utils/eventsHelper';
import type * as accessibility from '../accessibility';
import type * as frames from '../frames';
import type { JSHandle } from '../javascript';
import type { InitScript, PageDelegate } from '../page';
import type { Progress } from '../progress';
import type * as types from '../types';

const UTILITY_WORLD_NAME = '__playwright_utility_world__';

export class WKPage implements PageDelegate {
  readonly rawMouse: RawMouseImpl;
  readonly rawKeyboard: RawKeyboardImpl;
  readonly rawTouchscreen: RawTouchscreenImpl;
  _session: WKSession;
  private _provisionalPage: WKProvisionalPage | null = null;
  readonly _page: Page;
  private readonly _pageProxySession: WKSession;
  readonly _opener: WKPage | null;
  private readonly _requestIdToRequest = new Map<string, WKInterceptableRequest>();
  private readonly _requestIdToRequestWillBeSentEvent = new Map<string, Protocol.Network.requestWillBeSentPayload>();
  private readonly _workers: WKWorkers;
  private readonly _contextIdToContext: Map<number, dom.FrameExecutionContext>;
  private _sessionListeners: RegisteredListener[] = [];
  private _eventListeners: RegisteredListener[];
  readonly _browserContext: WKBrowserContext;
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
        this._page.setEmulatedSizeFromWindowOpen({ viewport: viewportSize, screen: viewportSize });
    }
  }

  private async _initializePageProxySession() {
    if (this._page.browserContext.isSettingStorageState())
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
    if (this._page.browserContext.needsPlaywrightBinding())
      promises.push(session.send('Runtime.addBinding', { name: PageBinding.kBindingName }));
    if (this._page.needsRequestInterception()) {
      promises.push(session.send('Network.setInterceptionEnabled', { enabled: true }));
      promises.push(session.send('Network.setResourceCachingDisabled', { disabled: true }));
      promises.push(session.send('Network.addInterception', { url: '.*', stage: 'request', isRegex: true }));
    }
    if (this._page.browserContext.isSettingStorageState()) {
      await Promise.all(promises);
      return;
    }

    const contextOptions = this._browserContext._options;
    if (contextOptions.userAgent)
      promises.push(this.updateUserAgent());
    const emulatedMedia = this._page.emulatedMedia();
    if (emulatedMedia.media || emulatedMedia.colorScheme || emulatedMedia.reducedMotion || emulatedMedia.forcedColors || emulatedMedia.contrast)
      promises.push(WKPage._setEmulateMedia(session, emulatedMedia.media, emulatedMedia.colorScheme, emulatedMedia.reducedMotion, emulatedMedia.forcedColors, emulatedMedia.contrast));
    const bootstrapScript = this._calculateBootstrapScript();
    if (bootstrapScript.length)
      promises.push(session.send('Page.setBootstrapScript', { source: bootstrapScript }));
    this._page.frames().map(frame => frame.evaluateExpression(bootstrapScript).catch(e => {}));
    if (contextOptions.bypassCSP)
      promises.push(session.send('Page.setBypassCSP', { enabled: true }));
    const emulatedSize = this._page.emulatedSize();
    if (emulatedSize) {
      promises.push(session.send('Page.setScreenSizeOverride', {
        width: emulatedSize.screen.width,
        height: emulatedSize.screen.height,
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
    if (this._page.fileChooserIntercepted())
      promises.push(session.send('Page.setInterceptFileChooserDialog', { enabled: true }));
    promises.push(session.send('Page.overrideSetting', { setting: 'DeviceOrientationEventEnabled', value: contextOptions.isMobile }));
    promises.push(session.send('Page.overrideSetting', { setting: 'FullScreenEnabled', value: !contextOptions.isMobile }));
    promises.push(session.send('Page.overrideSetting', { setting: 'NotificationsEnabled', value: !contextOptions.isMobile }));
    promises.push(session.send('Page.overrideSetting', { setting: 'PointerLockEnabled', value: !contextOptions.isMobile }));
    promises.push(session.send('Page.overrideSetting', { setting: 'InputTypeMonthEnabled', value: contextOptions.isMobile }));
    promises.push(session.send('Page.overrideSetting', { setting: 'InputTypeWeekEnabled', value: contextOptions.isMobile }));
    promises.push(session.send('Page.overrideSetting', { setting: 'FixedBackgroundsPaintRelativeToDocument', value: contextOptions.isMobile }));
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
      this._maybeCancelCoopNavigationRequest(this._provisionalPage);
      this._provisionalPage._session.dispose();
      this._provisionalPage.dispose();
      this._provisionalPage = null;
    } else if (this._session.sessionId === targetId) {
      this._session.dispose();
      eventsHelper.removeEventListeners(this._sessionListeners);
      if (crashed) {
        this._session.markAsCrashed();
        this._page._didCrash();
      }
    }
  }

  didClose() {
    this._pageProxySession.dispose();
    eventsHelper.removeEventListeners(this._sessionListeners);
    eventsHelper.removeEventListeners(this._eventListeners);
    if (this._session)
      this._session.dispose();
    if (this._provisionalPage) {
      this._provisionalPage._session.dispose();
      this._provisionalPage.dispose();
      this._provisionalPage = null;
    }
    this._firstNonInitialNavigationCommittedReject(new TargetClosedError());
    this._page._didClose();
  }

  dispatchMessageToSession(message: any) {
    this._pageProxySession.dispatchMessage(message);
  }

  handleProvisionalLoadFailed(event: Protocol.Playwright.provisionalLoadFailedPayload) {
    if (!this._page.initializedOrUndefined()) {
      this._firstNonInitialNavigationCommittedReject(new Error('Initial load failed'));
      return;
    }
    if (!this._provisionalPage)
      return;
    let errorText = event.error;
    if (errorText.includes('cancelled'))
      errorText += '; maybe frame was detached?';
    this._page.frameManager.frameAbortedNavigation(this._page.mainFrame()._id, errorText, event.loaderId);
  }

  handleWindowOpen(event: Protocol.Playwright.windowOpenPayload) {
    this._nextWindowOpenPopupFeatures = event.windowFeatures;
  }

  private async _onTargetCreated(event: Protocol.Target.targetCreatedPayload) {
    const { targetInfo } = event;
    const session = new WKSession(this._pageProxySession.connection, targetInfo.targetId, (message: any) => {
      this._pageProxySession.send('Target.sendMessageToTarget', {
        message: JSON.stringify(message), targetId: targetInfo.targetId
      }).catch(e => {
        session.dispatchMessage({ id: message.id, error: { message: e.message } });
      });
    });
    assert(targetInfo.type === 'page', 'Only page targets are expected in WebKit, received: ' + targetInfo.type);

    if (!targetInfo.isProvisional) {
      assert(!this._page.initializedOrUndefined());
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
      this._page.reportAsNew(this._opener?._page, pageOrError instanceof Page ? undefined : pageOrError);
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
      eventsHelper.addEventListener(this._session, 'Page.frameScheduledNavigation', event => this._onFrameScheduledNavigation(event.frameId, event.delay, event.targetIsCurrentFrame)),
      eventsHelper.addEventListener(this._session, 'Page.loadEventFired', event => this._page.frameManager.frameLifecycleEvent(event.frameId, 'load')),
      eventsHelper.addEventListener(this._session, 'Page.domContentEventFired', event => this._page.frameManager.frameLifecycleEvent(event.frameId, 'domcontentloaded')),
      eventsHelper.addEventListener(this._session, 'Runtime.executionContextCreated', event => this._onExecutionContextCreated(event.context)),
      eventsHelper.addEventListener(this._session, 'Runtime.bindingCalled', event => this._onBindingCalled(event.contextId, event.argument)),
      eventsHelper.addEventListener(this._session, 'Console.messageAdded', event => this._onConsoleMessage(event)),
      eventsHelper.addEventListener(this._session, 'Console.messageRepeatCountUpdated', event => this._onConsoleRepeatCountUpdated(event)),
      eventsHelper.addEventListener(this._pageProxySession, 'Dialog.javascriptDialogOpening', event => this._onDialog(event)),
      eventsHelper.addEventListener(this._session, 'Page.fileChooserOpened', event => this._onFileChooserOpened(event)),
      eventsHelper.addEventListener(this._session, 'Network.requestWillBeSent', e => this._onRequestWillBeSent(this._session, e)),
      eventsHelper.addEventListener(this._session, 'Network.requestIntercepted', e => this._onRequestIntercepted(this._session, e)),
      eventsHelper.addEventListener(this._session, 'Network.responseReceived', e => this._onResponseReceived(this._session, e)),
      eventsHelper.addEventListener(this._session, 'Network.loadingFinished', e => this._onLoadingFinished(e)),
      eventsHelper.addEventListener(this._session, 'Network.loadingFailed', e => this._onLoadingFailed(this._session, e)),
      eventsHelper.addEventListener(this._session, 'Network.webSocketCreated', e => this._page.frameManager.onWebSocketCreated(e.requestId, e.url)),
      eventsHelper.addEventListener(this._session, 'Network.webSocketWillSendHandshakeRequest', e => this._page.frameManager.onWebSocketRequest(e.requestId)),
      eventsHelper.addEventListener(this._session, 'Network.webSocketHandshakeResponseReceived', e => this._page.frameManager.onWebSocketResponse(e.requestId, e.response.status, e.response.statusText)),
      eventsHelper.addEventListener(this._session, 'Network.webSocketFrameSent', e => e.response.payloadData && this._page.frameManager.onWebSocketFrameSent(e.requestId, e.response.opcode, e.response.payloadData)),
      eventsHelper.addEventListener(this._session, 'Network.webSocketFrameReceived', e => e.response.payloadData && this._page.frameManager.webSocketFrameReceived(e.requestId, e.response.opcode, e.response.payloadData)),
      eventsHelper.addEventListener(this._session, 'Network.webSocketClosed', e => this._page.frameManager.webSocketClosed(e.requestId)),
      eventsHelper.addEventListener(this._session, 'Network.webSocketFrameError', e => this._page.frameManager.webSocketError(e.requestId, e.errorMessage)),
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
    this._page.frameManager.frameRequestedNavigation(frameId);
  }

  private _onDidCheckNavigationPolicy(frameId: string, cancel?: boolean) {
    if (!cancel)
      return;
    // This is a cross-process navigation that is canceled in the original page and continues in
    // the provisional page. Bail out as we are tracking it.
    if (this._provisionalPage)
      return;
    this._page.frameManager.frameAbortedNavigation(frameId, 'Navigation canceled by policy check');
  }

  private _onFrameScheduledNavigation(frameId: string, delay: number, targetIsCurrentFrame: boolean) {
    if (targetIsCurrentFrame)
      this._page.frameManager.frameRequestedNavigation(frameId);
  }

  private _handleFrameTree(frameTree: Protocol.Page.FrameResourceTree) {
    this._onFrameAttached(frameTree.frame.id, frameTree.frame.parentId || null);
    this._onFrameNavigated(frameTree.frame, true);
    this._page.frameManager.frameLifecycleEvent(frameTree.frame.id, 'domcontentloaded');
    this._page.frameManager.frameLifecycleEvent(frameTree.frame.id, 'load');

    if (!frameTree.childFrames)
      return;
    for (const child of frameTree.childFrames)
      this._handleFrameTree(child);
  }

  _onFrameAttached(frameId: string, parentFrameId: string | null): frames.Frame {
    return this._page.frameManager.frameAttached(frameId, parentFrameId);
  }

  private _onFrameNavigated(framePayload: Protocol.Page.Frame, initial: boolean) {
    const frame = this._page.frameManager.frame(framePayload.id);
    assert(frame);
    this._removeContextsForFrame(frame, true);
    if (!framePayload.parentId)
      this._workers.clear();
    this._page.frameManager.frameCommittedNewDocumentNavigation(framePayload.id, framePayload.url, framePayload.name || '', framePayload.loaderId, initial);
    if (!initial)
      this._firstNonInitialNavigationCommittedFulfill();
  }

  private _onFrameNavigatedWithinDocument(frameId: string, url: string) {
    this._page.frameManager.frameCommittedSameDocumentNavigation(frameId, url);
  }

  private _onFrameDetached(frameId: string) {
    this._page.frameManager.frameDetached(frameId);
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
    const frame = this._page.frameManager.frame(contextPayload.frameId);
    if (!frame)
      return;
    const delegate = new WKExecutionContext(this._session, contextPayload.id);
    let worldName: types.World|null = null;
    if (contextPayload.type === 'normal')
      worldName = 'main';
    else if (contextPayload.type === 'user' && contextPayload.name === UTILITY_WORLD_NAME)
      worldName = 'utility';
    const context = new dom.FrameExecutionContext(delegate, frame, worldName);
    if (worldName)
      frame._contextCreated(worldName, context);
    this._contextIdToContext.set(contextPayload.id, context);
  }

  private async _onBindingCalled(contextId: Protocol.Runtime.ExecutionContextId, argument: string) {
    const pageOrError = await this._page.waitForInitializedOrError();
    if (!(pageOrError instanceof Error)) {
      const context = this._contextIdToContext.get(contextId);
      if (context)
        await this._page.onBindingCalled(argument, context);
    }
  }

  async navigateFrame(frame: frames.Frame, url: string, referrer: string | undefined): Promise<frames.GotoResult> {
    if (this._pageProxySession.isDisposed())
      throw new TargetClosedError();
    const pageProxyId = this._pageProxySession.sessionId;
    const result = await this._pageProxySession.connection.browserSession.send('Playwright.navigate', { url, pageProxyId, frameId: frame._id, referrer });
    return { newDocumentId: result.loaderId };
  }

  private _onConsoleMessage(event: Protocol.Console.messageAddedPayload) {
    // Note: do no introduce await in this function, otherwise we lose the ordering.
    // For example, frame.setContent relies on this.
    const { type, level, text, parameters, url, line: lineNumber, column: columnNumber, source } = event.message;
    if (level === 'error' && source === 'javascript') {
      const { name, message } = splitErrorMessage(text);

      let stack: string;
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

      this._page.emitOnContextOnceInitialized(BrowserContext.Events.PageError, error, this._page);
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
        // Pick any context if the parameter is a value.
        context = [...this._contextIdToContext.values()].find(c => c.frame === this._page.mainFrame());
      }
      if (!context)
        return;
      handles.push(createHandle(context, p));
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
        this._page.addConsoleMessage(derivedType, handles, location, handles.length ? undefined : text);
      this._lastConsoleMessage.count = event.count;
    }
  }

  _onDialog(event: Protocol.Dialog.javascriptDialogOpeningPayload) {
    this._page.browserContext.dialogManager.dialogDidOpen(new dialog.Dialog(
        this._page,
        event.type as dialog.DialogType,
        event.message,
        async (accept: boolean, promptText?: string) => {
          // TODO: this should actually be a RDP event that notifies about a cancelled navigation attempt.
          if (event.type === 'beforeunload' && !accept)
            this._page.frameManager.frameAbortedNavigation(this._page.mainFrame()._id, 'navigation cancelled by beforeunload dialog');
          await this._pageProxySession.send('Dialog.handleJavaScriptDialog', { accept, promptText });
        },
        event.defaultPrompt));
  }

  private async _onFileChooserOpened(event: {frameId: Protocol.Network.FrameId, element: Protocol.Runtime.RemoteObject}) {
    let handle;
    try {
      const context = await this._page.frameManager.frame(event.frameId)!._mainContext();
      handle =  createHandle(context, event.element).asElement()!;
    } catch (e) {
      // During async processing, frame/context may go away. We should not throw.
      return;
    }
    await this._page._onFileChooserOpened(handle);
  }

  private static async _setEmulateMedia(session: WKSession, mediaType: types.MediaType, colorScheme: types.ColorScheme, reducedMotion: types.ReducedMotion, forcedColors: types.ForcedColors, contrast: types.Contrast): Promise<void> {
    const promises = [];
    promises.push(session.send('Page.setEmulatedMedia', { media: mediaType === 'no-override' ? '' : mediaType }));
    let appearance: any = undefined;
    switch (colorScheme) {
      case 'light': appearance = 'Light'; break;
      case 'dark': appearance = 'Dark'; break;
      case 'no-override': appearance = undefined; break;
    }
    promises.push(session.send('Page.overrideUserPreference', { name: 'PrefersColorScheme', value: appearance }));
    let reducedMotionWk: any = undefined;
    switch (reducedMotion) {
      case 'reduce': reducedMotionWk = 'Reduce'; break;
      case 'no-preference': reducedMotionWk = 'NoPreference'; break;
      case 'no-override': reducedMotionWk = undefined; break;
    }
    promises.push(session.send('Page.overrideUserPreference', { name: 'PrefersReducedMotion', value: reducedMotionWk }));
    let forcedColorsWk: any = undefined;
    switch (forcedColors) {
      case 'active': forcedColorsWk = 'Active'; break;
      case 'none': forcedColorsWk = 'None'; break;
      case 'no-override': forcedColorsWk = undefined; break;
    }
    promises.push(session.send('Page.setForcedColors', { forcedColors: forcedColorsWk }));
    let contrastWk: any = undefined;
    switch (contrast) {
      case 'more': contrastWk = 'More'; break;
      case 'no-preference': contrastWk = 'NoPreference'; break;
      case 'no-override': contrastWk = undefined; break;
    }
    promises.push(session.send('Page.overrideUserPreference', { name: 'PrefersContrast', value: contrastWk }));
    await Promise.all(promises);
  }

  async updateExtraHTTPHeaders(): Promise<void> {
    await this._updateState('Network.setExtraHTTPHeaders', { headers: headersArrayToObject(this._calculateExtraHTTPHeaders(), false /* lowerCase */) });
  }

  _calculateExtraHTTPHeaders(): types.HeadersArray {
    const locale = this._browserContext._options.locale;
    const headers = network.mergeHeaders([
      this._browserContext._options.extraHTTPHeaders,
      this._page.extraHTTPHeaders(),
      locale ? network.singleHeader('Accept-Language', locale) : undefined,
    ]);
    return headers;
  }

  async updateEmulateMedia(): Promise<void> {
    const emulatedMedia = this._page.emulatedMedia();
    const colorScheme = emulatedMedia.colorScheme;
    const reducedMotion = emulatedMedia.reducedMotion;
    const forcedColors = emulatedMedia.forcedColors;
    const contrast = emulatedMedia.contrast;
    await this._forAllSessions(session => WKPage._setEmulateMedia(session, emulatedMedia.media, colorScheme, reducedMotion, forcedColors, contrast));
  }

  async updateEmulatedViewportSize(): Promise<void> {
    this._browserContext._validateEmulatedViewport(this._page.emulatedSize()?.viewport);
    await this._updateViewport();
  }

  async updateUserAgent(): Promise<void> {
    const contextOptions = this._browserContext._options;
    this._updateState('Page.overrideUserAgent', { value: contextOptions.userAgent });
  }

  async bringToFront(): Promise<void> {
    this._pageProxySession.send('Target.activate', {
      targetId: this._session.sessionId
    });
  }

  async _updateViewport(): Promise<void> {
    const options = this._browserContext._options;
    const emulatedSize = this._page.emulatedSize();
    if (!emulatedSize)
      return;
    const viewportSize = emulatedSize.viewport;
    const screenSize = emulatedSize.screen;
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
      promises.push(this._pageProxySession.send('Emulation.setOrientationOverride', { angle }));
    }
    await Promise.all(promises);
  }

  async updateRequestInterception(): Promise<void> {
    const enabled = this._page.needsRequestInterception();
    await Promise.all([
      this._updateState('Network.setInterceptionEnabled', { enabled }),
      this._updateState('Network.setResourceCachingDisabled', { disabled: enabled }),
      this._updateState('Network.addInterception', { url: '.*', stage: 'request', isRegex: true }),
    ]);
  }

  async updateOffline() {
    await this._updateState('Network.setEmulateOfflineState', { offline: !!this._browserContext._options.offline });
  }

  async updateHttpCredentials() {
    const credentials = this._browserContext._options.httpCredentials || { username: '', password: '', origin: '' };
    await this._pageProxySession.send('Emulation.setAuthCredentials', { username: credentials.username, password: credentials.password, origin: credentials.origin });
  }

  async updateFileChooserInterception() {
    const enabled = this._page.fileChooserIntercepted();
    await this._session.send('Page.setInterceptFileChooserDialog', { enabled }).catch(() => {}); // target can be closed.
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

  async requestGC(): Promise<void> {
    await this._session.send('Heap.gc');
  }

  async addInitScript(initScript: InitScript): Promise<void> {
    await this._updateBootstrapScript();
  }

  async removeInitScripts(initScripts: InitScript[]): Promise<void> {
    await this._updateBootstrapScript();
  }

  async exposePlaywrightBinding() {
    await this._updateState('Runtime.addBinding', { name: PageBinding.kBindingName });
  }

  private _calculateBootstrapScript(): string {
    const scripts: string[] = [];
    if (!this._page.browserContext._options.isMobile) {
      scripts.push('delete window.orientation');
      scripts.push('delete window.ondevicemotion');
      scripts.push('delete window.ondeviceorientation');
    }
    scripts.push('if (!window.safari) window.safari = { pushNotification: { toString() { return "[object SafariRemoteNotification]"; } } };');
    scripts.push('if (!window.GestureEvent) window.GestureEvent = function GestureEvent() {};');
    scripts.push(this._publicKeyCredentialScript());
    scripts.push(...this._page.allInitScripts().map(script => script.source));
    return scripts.join(';\n');
  }

  private _publicKeyCredentialScript(): string {
    function polyfill() {
      /**
       * Some sites don't check existance of PublicKeyCredentials because all browsers except Webkit on Linux implement it.
       * We polyfill the subset that's used for feature detection, so that login flows that'd work in Safari don't crash with "PublicKeyCredential is not defined" in CI.
       * https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential
       */
      window.PublicKeyCredential ??= {
        async getClientCapabilities() {
          return {};
        },
        async isConditionalMediationAvailable() {
          return false;
        },
        async isUserVerifyingPlatformAuthenticatorAvailable() {
          return false;
        },
      } as any;
    }
    return `(${polyfill.toString()})();`;
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
    if (this._page.browserContext._browser?.options.headful)
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
    this._browserContext._browser._videoStarted(this._browserContext, screencastId, options.outputFile, this._page.waitForInitializedOrError());
  }

  async _stopVideo(): Promise<void> {
    if (!this._recordingVideoFile)
      return;
    await this._pageProxySession.sendMayFail('Screencast.stopVideo');
    this._recordingVideoFile = null;
  }

  private validateScreenshotDimension(side: number, omitDeviceScaleFactor: boolean) {
    // Cairo based implementations (Linux and Windows) have hard limit of 32767
    // (see https://github.com/microsoft/playwright/issues/16727).
    if (process.platform === 'darwin')
      return;
    if (!omitDeviceScaleFactor && this._page.browserContext._options.deviceScaleFactor)
      side = Math.ceil(side * this._page.browserContext._options.deviceScaleFactor);
    if (side > 32767)
      throw new Error('Cannot take screenshot larger than 32767 pixels on any dimension');
  }

  async takeScreenshot(progress: Progress, format: string, documentRect: types.Rect | undefined, viewportRect: types.Rect | undefined, quality: number | undefined, fitsViewport: boolean, scale: 'css' | 'device'): Promise<Buffer> {
    const rect = (documentRect || viewportRect)!;
    const omitDeviceScaleFactor = scale === 'css';
    this.validateScreenshotDimension(rect.width, omitDeviceScaleFactor);
    this.validateScreenshotDimension(rect.height, omitDeviceScaleFactor);
    const result = await progress.race(this._session.send('Page.snapshotRect', { ...rect, coordinateSystem: documentRect ? 'Page' : 'Viewport', omitDeviceScaleFactor }));
    const prefix = 'data:image/png;base64,';
    let buffer: Buffer = Buffer.from(result.dataURL.substr(prefix.length), 'base64');
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
    return this._page.frameManager.frame(nodeInfo.contentFrameId);
  }

  async getOwnerFrame(handle: dom.ElementHandle): Promise<string | null> {
    if (!handle._objectId)
      return null;
    const nodeInfo = await this._session.send('DOM.describeNode', {
      objectId: handle._objectId
    });
    return nodeInfo.ownerFrameId || null;
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
      executionContextId: (to.delegate as WKExecutionContext)._contextId
    });
    if (!result || result.object.subtype === 'null')
      throw new Error(dom.kUnableToAdoptErrorMessage);
    return createHandle(to, result.object) as dom.ElementHandle<T>;
  }

  async getAccessibilityTree(needle?: dom.ElementHandle): Promise<{tree: accessibility.AXNode, needle: accessibility.AXNode | null}> {
    return getAccessibilityTree(this._session, needle);
  }

  async inputActionEpilogue(): Promise<void> {
  }

  async resetForReuse(progress: Progress): Promise<void> {
  }

  async getFrameElement(frame: frames.Frame): Promise<dom.ElementHandle> {
    const parent = frame.parentFrame();
    if (!parent)
      throw new Error('Frame has been detached.');
    const context = await parent._mainContext();
    const result = await this._session.send('DOM.resolveNode', {
      frameId: frame._id,
      executionContextId: (context.delegate as WKExecutionContext)._contextId
    });
    if (!result || result.object.subtype === 'null')
      throw new Error('Frame has been detached.');
    return createHandle(context, result.object) as dom.ElementHandle;
  }

  private _maybeCancelCoopNavigationRequest(provisionalPage: WKProvisionalPage) {
    const navigationRequest = provisionalPage.coopNavigationRequest();
    for (const [requestId, request] of this._requestIdToRequest) {
      if (request.request === navigationRequest) {
        // Make sure the request completes if the provisional navigation is canceled.
        this._onLoadingFailed(provisionalPage._session, {
          requestId: requestId,
          errorText: 'Provisiolal navigation canceled.',
          timestamp: request._timestamp,
          canceled: true,
        });
        return;
      }
    }
  }

  _adoptRequestFromNewProcess(navigationRequest: network.Request, newSession: WKSession, newRequestId: string) {
    for (const [requestId, request] of this._requestIdToRequest) {
      if (request.request === navigationRequest) {
        this._requestIdToRequest.delete(requestId);
        request.adoptRequestFromNewProcess(newSession, newRequestId);
        this._requestIdToRequest.set(newRequestId, request);
        return;
      }
    }
  }

  _onRequestWillBeSent(session: WKSession, event: Protocol.Network.requestWillBeSentPayload) {
    if (event.request.url.startsWith('data:'))
      return;
    // WebKit started dispatching network events for about:blank after https://commits.webkit.org/292206@main.
    if (event.request.url.startsWith('about:'))
      return;

    // We do not support intercepting redirects.
    if (this._page.needsRequestInterception() && !event.redirectResponse)
      this._requestIdToRequestWillBeSentEvent.set(event.requestId, event);
    else
      this._onRequest(session, event, false);
  }

  private _onRequest(session: WKSession, event: Protocol.Network.requestWillBeSentPayload, intercepted: boolean) {
    let redirectedFrom: WKInterceptableRequest | null = null;
    if (event.redirectResponse) {
      const request = this._requestIdToRequest.get(event.requestId);
      // If we connect late to the target, we could have missed the requestWillBeSent event.
      if (request) {
        this._handleRequestRedirect(request, event.requestId, event.redirectResponse, event.timestamp);
        redirectedFrom = request;
      }
    }
    const frame = redirectedFrom ? redirectedFrom.request.frame() : this._page.frameManager.frame(event.frameId);
    // sometimes we get stray network events for detached frames
    // TODO(einbinder) why?
    if (!frame)
      return;

    // TODO(einbinder) this will fail if we are an XHR document request
    const isNavigationRequest = event.type === 'Document';
    const documentId = isNavigationRequest ? event.loaderId : undefined;
    const request = new WKInterceptableRequest(session, frame, event, redirectedFrom, documentId);
    let route;
    if (intercepted) {
      route = new WKRouteImpl(session, event.requestId);
      // There is no point in waiting for the raw headers in Network.responseReceived when intercepting.
      // Use provisional headers as raw headers, so that client can call allHeaders() from the route handler.
      request.request.setRawRequestHeaders(null);
    }
    this._requestIdToRequest.set(event.requestId, request);
    this._page.frameManager.requestStarted(request.request, route);
  }

  private _handleRequestRedirect(request: WKInterceptableRequest, requestId: string, responsePayload: Protocol.Network.Response, timestamp: number) {
    const response = request.createResponse(responsePayload);
    response._securityDetailsFinished();
    response._serverAddrFinished();
    response.setResponseHeadersSize(null);
    response.setEncodedBodySize(null);
    response._requestFinished(responsePayload.timing ? helper.secondsToRoundishMillis(timestamp - request._timestamp) : -1);
    this._requestIdToRequest.delete(requestId);
    this._page.frameManager.requestReceivedResponse(response);
    this._page.frameManager.reportRequestFinished(request.request, response);
  }

  _onRequestIntercepted(session: WKSession, event: Protocol.Network.requestInterceptedPayload) {
    const requestWillBeSentEvent = this._requestIdToRequestWillBeSentEvent.get(event.requestId);
    if (!requestWillBeSentEvent) {
      // Intercepted, although we do not intend to allow interception.
      // Just continue.
      session.sendMayFail('Network.interceptWithRequest', { requestId: event.requestId });
      return;
    }
    this._requestIdToRequestWillBeSentEvent.delete(event.requestId);
    this._onRequest(session, requestWillBeSentEvent, true);
  }

  _onResponseReceived(session: WKSession, event: Protocol.Network.responseReceivedPayload) {
    const requestWillBeSentEvent = this._requestIdToRequestWillBeSentEvent.get(event.requestId);
    if (requestWillBeSentEvent) {
      this._requestIdToRequestWillBeSentEvent.delete(event.requestId);
      // We received a response, so the request won't be intercepted (e.g. it was handled by a
      // service worker and we don't intercept service workers).
      this._onRequest(session, requestWillBeSentEvent, false);
    }
    const request = this._requestIdToRequest.get(event.requestId);
    // FileUpload sends a response without a matching request.
    if (!request)
      return;

    this._requestIdToResponseReceivedPayloadEvent.set(event.requestId, event);
    const response = request.createResponse(event.response);
    this._page.frameManager.requestReceivedResponse(response);

    if (response.status() === 204 && request.request.isNavigationRequest()) {
      this._onLoadingFailed(session, {
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
      const responseReceivedPayload = this._requestIdToResponseReceivedPayloadEvent.get(event.requestId);
      response._serverAddrFinished(parseRemoteAddress(event?.metrics?.remoteAddress));
      response._securityDetailsFinished({
        protocol: isLoadedSecurely(response.url(), response.timing()) ? event.metrics?.securityConnection?.protocol : undefined,
        subjectName: responseReceivedPayload?.response.security?.certificate?.subject,
        validFrom: responseReceivedPayload?.response.security?.certificate?.validFrom,
        validTo: responseReceivedPayload?.response.security?.certificate?.validUntil,
      });
      if (event.metrics?.protocol)
        response._setHttpVersion(event.metrics.protocol);
      response.setEncodedBodySize(event.metrics?.responseBodyBytesReceived ?? null);
      response.setResponseHeadersSize(event.metrics?.responseHeaderBytesReceived ?? null);

      response._requestFinished(helper.secondsToRoundishMillis(event.timestamp - request._timestamp));
    } else {
      // Use provisional headers if we didn't have the response with raw headers.
      request.request.setRawRequestHeaders(null);
    }

    this._requestIdToResponseReceivedPayloadEvent.delete(event.requestId);
    this._requestIdToRequest.delete(event.requestId);
    this._page.frameManager.reportRequestFinished(request.request, response);
  }

  _onLoadingFailed(session: WKSession, event: Protocol.Network.loadingFailedPayload) {
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
    if (!request)
      return;

    const response = request.request._existingResponse();
    if (response) {
      response._serverAddrFinished();
      response._securityDetailsFinished();
      response.setResponseHeadersSize(null);
      response.setEncodedBodySize(null);
      response._requestFinished(helper.secondsToRoundishMillis(event.timestamp - request._timestamp));
    } else {
      // Use provisional headers if we didn't have the response with raw headers.
      request.request.setRawRequestHeaders(null);
    }
    this._requestIdToRequest.delete(event.requestId);
    request.request._setFailureText(event.errorText);
    this._page.frameManager.requestFailed(request.request, event.errorText.includes('cancelled'));
  }

  async _grantPermissions(origin: string, permissions: string[]) {
    const webPermissionToProtocol = new Map<string, string>([
      ['geolocation', 'geolocation'],
      ['notifications', 'notifications'],
      ['clipboard-read', 'clipboard-read'],
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

  shouldToggleStyleSheetToSyncAnimations(): boolean {
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
