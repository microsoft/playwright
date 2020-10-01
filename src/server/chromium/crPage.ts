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

import * as dom from '../dom';
import * as frames from '../frames';
import { helper, RegisteredListener } from '../helper';
import * as network from '../network';
import { CRSession, CRConnection, CRSessionEvents } from './crConnection';
import { CRExecutionContext } from './crExecutionContext';
import { CRNetworkManager } from './crNetworkManager';
import { Page, Worker, PageBinding } from '../page';
import { Protocol } from './protocol';
import { toConsoleMessageLocation, exceptionToError, releaseObject } from './crProtocolHelper';
import * as dialog from '../dialog';
import { PageDelegate } from '../page';
import * as path from 'path';
import { RawMouseImpl, RawKeyboardImpl } from './crInput';
import { getAccessibilityTree } from './crAccessibility';
import { CRCoverage } from './crCoverage';
import { CRPDF } from './crPdf';
import { CRBrowserContext } from './crBrowser';
import * as types from '../types';
import { ConsoleMessage } from '../console';
import * as sourceMap from '../../utils/sourceMap';
import { rewriteErrorMessage } from '../../utils/stackTrace';
import { assert, headersArrayToObject, createGuid } from '../../utils/utils';
import { VideoRecorder } from './videoRecorder';


const UTILITY_WORLD_NAME = '__playwright_utility_world__';

export class CRPage implements PageDelegate {
  readonly _mainFrameSession: FrameSession;
  readonly _sessions = new Map<Protocol.Target.TargetID, FrameSession>();
  readonly _page: Page;
  readonly rawMouse: RawMouseImpl;
  readonly rawKeyboard: RawKeyboardImpl;
  readonly _targetId: string;
  readonly _opener: CRPage | null;
  private readonly _pdf: CRPDF;
  private readonly _coverage: CRCoverage;
  readonly _browserContext: CRBrowserContext;
  private readonly _pagePromise: Promise<Page | Error>;
  _initializedPage: Page | null = null;

  // Holds window features for the next popup being opened via window.open,
  // until the popup target arrives. This could be racy if two oopifs
  // simultaneously call window.open with window features: the order
  // of their Page.windowOpen events is not guaranteed to match the order
  // of new popup targets.
  readonly _nextWindowOpenPopupFeatures: string[][] = [];

  constructor(client: CRSession, targetId: string, browserContext: CRBrowserContext, opener: CRPage | null, hasUIWindow: boolean) {
    this._targetId = targetId;
    this._opener = opener;
    this.rawKeyboard = new RawKeyboardImpl(client, browserContext._browser._isMac);
    this.rawMouse = new RawMouseImpl(client);
    this._pdf = new CRPDF(client);
    this._coverage = new CRCoverage(client);
    this._browserContext = browserContext;
    this._page = new Page(this, browserContext);
    this._mainFrameSession = new FrameSession(this, client, targetId, null);
    this._sessions.set(targetId, this._mainFrameSession);
    client.once(CRSessionEvents.Disconnected, () => this._page._didDisconnect());
    if (opener && !browserContext._options.noDefaultViewport) {
      const features = opener._nextWindowOpenPopupFeatures.shift() || [];
      const viewportSize = helper.getViewportSizeFromWindowFeatures(features);
      if (viewportSize)
        this._page._state.viewportSize = viewportSize;
    }
    this._pagePromise = this._mainFrameSession._initialize(hasUIWindow).then(() => this._initializedPage = this._page).catch(e => e);
  }

  private async _forAllFrameSessions(cb: (frame: FrameSession) => Promise<any>) {
    await Promise.all(Array.from(this._sessions.values()).map(frame => cb(frame)));
  }

  private _sessionForFrame(frame: frames.Frame): FrameSession {
    // Frame id equals target id.
    while (!this._sessions.has(frame._id)) {
      const parent = frame.parentFrame();
      if (!parent)
        throw new Error(`Frame has been detached.`);
      frame = parent;
    }
    return this._sessions.get(frame._id)!;
  }

  private _sessionForHandle(handle: dom.ElementHandle): FrameSession {
    const frame = handle._context.frame;
    return this._sessionForFrame(frame);
  }

  async pageOrError(): Promise<Page | Error> {
    return this._pagePromise;
  }

  didClose() {
    for (const session of this._sessions.values())
      session.dispose();
    this._page._didClose();
    this._mainFrameSession._stopScreencast().catch(() => {});
  }

  async navigateFrame(frame: frames.Frame, url: string, referrer: string | undefined): Promise<frames.GotoResult> {
    return this._sessionForFrame(frame)._navigate(frame, url, referrer);
  }

  async exposeBinding(binding: PageBinding) {
    await this._forAllFrameSessions(frame => frame._initBinding(binding));
    await Promise.all(this._page.frames().map(frame => frame._evaluateExpression(binding.source, false, {}).catch(e => {})));
  }

  async updateExtraHTTPHeaders(): Promise<void> {
    await this._forAllFrameSessions(frame => frame._updateExtraHTTPHeaders());
  }

  async updateGeolocation(): Promise<void> {
    await this._forAllFrameSessions(frame => frame._updateGeolocation());
  }

  async updateOffline(): Promise<void> {
    await this._forAllFrameSessions(frame => frame._updateOffline());
  }

  async updateHttpCredentials(): Promise<void> {
    await this._forAllFrameSessions(frame => frame._updateHttpCredentials());
  }

  async setViewportSize(viewportSize: types.Size): Promise<void> {
    assert(this._page._state.viewportSize === viewportSize);
    await this._mainFrameSession._updateViewport();
  }

  async bringToFront(): Promise<void> {
    await this._mainFrameSession._client.send('Page.bringToFront');
  }

  async updateEmulateMedia(): Promise<void> {
    await this._forAllFrameSessions(frame => frame._updateEmulateMedia());
  }

  async updateRequestInterception(): Promise<void> {
    await this._forAllFrameSessions(frame => frame._updateRequestInterception());
  }

  async setFileChooserIntercepted(enabled: boolean) {
    await this._forAllFrameSessions(frame => frame._setFileChooserIntercepted(enabled));
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
    await this._mainFrameSession._client.send('Page.reload');
  }

  private async _go(delta: number): Promise<boolean> {
    const history = await this._mainFrameSession._client.send('Page.getNavigationHistory');
    const entry = history.entries[history.currentIndex + delta];
    if (!entry)
      return false;
    await this._mainFrameSession._client.send('Page.navigateToHistoryEntry', { entryId: entry.id });
    return true;
  }

  goBack(): Promise<boolean> {
    return this._go(-1);
  }

  goForward(): Promise<boolean> {
    return this._go(+1);
  }

  async evaluateOnNewDocument(source: string): Promise<void> {
    await this._forAllFrameSessions(frame => frame._evaluateOnNewDocument(source));
  }

  async closePage(runBeforeUnload: boolean): Promise<void> {
    if (runBeforeUnload)
      await this._mainFrameSession._client.send('Page.close');
    else
      await this._browserContext._browser._closePage(this);
  }

  canScreenshotOutsideViewport(): boolean {
    return false;
  }

  async setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void> {
    await this._mainFrameSession._client.send('Emulation.setDefaultBackgroundColorOverride', { color });
  }

  async startScreencast(options: types.PageScreencastOptions): Promise<void> {
    await this._mainFrameSession._startScreencast(createGuid(), options);
  }

  async stopScreencast(): Promise<void> {
    await this._mainFrameSession._stopScreencast();
  }

  async takeScreenshot(format: 'png' | 'jpeg', documentRect: types.Rect | undefined, viewportRect: types.Rect | undefined, quality: number | undefined): Promise<Buffer> {
    const { visualViewport } = await this._mainFrameSession._client.send('Page.getLayoutMetrics');
    if (!documentRect) {
      documentRect = {
        x: visualViewport.pageX + viewportRect!.x,
        y: visualViewport.pageY + viewportRect!.y,
        ...helper.enclosingIntSize({
          width: viewportRect!.width / visualViewport.scale,
          height: viewportRect!.height / visualViewport.scale,
        })
      };
    }
    // When taking screenshots with documentRect (based on the page content, not viewport),
    // ignore current page scale.
    const clip = { ...documentRect, scale: viewportRect ? visualViewport.scale : 1 };
    const result = await this._mainFrameSession._client.send('Page.captureScreenshot', { format, quality, clip });
    return Buffer.from(result.data, 'base64');
  }

  async resetViewport(): Promise<void> {
    await this._mainFrameSession._client.send('Emulation.setDeviceMetricsOverride', { mobile: false, width: 0, height: 0, deviceScaleFactor: 0 });
  }

  async getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    return this._sessionForHandle(handle)._getContentFrame(handle);
  }

  async getOwnerFrame(handle: dom.ElementHandle): Promise<string | null> {
    return this._sessionForHandle(handle)._getOwnerFrame(handle);
  }

  isElementHandle(remoteObject: any): boolean {
    return (remoteObject as Protocol.Runtime.RemoteObject).subtype === 'node';
  }

  async getBoundingBox(handle: dom.ElementHandle): Promise<types.Rect | null> {
    return this._sessionForHandle(handle)._getBoundingBox(handle);
  }

  async scrollRectIntoViewIfNeeded(handle: dom.ElementHandle, rect?: types.Rect): Promise<'error:notvisible' | 'error:notconnected' | 'done'> {
    return this._sessionForHandle(handle)._scrollRectIntoViewIfNeeded(handle, rect);
  }

  rafCountForStablePosition(): number {
    return 1;
  }

  async getContentQuads(handle: dom.ElementHandle): Promise<types.Quad[] | null> {
    return this._sessionForHandle(handle)._getContentQuads(handle);
  }

  async setInputFiles(handle: dom.ElementHandle<HTMLInputElement>, files: types.FilePayload[]): Promise<void> {
    await handle._evaluateInUtility(([injected, node, files]) =>
      injected.setInputFiles(node, files), files);
  }

  async adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>> {
    return this._sessionForHandle(handle)._adoptElementHandle<T>(handle, to);
  }

  async getAccessibilityTree(needle?: dom.ElementHandle) {
    return getAccessibilityTree(this._mainFrameSession._client, needle);
  }

  async inputActionEpilogue(): Promise<void> {
    await this._mainFrameSession._client.send('Page.enable').catch(e => {});
  }

  async pdf(options?: types.PDFOptions): Promise<Buffer> {
    return this._pdf.generate(options);
  }

  coverage(): CRCoverage {
    return this._coverage;
  }

  async getFrameElement(frame: frames.Frame): Promise<dom.ElementHandle> {
    let parent = frame.parentFrame();
    if (!parent)
      throw new Error('Frame has been detached.');
    const parentSession = this._sessionForFrame(parent);
    const { backendNodeId } = await parentSession._client.send('DOM.getFrameOwner', { frameId: frame._id }).catch(e => {
      if (e instanceof Error && e.message.includes('Frame with the given id was not found.'))
        rewriteErrorMessage(e, 'Frame has been detached.');
      throw e;
    });
    parent = frame.parentFrame();
    if (!parent)
      throw new Error('Frame has been detached.');
    return parentSession._adoptBackendNodeId(backendNodeId, await parent._mainContext());
  }
}

class FrameSession {
  readonly _client: CRSession;
  readonly _crPage: CRPage;
  readonly _page: Page;
  readonly _networkManager: CRNetworkManager;
  private readonly _contextIdToContext = new Map<number, dom.FrameExecutionContext>();
  private _eventListeners: RegisteredListener[] = [];
  readonly _targetId: string;
  private _firstNonInitialNavigationCommittedPromise: Promise<void>;
  private _firstNonInitialNavigationCommittedFulfill = () => {};
  private _firstNonInitialNavigationCommittedReject = (e: Error) => {};
  private _windowId: number | undefined;
  // Marks the oopif session that remote -> local transition has happened in the parent.
  // See Target.detachedFromTarget handler for details.
  private _swappedIn = false;
  private _videoRecorder: VideoRecorder | null = null;
  private _screencastId: string | null = null;
  private _screencastState: 'stopped' | 'starting' | 'started' = 'stopped';

  constructor(crPage: CRPage, client: CRSession, targetId: string, parentSession: FrameSession | null) {
    this._client = client;
    this._crPage = crPage;
    this._page = crPage._page;
    this._targetId = targetId;
    this._networkManager = new CRNetworkManager(client, this._page, parentSession ? parentSession._networkManager : null);
    this._firstNonInitialNavigationCommittedPromise = new Promise((f, r) => {
      this._firstNonInitialNavigationCommittedFulfill = f;
      this._firstNonInitialNavigationCommittedReject = r;
    });
    client.once(CRSessionEvents.Disconnected, () => {
      this._firstNonInitialNavigationCommittedReject(new Error('Page closed'));
    });
  }

  private _isMainFrame(): boolean {
    return this._targetId === this._crPage._targetId;
  }

  private _addSessionListeners() {
    this._eventListeners = [
      helper.addEventListener(this._client, 'Inspector.targetCrashed', event => this._onTargetCrashed()),
      helper.addEventListener(this._client, 'Log.entryAdded', event => this._onLogEntryAdded(event)),
      helper.addEventListener(this._client, 'Page.fileChooserOpened', event => this._onFileChooserOpened(event)),
      helper.addEventListener(this._client, 'Page.frameAttached', event => this._onFrameAttached(event.frameId, event.parentFrameId)),
      helper.addEventListener(this._client, 'Page.frameDetached', event => this._onFrameDetached(event.frameId)),
      helper.addEventListener(this._client, 'Page.frameNavigated', event => this._onFrameNavigated(event.frame, false)),
      helper.addEventListener(this._client, 'Page.frameRequestedNavigation', event => this._onFrameRequestedNavigation(event)),
      helper.addEventListener(this._client, 'Page.frameStoppedLoading', event => this._onFrameStoppedLoading(event.frameId)),
      helper.addEventListener(this._client, 'Page.javascriptDialogOpening', event => this._onDialog(event)),
      helper.addEventListener(this._client, 'Page.navigatedWithinDocument', event => this._onFrameNavigatedWithinDocument(event.frameId, event.url)),
      helper.addEventListener(this._client, 'Page.downloadWillBegin', event => this._onDownloadWillBegin(event)),
      helper.addEventListener(this._client, 'Page.downloadProgress', event => this._onDownloadProgress(event)),
      helper.addEventListener(this._client, 'Page.screencastFrame', event => this._onScreencastFrame(event)),
      helper.addEventListener(this._client, 'Runtime.bindingCalled', event => this._onBindingCalled(event)),
      helper.addEventListener(this._client, 'Runtime.consoleAPICalled', event => this._onConsoleAPI(event)),
      helper.addEventListener(this._client, 'Runtime.exceptionThrown', exception => this._handleException(exception.exceptionDetails)),
      helper.addEventListener(this._client, 'Runtime.executionContextCreated', event => this._onExecutionContextCreated(event.context)),
      helper.addEventListener(this._client, 'Runtime.executionContextDestroyed', event => this._onExecutionContextDestroyed(event.executionContextId)),
      helper.addEventListener(this._client, 'Runtime.executionContextsCleared', event => this._onExecutionContextsCleared()),
      helper.addEventListener(this._client, 'Target.attachedToTarget', event => this._onAttachedToTarget(event)),
      helper.addEventListener(this._client, 'Target.detachedFromTarget', event => this._onDetachedFromTarget(event)),
      helper.addEventListener(this._client, 'Page.windowOpen', event => this._onWindowOpen(event)),
    ];
  }

  async _initialize(hasUIWindow: boolean) {
    if (hasUIWindow && !this._crPage._browserContext._options.noDefaultViewport) {
      const { windowId } = await this._client.send('Browser.getWindowForTarget');
      this._windowId = windowId;
    }
    let lifecycleEventsEnabled: Promise<any>;
    if (!this._isMainFrame())
      this._addSessionListeners();
    const promises: Promise<any>[] = [
      this._client.send('Page.enable'),
      this._client.send('Page.getFrameTree').then(({frameTree}) => {
        if (this._isMainFrame()) {
          this._handleFrameTree(frameTree);
          this._addSessionListeners();
        }
        const localFrames = this._isMainFrame() ? this._page.frames() : [ this._page._frameManager.frame(this._targetId)! ];
        for (const frame of localFrames) {
          // Note: frames might be removed before we send these.
          this._client._sendMayFail('Page.createIsolatedWorld', {
            frameId: frame._id,
            grantUniveralAccess: true,
            worldName: UTILITY_WORLD_NAME,
          });
          for (const binding of this._crPage._browserContext._pageBindings.values())
            frame._evaluateExpression(binding.source, false, {}).catch(e => {});
        }
        const isInitialEmptyPage = this._isMainFrame() && this._page.mainFrame().url() === ':';
        if (isInitialEmptyPage) {
          // Ignore lifecycle events for the initial empty page. It is never the final page
          // hence we are going to get more lifecycle updates after the actual navigation has
          // started (even if the target url is about:blank).
          lifecycleEventsEnabled.then(() => {
            this._eventListeners.push(helper.addEventListener(this._client, 'Page.lifecycleEvent', event => this._onLifecycleEvent(event)));
          });
        } else {
          this._firstNonInitialNavigationCommittedFulfill();
          this._eventListeners.push(helper.addEventListener(this._client, 'Page.lifecycleEvent', event => this._onLifecycleEvent(event)));
        }
      }),
      this._client.send('Log.enable', {}),
      lifecycleEventsEnabled = this._client.send('Page.setLifecycleEventsEnabled', { enabled: true }),
      this._client.send('Runtime.enable', {}),
      this._client.send('Page.addScriptToEvaluateOnNewDocument', {
        source: sourceMap.generateSourceUrl(),
        worldName: UTILITY_WORLD_NAME,
      }),
      this._networkManager.initialize(),
      this._client.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }),
      this._client.send('Emulation.setFocusEmulationEnabled', { enabled: true }),
    ];
    const options = this._crPage._browserContext._options;
    if (options.bypassCSP)
      promises.push(this._client.send('Page.setBypassCSP', { enabled: true }));
    if (options.ignoreHTTPSErrors)
      promises.push(this._client.send('Security.setIgnoreCertificateErrors', { ignore: true }));
    if (this._isMainFrame())
      promises.push(this._updateViewport());
    if (options.hasTouch)
      promises.push(this._client.send('Emulation.setTouchEmulationEnabled', { enabled: true }));
    if (options.javaScriptEnabled === false)
      promises.push(this._client.send('Emulation.setScriptExecutionDisabled', { value: true }));
    if (options.userAgent || options.locale)
      promises.push(this._client.send('Emulation.setUserAgentOverride', { userAgent: options.userAgent || '', acceptLanguage: options.locale }));
    if (options.locale)
      promises.push(emulateLocale(this._client, options.locale));
    if (options.timezoneId)
      promises.push(emulateTimezone(this._client, options.timezoneId));
    promises.push(this._updateGeolocation());
    promises.push(this._updateExtraHTTPHeaders());
    promises.push(this._updateRequestInterception());
    promises.push(this._updateOffline());
    promises.push(this._updateHttpCredentials());
    promises.push(this._updateEmulateMedia());
    for (const binding of this._crPage._browserContext._pageBindings.values())
      promises.push(this._initBinding(binding));
    for (const binding of this._crPage._page._pageBindings.values())
      promises.push(this._initBinding(binding));
    for (const source of this._crPage._browserContext._evaluateOnNewDocumentSources)
      promises.push(this._evaluateOnNewDocument(source));
    for (const source of this._crPage._page._evaluateOnNewDocumentSources)
      promises.push(this._evaluateOnNewDocument(source));
    if (this._isMainFrame() && this._crPage._browserContext._options.videosPath) {
      const size = this._crPage._browserContext._options.videoSize || this._crPage._browserContext._options.viewport || { width: 1280, height: 720 };
      const screencastId = createGuid();
      const outputFile = path.join(this._crPage._browserContext._options.videosPath, screencastId + '.webm');
      promises.push(this._crPage._browserContext._ensureVideosPath().then(() => {
        return this._startScreencast(screencastId, {
          ...size,
          outputFile,
        });
      }));
    }
    promises.push(this._client.send('Runtime.runIfWaitingForDebugger'));
    promises.push(this._firstNonInitialNavigationCommittedPromise);
    await Promise.all(promises);
  }

  dispose() {
    helper.removeEventListeners(this._eventListeners);
    this._networkManager.dispose();
    this._crPage._sessions.delete(this._targetId);
  }

  async _navigate(frame: frames.Frame, url: string, referrer: string | undefined): Promise<frames.GotoResult> {
    const response = await this._client.send('Page.navigate', { url, referrer, frameId: frame._id });
    if (response.errorText)
      throw new Error(`${response.errorText} at ${url}`);
    return { newDocumentId: response.loaderId };
  }

  _onLifecycleEvent(event: Protocol.Page.lifecycleEventPayload) {
    if (event.name === 'load')
      this._page._frameManager.frameLifecycleEvent(event.frameId, 'load');
    else if (event.name === 'DOMContentLoaded')
      this._page._frameManager.frameLifecycleEvent(event.frameId, 'domcontentloaded');
  }

  _onFrameStoppedLoading(frameId: string) {
    this._page._frameManager.frameStoppedLoading(frameId);
  }

  _handleFrameTree(frameTree: Protocol.Page.FrameTree) {
    this._onFrameAttached(frameTree.frame.id, frameTree.frame.parentId || null);
    this._onFrameNavigated(frameTree.frame, true);
    if (!frameTree.childFrames)
      return;

    for (const child of frameTree.childFrames)
      this._handleFrameTree(child);
  }

  _onFrameAttached(frameId: string, parentFrameId: string | null) {
    const frameSession = this._crPage._sessions.get(frameId);
    if (frameSession && frameId !== this._targetId) {
      // This is a remote -> local frame transition.
      frameSession._swappedIn = true;
      const frame = this._page._frameManager.frame(frameId)!;
      this._page._frameManager.removeChildFramesRecursively(frame);
      return;
    }
    this._page._frameManager.frameAttached(frameId, parentFrameId);
  }

  _onFrameNavigated(framePayload: Protocol.Page.Frame, initial: boolean) {
    this._page._frameManager.frameCommittedNewDocumentNavigation(framePayload.id, framePayload.url + (framePayload.urlFragment || ''), framePayload.name || '', framePayload.loaderId, initial);
    if (!initial)
      this._firstNonInitialNavigationCommittedFulfill();
  }

  _onFrameRequestedNavigation(payload: Protocol.Page.frameRequestedNavigationPayload) {
    if (payload.disposition === 'currentTab')
      this._page._frameManager.frameRequestedNavigation(payload.frameId);
  }

  _onFrameNavigatedWithinDocument(frameId: string, url: string) {
    this._page._frameManager.frameCommittedSameDocumentNavigation(frameId, url);
  }

  _onFrameDetached(frameId: string) {
    if (this._crPage._sessions.has(frameId)) {
      // This is a local -> remote frame transtion.
      // We already got a new target and handled frame reattach - nothing to do here.
      return;
    }
    this._page._frameManager.frameDetached(frameId);
  }

  _onExecutionContextCreated(contextPayload: Protocol.Runtime.ExecutionContextDescription) {
    const frame = contextPayload.auxData ? this._page._frameManager.frame(contextPayload.auxData.frameId) : null;
    if (!frame)
      return;
    const delegate = new CRExecutionContext(this._client, contextPayload);
    const context = new dom.FrameExecutionContext(delegate, frame);
    if (contextPayload.auxData && !!contextPayload.auxData.isDefault)
      frame._contextCreated('main', context);
    else if (contextPayload.name === UTILITY_WORLD_NAME)
      frame._contextCreated('utility', context);
    this._contextIdToContext.set(contextPayload.id, context);
  }

  _onExecutionContextDestroyed(executionContextId: number) {
    const context = this._contextIdToContext.get(executionContextId);
    if (!context)
      return;
    this._contextIdToContext.delete(executionContextId);
    context.frame._contextDestroyed(context);
  }

  _onExecutionContextsCleared() {
    for (const contextId of Array.from(this._contextIdToContext.keys()))
      this._onExecutionContextDestroyed(contextId);
  }

  _onAttachedToTarget(event: Protocol.Target.attachedToTargetPayload) {
    const session = CRConnection.fromSession(this._client).session(event.sessionId)!;

    if (event.targetInfo.type === 'iframe') {
      // Frame id equals target id.
      const targetId = event.targetInfo.targetId;
      const frame = this._page._frameManager.frame(targetId)!;
      this._page._frameManager.removeChildFramesRecursively(frame);
      const frameSession = new FrameSession(this._crPage, session, targetId, this);
      this._crPage._sessions.set(targetId, frameSession);
      frameSession._initialize(false).catch(e => e);
      return;
    }

    if (event.targetInfo.type !== 'worker') {
      // Ideally, detaching should resume any target, but there is a bug in the backend.
      session._sendMayFail('Runtime.runIfWaitingForDebugger').then(() => {
        this._client._sendMayFail('Target.detachFromTarget', { sessionId: event.sessionId });
      });
      return;
    }

    const url = event.targetInfo.url;
    const worker = new Worker(url);
    this._page._addWorker(event.sessionId, worker);
    session.once('Runtime.executionContextCreated', async event => {
      worker._createExecutionContext(new CRExecutionContext(session, event.context));
    });
    Promise.all([
      session._sendMayFail('Runtime.enable'),
      session._sendMayFail('Network.enable'),
      session._sendMayFail('Runtime.runIfWaitingForDebugger'),
    ]);  // This might fail if the target is closed before we initialize.
    session.on('Runtime.consoleAPICalled', event => {
      const args = event.args.map(o => worker._existingExecutionContext!.createHandle(o));
      this._page._addConsoleMessage(event.type, args, toConsoleMessageLocation(event.stackTrace));
    });
    session.on('Runtime.exceptionThrown', exception => this._page.emit(Page.Events.PageError, exceptionToError(exception.exceptionDetails)));
    // TODO: attribute workers to the right frame.
    this._networkManager.instrumentNetworkEvents(session, this._page._frameManager.frame(this._targetId)!);
  }

  _onDetachedFromTarget(event: Protocol.Target.detachedFromTargetPayload) {
    // This might be a worker...
    this._page._removeWorker(event.sessionId);

    // ... or an oopif.
    const childFrameSession = this._crPage._sessions.get(event.targetId!);
    if (!childFrameSession)
      return;

    // Usually, we get frameAttached in this session first and mark child as swappedIn.
    if (childFrameSession._swappedIn) {
      childFrameSession.dispose();
      return;
    }

    // However, sometimes we get detachedFromTarget before frameAttached.
    // In this case we don't know wheter this is a remote frame detach,
    // or just a remote -> local transition. In the latter case, frameAttached
    // is already inflight, so let's make a safe roundtrip to ensure it arrives.
    this._client.send('Page.enable').catch(e => null).then(() => {
      // Child was not swapped in - that means frameAttached did not happen and
      // this is remote detach rather than remote -> local swap.
      if (!childFrameSession._swappedIn)
        this._page._frameManager.frameDetached(event.targetId!);
      childFrameSession.dispose();
    });
  }

  _onWindowOpen(event: Protocol.Page.windowOpenPayload) {
    this._crPage._nextWindowOpenPopupFeatures.push(event.windowFeatures);
  }

  async _onConsoleAPI(event: Protocol.Runtime.consoleAPICalledPayload) {
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
    const context = this._contextIdToContext.get(event.executionContextId)!;
    const values = event.args.map(arg => context.createHandle(arg));
    this._page._addConsoleMessage(event.type, values, toConsoleMessageLocation(event.stackTrace));
  }

  async _initBinding(binding: PageBinding) {
    await Promise.all([
      this._client.send('Runtime.addBinding', { name: binding.name }),
      this._client.send('Page.addScriptToEvaluateOnNewDocument', { source: binding.source })
    ]);
  }

  async _onBindingCalled(event: Protocol.Runtime.bindingCalledPayload) {
    const context = this._contextIdToContext.get(event.executionContextId)!;
    const pageOrError = await this._crPage.pageOrError();
    if (!(pageOrError instanceof Error))
      this._page._onBindingCalled(event.payload, context);
  }

  _onDialog(event: Protocol.Page.javascriptDialogOpeningPayload) {
    this._page.emit(Page.Events.Dialog, new dialog.Dialog(
        event.type,
        event.message,
        async (accept: boolean, promptText?: string) => {
          await this._client.send('Page.handleJavaScriptDialog', { accept, promptText });
        },
        event.defaultPrompt));
  }

  _handleException(exceptionDetails: Protocol.Runtime.ExceptionDetails) {
    this._page.emit(Page.Events.PageError, exceptionToError(exceptionDetails));
  }

  async _onTargetCrashed() {
    this._client._markAsCrashed();
    this._page._didCrash();
  }

  _onLogEntryAdded(event: Protocol.Log.entryAddedPayload) {
    const {level, text, args, source, url, lineNumber} = event.entry;
    if (args)
      args.map(arg => releaseObject(this._client, arg.objectId!));
    if (source !== 'worker') {
      const location: types.ConsoleMessageLocation = {
        url: url || '',
        lineNumber: lineNumber || 0,
        columnNumber: 0,
      };
      this._page.emit(Page.Events.Console, new ConsoleMessage(level, text, [], location));
    }
  }

  async _onFileChooserOpened(event: Protocol.Page.fileChooserOpenedPayload) {
    const frame = this._page._frameManager.frame(event.frameId)!;
    const utilityContext = await frame._utilityContext();
    const handle = await this._adoptBackendNodeId(event.backendNodeId, utilityContext);
    this._page._onFileChooserOpened(handle);
  }

  _onDownloadWillBegin(payload: Protocol.Page.downloadWillBeginPayload) {
    let originPage = this._crPage._initializedPage;
    // If it's a new window download, report it on the opener page.
    if (!originPage) {
      // Resume the page creation with an error. The page will automatically close right
      // after the download begins.
      this._firstNonInitialNavigationCommittedReject(new Error('Starting new page download'));
      if (this._crPage._opener)
        originPage = this._crPage._opener._initializedPage;
    }
    if (!originPage)
      return;
    this._crPage._browserContext._browser._downloadCreated(originPage, payload.guid, payload.url, payload.suggestedFilename);
  }

  _onDownloadProgress(payload: Protocol.Page.downloadProgressPayload) {
    if (payload.state === 'completed')
      this._crPage._browserContext._browser._downloadFinished(payload.guid, '');
    if (payload.state === 'canceled')
      this._crPage._browserContext._browser._downloadFinished(payload.guid, 'canceled');
  }

  _onScreencastFrame(payload: Protocol.Page.screencastFramePayload) {
    if (!this._videoRecorder)
      return;
    const buffer = Buffer.from(payload.data, 'base64');
    this._videoRecorder.writeFrame(buffer, payload.metadata.timestamp!);
    // The target may be closed before receiving the ack.
    this._client.send('Page.screencastFrameAck', {sessionId: payload.sessionId}).catch(() => {});
  }

  async _startScreencast(screencastId: string, options: types.PageScreencastOptions): Promise<void> {
    if (this._screencastState !== 'stopped')
      throw new Error('Already started');
    const videoRecorder = await VideoRecorder.launch(options);
    this._screencastState = 'starting';
    try {
      await this._client.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 90,
        maxWidth: options.width,
        maxHeight: options.height,
      });
      this._screencastState = 'started';
      this._videoRecorder = videoRecorder;
      this._screencastId = screencastId;
      this._crPage._browserContext._browser._videoStarted(this._crPage._browserContext, screencastId, options.outputFile, this._crPage.pageOrError());
    } catch (e) {
      videoRecorder.stop().catch(() => {});
      throw e;
    }
  }

  async _stopScreencast(): Promise<void> {
    if (this._screencastState !== 'started')
      throw new Error('No screencast in progress, current state: ' + this._screencastState);
    try {
      await this._client.send('Page.stopScreencast');
    } finally {
      const recorder = this._videoRecorder!;
      const screencastId = this._screencastId!;
      this._videoRecorder = null;
      this._screencastId = null;
      this._screencastState = 'stopped';
      await recorder.stop().catch(() => {});
      this._crPage._browserContext._browser._videoFinished(screencastId);
    }
  }

  async _updateExtraHTTPHeaders(): Promise<void> {
    const headers = network.mergeHeaders([
      this._crPage._browserContext._options.extraHTTPHeaders,
      this._page._state.extraHTTPHeaders
    ]);
    await this._client.send('Network.setExtraHTTPHeaders', { headers: headersArrayToObject(headers, false /* lowerCase */) });
  }

  async _updateGeolocation(): Promise<void> {
    const geolocation = this._crPage._browserContext._options.geolocation;
    await this._client.send('Emulation.setGeolocationOverride', geolocation || {});
  }

  async _updateOffline(): Promise<void> {
    const offline = !!this._crPage._browserContext._options.offline;
    await this._networkManager.setOffline(offline);
  }

  async _updateHttpCredentials(): Promise<void> {
    const credentials = this._crPage._browserContext._options.httpCredentials || null;
    await this._networkManager.authenticate(credentials);
  }

  async _updateViewport(): Promise<void> {
    assert(this._isMainFrame());
    const options = this._crPage._browserContext._options;
    const viewportSize = this._page._state.viewportSize;
    if (viewportSize === null)
      return;
    const isLandscape = viewportSize.width > viewportSize.height;
    const promises = [
      this._client.send('Emulation.setDeviceMetricsOverride', {
        mobile: !!options.isMobile,
        width: viewportSize.width,
        height: viewportSize.height,
        screenWidth: viewportSize.width,
        screenHeight: viewportSize.height,
        deviceScaleFactor: options.deviceScaleFactor || 1,
        screenOrientation: isLandscape ? { angle: 90, type: 'landscapePrimary' } : { angle: 0, type: 'portraitPrimary' },
      }),
    ];
    if (this._windowId) {
      let insets = { width: 0, height: 0 };
      if (this._crPage._browserContext._browser._options.headful) {
        // TODO: popup windows have their own insets.
        insets = { width: 24, height: 88 };
        if (process.platform === 'win32')
          insets = { width: 16, height: 88 };
        else if (process.platform === 'linux')
          insets = { width: 8, height: 85 };
        else if (process.platform === 'darwin')
          insets = { width: 2, height: 80 };
      }
      promises.push(this._client.send('Browser.setWindowBounds', {
        windowId: this._windowId,
        bounds: { width: viewportSize.width + insets.width, height: viewportSize.height + insets.height }
      }));
    }
    await Promise.all(promises);
  }

  async _updateEmulateMedia(): Promise<void> {
    const colorScheme = this._page._state.colorScheme || this._crPage._browserContext._options.colorScheme || 'light';
    const features = colorScheme ? [{ name: 'prefers-color-scheme', value: colorScheme }] : [];
    await this._client.send('Emulation.setEmulatedMedia', { media: this._page._state.mediaType || '', features });
  }

  async _updateRequestInterception(): Promise<void> {
    await this._networkManager.setRequestInterception(this._page._needsRequestInterception());
  }

  async _setFileChooserIntercepted(enabled: boolean) {
    await this._client.send('Page.setInterceptFileChooserDialog', { enabled }).catch(e => {}); // target can be closed.
  }

  async _evaluateOnNewDocument(source: string): Promise<void> {
    await this._client.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }

  async _getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    const nodeInfo = await this._client.send('DOM.describeNode', {
      objectId: handle._objectId
    });
    if (!nodeInfo || typeof nodeInfo.node.frameId !== 'string')
      return null;
    return this._page._frameManager.frame(nodeInfo.node.frameId);
  }

  async _getOwnerFrame(handle: dom.ElementHandle): Promise<string | null> {
    // document.documentElement has frameId of the owner frame.
    const documentElement = await handle.evaluateHandle(node => {
      const doc = node as Document;
      if (doc.documentElement && doc.documentElement.ownerDocument === doc)
        return doc.documentElement;
      return node.ownerDocument ? node.ownerDocument.documentElement : null;
    });
    if (!documentElement)
      return null;
    if (!documentElement._objectId)
      return null;
    const nodeInfo = await this._client.send('DOM.describeNode', {
      objectId: documentElement._objectId
    });
    const frameId = nodeInfo && typeof nodeInfo.node.frameId === 'string' ?
      nodeInfo.node.frameId : null;
    documentElement.dispose();
    return frameId;
  }

  async _getBoundingBox(handle: dom.ElementHandle): Promise<types.Rect | null> {
    const result = await this._client._sendMayFail('DOM.getBoxModel', {
      objectId: handle._objectId
    });
    if (!result)
      return null;
    const quad = result.model.border;
    const x = Math.min(quad[0], quad[2], quad[4], quad[6]);
    const y = Math.min(quad[1], quad[3], quad[5], quad[7]);
    const width = Math.max(quad[0], quad[2], quad[4], quad[6]) - x;
    const height = Math.max(quad[1], quad[3], quad[5], quad[7]) - y;
    const position = await this._framePosition();
    if (!position)
      return null;
    return { x: x + position.x, y: y + position.y, width, height };
  }

  private async _framePosition(): Promise<types.Point | null> {
    const frame = this._page._frameManager.frame(this._targetId);
    if (!frame)
      return null;
    if (frame === this._page.mainFrame())
      return { x: 0, y: 0 };
    const element = await frame.frameElement();
    const box = await element.boundingBox();
    return box;
  }

  async _scrollRectIntoViewIfNeeded(handle: dom.ElementHandle, rect?: types.Rect): Promise<'error:notvisible' | 'error:notconnected' | 'done'> {
    return await this._client.send('DOM.scrollIntoViewIfNeeded', {
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

  async _getContentQuads(handle: dom.ElementHandle): Promise<types.Quad[] | null> {
    const result = await this._client._sendMayFail('DOM.getContentQuads', {
      objectId: handle._objectId
    });
    if (!result)
      return null;
    const position = await this._framePosition();
    if (!position)
      return null;
    return result.quads.map(quad => [
      { x: quad[0] + position.x, y: quad[1] + position.y },
      { x: quad[2] + position.x, y: quad[3] + position.y },
      { x: quad[4] + position.x, y: quad[5] + position.y },
      { x: quad[6] + position.x, y: quad[7] + position.y }
    ]);
  }

  async _adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>> {
    const nodeInfo = await this._client.send('DOM.describeNode', {
      objectId: handle._objectId,
    });
    return this._adoptBackendNodeId(nodeInfo.node.backendNodeId, to) as Promise<dom.ElementHandle<T>>;
  }

  async _adoptBackendNodeId(backendNodeId: Protocol.DOM.BackendNodeId, to: dom.FrameExecutionContext): Promise<dom.ElementHandle> {
    const result = await this._client._sendMayFail('DOM.resolveNode', {
      backendNodeId,
      executionContextId: (to._delegate as CRExecutionContext)._contextId,
    });
    if (!result || result.object.subtype === 'null')
      throw new Error('Unable to adopt element handle from a different document');
    return to.createHandle(result.object).asElement()!;
  }
}

async function emulateLocale(session: CRSession, locale: string) {
  try {
    await session.send('Emulation.setLocaleOverride', { locale });
  } catch (exception) {
    // All pages in the same renderer share locale. All such pages belong to the same
    // context and if locale is overridden for one of them its value is the same as
    // we are trying to set so it's not a problem.
    if (exception.message.includes('Another locale override is already in effect'))
      return;
    throw exception;
  }
}

async function emulateTimezone(session: CRSession, timezoneId: string) {
  try {
    await session.send('Emulation.setTimezoneOverride', { timezoneId: timezoneId });
  } catch (exception) {
    if (exception.message.includes('Timezone override is already in effect'))
      return;
    if (exception.message.includes('Invalid timezone'))
      throw new Error(`Invalid timezone ID: ${timezoneId}`);
    throw exception;
  }
}
