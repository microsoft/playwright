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
import { Events } from '../events';
import { ExecutionContextDelegate, EVALUATION_SCRIPT_URL } from './ExecutionContext';
import { NetworkManager, NetworkManagerEvents } from './NetworkManager';
import { Page, PageDelegate } from '../page';
import { Protocol } from './protocol';
import { DOMWorldDelegate } from './JSHandle';
import * as dialog from '../dialog';
import { Browser } from './Browser';
import { BrowserContext } from '../browserContext';
import { RawMouseImpl, RawKeyboardImpl } from './Input';
import { WKScreenshotDelegate } from './Screenshotter';
import * as input from '../input';
import * as types from '../types';

const UTILITY_WORLD_NAME = '__playwright_utility_world__';
const BINDING_CALL_MESSAGE = '__playwright_binding_call__';

export const FrameManagerEvents = {
  FrameNavigatedWithinDocument: Symbol('FrameNavigatedWithinDocument'),
  FrameAttached: Symbol('FrameAttached'),
  FrameDetached: Symbol('FrameDetached'),
  FrameNavigated: Symbol('FrameNavigated'),
  LifecycleEvent: Symbol('LifecycleEvent'),
};

const frameDataSymbol = Symbol('frameData');
type FrameData = {
  id: string,
  loaderId: string,
};

export class FrameManager extends EventEmitter implements frames.FrameDelegate, PageDelegate {
  readonly rawMouse: RawMouseImpl;
  readonly rawKeyboard: RawKeyboardImpl;
  readonly screenshotterDelegate: WKScreenshotDelegate;
  _session: TargetSession;
  readonly _page: Page;
  private readonly _networkManager: NetworkManager;
  private readonly _frames: Map<string, frames.Frame>;
  private readonly _contextIdToContext: Map<number, js.ExecutionContext>;
  private _isolatedWorlds: Set<string>;
  private _sessionListeners: RegisteredListener[] = [];
  private _mainFrame: frames.Frame;
  private readonly _bootstrapScripts: string[] = [];

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
    this._networkManager.on(NetworkManagerEvents.Request, event => this._page.emit(Events.Page.Request, event));
    this._networkManager.on(NetworkManagerEvents.Response, event => this._page.emit(Events.Page.Response, event));
    this._networkManager.on(NetworkManagerEvents.RequestFailed, event => this._page.emit(Events.Page.RequestFailed, event));
    this._networkManager.on(NetworkManagerEvents.RequestFinished, event => this._page.emit(Events.Page.RequestFinished, event));
  }

  setSession(session: TargetSession) {
    helper.removeEventListeners(this._sessionListeners);
    this.disconnectFromTarget();
    this._session = session;
    this.rawKeyboard.setSession(session);
    this.rawMouse.setSession(session);
    this.screenshotterDelegate.setSession(session);
    this._addSessionListeners();
    this._networkManager.setSession(session);
    this._isolatedWorlds = new Set();
  }

  // This method is called for provisional targets as well. The session passed as the parameter
  // may be different from the current session and may be destroyed without becoming current.
  async _initializeSession(session: TargetSession) {
    const promises : Promise<any>[] = [
      // Page agent must be enabled before Runtime.
      session.send('Page.enable'),
      session.send('Page.getResourceTree').then(({frameTree}) => this._handleFrameTree(frameTree)),
      // Resource tree should be received before first execution context.
      session.send('Runtime.enable').then(() => this._ensureIsolatedWorld(UTILITY_WORLD_NAME)),
      session.send('Console.enable'),
      session.send('Page.setInterceptFileChooserDialog', { enabled: true }),
      this._networkManager.initializeSession(session),
    ];
    if (!session.isProvisional()) {
      // FIXME: move dialog agent to web process.
      // Dialog agent resides in the UI process and should not be re-enabled on navigation.
      promises.push(session.send('Dialog.enable'));
    }
    if (this._page._state.userAgent !== null)
      promises.push(session.send('Page.overrideUserAgent', { value: this._page._state.userAgent }));
    if (this._page._state.mediaType !== null)
      promises.push(session.send('Page.setEmulatedMedia', { media: this._page._state.mediaType || '' }));
    if (this._page._state.javascriptEnabled !== null)
      promises.push(session.send('Emulation.setJavaScriptEnabled', { enabled: this._page._state.javascriptEnabled }));
    if (this._page._state.bypassCSP !== null)
      promises.push(session.send('Page.setBypassCSP', { enabled: this._page._state.bypassCSP }));
    await Promise.all(promises);
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
      helper.addEventListener(this._session, 'Page.loadEventFired', event => this._onLifecycleEvent(event.frameId, 'load')),
      helper.addEventListener(this._session, 'Page.domContentEventFired', event => this._onLifecycleEvent(event.frameId, 'domcontentloaded')),
      helper.addEventListener(this._session, 'Runtime.executionContextCreated', event => this._onExecutionContextCreated(event.context)),
      helper.addEventListener(this._session, 'Console.messageAdded', event => this._onConsoleMessage(event)),
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
    const hasDOMContentLoaded = frame._firedLifecycleEvents.has('domcontentloaded');
    const hasLoad = frame._firedLifecycleEvents.has('load');
    frame._firedLifecycleEvents.add('domcontentloaded');
    frame._firedLifecycleEvents.add('load');
    this.emit(FrameManagerEvents.LifecycleEvent, frame);
    if (frame === this.mainFrame() && !hasDOMContentLoaded)
      this._page.emit(Events.Page.DOMContentLoaded);
    if (frame === this.mainFrame() && !hasLoad)
      this._page.emit(Events.Page.Load);
  }

  _onLifecycleEvent(frameId: string, event: frames.LifecycleEvent) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    frame._firedLifecycleEvents.add(event);
    this.emit(FrameManagerEvents.LifecycleEvent, frame);
    if (frame === this.mainFrame()) {
      if (event === 'load')
        this._page.emit(Events.Page.Load);
      if (event === 'domcontentloaded')
        this._page.emit(Events.Page.DOMContentLoaded);
    }
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

  page(): Page {
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
      loaderId: '',
    };
    frame[frameDataSymbol] = data;
    this._frames.set(frameId, frame);
    this.emit(FrameManagerEvents.FrameAttached, frame);
    this._page.emit(Events.Page.FrameAttached, frame);
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
        loaderId: framePayload.loaderId,
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
    frame._firedLifecycleEvents.clear();
    const data = this._frameData(frame);
    data.loaderId = framePayload.loaderId;

    for (const context of this._contextIdToContext.values()) {
      if (context.frame() === frame) {
        const delegate = context._delegate as ExecutionContextDelegate;
        delegate._dispose();
        this._contextIdToContext.delete(delegate._contextId);
        frame._contextDestroyed(context);
      }
    }

    this.emit(FrameManagerEvents.FrameNavigated, frame);
    this._page.emit(Events.Page.FrameNavigated, frame);
  }

  _onFrameNavigatedWithinDocument(frameId: string, url: string) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    frame._navigated(url, frame.name());
    this.emit(FrameManagerEvents.FrameNavigatedWithinDocument, frame);
    this.emit(FrameManagerEvents.FrameNavigated, frame);
    this._page.emit(Events.Page.FrameNavigated, frame);
  }

  _onFrameDetached(frameId: string) {
    const frame = this._frames.get(frameId);
    if (frame)
      this._removeFramesRecursively(frame);
  }

  _onExecutionContextCreated(contextPayload : Protocol.Runtime.ExecutionContextDescription) {
    if (this._contextIdToContext.has(contextPayload.id))
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
      if (contextPayload.isPageContext)
        frame._contextCreated('main', context);
      else if (contextPayload.name === UTILITY_WORLD_NAME)
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
    this._page.emit(Events.Page.FrameDetached, frame);
  }

  async navigateFrame(frame: frames.Frame, url: string, options: frames.GotoOptions = {}): Promise<network.Response | null> {
    const {
      timeout = this._page._timeoutSettings.navigationTimeout(),
      waitUntil = (['load'] as frames.LifecycleEvent[])
    } = options;
    const watchDog = new NextNavigationWatchdog(this, frame, waitUntil, timeout);
    await this._session.send('Page.navigate', {url, frameId: this._frameData(frame).id});
    const error = await Promise.race([
      watchDog.timeoutOrTerminationPromise(),
      watchDog.newDocumentNavigationPromise(),
      watchDog.sameDocumentNavigationPromise(),
    ]);
    watchDog.dispose();
    if (error)
      throw error;
    return watchDog.navigationResponse();
  }

  async waitForFrameNavigation(frame: frames.Frame, options: frames.NavigateOptions = {}): Promise<network.Response | null> {
    const {
      timeout = this._page._timeoutSettings.navigationTimeout(),
      waitUntil = (['load'] as frames.LifecycleEvent[])
    } = options;
    const watchDog = new NextNavigationWatchdog(this, frame, waitUntil, timeout);
    const error = await Promise.race([
      watchDog.timeoutOrTerminationPromise(),
      watchDog.newDocumentNavigationPromise(),
      watchDog.sameDocumentNavigationPromise(),
    ]);
    watchDog.dispose();
    if (error)
      throw error;
    return watchDog.navigationResponse();
  }

  async setFrameContent(frame: frames.Frame, html: string, options: frames.NavigateOptions = {}) {
    // We rely upon the fact that document.open() will trigger Page.loadEventFired.
    const {
      timeout = this._page._timeoutSettings.navigationTimeout(),
      waitUntil = (['load'] as frames.LifecycleEvent[])
    } = options;
    const watchDog = new NextNavigationWatchdog(this, frame, waitUntil, timeout);
    await frame.evaluate(html => {
      document.open();
      document.write(html);
      document.close();
    }, html);
    const error = await Promise.race([
      watchDog.timeoutOrTerminationPromise(),
      watchDog.lifecyclePromise(),
    ]);
    watchDog.dispose();
    if (error)
      throw error;
  }

  async _onConsoleMessage(event: Protocol.Console.messageAddedPayload) {
    const { type, level, text, parameters, url, line: lineNumber, column: columnNumber } = event.message;
    if (level === 'debug' && parameters && parameters[0].value === BINDING_CALL_MESSAGE) {
      const parsedObjectId = JSON.parse(parameters[1].objectId);
      const context = this._contextIdToContext.get(parsedObjectId.injectedScriptId);
      this._page._onBindingCalled(parameters[2].value, context);
      return;
    }
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
    const context = await this.frame(event.frameId)._mainContext();
    const handle = context._createHandle(event.element).asElement()!;
    this._page._onFileChooserOpened(handle);
  }

  setExtraHTTPHeaders(extraHTTPHeaders: network.Headers): Promise<void> {
    return this._networkManager.setExtraHTTPHeaders(extraHTTPHeaders);
  }

  async _ensureIsolatedWorld(name: string) {
    if (this._isolatedWorlds.has(name))
      return;
    this._isolatedWorlds.add(name);
    await this._session.send('Page.createIsolatedWorld', {
      name,
      source: `//# sourceURL=${EVALUATION_SCRIPT_URL}`
    });
  }

  async setUserAgent(userAgent: string): Promise<void> {
    await this._session.send('Page.overrideUserAgent', { value: userAgent });
  }

  async setJavaScriptEnabled(enabled: boolean): Promise<void> {
    await this._session.send('Emulation.setJavaScriptEnabled', { enabled });
  }

  async setBypassCSP(enabled: boolean): Promise<void> {
    await this._session.send('Page.setBypassCSP', { enabled });
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

  async exposeBinding(name: string, bindingFunction: string): Promise<void> {
    const script = `self.${name} = (param) => console.debug('${BINDING_CALL_MESSAGE}', {}, param); ${bindingFunction}`;
    this._bootstrapScripts.unshift(script);
    const source = this._bootstrapScripts.join(';');
    await this._session.send('Page.setBootstrapScript', { source });
    await Promise.all(this.frames().map(frame => frame.evaluate(script).catch(debugError)));
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
    (this._page.browser() as Browser)._closePage(this._page);
  }
}

/**
 * @internal
 */
class NextNavigationWatchdog {
  private readonly _frameManager: FrameManager;
  private readonly _frame: frames.Frame;
  private readonly _newDocumentNavigationPromise: Promise<Error | null>;
  private _newDocumentNavigationCallback: (value?: unknown) => void;
  private readonly _sameDocumentNavigationPromise: Promise<Error | null>;
  private _sameDocumentNavigationCallback: (value?: unknown) => void;
  private readonly _lifecyclePromise: Promise<void>;
  private _lifecycleCallback: () => void;
  private readonly _frameDetachPromise: Promise<Error | null>;
  private _frameDetachCallback: (err: Error | null) => void;
  private readonly _initialSession: TargetSession;
  private _navigationRequest?: network.Request = null;
  private readonly _eventListeners: RegisteredListener[];
  private readonly _timeoutPromise: Promise<Error | null>;
  private readonly _timeoutId: NodeJS.Timer;
  private _hasSameDocumentNavigation = false;
  private readonly _expectedLifecycle: frames.LifecycleEvent[];
  private readonly _initialLoaderId: string;

  constructor(frameManager: FrameManager, frame: frames.Frame, waitUntil: frames.LifecycleEvent | frames.LifecycleEvent[], timeout) {
    if (Array.isArray(waitUntil))
      waitUntil = waitUntil.slice();
    else if (typeof waitUntil === 'string')
      waitUntil = [waitUntil];
    this._expectedLifecycle = waitUntil.slice();
    this._frameManager = frameManager;
    this._frame = frame;
    this._initialLoaderId = frameManager._frameData(frame).loaderId;
    this._initialSession = frameManager._session;
    this._newDocumentNavigationPromise = new Promise(fulfill => {
      this._newDocumentNavigationCallback = fulfill;
    });
    this._sameDocumentNavigationPromise = new Promise(fulfill => {
      this._sameDocumentNavigationCallback = fulfill;
    });
    this._lifecyclePromise = new Promise(fulfill => {
      this._lifecycleCallback = fulfill;
    });
    this._eventListeners = [
      helper.addEventListener(frameManager, FrameManagerEvents.LifecycleEvent, frame => this._onLifecycleEvent(frame)),
      helper.addEventListener(frameManager, FrameManagerEvents.FrameNavigated, frame => this._onLifecycleEvent(frame)),
      helper.addEventListener(frameManager, FrameManagerEvents.FrameNavigatedWithinDocument, frame => this._onSameDocumentNavigation(frame)),
      helper.addEventListener(frameManager, FrameManagerEvents.FrameDetached, frame => this._onFrameDetached(frame)),
      helper.addEventListener(frameManager.networkManager(), NetworkManagerEvents.Request, this._onRequest.bind(this)),
    ];
    const timeoutError = new TimeoutError('Navigation Timeout Exceeded: ' + timeout + 'ms');
    let timeoutCallback;
    this._timeoutPromise = new Promise(resolve => timeoutCallback = resolve.bind(null, timeoutError));
    this._timeoutId = timeout ? setTimeout(timeoutCallback, timeout) : null;
    this._frameDetachPromise = new Promise(fulfill => {
      this._frameDetachCallback = fulfill;
    });
  }

  sameDocumentNavigationPromise(): Promise<Error | null> {
    return this._sameDocumentNavigationPromise;
  }

  newDocumentNavigationPromise(): Promise<Error | null> {
    return this._newDocumentNavigationPromise;
  }

  lifecyclePromise(): Promise<any> {
    return this._lifecyclePromise;
  }

  timeoutOrTerminationPromise(): Promise<Error | null> {
    return Promise.race([
      this._timeoutPromise,
      this._frameDetachPromise,
      this._frameManager._page._disconnectedPromise
    ]);
  }

  _onLifecycleEvent(frame: frames.Frame) {
    this._checkLifecycle();
  }

  _onSameDocumentNavigation(frame) {
    if (this._frame === frame)
      this._hasSameDocumentNavigation = true;
    this._checkLifecycle();
  }

  _checkLifecycle() {
    const checkLifecycle = (frame: frames.Frame, expectedLifecycle: frames.LifecycleEvent[]): boolean => {
      for (const event of expectedLifecycle) {
        if (!frame._firedLifecycleEvents.has(event))
          return false;
      }
      for (const child of frame.childFrames()) {
        if (!checkLifecycle(child, expectedLifecycle))
          return false;
      }
      return true;
    };

    if (this._frame.isDetached()) {
      this._newDocumentNavigationCallback(new Error('Navigating frame was detached'));
      this._sameDocumentNavigationCallback(new Error('Navigating frame was detached'));
      return;
    }

    if (!checkLifecycle(this._frame, this._expectedLifecycle))
      return;
    this._lifecycleCallback();
    if (this._hasSameDocumentNavigation)
      this._sameDocumentNavigationCallback();
    if (this._frameManager._frameData(this._frame).loaderId !== this._initialLoaderId ||
        this._initialSession !== this._frameManager._session)
      this._newDocumentNavigationCallback();
  }

  _onFrameDetached(frame: frames.Frame) {
    if (this._frame === frame) {
      this._frameDetachCallback.call(null, new Error('Navigating frame was detached'));
      return;
    }
    this._checkLifecycle();
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
    // TODO: handle exceptions
    helper.removeEventListeners(this._eventListeners);
    clearTimeout(this._timeoutId);
  }
}
