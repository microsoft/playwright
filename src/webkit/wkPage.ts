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

import * as frames from '../frames';
import { debugError, helper, RegisteredListener, assert } from '../helper';
import * as dom from '../dom';
import * as network from '../network';
import { WKSession } from './wkConnection';
import { Events } from '../events';
import { WKExecutionContext } from './wkExecutionContext';
import { WKInterceptableRequest } from './wkInterceptableRequest';
import { WKWorkers } from './wkWorkers';
import { Page, PageDelegate } from '../page';
import { Protocol } from './protocol';
import * as dialog from '../dialog';
import { BrowserContext } from '../browserContext';
import { RawMouseImpl, RawKeyboardImpl } from './wkInput';
import * as types from '../types';
import * as accessibility from '../accessibility';
import * as platform from '../platform';
import { getAccessibilityTree } from './wkAccessibility';
import { WKProvisionalPage } from './wkProvisionalPage';

const UTILITY_WORLD_NAME = '__playwright_utility_world__';
const BINDING_CALL_MESSAGE = '__playwright_binding_call__';

export class WKPage implements PageDelegate {
  readonly rawMouse: RawMouseImpl;
  readonly rawKeyboard: RawKeyboardImpl;
  _session: WKSession;
  private _provisionalPage: WKProvisionalPage | null = null;
  readonly _page: Page;
  private readonly _pageProxySession: WKSession;
  private readonly _openerResolver: () => Promise<Page | null>;
  private readonly _requestIdToRequest = new Map<string, WKInterceptableRequest>();
  private readonly _workers: WKWorkers;
  private readonly _contextIdToContext: Map<number, dom.FrameExecutionContext>;
  private _mainFrameContextId?: number;
  private _sessionListeners: RegisteredListener[] = [];
  private readonly _bootstrapScripts: string[] = [];

  constructor(browserContext: BrowserContext, pageProxySession: WKSession, openerResolver: () => Promise<Page | null>) {
    this._pageProxySession = pageProxySession;
    this._openerResolver = openerResolver;
    this.rawKeyboard = new RawKeyboardImpl(pageProxySession);
    this.rawMouse = new RawMouseImpl(pageProxySession);
    this._contextIdToContext = new Map();
    this._page = new Page(this, browserContext);
    this._workers = new WKWorkers(this._page);
    this._session = undefined as any as WKSession;
    this._page.on(Events.Page.FrameDetached, frame => this._removeContextsForFrame(frame, false));
  }

  private async _initializePageProxySession() {
    const promises: Promise<any>[] = [
      this._pageProxySession.send('Dialog.enable'),
      this._pageProxySession.send('Emulation.setActiveAndFocused', { active: true }),
      this.authenticate(this._page._state.credentials)
    ];
    const contextOptions = this._page.context()._options;
    if (contextOptions.javaScriptEnabled === false)
      promises.push(this._pageProxySession.send('Emulation.setJavaScriptEnabled', { enabled: false }));
    if (this._page._state.viewportSize || contextOptions.viewport)
      promises.push(this._updateViewport(true /* updateTouch */));
    await Promise.all(promises);
  }

  private _setSession(session: WKSession) {
    helper.removeEventListeners(this._sessionListeners);
    this._session = session;
    this.rawKeyboard.setSession(session);
    this._addSessionListeners();
    this._workers.setSession(session);
  }

  async initialize(session: WKSession) {
    this._setSession(session);
    await Promise.all([
      this._initializePageProxySession(),
      this._initializeSession(this._session, ({frameTree}) => this._handleFrameTree(frameTree)),
    ]);
  }

  // This method is called for provisional targets as well. The session passed as the parameter
  // may be different from the current session and may be destroyed without becoming current.
  async _initializeSession(session: WKSession, resourceTreeHandler: (r: Protocol.Page.getResourceTreeReturnValue) => void) {
    await this._initializeSessionMayThrow(session, resourceTreeHandler).catch(e => {
      if (session.isDisposed())
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

    if (this._page._state.interceptNetwork)
      promises.push(session.send('Network.setInterceptionEnabled', { enabled: true, interceptRequests: true }));
    if (this._page._state.offlineMode)
      promises.push(session.send('Network.setEmulateOfflineState', { offline: true }));
    if (this._page._state.cacheEnabled === false)
      promises.push(session.send('Network.setResourceCachingDisabled', { disabled: true }));

    const contextOptions = this._page.context()._options;
    if (contextOptions.userAgent)
      promises.push(session.send('Page.overrideUserAgent', { value: contextOptions.userAgent }));
    if (this._page._state.mediaType || this._page._state.colorScheme)
      promises.push(WKPage._setEmulateMedia(session, this._page._state.mediaType, this._page._state.colorScheme));
    if (this._bootstrapScripts.length) {
      const source = this._bootstrapScripts.join(';');
      promises.push(session.send('Page.setBootstrapScript', { source }));
    }
    if (contextOptions.bypassCSP)
      promises.push(session.send('Page.setBypassCSP', { enabled: true }));
    if (this._page._state.extraHTTPHeaders || contextOptions.locale) {
      const headers = this._page._state.extraHTTPHeaders || {};
      if (contextOptions.locale)
        headers['Accept-Language'] = contextOptions.locale;
      promises.push(session.send('Network.setExtraHTTPHeaders', { headers }));
    }
    if (this._page._state.hasTouch)
      promises.push(session.send('Page.setTouchEmulationEnabled', { enabled: true }));
    if (contextOptions.timezoneId) {
      promises.push(session.send('Page.setTimeZone', { timeZone: contextOptions.timezoneId }).
          catch(e => { throw new Error(`Invalid timezone ID: ${contextOptions.timezoneId}`); }));
    }
    await Promise.all(promises);
  }

  initializeProvisionalPage(provisionalSession: WKSession): Promise<void> {
    assert(!this._provisionalPage);
    this._provisionalPage = new WKProvisionalPage(provisionalSession, this);
    return this._provisionalPage.initializationPromise;
  }

  onProvisionalLoadCommitted(session: WKSession) {
    assert(this._provisionalPage);
    assert(this._provisionalPage._session === session);
    this._provisionalPage.commit();
    this._provisionalPage.dispose();
    this._provisionalPage = null;
    this._setSession(session);
  }

  onSessionDestroyed(session: WKSession, crashed: boolean) {
    if (this._provisionalPage && this._provisionalPage._session === session) {
      this._provisionalPage.dispose();
      this._provisionalPage = null;
      return;
    }
    if (this._session === session && crashed)
      this.didClose(crashed);
  }

  didClose(crashed: boolean) {
    helper.removeEventListeners(this._sessionListeners);
    if (crashed)
      this._page._didCrash();
    else
      this._page._didClose();
  }

  dispose() {
    if (this._provisionalPage) {
      this._provisionalPage.dispose();
      this._provisionalPage = null;
    }
    this._page._didDisconnect();
  }

  private _addSessionListeners() {
    this._sessionListeners = [
      helper.addEventListener(this._session, 'Page.frameNavigated', event => this._onFrameNavigated(event.frame, false)),
      helper.addEventListener(this._session, 'Page.navigatedWithinDocument', event => this._onFrameNavigatedWithinDocument(event.frameId, event.url)),
      helper.addEventListener(this._session, 'Page.frameAttached', event => this._onFrameAttached(event.frameId, event.parentFrameId)),
      helper.addEventListener(this._session, 'Page.frameDetached', event => this._onFrameDetached(event.frameId)),
      helper.addEventListener(this._session, 'Page.frameStoppedLoading', event => this._onFrameStoppedLoading(event.frameId)),
      helper.addEventListener(this._session, 'Page.loadEventFired', event => this._onLifecycleEvent(event.frameId, 'load')),
      helper.addEventListener(this._session, 'Page.domContentEventFired', event => this._onLifecycleEvent(event.frameId, 'domcontentloaded')),
      helper.addEventListener(this._session, 'Runtime.executionContextCreated', event => this._onExecutionContextCreated(event.context)),
      helper.addEventListener(this._session, 'Console.messageAdded', event => this._onConsoleMessage(event)),
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
    await Promise.all(sessions.map(session => callback(session).catch(debugError)));
  }

  private _onFrameStoppedLoading(frameId: string) {
    this._page._frameManager.frameStoppedLoading(frameId);
  }

  private _onLifecycleEvent(frameId: string, event: frames.LifecycleEvent) {
    this._page._frameManager.frameLifecycleEvent(frameId, event);
  }

  private _handleFrameTree(frameTree: Protocol.Page.FrameResourceTree) {
    this._onFrameAttached(frameTree.frame.id, frameTree.frame.parentId || null);
    this._onFrameNavigated(frameTree.frame, true);

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
    const result = await this._pageProxySession.connection.browserSession.send('Browser.navigate', { url, pageProxyId, frameId: frame._id, referrer });
    return { newDocumentId: result.loaderId };
  }

  private _onConsoleMessage(event: Protocol.Console.messageAddedPayload) {
    // Note: do no introduce await in this function, otherwise we lose the ordering.
    // For example, frame.setContent relies on this.
    const { type, level, text, parameters, url, line: lineNumber, column: columnNumber, source } = event.message;
    if (level === 'debug' && parameters && parameters[0].value === BINDING_CALL_MESSAGE) {
      const parsedObjectId = JSON.parse(parameters[1].objectId!);
      const context = this._contextIdToContext.get(parsedObjectId.injectedScriptId)!;
      this._page._onBindingCalled(parameters[2].value, context);
      return;
    }
    if (level === 'error' && source === 'javascript') {
      const error = new Error(text);
      error.stack = 'Error: ' + error.message; // Nullify stack. Stack is supposed to contain error message as the first line.
      this._page.emit(Events.Page.PageError, error);
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
      return context._createHandle(p);
    });
    this._page._addConsoleMessage(derivedType, handles, { url, lineNumber: (lineNumber || 1) - 1, columnNumber: (columnNumber || 1) - 1 }, handles.length ? undefined : text);
  }

  _onDialog(event: Protocol.Dialog.javascriptDialogOpeningPayload) {
    this._page.emit(Events.Page.Dialog, new dialog.Dialog(
      event.type as dialog.DialogType,
      event.message,
      async (accept: boolean, promptText?: string) => {
        await this._pageProxySession.send('Dialog.handleJavaScriptDialog', { accept, promptText });
      },
      event.defaultPrompt));
  }

  private async _onFileChooserOpened(event: {frameId: Protocol.Network.FrameId, element: Protocol.Runtime.RemoteObject}) {
    const context = await this._page._frameManager.frame(event.frameId)!._mainContext();
    const handle = context._createHandle(event.element).asElement()!;
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

  async setExtraHTTPHeaders(headers: network.Headers): Promise<void> {
    const copy = { ...headers };
    const locale = this._page.context()._options.locale;
    if (locale)
      copy['Accept-Language'] = locale;
    await this._updateState('Network.setExtraHTTPHeaders', { headers: copy });
  }

  async setEmulateMedia(mediaType: types.MediaType | null, colorScheme: types.ColorScheme | null): Promise<void> {
    await this._forAllSessions(session => WKPage._setEmulateMedia(session, mediaType, colorScheme));
  }

  async setViewportSize(viewportSize: types.Size): Promise<void> {
    assert(this._page._state.viewportSize === viewportSize);
    await this._updateViewport(false /* updateTouch */);
  }

  async _updateViewport(updateTouch: boolean): Promise<void> {
    let viewport = this._page.context()._options.viewport || { width: 0, height: 0 };
    const viewportSize = this._page._state.viewportSize;
    if (viewportSize)
      viewport = { ...viewport, ...viewportSize };
    const promises: Promise<any>[] = [
      this._pageProxySession.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        fixedLayout: !!viewport.isMobile,
        deviceScaleFactor: viewport.deviceScaleFactor || 1
      }),
    ];
    if (updateTouch)
      promises.push(this._updateState('Page.setTouchEmulationEnabled', { enabled: !!viewport.isMobile }));
    await Promise.all(promises);
  }

  async setCacheEnabled(enabled: boolean): Promise<void> {
    const disabled = !enabled;
    await this._updateState('Network.setResourceCachingDisabled', { disabled });
  }

  async setRequestInterception(enabled: boolean): Promise<void> {
    await this._updateState('Network.setInterceptionEnabled', { enabled, interceptRequests: enabled });
  }

  async setOfflineMode(offline: boolean) {
    await this._updateState('Network.setEmulateOfflineState', { offline });
  }

  async authenticate(credentials: types.Credentials | null) {
    await this._pageProxySession.send('Emulation.setAuthCredentials', { ...(credentials || { username: '', password: '' }) });
  }

  async setFileChooserIntercepted(enabled: boolean) {
    await this._session.send('Page.setInterceptFileChooserDialog', { enabled }).catch(e => {}); // target can be closed.
  }

  async opener() {
    return await this._openerResolver();
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

  async exposeBinding(name: string, bindingFunction: string): Promise<void> {
    const script = `self.${name} = (param) => console.debug('${BINDING_CALL_MESSAGE}', {}, param); ${bindingFunction}`;
    this._bootstrapScripts.unshift(script);
    await this._setBootstrapScripts();
    await Promise.all(this._page.frames().map(frame => frame.evaluate(script).catch(debugError)));
  }

  async evaluateOnNewDocument(script: string): Promise<void> {
    this._bootstrapScripts.push(script);
    await this._setBootstrapScripts();
  }

  private async _setBootstrapScripts() {
    const source = this._bootstrapScripts.join(';');
    await this._updateState('Page.setBootstrapScript', { source });
  }

  async closePage(runBeforeUnload: boolean): Promise<void> {
    this._pageProxySession.send('Target.close', {
      targetId: this._session.sessionId,
      runBeforeUnload
    }).catch(debugError);
  }

  getBoundingBoxForScreenshot(handle: dom.ElementHandle<Node>): Promise<types.Rect | null> {
    return handle.boundingBox();
  }

  canScreenshotOutsideViewport(): boolean {
    return false;
  }

  async setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void> {
    // TODO: line below crashes, sort it out.
    await this._session.send('Page.setDefaultBackgroundColorOverride', { color });
  }

  async takeScreenshot(format: string, options: types.ScreenshotOptions, viewportSize: types.Size): Promise<platform.BufferType> {
    const rect = options.clip || { x: 0, y: 0, width: viewportSize.width, height: viewportSize.height };
    const result = await this._session.send('Page.snapshotRect', { ...rect, coordinateSystem: options.fullPage ? 'Page' : 'Viewport' });
    const prefix = 'data:image/png;base64,';
    let buffer = platform.Buffer.from(result.dataURL.substr(prefix.length), 'base64');
    if (format === 'jpeg')
      buffer = platform.pngToJpeg(buffer);
    return buffer;
  }

  async resetViewport(oldSize: types.Size): Promise<void> {
    await this._pageProxySession.send('Emulation.setDeviceMetricsOverride', { ...oldSize, fixedLayout: false, deviceScaleFactor: 0 });
  }

  async getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    const nodeInfo = await this._session.send('DOM.describeNode', {
      objectId: toRemoteObject(handle).objectId!
    });
    if (!nodeInfo.contentFrameId)
      return null;
    return this._page._frameManager.frame(nodeInfo.contentFrameId);
  }

  async getOwnerFrame(handle: dom.ElementHandle): Promise<string | null> {
    const remoteObject = toRemoteObject(handle);
    if (!remoteObject.objectId)
      return null;
    const nodeInfo = await this._session.send('DOM.describeNode', {
      objectId: remoteObject.objectId
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

  async scrollRectIntoViewIfNeeded(handle: dom.ElementHandle, rect?: types.Rect): Promise<void> {
    await this._session.send('DOM.scrollIntoViewIfNeeded', {
      objectId: toRemoteObject(handle).objectId!,
      rect,
    }).catch(e => {
      if (e instanceof Error && e.message.includes('Node does not have a layout object'))
        e.message = 'Node is either not visible or not an HTMLElement';
      throw e;
    });
  }

  async getContentQuads(handle: dom.ElementHandle): Promise<types.Quad[] | null> {
    const result = await this._session.send('DOM.getContentQuads', {
      objectId: toRemoteObject(handle).objectId!
    }).catch(debugError);
    if (!result)
      return null;
    return result.quads.map(quad => [
      { x: quad[0], y: quad[1] },
      { x: quad[2], y: quad[3] },
      { x: quad[4], y: quad[5] },
      { x: quad[6], y: quad[7] }
    ]);
  }

  async layoutViewport(): Promise<{ width: number, height: number }> {
    return this._page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  }

  async setInputFiles(handle: dom.ElementHandle<HTMLInputElement>, files: types.FilePayload[]): Promise<void> {
    const objectId = toRemoteObject(handle).objectId!;
    await this._session.send('DOM.setInputFiles', { objectId, files });
  }

  async adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>> {
    const result = await this._session.send('DOM.resolveNode', {
      objectId: toRemoteObject(handle).objectId,
      executionContextId: (to._delegate as WKExecutionContext)._contextId
    }).catch(debugError);
    if (!result || result.object.subtype === 'null')
      throw new Error('Unable to adopt element handle from a different document');
    return to._createHandle(result.object) as dom.ElementHandle<T>;
  }

  async getAccessibilityTree(needle?: dom.ElementHandle): Promise<{tree: accessibility.AXNode, needle: accessibility.AXNode | null}> {
    return getAccessibilityTree(this._session, needle);
  }

  async getFrameElement(frame: frames.Frame): Promise<dom.ElementHandle> {
    const parent = frame.parentFrame();
    if (!parent)
      throw new Error('Frame has been detached.');
    const context = await parent._utilityContext();
    const handles = await context._$$('iframe');
    const items = await Promise.all(handles.map(async handle => {
      const frame = await handle.contentFrame().catch(e => null);
      return { handle, frame };
    }));
    const result = items.find(item => item.frame === frame);
    await Promise.all(items.map(item => item === result ? Promise.resolve() : item.handle.dispose()));
    if (!result)
      throw new Error('Frame has been detached.');
    return result.handle;
  }

  _onRequestWillBeSent(session: WKSession, event: Protocol.Network.requestWillBeSentPayload) {
    if (event.request.url.startsWith('data:'))
      return;
    let redirectChain: network.Request[] = [];
    if (event.redirectResponse) {
      const request = this._requestIdToRequest.get(event.requestId);
      // If we connect late to the target, we could have missed the requestWillBeSent event.
      if (request) {
        this._handleRequestRedirect(request, event.redirectResponse);
        redirectChain = request.request._redirectChain;
      }
    }
    const frame = this._page._frameManager.frame(event.frameId);
    // TODO(einbinder) this will fail if we are an XHR document request
    const isNavigationRequest = event.type === 'Document';
    const documentId = isNavigationRequest ? event.loaderId : undefined;
    const request = new WKInterceptableRequest(session, !!this._page._state.interceptNetwork, frame, event, redirectChain, documentId);
    this._requestIdToRequest.set(event.requestId, request);
    this._page._frameManager.requestStarted(request.request);
  }

  private _handleRequestRedirect(request: WKInterceptableRequest, responsePayload: Protocol.Network.Response) {
    const response = request.createResponse(responsePayload);
    request.request._redirectChain.push(request.request);
    response._requestFinished(new Error('Response body is unavailable for redirect responses'));
    this._requestIdToRequest.delete(request._requestId);
    this._page._frameManager.requestReceivedResponse(response);
    this._page._frameManager.requestFinished(request.request);
  }

  _onRequestIntercepted(event: Protocol.Network.requestInterceptedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    if (request)
      request._interceptedCallback();
  }

  _onResponseReceived(event: Protocol.Network.responseReceivedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    // FileUpload sends a response without a matching request.
    if (!request)
      return;
    const response = request.createResponse(event.response);
    this._page._frameManager.requestReceivedResponse(response);
  }

  _onLoadingFinished(event: Protocol.Network.loadingFinishedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    // For certain requestIds we never receive requestWillBeSent event.
    // @see https://crbug.com/750469
    if (!request)
      return;

    // Under certain conditions we never get the Network.responseReceived
    // event from protocol. @see https://crbug.com/883475
    const response = request.request.response();
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
    const response = request.request.response();
    if (response)
      response._requestFinished();
    this._requestIdToRequest.delete(request._requestId);
    request.request._setFailureText(event.errorText);
    this._page._frameManager.requestFailed(request.request, event.errorText.includes('cancelled'));
  }
}

function toRemoteObject(handle: dom.ElementHandle): Protocol.Runtime.RemoteObject {
  return handle._remoteObject as Protocol.Runtime.RemoteObject;
}
