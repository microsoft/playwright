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
import type { RegisteredListener } from '../../utils/eventsHelper';
import { eventsHelper } from '../../utils/eventsHelper';
import { registry } from '../registry';
import { rewriteErrorMessage } from '../../utils/stackTrace';
import { assert, createGuid, headersArrayToObject } from '../../utils';
import * as dialog from '../dialog';
import * as dom from '../dom';
import type * as frames from '../frames';
import { helper } from '../helper';
import * as network from '../network';
import type { PageBinding, PageDelegate } from '../page';
import { Page, Worker } from '../page';
import type { Progress } from '../progress';
import type * as types from '../types';
import { getAccessibilityTree } from './crAccessibility';
import { CRBrowserContext } from './crBrowser';
import type { CRSession } from './crConnection';
import { CRConnection, CRSessionEvents } from './crConnection';
import { CRCoverage } from './crCoverage';
import { DragManager } from './crDragDrop';
import { CRExecutionContext } from './crExecutionContext';
import { RawKeyboardImpl, RawMouseImpl, RawTouchscreenImpl } from './crInput';
import { CRNetworkManager } from './crNetworkManager';
import { CRPDF } from './crPdf';
import { exceptionToError, releaseObject, toConsoleMessageLocation } from './crProtocolHelper';
import { platformToFontFamilies } from './defaultFontFamilies';
import type { Protocol } from './protocol';
import { VideoRecorder } from './videoRecorder';


const UTILITY_WORLD_NAME = '__playwright_utility_world__';
export type WindowBounds = { top?: number, left?: number, width?: number, height?: number };

export class CRPage implements PageDelegate {
  readonly _mainFrameSession: FrameSession;
  readonly _sessions = new Map<Protocol.Target.TargetID, FrameSession>();
  readonly _page: Page;
  readonly rawMouse: RawMouseImpl;
  readonly rawKeyboard: RawKeyboardImpl;
  readonly rawTouchscreen: RawTouchscreenImpl;
  readonly _targetId: string;
  readonly _opener: CRPage | null;
  private readonly _pdf: CRPDF;
  private readonly _coverage: CRCoverage;
  readonly _browserContext: CRBrowserContext;
  private readonly _pagePromise: Promise<Page | Error>;
  _initializedPage: Page | null = null;
  private _isBackgroundPage: boolean;

  // Holds window features for the next popup being opened via window.open,
  // until the popup target arrives. This could be racy if two oopifs
  // simultaneously call window.open with window features: the order
  // of their Page.windowOpen events is not guaranteed to match the order
  // of new popup targets.
  readonly _nextWindowOpenPopupFeatures: string[][] = [];

  static mainFrameSession(page: Page): FrameSession {
    const crPage = page._delegate as CRPage;
    return crPage._mainFrameSession;
  }

  constructor(client: CRSession, targetId: string, browserContext: CRBrowserContext, opener: CRPage | null, bits: { hasUIWindow: boolean, isBackgroundPage: boolean }) {
    this._targetId = targetId;
    this._opener = opener;
    this._isBackgroundPage = bits.isBackgroundPage;
    const dragManager = new DragManager(this);
    this.rawKeyboard = new RawKeyboardImpl(client, browserContext._browser._platform() === 'mac', dragManager);
    this.rawMouse = new RawMouseImpl(this, client, dragManager);
    this.rawTouchscreen = new RawTouchscreenImpl(client);
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
        this._page._state.emulatedSize = { viewport: viewportSize, screen: viewportSize };
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

  potentiallyUninitializedPage(): Page {
    return this._page;
  }

  private _reportAsNew(error?: Error) {
    if (this._isBackgroundPage) {
      if (!error)
        this._browserContext.emit(CRBrowserContext.CREvents.BackgroundPage, this._page);
    } else {
      this._page.reportAsNew(error);
    }
  }

  private async _forAllFrameSessions(cb: (frame: FrameSession) => Promise<any>) {
    const frameSessions = Array.from(this._sessions.values());
    await Promise.all(frameSessions.map(frameSession => {
      if (frameSession._isMainFrame())
        return cb(frameSession);
      return cb(frameSession).catch(e => {
        // Broadcasting a message to the closed iframe shoule be a noop.
        if (e.message && (e.message.includes('Target closed.') || e.message.includes('Session closed.')))
          return;
        throw e;
      });
    }));
  }

  _sessionForFrame(frame: frames.Frame): FrameSession {
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

  willBeginDownload() {
    this._mainFrameSession._willBeginDownload();
  }

  async pageOrError(): Promise<Page | Error> {
    return this._pagePromise;
  }

  didClose() {
    for (const session of this._sessions.values())
      session.dispose();
    this._page._didClose();
  }

  async navigateFrame(frame: frames.Frame, url: string, referrer: string | undefined): Promise<frames.GotoResult> {
    return this._sessionForFrame(frame)._navigate(frame, url, referrer);
  }

  async exposeBinding(binding: PageBinding) {
    await this._forAllFrameSessions(frame => frame._initBinding(binding));
    await Promise.all(this._page.frames().map(frame => frame.evaluateExpression(binding.source, false, {}).catch(e => {})));
  }

  async removeExposedBindings() {
    await this._forAllFrameSessions(frame => frame._removeExposedBindings());
  }

  async updateExtraHTTPHeaders(): Promise<void> {
    await this._forAllFrameSessions(frame => frame._updateExtraHTTPHeaders(false));
  }

  async updateGeolocation(): Promise<void> {
    await this._forAllFrameSessions(frame => frame._updateGeolocation(false));
  }

  async updateOffline(): Promise<void> {
    await this._forAllFrameSessions(frame => frame._updateOffline(false));
  }

  async updateHttpCredentials(): Promise<void> {
    await this._forAllFrameSessions(frame => frame._updateHttpCredentials(false));
  }

  async setEmulatedSize(emulatedSize: types.EmulatedSize): Promise<void> {
    assert(this._page._state.emulatedSize === emulatedSize);
    await this._mainFrameSession._updateViewport();
  }

  async bringToFront(): Promise<void> {
    await this._mainFrameSession._client.send('Page.bringToFront');
  }

  async updateEmulateMedia(): Promise<void> {
    await this._forAllFrameSessions(frame => frame._updateEmulateMedia(false));
  }

  async updateRequestInterception(): Promise<void> {
    await this._forAllFrameSessions(frame => frame._updateRequestInterception());
  }

  async setFileChooserIntercepted(enabled: boolean) {
    await this._forAllFrameSessions(frame => frame.setFileChooserIntercepted(enabled));
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

  async addInitScript(source: string, world: types.World = 'main'): Promise<void> {
    await this._forAllFrameSessions(frame => frame._evaluateOnNewDocument(source, world));
  }

  async removeInitScripts() {
    await this._forAllFrameSessions(frame => frame._removeEvaluatesOnNewDocument());
  }

  async closePage(runBeforeUnload: boolean): Promise<void> {
    if (runBeforeUnload)
      await this._mainFrameSession._client.send('Page.close');
    else
      await this._browserContext._browser._closePage(this);
  }

  async setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void> {
    await this._mainFrameSession._client.send('Emulation.setDefaultBackgroundColorOverride', { color });
  }

  async takeScreenshot(progress: Progress, format: 'png' | 'jpeg', documentRect: types.Rect | undefined, viewportRect: types.Rect | undefined, quality: number | undefined, fitsViewport: boolean, scale: 'css' | 'device'): Promise<Buffer> {
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
    if (scale === 'css') {
      const deviceScaleFactor = this._browserContext._options.deviceScaleFactor || 1;
      clip.scale /= deviceScaleFactor;
    }
    progress.throwIfAborted();
    const result = await this._mainFrameSession._client.send('Page.captureScreenshot', { format, quality, clip, captureBeyondViewport: !fitsViewport });
    return Buffer.from(result.data, 'base64');
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

  async setScreencastOptions(options: { width: number, height: number, quality: number } | null): Promise<void> {
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

  rafCountForStablePosition(): number {
    return 1;
  }

  async getContentQuads(handle: dom.ElementHandle): Promise<types.Quad[] | null> {
    return this._sessionForHandle(handle)._getContentQuads(handle);
  }

  async setInputFiles(handle: dom.ElementHandle<HTMLInputElement>, files: types.FilePayload[]): Promise<void> {
    await handle.evaluateInUtility(([injected, node, files]) =>
      injected.setInputFiles(node, files), files);
  }

  async setInputFilePaths(handle: dom.ElementHandle<HTMLInputElement>, files: string[]): Promise<void> {
    const frame = await handle.ownerFrame();
    if (!frame)
      throw new Error('Cannot set input files to detached input element');
    const parentSession = this._sessionForFrame(frame);
    await parentSession._client.send('DOM.setFileInputFiles', {
      objectId: handle._objectId,
      files
    });
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
  private readonly _parentSession: FrameSession | null;
  private readonly _childSessions = new Set<FrameSession>();
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
  private _screencastClients = new Set<any>();
  private _evaluateOnNewDocumentIdentifiers: string[] = [];
  private _exposedBindingNames: string[] = [];

  constructor(crPage: CRPage, client: CRSession, targetId: string, parentSession: FrameSession | null) {
    this._client = client;
    this._crPage = crPage;
    this._page = crPage._page;
    this._targetId = targetId;
    this._networkManager = new CRNetworkManager(client, this._page, parentSession ? parentSession._networkManager : null);
    this._parentSession = parentSession;
    if (parentSession)
      parentSession._childSessions.add(this);
    this._firstNonInitialNavigationCommittedPromise = new Promise((f, r) => {
      this._firstNonInitialNavigationCommittedFulfill = f;
      this._firstNonInitialNavigationCommittedReject = r;
    });
    client.once(CRSessionEvents.Disconnected, () => {
      this._firstNonInitialNavigationCommittedReject(new Error('Page closed'));
    });
  }

  _isMainFrame(): boolean {
    return this._targetId === this._crPage._targetId;
  }

  private _addRendererListeners() {
    this._eventListeners.push(...[
      eventsHelper.addEventListener(this._client, 'Log.entryAdded', event => this._onLogEntryAdded(event)),
      eventsHelper.addEventListener(this._client, 'Page.fileChooserOpened', event => this._onFileChooserOpened(event)),
      eventsHelper.addEventListener(this._client, 'Page.frameAttached', event => this._onFrameAttached(event.frameId, event.parentFrameId)),
      eventsHelper.addEventListener(this._client, 'Page.frameDetached', event => this._onFrameDetached(event.frameId, event.reason)),
      eventsHelper.addEventListener(this._client, 'Page.frameNavigated', event => this._onFrameNavigated(event.frame, false)),
      eventsHelper.addEventListener(this._client, 'Page.frameRequestedNavigation', event => this._onFrameRequestedNavigation(event)),
      eventsHelper.addEventListener(this._client, 'Page.frameStoppedLoading', event => this._onFrameStoppedLoading(event.frameId)),
      eventsHelper.addEventListener(this._client, 'Page.javascriptDialogOpening', event => this._onDialog(event)),
      eventsHelper.addEventListener(this._client, 'Page.navigatedWithinDocument', event => this._onFrameNavigatedWithinDocument(event.frameId, event.url)),
      eventsHelper.addEventListener(this._client, 'Runtime.bindingCalled', event => this._onBindingCalled(event)),
      eventsHelper.addEventListener(this._client, 'Runtime.consoleAPICalled', event => this._onConsoleAPI(event)),
      eventsHelper.addEventListener(this._client, 'Runtime.exceptionThrown', exception => this._handleException(exception.exceptionDetails)),
      eventsHelper.addEventListener(this._client, 'Runtime.executionContextCreated', event => this._onExecutionContextCreated(event.context)),
      eventsHelper.addEventListener(this._client, 'Runtime.executionContextDestroyed', event => this._onExecutionContextDestroyed(event.executionContextId)),
      eventsHelper.addEventListener(this._client, 'Runtime.executionContextsCleared', event => this._onExecutionContextsCleared()),
      eventsHelper.addEventListener(this._client, 'Target.attachedToTarget', event => this._onAttachedToTarget(event)),
      eventsHelper.addEventListener(this._client, 'Target.detachedFromTarget', event => this._onDetachedFromTarget(event)),
    ]);
  }

  private _addBrowserListeners() {
    this._eventListeners.push(...[
      eventsHelper.addEventListener(this._client, 'Inspector.targetCrashed', event => this._onTargetCrashed()),
      eventsHelper.addEventListener(this._client, 'Page.screencastFrame', event => this._onScreencastFrame(event)),
      eventsHelper.addEventListener(this._client, 'Page.windowOpen', event => this._onWindowOpen(event)),
    ]);
  }

  async _initialize(hasUIWindow: boolean) {
    const isSettingStorageState = this._page._browserContext.isSettingStorageState();
    if (!isSettingStorageState && hasUIWindow &&
      !this._crPage._browserContext._browser.isClank() &&
      !this._crPage._browserContext._options.noDefaultViewport) {
      const { windowId } = await this._client.send('Browser.getWindowForTarget');
      this._windowId = windowId;
    }

    let screencastOptions: types.PageScreencastOptions | undefined;
    if (!isSettingStorageState && this._isMainFrame() && this._crPage._browserContext._options.recordVideo && hasUIWindow) {
      const screencastId = createGuid();
      const outputFile = path.join(this._crPage._browserContext._options.recordVideo.dir, screencastId + '.webm');
      screencastOptions = {
        // validateBrowserContextOptions ensures correct video size.
        ...this._crPage._browserContext._options.recordVideo.size!,
        outputFile,
      };
      await this._crPage._browserContext._ensureVideosPath();
      // Note: it is important to start video recorder before sending Page.startScreencast,
      // and it is equally important to send Page.startScreencast before sending Runtime.runIfWaitingForDebugger.
      await this._createVideoRecorder(screencastId, screencastOptions);
      this._crPage.pageOrError().then(p => {
        if (p instanceof Error)
          this._stopVideoRecording().catch(() => {});
      });
    }

    let lifecycleEventsEnabled: Promise<any>;
    if (!this._isMainFrame())
      this._addRendererListeners();
    this._addBrowserListeners();
    const promises: Promise<any>[] = [
      this._client.send('Page.enable'),
      this._client.send('Page.getFrameTree').then(({ frameTree }) => {
        if (this._isMainFrame()) {
          this._handleFrameTree(frameTree);
          this._addRendererListeners();
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
            frame.evaluateExpression(binding.source, false, undefined).catch(e => {});
          for (const source of this._crPage._browserContext.initScripts)
            frame.evaluateExpression(source, false, undefined, 'main').catch(e => {});
        }
        const isInitialEmptyPage = this._isMainFrame() && this._page.mainFrame().url() === ':';
        if (isInitialEmptyPage) {
          // Ignore lifecycle events for the initial empty page. It is never the final page
          // hence we are going to get more lifecycle updates after the actual navigation has
          // started (even if the target url is about:blank).
          lifecycleEventsEnabled.catch(e => {}).then(() => {
            this._eventListeners.push(eventsHelper.addEventListener(this._client, 'Page.lifecycleEvent', event => this._onLifecycleEvent(event)));
          });
        } else {
          this._firstNonInitialNavigationCommittedFulfill();
          this._eventListeners.push(eventsHelper.addEventListener(this._client, 'Page.lifecycleEvent', event => this._onLifecycleEvent(event)));
        }
      }),
      this._client.send('Log.enable', {}),
      lifecycleEventsEnabled = this._client.send('Page.setLifecycleEventsEnabled', { enabled: true }),
      this._client.send('Runtime.enable', {}),
      this._client.send('Page.addScriptToEvaluateOnNewDocument', {
        source: '',
        worldName: UTILITY_WORLD_NAME,
      }),
      this._networkManager.initialize(),
      this._client.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }),
    ];
    if (!isSettingStorageState) {
      if (this._isMainFrame())
        promises.push(this._client.send('Emulation.setFocusEmulationEnabled', { enabled: true }));
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
      if (!this._crPage._browserContext._browser.options.headful)
        promises.push(this._setDefaultFontFamilies(this._client));
      promises.push(this._updateGeolocation(true));
      promises.push(this._updateExtraHTTPHeaders(true));
      promises.push(this._updateRequestInterception());
      promises.push(this._updateOffline(true));
      promises.push(this._updateHttpCredentials(true));
      promises.push(this._updateEmulateMedia(true));
      for (const binding of this._crPage._page.allBindings())
        promises.push(this._initBinding(binding));
      for (const source of this._crPage._browserContext.initScripts)
        promises.push(this._evaluateOnNewDocument(source, 'main'));
      for (const source of this._crPage._page.initScripts)
        promises.push(this._evaluateOnNewDocument(source, 'main'));
      if (screencastOptions)
        promises.push(this._startVideoRecording(screencastOptions));
    }
    promises.push(this._client.send('Runtime.runIfWaitingForDebugger'));
    promises.push(this._firstNonInitialNavigationCommittedPromise);
    await Promise.all(promises);
  }

  dispose() {
    for (const childSession of this._childSessions)
      childSession.dispose();
    if (this._parentSession)
      this._parentSession._childSessions.delete(this);
    eventsHelper.removeEventListeners(this._eventListeners);
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
    if (this._eventBelongsToStaleFrame(event.frameId))
      return;
    if (event.name === 'load')
      this._page._frameManager.frameLifecycleEvent(event.frameId, 'load');
    else if (event.name === 'DOMContentLoaded')
      this._page._frameManager.frameLifecycleEvent(event.frameId, 'domcontentloaded');
  }

  _onFrameStoppedLoading(frameId: string) {
    if (this._eventBelongsToStaleFrame(frameId))
      return;
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

  private _eventBelongsToStaleFrame(frameId: string)  {
    const frame = this._page._frameManager.frame(frameId);
    // Subtree may be already gone because some ancestor navigation destroyed the oopif.
    if (!frame)
      return true;
    // When frame goes remote, parent process may still send some events
    // related to the local frame before it sends frameDetached.
    // In this case, we already have a new session for this frame, so events
    // in the old session should be ignored.
    const session = this._crPage._sessionForFrame(frame);
    return session && session !== this && !session._swappedIn;
  }

  _onFrameAttached(frameId: string, parentFrameId: string | null) {
    const frameSession = this._crPage._sessions.get(frameId);
    if (frameSession && frameId !== this._targetId) {
      // This is a remote -> local frame transition.
      frameSession._swappedIn = true;
      const frame = this._page._frameManager.frame(frameId);
      // Frame or even a whole subtree may be already gone, because some ancestor did navigate.
      if (frame)
        this._page._frameManager.removeChildFramesRecursively(frame);
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

  _onFrameNavigated(framePayload: Protocol.Page.Frame, initial: boolean) {
    if (this._eventBelongsToStaleFrame(framePayload.id))
      return;
    this._page._frameManager.frameCommittedNewDocumentNavigation(framePayload.id, framePayload.url + (framePayload.urlFragment || ''), framePayload.name || '', framePayload.loaderId, initial);
    if (!initial)
      this._firstNonInitialNavigationCommittedFulfill();
  }

  _onFrameRequestedNavigation(payload: Protocol.Page.frameRequestedNavigationPayload) {
    if (this._eventBelongsToStaleFrame(payload.frameId))
      return;
    if (payload.disposition === 'currentTab')
      this._page._frameManager.frameRequestedNavigation(payload.frameId);
  }

  _onFrameNavigatedWithinDocument(frameId: string, url: string) {
    if (this._eventBelongsToStaleFrame(frameId))
      return;
    this._page._frameManager.frameCommittedSameDocumentNavigation(frameId, url);
  }

  _onFrameDetached(frameId: string, reason: 'remove' | 'swap') {
    if (this._crPage._sessions.has(frameId)) {
      // This is a local -> remote frame transtion, where
      // Page.frameDetached arrives after Target.attachedToTarget.
      // We've already handled the new target and frame reattach - nothing to do here.
      return;
    }
    if (reason === 'swap') {
      // This is a local -> remote frame transtion, where
      // Page.frameDetached arrives before Target.attachedToTarget.
      // We should keep the frame in the tree, and it will be used for the new target.
      const frame = this._page._frameManager.frame(frameId);
      if (frame)
        this._page._frameManager.removeChildFramesRecursively(frame);
      return;
    }
    // Just a regular frame detach.
    this._page._frameManager.frameDetached(frameId);
  }

  _onExecutionContextCreated(contextPayload: Protocol.Runtime.ExecutionContextDescription) {
    const frame = contextPayload.auxData ? this._page._frameManager.frame(contextPayload.auxData.frameId) : null;
    if (!frame || this._eventBelongsToStaleFrame(frame._id))
      return;
    const delegate = new CRExecutionContext(this._client, contextPayload);
    let worldName: types.World|null = null;
    if (contextPayload.auxData && !!contextPayload.auxData.isDefault)
      worldName = 'main';
    else if (contextPayload.name === UTILITY_WORLD_NAME)
      worldName = 'utility';
    const context = new dom.FrameExecutionContext(delegate, frame, worldName);
    (context as any)[contextDelegateSymbol] = delegate;
    if (worldName)
      frame._contextCreated(worldName, context);
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
      const frame = this._page._frameManager.frame(targetId);
      if (!frame)
        return; // Subtree may be already gone due to renderer/browser race.
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
    const worker = new Worker(this._page, url);
    this._page._addWorker(event.sessionId, worker);
    session.once('Runtime.executionContextCreated', async event => {
      worker._createExecutionContext(new CRExecutionContext(session, event.context));
    });
    // This might fail if the target is closed before we initialize.
    session._sendMayFail('Runtime.enable');
    session._sendMayFail('Network.enable');
    session._sendMayFail('Runtime.runIfWaitingForDebugger');
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
    const context = this._contextIdToContext.get(event.executionContextId);
    if (!context)
      return;
    const values = event.args.map(arg => context.createHandle(arg));
    this._page._addConsoleMessage(event.type, values, toConsoleMessageLocation(event.stackTrace));
  }

  async _initBinding(binding: PageBinding) {
    const [ , response ] = await Promise.all([
      this._client.send('Runtime.addBinding', { name: binding.name }),
      this._client.send('Page.addScriptToEvaluateOnNewDocument', { source: binding.source })
    ]);
    this._exposedBindingNames.push(binding.name);
    if (!binding.name.startsWith('__pw'))
      this._evaluateOnNewDocumentIdentifiers.push(response.identifier);
  }

  async _removeExposedBindings() {
    const toRetain: string[] = [];
    const toRemove: string[] = [];
    for (const name of this._exposedBindingNames)
      (name.startsWith('__pw_') ? toRetain : toRemove).push(name);
    this._exposedBindingNames = toRetain;
    await Promise.all(toRemove.map(name => this._client.send('Runtime.removeBinding', { name })));
  }

  async _onBindingCalled(event: Protocol.Runtime.bindingCalledPayload) {
    const pageOrError = await this._crPage.pageOrError();
    if (!(pageOrError instanceof Error)) {
      const context = this._contextIdToContext.get(event.executionContextId);
      if (context)
        await this._page._onBindingCalled(event.payload, context);
    }
  }

  _onDialog(event: Protocol.Page.javascriptDialogOpeningPayload) {
    if (!this._page._frameManager.frame(this._targetId))
      return; // Our frame/subtree may be gone already.
    this._page.emit(Page.Events.Dialog, new dialog.Dialog(
        this._page,
        event.type,
        event.message,
        async (accept: boolean, promptText?: string) => {
          await this._client.send('Page.handleJavaScriptDialog', { accept, promptText });
        },
        event.defaultPrompt));
  }

  _handleException(exceptionDetails: Protocol.Runtime.ExceptionDetails) {
    this._page.firePageError(exceptionToError(exceptionDetails));
  }

  async _onTargetCrashed() {
    this._client._markAsCrashed();
    this._page._didCrash();
  }

  _onLogEntryAdded(event: Protocol.Log.entryAddedPayload) {
    const { level, text, args, source, url, lineNumber } = event.entry;
    if (args)
      args.map(arg => releaseObject(this._client, arg.objectId!));
    if (source !== 'worker') {
      const location: types.ConsoleMessageLocation = {
        url: url || '',
        lineNumber: lineNumber || 0,
        columnNumber: 0,
      };
      this._page._addConsoleMessage(level, [], location, text);
    }
  }

  async _onFileChooserOpened(event: Protocol.Page.fileChooserOpenedPayload) {
    const frame = this._page._frameManager.frame(event.frameId);
    if (!frame)
      return;
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

  _onScreencastFrame(payload: Protocol.Page.screencastFramePayload) {
    this._page.throttleScreencastFrameAck(() => {
      this._client.send('Page.screencastFrameAck', { sessionId: payload.sessionId }).catch(() => {});
    });
    const buffer = Buffer.from(payload.data, 'base64');
    this._page.emit(Page.Events.ScreencastFrame, {
      buffer,
      timestamp: payload.metadata.timestamp,
      width: payload.metadata.deviceWidth,
      height: payload.metadata.deviceHeight,
    });
  }

  async _createVideoRecorder(screencastId: string, options: types.PageScreencastOptions): Promise<void> {
    assert(!this._screencastId);
    const ffmpegPath = registry.findExecutable('ffmpeg')!.executablePathOrDie(this._page._browserContext._browser.options.sdkLanguage);
    this._videoRecorder = await VideoRecorder.launch(this._crPage._page, ffmpegPath, options);
    this._screencastId = screencastId;
  }

  async _startVideoRecording(options: types.PageScreencastOptions) {
    const screencastId = this._screencastId;
    assert(screencastId);
    this._page.once(Page.Events.Close, () => this._stopVideoRecording().catch(() => {}));
    const gotFirstFrame = new Promise(f => this._client.once('Page.screencastFrame', f));
    await this._startScreencast(this._videoRecorder, {
      format: 'jpeg',
      quality: 90,
      maxWidth: options.width,
      maxHeight: options.height,
    });
    // Wait for the first frame before reporting video to the client.
    gotFirstFrame.then(() => {
      this._crPage._browserContext._browser._videoStarted(this._crPage._browserContext, screencastId, options.outputFile, this._crPage.pageOrError());
    });
  }

  async _stopVideoRecording(): Promise<void> {
    if (!this._screencastId)
      return;
    const screencastId = this._screencastId;
    this._screencastId = null;
    const recorder = this._videoRecorder!;
    this._videoRecorder = null;
    await this._stopScreencast(recorder);
    await recorder.stop().catch(() => {});
    // Keep the video artifact in the map utntil encoding is fully finished, if the context
    // starts closing before the video is fully written to disk it will wait for it.
    const video = this._crPage._browserContext._browser._takeVideo(screencastId);
    video?.reportFinished();
  }

  async _startScreencast(client: any, options: Protocol.Page.startScreencastParameters = {}) {
    this._screencastClients.add(client);
    if (this._screencastClients.size === 1)
      await this._client.send('Page.startScreencast', options);
  }

  async _stopScreencast(client: any) {
    this._screencastClients.delete(client);
    if (!this._screencastClients.size)
      await this._client._sendMayFail('Page.stopScreencast');
  }

  async _updateExtraHTTPHeaders(initial: boolean): Promise<void> {
    const headers = network.mergeHeaders([
      this._crPage._browserContext._options.extraHTTPHeaders,
      this._page._state.extraHTTPHeaders
    ]);
    if (!initial || headers.length)
      await this._client.send('Network.setExtraHTTPHeaders', { headers: headersArrayToObject(headers, false /* lowerCase */) });
  }

  async _updateGeolocation(initial: boolean): Promise<void> {
    const geolocation = this._crPage._browserContext._options.geolocation;
    if (!initial || geolocation)
      await this._client.send('Emulation.setGeolocationOverride', geolocation || {});
  }

  async _updateOffline(initial: boolean): Promise<void> {
    const offline = !!this._crPage._browserContext._options.offline;
    if (!initial || offline)
      await this._networkManager.setOffline(offline);
  }

  async _updateHttpCredentials(initial: boolean): Promise<void> {
    const credentials = this._crPage._browserContext._options.httpCredentials || null;
    if (!initial || credentials)
      await this._networkManager.authenticate(credentials);
  }

  async _updateViewport(): Promise<void> {
    if (this._crPage._browserContext._browser.isClank())
      return;
    assert(this._isMainFrame());
    const options = this._crPage._browserContext._options;
    const emulatedSize = this._page._state.emulatedSize;
    if (emulatedSize === null)
      return;
    const viewportSize = emulatedSize.viewport;
    const screenSize = emulatedSize.screen;
    const isLandscape = viewportSize.width > viewportSize.height;
    const promises = [
      this._client.send('Emulation.setDeviceMetricsOverride', {
        mobile: !!options.isMobile,
        width: viewportSize.width,
        height: viewportSize.height,
        screenWidth: screenSize.width,
        screenHeight: screenSize.height,
        deviceScaleFactor: options.deviceScaleFactor || 1,
        screenOrientation: isLandscape ? { angle: 90, type: 'landscapePrimary' } : { angle: 0, type: 'portraitPrimary' },
      }),
    ];
    if (this._windowId) {
      let insets = { width: 0, height: 0 };
      if (this._crPage._browserContext._browser.options.headful) {
        // TODO: popup windows have their own insets.
        insets = { width: 24, height: 88 };
        if (process.platform === 'win32')
          insets = { width: 16, height: 88 };
        else if (process.platform === 'linux')
          insets = { width: 8, height: 85 };
        else if (process.platform === 'darwin')
          insets = { width: 2, height: 80 };
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
  }

  async windowBounds(): Promise<WindowBounds> {
    const { bounds } = await this._client.send('Browser.getWindowBounds', {
      windowId: this._windowId!
    });
    return bounds;
  }

  async setWindowBounds(bounds: WindowBounds) {
    return await this._client.send('Browser.setWindowBounds', {
      windowId: this._windowId!,
      bounds
    });
  }

  async _updateEmulateMedia(initial: boolean): Promise<void> {
    const colorScheme = this._page._state.colorScheme === null ? '' : this._page._state.colorScheme;
    const reducedMotion = this._page._state.reducedMotion === null ? '' : this._page._state.reducedMotion;
    const forcedColors = this._page._state.forcedColors === null ? '' : this._page._state.forcedColors;
    const features = [
      { name: 'prefers-color-scheme', value: colorScheme },
      { name: 'prefers-reduced-motion', value: reducedMotion },
      { name: 'forced-colors', value: forcedColors },
    ];
    // Empty string disables the override.
    await this._client.send('Emulation.setEmulatedMedia', { media: this._page._state.mediaType || '', features });
  }

  private async _setDefaultFontFamilies(session: CRSession) {
    const fontFamilies = platformToFontFamilies[this._crPage._browserContext._browser._platform()];
    await session.send('Page.setFontFamilies', fontFamilies);
  }

  async _updateRequestInterception(): Promise<void> {
    await this._networkManager.setRequestInterception(this._page._needsRequestInterception());
  }

  async setFileChooserIntercepted(enabled: boolean) {
    await this._client.send('Page.setInterceptFileChooserDialog', { enabled }).catch(e => {}); // target can be closed.
  }

  async _evaluateOnNewDocument(source: string, world: types.World): Promise<void> {
    const worldName = world === 'utility' ? UTILITY_WORLD_NAME : undefined;
    const { identifier } = await this._client.send('Page.addScriptToEvaluateOnNewDocument', { source, worldName });
    this._evaluateOnNewDocumentIdentifiers.push(identifier);
  }

  async _removeEvaluatesOnNewDocument(): Promise<void> {
    const identifiers = this._evaluateOnNewDocumentIdentifiers;
    this._evaluateOnNewDocumentIdentifiers = [];
    await Promise.all(identifiers.map(identifier => this._client.send('Page.removeScriptToEvaluateOnNewDocument', { identifier })));
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
      executionContextId: ((to as any)[contextDelegateSymbol] as CRExecutionContext)._contextId,
    });
    if (!result || result.object.subtype === 'null')
      throw new Error(dom.kUnableToAdoptErrorMessage);
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

const contextDelegateSymbol = Symbol('delegate');
