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

import * as EventEmitter from 'events';
import { TimeoutError } from '../Errors';
import * as frames from '../frames';
import { assert, debugError, helper, RegisteredListener } from '../helper';
import * as js from '../javascript';
import * as dom from '../dom';
import * as network from '../network';
import { TargetSession } from './Connection';
import { Events } from './events';
import { Events as CommonEvents } from '../events';
import { ExecutionContextDelegate } from './ExecutionContext';
import { NetworkManager, NetworkManagerEvents } from './NetworkManager';
import { Page, PageDelegate } from '../page';
import { Protocol } from './protocol';
import { DOMWorldDelegate } from './JSHandle';
import * as dialog from '../dialog';
import { Browser, BrowserContext } from './Browser';
import { RawMouseImpl, RawKeyboardImpl } from './Input';
import { WKScreenshotDelegate } from './Screenshotter';
import * as input from '../input';
import * as types from '../types';

export const FrameManagerEvents = {
  FrameNavigatedWithinDocument: Symbol('FrameNavigatedWithinDocument'),
  TargetSwappedOnNavigation: Symbol('TargetSwappedOnNavigation'),
  FrameAttached: Symbol('FrameAttached'),
  FrameDetached: Symbol('FrameDetached'),
  FrameNavigated: Symbol('FrameNavigated'),
};

const frameDataSymbol = Symbol('frameData');
type FrameData = {
  id: string,
};

export class FrameManager extends EventEmitter implements frames.FrameDelegate, PageDelegate {
  readonly rawMouse: RawMouseImpl;
  readonly rawKeyboard: RawKeyboardImpl;
  readonly screenshotterDelegate: WKScreenshotDelegate;
  _session: TargetSession;
  _page: Page<Browser, BrowserContext>;
  _networkManager: NetworkManager;
  _frames: Map<string, frames.Frame>;
  _contextIdToContext: Map<number, js.ExecutionContext>;
  _isolatedWorlds: Set<string>;
  _sessionListeners: RegisteredListener[] = [];
  _mainFrame: frames.Frame;
  private _bootstrapScripts: string[] = [];

  constructor(browserContext: BrowserContext) {
    super();
    this.rawKeyboard = new RawKeyboardImpl();
    this.rawMouse = new RawMouseImpl();
    this.screenshotterDelegate = new WKScreenshotDelegate();
    this._networkManager = new NetworkManager(this);
    this._frames = new Map();
    this._contextIdToContext = new Map();
    this._isolatedWorlds = new Set();
    this._page = new Page(this, browserContext);
    this._networkManager.on(NetworkManagerEvents.Request, event => this._page.emit(CommonEvents.Page.Request, event));
    this._networkManager.on(NetworkManagerEvents.Response, event => this._page.emit(CommonEvents.Page.Response, event));
    this._networkManager.on(NetworkManagerEvents.RequestFailed, event => this._page.emit(CommonEvents.Page.RequestFailed, event));
    this._networkManager.on(NetworkManagerEvents.RequestFinished, event => this._page.emit(CommonEvents.Page.RequestFinished, event));
  }

  async initialize(session: TargetSession) {
    helper.removeEventListeners(this._sessionListeners);
    this.disconnectFromTarget();
    this._session = session;
    this.rawKeyboard.setSession(session);
    this.rawMouse.setSession(session);
    this.screenshotterDelegate.initialize(session);
    this._addSessionListeners();
    this.emit(FrameManagerEvents.TargetSwappedOnNavigation);
    const [,{frameTree}] = await Promise.all([
      // Page agent must be enabled before Runtime.
      this._session.send('Page.enable'),
      this._session.send('Page.getResourceTree'),
    ]);
    this._handleFrameTree(frameTree);
    await Promise.all([
      this._session.send('Runtime.enable'),
      this._session.send('Console.enable'),
      this._session.send('Dialog.enable'),
      this._session.send('Page.setInterceptFileChooserDialog', { enabled: true }),
      this._networkManager.initialize(session),
    ]);
    if (this._page._state.userAgent !== null)
      await this._session.send('Page.overrideUserAgent', { value: this._page._state.userAgent });
    if (this._page._state.mediaType !== null)
      await this._session.send('Page.setEmulatedMedia', { media: this._page._state.mediaType || '' });
    if (this._page._state.javascriptEnabled !== null)
      await this._session.send('Emulation.setJavaScriptEnabled', { enabled: this._page._state.javascriptEnabled });
  }

  didClose() {
    helper.removeEventListeners(this._sessionListeners);
    this.disconnectFromTarget();
  }

  _addSessionListeners() {
    this._sessionListeners = [
      helper.addEventListener(this._session, 'Page.frameNavigated', event => this._onFrameNavigated(event.frame)),
      helper.addEventListener(this._session, 'Page.navigatedWithinDocument', event => this._onFrameNavigatedWithinDocument(event.frameId, event.url)),
      helper.addEventListener(this._session, 'Page.frameDetached', event => this._onFrameDetached(event.frameId)),
      helper.addEventListener(this._session, 'Page.frameStoppedLoading', event => this._onFrameStoppedLoading(event.frameId)),
      helper.addEventListener(this._session, 'Runtime.executionContextCreated', event => this._onExecutionContextCreated(event.context)),
      helper.addEventListener(this._session, 'Page.loadEventFired', event => this._page.emit(Events.Page.Load)),
      helper.addEventListener(this._session, 'Console.messageAdded', event => this._onConsoleMessage(event)),
      helper.addEventListener(this._session, 'Page.domContentEventFired', event => this._page.emit(Events.Page.DOMContentLoaded)),
      helper.addEventListener(this._session, 'Dialog.javascriptDialogOpening', event => this._onDialog(event)),
      helper.addEventListener(this._session, 'Page.fileChooserOpened', event => this._onFileChooserOpened(event))
    ];
  }

  disconnectFromTarget() {
    for (const context of this._contextIdToContext.values()) {
      (context._delegate as ExecutionContextDelegate)._dispose();
      context.frame()._contextDestroyed(context);
    }
    // this._mainFrame = null;
  }

  networkManager(): NetworkManager {
    return this._networkManager;
  }

  _onFrameStoppedLoading(frameId: string) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
  }

  _handleFrameTree(frameTree: Protocol.Page.FrameResourceTree) {
    if (frameTree.frame.parentId)
      this._onFrameAttached(frameTree.frame.id, frameTree.frame.parentId);
    this._onFrameNavigated(frameTree.frame);
    if (!frameTree.childFrames)
      return;

    for (const child of frameTree.childFrames)
      this._handleFrameTree(child);
  }

  page(): Page<Browser, BrowserContext> {
    return this._page;
  }

  mainFrame(): frames.Frame {
    return this._mainFrame;
  }

  frames(): Array<frames.Frame> {
    return Array.from(this._frames.values());
  }

  frame(frameId: string): frames.Frame | null {
    return this._frames.get(frameId) || null;
  }

  _frameData(frame: frames.Frame): FrameData {
    return (frame as any)[frameDataSymbol];
  }

  _onFrameAttached(frameId: string, parentFrameId: string | null) {
    if (this._frames.has(frameId))
      return;
    assert(parentFrameId);
    const parentFrame = this._frames.get(parentFrameId);
    const frame = new frames.Frame(this, this._page._timeoutSettings, parentFrame);
    const data: FrameData = {
      id: frameId,
    };
    frame[frameDataSymbol] = data;
    this._frames.set(frameId, frame);
    this.emit(FrameManagerEvents.FrameAttached, frame);
    this._page.emit(CommonEvents.Page.FrameAttached, frame);
    return frame;
  }

  _onFrameNavigated(framePayload: Protocol.Page.Frame) {
    const isMainFrame = !framePayload.parentId;
    let frame = isMainFrame ? this._mainFrame : this._frames.get(framePayload.id);

    // Detach all child frames first.
    if (frame) {
      for (const child of frame.childFrames())
        this._removeFramesRecursively(child);
      if (isMainFrame) {
        // Update frame id to retain frame identity on cross-process navigation.
        const data = this._frameData(frame);
        this._frames.delete(data.id);
        data.id = framePayload.id;
        this._frames.set(data.id, frame);
      }
    } else if (isMainFrame) {
      // Initial frame navigation.
      frame = new frames.Frame(this, this._page._timeoutSettings, null);
      const data: FrameData = {
        id: framePayload.id,
      };
      frame[frameDataSymbol] = data;
      this._frames.set(framePayload.id, frame);
    } else {
      // FIXME(WebKit): there is no Page.frameAttached event in WK.
      frame = this._onFrameAttached(framePayload.id, framePayload.parentId);
    }
    // Update or create main frame.
    if (isMainFrame)
      this._mainFrame = frame;

    // Update frame payload.
    frame._navigated(framePayload.url, framePayload.name);
    for (const context of this._contextIdToContext.values()) {
      if (context.frame() === frame) {
        const delegate = context._delegate as ExecutionContextDelegate;
        delegate._dispose();
        this._contextIdToContext.delete(delegate._contextId);
        frame._contextDestroyed(context);
      }
    }

    this.emit(FrameManagerEvents.FrameNavigated, frame);
    this._page.emit(CommonEvents.Page.FrameNavigated, frame);
  }

  _onFrameNavigatedWithinDocument(frameId: string, url: string) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    frame._navigated(url, frame.name());
    this.emit(FrameManagerEvents.FrameNavigatedWithinDocument, frame);
    this.emit(FrameManagerEvents.FrameNavigated, frame);
    this._page.emit(CommonEvents.Page.FrameNavigated, frame);
  }

  _onFrameDetached(frameId: string) {
    const frame = this._frames.get(frameId);
    if (frame)
      this._removeFramesRecursively(frame);
  }

  _onExecutionContextCreated(contextPayload : Protocol.Runtime.ExecutionContextDescription) {
    if (this._contextIdToContext.has(contextPayload.id))
      return;
    if (!contextPayload.isPageContext)
      return;
    const frameId = contextPayload.frameId;
    // If the frame was attached manually there is no navigation event.
    // FIXME: support frameAttached event in WebKit protocol.
    const frame = this._frames.get(frameId) || null;
    if (!frame)
      return;
    const context = new js.ExecutionContext(new ExecutionContextDelegate(this._session, contextPayload));
    if (frame) {
      context._domWorld = new dom.DOMWorld(context, new DOMWorldDelegate(this, frame));
      frame._contextCreated('main', context);
      frame._contextCreated('utility', context);
    }
    this._contextIdToContext.set(contextPayload.id, context);
  }

  executionContextById(contextId: number): js.ExecutionContext {
    const context = this._contextIdToContext.get(contextId);
    assert(context, 'INTERNAL ERROR: missing context with id = ' + contextId);
    return context;
  }

  _removeFramesRecursively(frame: frames.Frame) {
    for (const child of frame.childFrames())
      this._removeFramesRecursively(child);
    frame._detach();
    this._frames.delete(this._frameData(frame).id);
    this.emit(FrameManagerEvents.FrameDetached, frame);
    this._page.emit(CommonEvents.Page.FrameDetached, frame);
  }

  async navigateFrame(frame: frames.Frame, url: string, options: { referer?: string; timeout?: number; waitUntil?: string | Array<string>; } | undefined = {}): Promise<network.Response | null> {
    const {
      timeout = this._page._timeoutSettings.navigationTimeout(),
    } = options;
    const watchDog = new NextNavigationWatchdog(this, frame, timeout);
    await this._session.send('Page.navigate', {url});
    return watchDog.waitForNavigation();
  }

  async waitForFrameNavigation(frame: frames.Frame, options?: frames.NavigateOptions): Promise<network.Response | null> {
    // FIXME: this method only works for main frames.
    const watchDog = new NextNavigationWatchdog(this, frame, 10000);
    return watchDog.waitForNavigation();
  }

  async setFrameContent(frame: frames.Frame, html: string, options: { timeout?: number; waitUntil?: string | Array<string>; } | undefined = {}) {
    // We rely upon the fact that document.open() will trigger Page.loadEventFired.
    const watchDog = new NextNavigationWatchdog(this, frame, 1000);
    await frame.evaluate(html => {
      document.open();
      document.write(html);
      document.close();
    }, html);
    await watchDog.waitForNavigation();
  }

  async _onConsoleMessage(event: Protocol.Console.messageAddedPayload) {
    const { type, level, text, parameters, url, line: lineNumber, column: columnNumber } = event.message;
    let derivedType: string = type;
    if (type === 'log')
      derivedType = level;
    else if (type === 'timing')
      derivedType = 'timeEnd';
    const mainFrameContext = await this.mainFrame().executionContext();
    const handles = (parameters || []).map(p => {
      let context: js.ExecutionContext | null = null;
      if (p.objectId) {
        const objectId = JSON.parse(p.objectId);
        context = this._contextIdToContext.get(objectId.injectedScriptId);
      } else {
        context = mainFrameContext;
      }
      return context._createHandle(p);
    });
    this._page._addConsoleMessage(derivedType, handles, { url, lineNumber, columnNumber }, handles.length ? undefined : text);
  }

  _onDialog(event: Protocol.Dialog.javascriptDialogOpeningPayload) {
    this._page.emit(Events.Page.Dialog, new dialog.Dialog(
      event.type as dialog.DialogType,
      event.message,
      async (accept: boolean, promptText?: string) => {
        await this._session.send('Dialog.handleJavaScriptDialog', { accept, promptText });
      },
      event.defaultPrompt));
  }

  async _onFileChooserOpened(event: {frameId: Protocol.Network.FrameId, element: Protocol.Runtime.RemoteObject}) {
    const context = await this.frame(event.frameId)._utilityContext();
    const handle = context._createHandle(event.element).asElement()!;
    this._page._onFileChooserOpened(handle);
  }

  setExtraHTTPHeaders(extraHTTPHeaders: network.Headers): Promise<void> {
    return this._networkManager.setExtraHTTPHeaders(extraHTTPHeaders);
  }

  async setUserAgent(userAgent: string): Promise<void> {
    await this._session.send('Page.overrideUserAgent', { value: userAgent });
  }

  async setJavaScriptEnabled(enabled: boolean): Promise<void> {
    await this._session.send('Emulation.setJavaScriptEnabled', { enabled });
  }

  setBypassCSP(enabled: boolean): Promise<void> {
    throw new Error('Not implemented');
  }

  async setViewport(viewport: types.Viewport): Promise<void> {
    if (viewport.isMobile || viewport.isLandscape || viewport.hasTouch)
      throw new Error('Not implemented');
    const width = viewport.width;
    const height = viewport.height;
    await this._session.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: viewport.deviceScaleFactor || 1 });
  }

  async setEmulateMedia(mediaType: input.MediaType | null, mediaColorScheme: input.MediaColorScheme | null): Promise<void> {
    if (mediaColorScheme !== null)
      throw new Error('Not implemented');
    await this._session.send('Page.setEmulatedMedia', { media: mediaType || '' });
  }

  setCacheEnabled(enabled: boolean): Promise<void> {
    return this._networkManager.setCacheEnabled(enabled);
  }

  async reload(options?: frames.NavigateOptions): Promise<network.Response | null> {
    const [response] = await Promise.all([
      this._page.waitForNavigation(options),
      this._session.send('Page.reload')
    ]);
    return response;
  }

  async _go<T extends keyof Protocol.CommandParameters>(command: T, options?: frames.NavigateOptions): Promise<network.Response | null> {
    const [response] = await Promise.all([
      this._page.waitForNavigation(options),
      this._session.send(command).then(() => null),
    ]).catch(error => {
      if (error instanceof Error && error.message.includes(`Protocol error (${command}): Failed to go`))
        return [null];
      throw error;
    });
    return response;
  }

  goBack(options?: frames.NavigateOptions): Promise<network.Response | null> {
    return this._go('Page.goBack', options);
  }

  goForward(options?: frames.NavigateOptions): Promise<network.Response | null> {
    return this._go('Page.goForward', options);
  }

  exposeBinding(name: string, bindingFunction: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async evaluateOnNewDocument(script: string): Promise<void> {
    this._bootstrapScripts.push(script);
    const source = this._bootstrapScripts.join(';');
    // TODO(yurys): support process swap on navigation.
    await this._session.send('Page.setBootstrapScript', { source });
  }

  async closePage(runBeforeUnload: boolean): Promise<void> {
    if (runBeforeUnload)
      throw new Error('Not implemented');
    this._page.browser()._closePage(this._page);
  }
}

/**
 * @internal
 */
class NextNavigationWatchdog {
  _frameManager: FrameManager;
  _frame: frames.Frame;
  _newDocumentNavigationPromise: Promise<unknown>;
  _newDocumentNavigationCallback: (value?: unknown) => void;
  _sameDocumentNavigationPromise: Promise<unknown>;
  _sameDocumentNavigationCallback: (value?: unknown) => void;
  _navigationRequest: any;
  _eventListeners: RegisteredListener[];
  _timeoutPromise: Promise<unknown>;
  _timeoutId: NodeJS.Timer;

  constructor(frameManager: FrameManager, frame: frames.Frame, timeout) {
    this._frameManager = frameManager;
    this._frame = frame;
    this._newDocumentNavigationPromise = new Promise(fulfill => {
      this._newDocumentNavigationCallback = fulfill;
    });
    this._sameDocumentNavigationPromise = new Promise(fulfill => {
      this._sameDocumentNavigationCallback = fulfill;
    });
    /** @type {?Request} */
    this._navigationRequest = null;
    this._eventListeners = [
      helper.addEventListener(frameManager._page, Events.Page.Load, event => this._newDocumentNavigationCallback()),
      helper.addEventListener(frameManager, FrameManagerEvents.FrameNavigatedWithinDocument, frame => this._onSameDocumentNavigation(frame)),
      helper.addEventListener(frameManager, FrameManagerEvents.TargetSwappedOnNavigation, event => this._onTargetReconnected()),
      helper.addEventListener(frameManager.networkManager(), NetworkManagerEvents.Request, this._onRequest.bind(this)),
    ];
    const timeoutError = new TimeoutError('Navigation Timeout Exceeded: ' + timeout + 'ms');
    let timeoutCallback;
    this._timeoutPromise = new Promise(resolve => timeoutCallback = resolve.bind(null, timeoutError));
    this._timeoutId = timeout ? setTimeout(timeoutCallback, timeout) : null;
  }

  async waitForNavigation() {
    const error = await Promise.race([
      this._timeoutPromise,
      this._newDocumentNavigationPromise,
      this._sameDocumentNavigationPromise
    ]);
    // TODO: handle exceptions
    this.dispose();
    if (error)
      throw error;
    return this.navigationResponse();
  }

  async _onTargetReconnected() {
    // In case web process change we migh have missed load event. Check current ready
    // state to mitigate that.
    try {
      const context = await this._frame.executionContext();
      const readyState = await context.evaluate(() => document.readyState);
      switch (readyState) {
        case 'loading':
        case 'interactive':
        case 'complete':
          this._newDocumentNavigationCallback();
          break;
      }
    } catch (e) {
      debugError('_onTargetReconnected ' + e);
    }
  }

  _onSameDocumentNavigation(frame) {
    if (this._frame === frame)
      this._sameDocumentNavigationCallback();
  }

  _onRequest(request: network.Request) {
    if (request.frame() !== this._frame || !request.isNavigationRequest())
      return;
    this._navigationRequest = request;
  }

  navigationResponse(): network.Response | null {
    return this._navigationRequest ? this._navigationRequest.response() : null;
  }

  dispose() {
    helper.removeEventListeners(this._eventListeners);
    clearTimeout(this._timeoutId);
  }
}
