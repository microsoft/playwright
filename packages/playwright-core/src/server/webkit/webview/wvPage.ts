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

import { PNG } from 'pngjs';
import jpegjs from 'jpeg-js';
import { assert } from '@isomorphic/assert';
import { headersArrayToObject } from '@isomorphic/headers';
import { ManualPromise } from '@isomorphic/manualPromise';
import { splitErrorMessage } from '@isomorphic/stackTrace';
import { debugLogger } from '@utils/debugLogger';
import { eventsHelper } from '@utils/eventsHelper';
import * as dialog from '../../dialog';
import * as dom from '../../dom';
import { TargetClosedError } from '../../errors';
import { helper } from '../../helper';
import { saveGlobalsSnapshotSource } from '../../javascript';
import * as network from '../../network';
import { Page, PageBinding } from '../../page';
import { WVSession } from './wvConnection';
import { createHandle, WVExecutionContext } from './wvExecutionContext';
import { RawKeyboardImpl, RawMouseImpl, RawTouchscreenImpl } from './wvInput';
import { WVWorkers } from './wvWorkers';
import { WVInterceptableRequest, WVRouteImpl } from './wvInterceptableRequest';
import { WVProvisionalPage } from './wvProvisionalPage';

import type { Protocol } from './protocol';
import type { WVBrowserContext } from './wvBrowser';
import type { RegisteredListener } from '@utils/eventsHelper';
import type * as frames from '../../frames';
import type { JSHandle } from '../../javascript';
import type { InitScript, PageDelegate } from '../../page';
import type { Progress } from '../../progress';
import type * as types from '../../types';
import type { PagePdfParams } from '@protocol/channels';

export class WVPage implements PageDelegate {
  readonly rawMouse: RawMouseImpl;
  readonly rawKeyboard: RawKeyboardImpl;
  readonly rawTouchscreen: RawTouchscreenImpl;
  private _session!: WVSession;
  private readonly _outerSession: WVSession;
  private _provisionalPage: WVProvisionalPage | null = null;
  readonly _page: Page;
  private readonly _requestIdToRequest = new Map<string, WVInterceptableRequest>();
  private readonly _requestIdToRequestWillBeSentEvent = new Map<string, Protocol.Network.requestWillBeSentPayload>();
  private _workers: WVWorkers;
  private readonly _contextIdToContext: Map<number, dom.FrameExecutionContext>;
  private _sessionListeners: RegisteredListener[] = [];
  private _eventListeners: RegisteredListener[];
  private _pendingMainFrameLoaderResolvers = new Map<string, (loaderId: string) => void>();
  readonly _browserContext: WVBrowserContext;
  private _firstNonInitialNavigationCommittedPromise: Promise<void>;
  private _firstNonInitialNavigationCommittedFulfill = () => {};
  _firstNonInitialNavigationCommittedReject = (e: Error) => {};
  private _initializedPromise = new ManualPromise<void>();
  private _lastConsoleMessage: { derivedType: string, text: string, handles: JSHandle[]; count: number, location: types.ConsoleMessageLocation; } | null = null;
  private readonly _requestIdToResponseReceivedPayloadEvent = new Map<string, Protocol.Network.responseReceivedPayload>();

  private readonly _dialogEndpoint: string | undefined;

  constructor(browserContext: WVBrowserContext, outerSession: WVSession, dialogEndpoint?: string) {
    this._outerSession = outerSession;
    this._dialogEndpoint = dialogEndpoint;
    this.rawKeyboard = new RawKeyboardImpl();
    this.rawMouse = new RawMouseImpl();
    this.rawTouchscreen = new RawTouchscreenImpl();
    this._contextIdToContext = new Map();
    this._page = new Page(this, browserContext);
    this._workers = new WVWorkers(this._page, outerSession);
    this._browserContext = browserContext;
    this._page.on(Page.Events.FrameDetached, (frame: frames.Frame) => this._removeContextsForFrame(frame, false));
    this._eventListeners = [
      eventsHelper.addEventListener(outerSession, 'Target.targetCreated', this._onTargetCreated.bind(this)),
      eventsHelper.addEventListener(outerSession, 'Target.targetDestroyed', this._onTargetDestroyed.bind(this)),
      eventsHelper.addEventListener(outerSession, 'Target.dispatchMessageFromTarget', this._onDispatchMessageFromTarget.bind(this)),
      eventsHelper.addEventListener(outerSession, 'Target.didCommitProvisionalTarget', this._onDidCommitProvisionalTarget.bind(this)),
    ];
    this._firstNonInitialNavigationCommittedPromise = new Promise((f, r) => {
      this._firstNonInitialNavigationCommittedFulfill = f;
      this._firstNonInitialNavigationCommittedReject = r;
    });
    // Avoid unhandled rejection on disconnect in the middle of initialization.
    this._firstNonInitialNavigationCommittedPromise.catch(() => {});
  }

  waitForInitialized(): Promise<void> {
    return this._initializedPromise;
  }

  updateEmulatedViewportSize(preserveWindowBoundaries?: boolean): Promise<void> {
    throw new Error('Method not implemented.');
  }

  updateEmulateMedia(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  goBack(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  goForward(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  requestGC(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  updateFileChooserInterception(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  setInputFilePaths(progress: Progress, handle: dom.ElementHandle<HTMLInputElement>, files: string[]): Promise<void> {
    throw new Error('Method not implemented.');
  }

  startScreencast(options: { width: number; height: number; quality: number; }): void {
    throw new Error('Method not implemented.');
  }

  stopScreencast(): void {
    throw new Error('Method not implemented.');
  }

  pdf?: ((options: PagePdfParams) => Promise<Buffer>) | undefined;
  coverage?: (() => any) | undefined;
  cspErrorsAsynchronousForInlineScripts?: boolean | undefined;

  private _setSession(session: WVSession) {
    eventsHelper.removeEventListeners(this._sessionListeners);
    this._session = session;
    this.rawKeyboard.setSession(session);
    this.rawMouse.setSession(session);
    this.rawTouchscreen.setSession(session);
    this._workers.setSession(session);
    this._addSessionListeners();
  }

  // This method is called for provisional targets as well. The session passed as the parameter
  // may be different from the current session and may be destroyed without becoming current.
  async _initializeSession(session: WVSession, provisional: boolean, resourceTreeHandler: (r: Protocol.Page.getResourceTreeReturnValue) => void): Promise<void> {
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

  private async _initializeSessionMayThrow(session: WVSession, resourceTreeHandler: (r: Protocol.Page.getResourceTreeReturnValue) => void): Promise<void> {
    const [, frameTree] = await Promise.all([
      session.send('Page.enable'),
      session.send('Page.getResourceTree'),
    ] as const);
    resourceTreeHandler(frameTree);
    await Promise.all([
      session.send('Runtime.enable'),
      session.sendMayFail('Network.enable'),
      session.sendMayFail('Console.enable'),
      session.sendMayFail('Page.setBootstrapScript', { source: this._calculateBootstrapScript() }),
      session.sendMayFail('Runtime.evaluate', { expression: saveGlobalsSnapshotSource, returnByValue: true } as any),
    ]);
    if (this._page.needsRequestInterception()) {
      await Promise.all([
        session.sendMayFail('Network.setInterceptionEnabled', { enabled: true }),
        session.sendMayFail('Network.setResourceCachingDisabled', { disabled: true }),
        session.sendMayFail('Network.addInterception', { url: '.*', stage: 'request', isRegex: true }),
      ]);
    }
    // Inject the dialog bridge into the currently-loaded document too —
    // bootstrap only applies to future navigations.
    if (this._dialogEndpoint) {
      await session.sendMayFail('Runtime.evaluate', {
        expression: dialogBridgeSource(this._dialogEndpoint),
        returnByValue: true,
      } as any);
    }
  }

  private _createSession(targetId: string): WVSession {
    const session: WVSession = new WVSession(this._outerSession.connection, targetId, (message: any) => {
      this._outerSession.send('Target.sendMessageToTarget', {
        targetId,
        message: JSON.stringify(message),
      }).catch(e => {
        session.dispatchMessage({ id: message.id, error: { message: e.message } });
      });
    });
    return session;
  }

  private async _onTargetCreated(event: Protocol.Target.targetCreatedPayload) {
    const { targetInfo } = event;
    if (targetInfo.type !== 'page') {
      // Site-isolated WebKit (iOS 26+) reports a separate target per frame. We
      // drive the whole page through the top-level page target, so out-of-process
      // frame targets are not attached. Resume any paused ones so navigation in
      // the owning page is not blocked waiting on them.
      if (targetInfo.isPaused)
        this._outerSession.sendMayFail('Target.resume', { targetId: targetInfo.targetId });
      return;
    }
    const session = this._createSession(targetInfo.targetId);
    if (!targetInfo.isProvisional) {
      let pageOrError: Page | Error;
      try {
        this._setSession(session);
        await this._initializeSession(session, false, ({ frameTree }) => this._handleFrameTree(frameTree));
        pageOrError = this._page;
      } catch (e) {
        pageOrError = e as Error;
      }
      if (targetInfo.isPaused)
        this._outerSession.sendMayFail('Target.resume', { targetId: targetInfo.targetId });
      await this._page.reportAsNew(undefined, pageOrError instanceof Page ? undefined : pageOrError);
      this._initializedPromise.resolve();
    } else {
      assert(!this._provisionalPage);
      this._provisionalPage = new WVProvisionalPage(session, this);
      if (targetInfo.isPaused) {
        this._provisionalPage.initializationPromise.then(() => {
          this._outerSession.sendMayFail('Target.resume', { targetId: targetInfo.targetId });
        });
      }
    }
  }

  private _onDispatchMessageFromTarget(event: Protocol.Target.dispatchMessageFromTargetPayload) {
    const { targetId, message } = event;
    if (this._provisionalPage && this._provisionalPage._session.sessionId === targetId)
      this._provisionalPage._session.dispatchMessage(JSON.parse(message));
    else if (this._session && this._session.sessionId === targetId)
      this._session.dispatchMessage(JSON.parse(message));
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
    const { targetId } = event;
    if (this._provisionalPage && this._provisionalPage._session.sessionId === targetId) {
      this._provisionalPage._session.dispose();
      this._provisionalPage.dispose();
      this._provisionalPage = null;
    } else if (this._session && this._session.sessionId === targetId) {
      this._session.dispose();
      eventsHelper.removeEventListeners(this._sessionListeners);
    }
  }

  async onBridgeDialog(req: { type: 'alert' | 'confirm' | 'prompt'; message: string; defaultValue: string }): Promise<{ accept: boolean; promptText?: string }> {
    return await new Promise<{ accept: boolean; promptText?: string }>(resolve => {
      this._page.browserContext.dialogManager.dialogDidOpen(new dialog.Dialog(
          this._page,
          req.type,
          req.message,
          async (accept: boolean, promptText?: string) => resolve({ accept, promptText }),
          req.defaultValue,
      ));
    });
  }

  didClose() {
    eventsHelper.removeEventListeners(this._sessionListeners);
    eventsHelper.removeEventListeners(this._eventListeners);
    if (this._session)
      this._session.dispose();
    if (this._provisionalPage) {
      this._provisionalPage._session.dispose();
      this._provisionalPage.dispose();
      this._provisionalPage = null;
    }
    this._firstNonInitialNavigationCommittedReject(new TargetClosedError(this._page.closeReason()));
    this._page._didClose();
  }

  private _addSessionListeners() {
    this._sessionListeners = this._buildSessionListeners(this._session);
  }

  private _buildSessionListeners(session: WVSession): RegisteredListener[] {
    return [
      eventsHelper.addEventListener(session, 'Page.frameNavigated', event => this._onFrameNavigated(event.frame, false)),
      eventsHelper.addEventListener(session, 'Page.navigatedWithinDocument', event => this._onFrameNavigatedWithinDocument(event.frameId, event.url)),
      eventsHelper.addEventListener(session, 'Page.frameAttached', event => this._onFrameAttached(event.frameId, event.parentFrameId)),
      eventsHelper.addEventListener(session, 'Page.frameDetached', event => this._onFrameDetached(event.frameId)),
      eventsHelper.addEventListener(session, 'Page.loadEventFired', event => this._page.frameManager.frameLifecycleEvent(this._page.mainFrame()._id, 'load')),
      eventsHelper.addEventListener(session, 'Page.domContentEventFired', event => this._page.frameManager.frameLifecycleEvent(this._page.mainFrame()._id, 'domcontentloaded')),
      eventsHelper.addEventListener(session, 'Runtime.executionContextCreated', event => this._onExecutionContextCreated(event.context)),
      eventsHelper.addEventListener(session, 'Console.messageAdded', event => this._onConsoleMessage(event)),
      eventsHelper.addEventListener(session, 'Console.messageRepeatCountUpdated', event => this._onConsoleRepeatCountUpdated(event)),
      eventsHelper.addEventListener(session, 'Network.requestWillBeSent', e => this._onRequestWillBeSent(session, e)),
      eventsHelper.addEventListener(session, 'Network.requestIntercepted', e => this._onRequestIntercepted(session, e)),
      eventsHelper.addEventListener(session, 'Network.responseReceived', e => this._onResponseReceived(session, e)),
      eventsHelper.addEventListener(session, 'Network.loadingFinished', e => this._onLoadingFinished(e)),
      eventsHelper.addEventListener(session, 'Network.loadingFailed', e => this._onLoadingFailed(session, e)),
      eventsHelper.addEventListener(session, 'Network.webSocketCreated', e => this._page.frameManager.onWebSocketCreated(e.requestId, e.url)),
      eventsHelper.addEventListener(session, 'Network.webSocketWillSendHandshakeRequest', e => this._page.frameManager.onWebSocketRequest(e.requestId)),
      eventsHelper.addEventListener(session, 'Network.webSocketHandshakeResponseReceived', e => this._page.frameManager.onWebSocketResponse(e.requestId, e.response.status, e.response.statusText)),
      eventsHelper.addEventListener(session, 'Network.webSocketFrameSent', e => e.response.payloadData && this._page.frameManager.onWebSocketFrameSent(e.requestId, e.response.opcode, e.response.payloadData)),
      eventsHelper.addEventListener(session, 'Network.webSocketFrameReceived', e => e.response.payloadData && this._page.frameManager.webSocketFrameReceived(e.requestId, e.response.opcode, e.response.payloadData)),
      eventsHelper.addEventListener(session, 'Network.webSocketClosed', e => this._page.frameManager.webSocketClosed(e.requestId)),
      eventsHelper.addEventListener(session, 'Network.webSocketFrameError', e => this._page.frameManager.webSocketError(e.requestId, e.errorMessage)),
    ];
  }

  private async _updateState<T extends keyof Protocol.CommandParameters>(
    method: T,
    params?: Protocol.CommandParameters[T]
  ): Promise<void> {
    await this._forAllSessions(session => session.send(method, params).then());
  }

  private async _forAllSessions(callback: ((session: WVSession) => Promise<void>)): Promise<void> {
    const sessions = [
      this._session
    ];
    await Promise.all(sessions.map(session => callback(session).catch(e => {})));
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
    // The stock WebKit RDP has no Page.frameAttached event, so we discover child
    // frames lazily on their first navigation.
    if (!this._page.frameManager.frame(framePayload.id))
      this._onFrameAttached(framePayload.id, framePayload.parentId || null);
    const frame = this._page.frameManager.frame(framePayload.id)!;
    this._removeContextsForFrame(frame, true);
    if (!framePayload.parentId)
      this._workers.clear();
    this._page.frameManager.frameCommittedNewDocumentNavigation(framePayload.id, framePayload.url, framePayload.name || '', framePayload.loaderId, initial);
    if (!initial)
      this._firstNonInitialNavigationCommittedFulfill();
    const pending = this._pendingMainFrameLoaderResolvers.get(framePayload.id);
    if (pending) {
      this._pendingMainFrameLoaderResolvers.delete(framePayload.id);
      pending(framePayload.loaderId);
    }
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
          frame.contextDestroyed(context);
      }
    }
  }

  private _onExecutionContextCreated(contextPayload: Protocol.Runtime.ExecutionContextDescription) {
    if (this._contextIdToContext.has(contextPayload.id))
      return;
    const frame = this._page.frameManager.frame(contextPayload.frameId);
    if (!frame)
      return;
    if (contextPayload.type !== 'normal')
      return;
    const delegate = new WVExecutionContext(this._session, contextPayload.id);
    const context = new dom.FrameExecutionContext(delegate, frame, 'main');
    frame.contextCreated('main', context);
    this._contextIdToContext.set(contextPayload.id, context);
  }

  async navigateFrame(frame: frames.Frame, url: string, referrer: string | undefined): Promise<frames.GotoResult> {
    if (frame.parentFrame())
      throw new Error('Navigating subframes is not supported on stock WebKit RDP — only the main frame can be navigated.');

    if (url.startsWith('data:'))
      return await this._navigateToDataUrl(frame, url);
    return await this._navigateMainFrame(frame, url);
  }

  private async _navigateMainFrame(frame: frames.Frame, url: string): Promise<frames.GotoResult> {
    const loaderIdPromise = new Promise<string>(resolve => {
      this._pendingMainFrameLoaderResolvers.set(frame._id, resolve);
    });
    try {
      this._session.sendMayFail('Runtime.evaluate', {
        expression: `window.location.href = ${JSON.stringify(url)}`,
        returnByValue: true,
      } as any);
      const loaderId = await loaderIdPromise;
      return { newDocumentId: loaderId };
    } finally {
      this._pendingMainFrameLoaderResolvers.delete(frame._id);
    }
  }

  private async _navigateToDataUrl(frame: frames.Frame, url: string): Promise<frames.GotoResult> {
    const match = /^data:([^,]*),([\s\S]*)$/.exec(url);
    if (!match)
      throw new Error(`Invalid data URL: ${url.slice(0, 80)}`);
    const meta = match[1];
    const data = match[2];
    const content = /;base64$/i.test(meta)
      ? Buffer.from(data, 'base64').toString('utf8')
      : decodeURIComponent(data);
    const result = await this._navigateMainFrame(frame, 'about:blank');
    await this._session.sendMayFail('Runtime.evaluate', {
      expression: `(function() { document.open(); document.write(${JSON.stringify(content)}); document.close(); })()`,
    } as any);
    return result;
  }

  _onConsoleMessage(event: Protocol.Console.messageAddedPayload) {
    // Note: do no introduce await in this function, otherwise we lose the ordering.
    // For example, frame.setContent relies on this.
    const { type, level, text, parameters, url, line: lineNumber, column: columnNumber, source } = event.message;

    if (level === 'debug'
        && parameters
        && parameters.length >= 2
        && parameters[0].type === 'string'
        && parameters[0].value === BINDING_CALL_TAG
        && parameters[1].type === 'string') {
      const payload = parameters[1].value as string;
      const context = [...this._contextIdToContext.values()].find(c => c.frame === this._page.mainFrame());
      if (context)
        this._page.onBindingCalled(payload, context).catch(e => debugLogger.log('error', e));
      return;
    }

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

      this._page.addPageError(error, {
        url: url || '',
        lineNumber: (lineNumber || 1) - 1,
        columnNumber: (columnNumber || 1) - 1,
      });
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
      },
    };
    this._onConsoleRepeatCountUpdated({ count: 1, timestamp: event.message.timestamp });
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
      const timestamp = event.timestamp ? event.timestamp * 1000 : Date.now();
      for (let i = count; i < event.count; ++i)
        this._page.addConsoleMessage(null, derivedType, handles, location, handles.length ? undefined : text, timestamp);
      this._lastConsoleMessage.count = event.count;
    }
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

  async bringToFront(): Promise<void> {
  }

  noUtilityWorld() {
    return true;
  }

  async updateRequestInterception(): Promise<void> {
    const enabled = this._page.needsRequestInterception();
    await Promise.all([
      this._updateState('Network.setInterceptionEnabled', { enabled }),
      this._updateState('Network.setResourceCachingDisabled', { disabled: enabled }),
      this._updateState('Network.addInterception', { url: '.*', stage: 'request', isRegex: true }),
    ]);
  }

  async reload(): Promise<void> {
    await this._session.send('Page.reload');
  }

  async addInitScript(initScript: InitScript): Promise<void> {
    await this._updateBootstrapScript();
  }

  async removeInitScripts(initScripts: InitScript[]): Promise<void> {
    await this._updateBootstrapScript();
  }

  async exposePlaywrightBinding() {
    await this._updateBootstrapScript();
    await this._session.sendMayFail('Runtime.evaluate', {
      expression: bindingBridgeSource,
      returnByValue: true,
    } as any);
  }

  private _calculateBootstrapScript(): string {
    const scripts: string[] = [];
    // The injected script lives in the main world here, so snapshot the globals it
    // depends on before any page script runs and stash them on a non-standard property
    // that the injected script falls back to if the page later deletes them.
    scripts.push(saveGlobalsSnapshotSource);
    if (!this._page.browserContext._options.isMobile) {
      scripts.push('delete window.orientation');
      scripts.push('delete window.ondevicemotion');
      scripts.push('delete window.ondeviceorientation');
    }
    scripts.push('if (!window.safari) window.safari = { pushNotification: { toString() { return "[object SafariRemoteNotification]"; } } };');
    scripts.push('if (!window.GestureEvent) window.GestureEvent = function GestureEvent() {};');
    scripts.push(this._publicKeyCredentialScript());
    scripts.push(bindingBridgeSource);
    if (this._dialogEndpoint)
      scripts.push(dialogBridgeSource(this._dialogEndpoint));
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

  async closePage(): Promise<void> {
    await this._session.sendMayFail('Runtime.evaluate', {
      expression: 'window.close()',
      emulateUserGesture: true,
    } as any);
    this._session.connection.close();
  }

  async setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void> {
    throw new Error('Method not implemented');
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
    if (omitDeviceScaleFactor)
      throw new Error('css screenshots are not implemented');
    this.validateScreenshotDimension(rect.width, omitDeviceScaleFactor);
    this.validateScreenshotDimension(rect.height, omitDeviceScaleFactor);
    const result = await progress.race(this._session.send('Page.snapshotRect', { ...rect, coordinateSystem: documentRect ? 'Page' : 'Viewport' }));
    const prefix = 'data:image/png;base64,';
    let buffer: Buffer = Buffer.from(result.dataURL.substr(prefix.length), 'base64');
    if (format === 'jpeg')
      buffer = jpegjs.encode(PNG.sync.read(buffer), quality).data;
    return buffer;
  }

  async getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    throw new Error('Method not implemented');
  }

  async getOwnerFrame(handle: dom.ElementHandle): Promise<string | null> {
    throw new Error('Method not implemented');
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
    const result = await handle.evaluateInUtility(([, node, rect]) => {
      if (!node.isConnected)
        return 'error:notconnected';
      if (!(node instanceof Element))
        return 'error:notvisible';
      const box = node.getBoundingClientRect();
      if (!box.width && !box.height && !node.getClientRects().length)
        return 'error:notvisible';
      const innerW = document.documentElement.clientWidth;
      const innerH = document.documentElement.clientHeight;
      const target = rect
        ? { left: box.left + rect.x, top: box.top + rect.y, right: box.left + rect.x + rect.width, bottom: box.top + rect.y + rect.height }
        : { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
      const fullyVisible = target.left >= 0 && target.top >= 0 && target.right <= innerW && target.bottom <= innerH;
      if (!fullyVisible)
        node.scrollIntoView({ block: 'center', inline: 'center' });
      return 'done';
    }, rect ?? null);
    if (result === 'error:notvisible' || result === 'error:notconnected' || result === 'done')
      return result;
    return 'error:notconnected';
  }

  rafCountForStablePosition(): number {
    return 1;
  }

  async getContentQuads(handle: dom.ElementHandle): Promise<types.Quad[] | null> {
    const result = await handle.evaluateInUtility(([, node]) => {
      let element: Element | null = node as Element;
      while (element && element.nodeType !== 1 /* Node.ELEMENT_NODE */)
        element = element.parentNode as Element | null;
      if (!element)
        return null;
      const rects = element.getClientRects();
      if (!rects.length)
        return null;
      return Array.from(rects, r => [
        { x: r.left, y: r.top },
        { x: r.right, y: r.top },
        { x: r.right, y: r.bottom },
        { x: r.left, y: r.bottom },
      ]);
    }, {});
    if (!result || typeof result === 'string')
      return null;
    return result as types.Quad[];
  }

  async adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>> {
    throw new Error('Method not implemented');
  }

  async inputActionEpilogue(): Promise<void> {
  }

  async resetForReuse(progress: Progress): Promise<void> {
  }

  async getFrameElement(frame: frames.Frame): Promise<dom.ElementHandle> {
    throw new Error('Method not implemented');
  }

  _adoptRequestFromNewProcess(navigationRequest: network.Request, newSession: WVSession, newRequestId: string) {
    for (const [requestId, request] of this._requestIdToRequest) {
      if (request.request === navigationRequest) {
        this._requestIdToRequest.delete(requestId);
        request.adoptRequestFromNewProcess(newSession, newRequestId);
        this._requestIdToRequest.set(newRequestId, request);
        return;
      }
    }
  }

  _onRequestWillBeSent(session: WVSession, event: Protocol.Network.requestWillBeSentPayload) {
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

  private _onRequest(session: WVSession, event: Protocol.Network.requestWillBeSentPayload, intercepted: boolean) {
    let redirectedFrom: WVInterceptableRequest | null = null;
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
    const request = new WVInterceptableRequest(session, frame, event, redirectedFrom, documentId);
    let route;
    if (intercepted) {
      route = new WVRouteImpl(session, event.requestId);
      // There is no point in waiting for the raw headers in Network.responseReceived when intercepting.
      // Use provisional headers as raw headers, so that client can call allHeaders() from the route handler.
      request.request.setRawRequestHeaders(null);
    }
    this._requestIdToRequest.set(event.requestId, request);
    this._page.frameManager.requestStarted(request.request, route);
  }

  private _handleRequestRedirect(request: WVInterceptableRequest, requestId: string, responsePayload: Protocol.Network.Response, timestamp: number) {
    const response = request.createResponse(responsePayload);
    response._setHttpVersion(null);
    response._securityDetailsFinished();
    response._serverAddrFinished();
    response.setResponseHeadersSize(null);
    response.setEncodedBodySize(null);
    response._requestFinished(responsePayload.timing ? helper.secondsToRoundishMillis(timestamp - request._timestamp) : -1);
    this._requestIdToRequest.delete(requestId);
    this._page.frameManager.requestReceivedResponse(response);
    this._page.frameManager.reportRequestFinished(request.request, response);
  }

  _onRequestIntercepted(session: WVSession, event: Protocol.Network.requestInterceptedPayload) {
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

  _onResponseReceived(session: WVSession, event: Protocol.Network.responseReceivedPayload) {
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
      response._setHttpVersion(event.metrics?.protocol ?? null);
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

  _onLoadingFailed(session: WVSession, event: Protocol.Network.loadingFailedPayload) {
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
      response._setHttpVersion(null);
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

  shouldToggleStyleSheetToSyncAnimations(): boolean {
    return true;
  }

  async setDockTile(image: Buffer): Promise<void> {
  }
}

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

const BINDING_CALL_TAG = '__pw_binding_call__';
const bindingBridgeSource = `
  if (!window['${PageBinding.kBindingName}']) {
    Object.defineProperty(window, '${PageBinding.kBindingName}', {
      configurable: true,
      writable: false,
      value: function(payload) { console.debug('${BINDING_CALL_TAG}', payload); },
    });
  }
`;

// Stock WebKit RDP has no dialog API. We override window.alert/confirm/prompt
// to tunnel calls through a synchronous XHR to our DialogBridge HTTP server,
// which holds the response until the host-side Dialog handler resolves.
function dialogBridgeSource(endpoint: string): string {
  return `
    (function() {
      const URL = ${JSON.stringify(endpoint)};
      function post(type, message, defaultValue) {
        const xhr = new XMLHttpRequest();
        try { xhr.open('POST', URL, false); } catch (e) { return null; }
        // text/plain body keeps this a "simple" CORS request — no preflight.
        try { xhr.send(JSON.stringify({ type: type, message: message, defaultValue: defaultValue })); }
        catch (e) { return null; }
        if (xhr.status !== 200) return null;
        try { return JSON.parse(xhr.responseText); } catch (e) { return null; }
      }
      Object.defineProperty(window, 'alert', {
        configurable: true, writable: false,
        value: function(message) { post('alert', String(message == null ? '' : message), ''); },
      });
      Object.defineProperty(window, 'confirm', {
        configurable: true, writable: false,
        value: function(message) {
          const r = post('confirm', String(message == null ? '' : message), '');
          return !!(r && r.accept);
        },
      });
      Object.defineProperty(window, 'prompt', {
        configurable: true, writable: false,
        value: function(message, defaultValue) {
          const def = defaultValue == null ? '' : String(defaultValue);
          const r = post('prompt', String(message == null ? '' : message), def);
          if (!r || !r.accept) return null;
          return typeof r.promptText === 'string' ? r.promptText : def;
        },
      });
    })();
  `;
}
