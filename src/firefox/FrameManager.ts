/**
 * Copyright 2019 Google Inc. All rights reserved.
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

import { EventEmitter } from 'events';
import { TimeoutError } from '../Errors';
import * as frames from '../frames';
import { assert, helper, RegisteredListener, debugError } from '../helper';
import * as js from '../javascript';
import * as dom from '../dom';
import { JugglerSession } from './Connection';
import { ExecutionContextDelegate } from './ExecutionContext';
import { NavigationWatchdog, NextNavigationWatchdog } from './NavigationWatchdog';
import { Page, PageDelegate } from '../page';
import { NetworkManager, NetworkManagerEvents } from './NetworkManager';
import { DOMWorldDelegate } from './JSHandle';
import { Events } from './events';
import { Events as CommonEvents } from '../events';
import * as dialog from '../dialog';
import { Protocol } from './protocol';
import * as input from '../input';
import { RawMouseImpl, RawKeyboardImpl } from './Input';
import { FFScreenshotDelegate } from './Screenshotter';
import { Browser, BrowserContext } from './Browser';
import { Interception } from './features/interception';
import { Accessibility } from './features/accessibility';
import * as network from '../network';
import * as types from '../types';

export const FrameManagerEvents = {
  FrameNavigated: Symbol('FrameManagerEvents.FrameNavigated'),
  FrameAttached: Symbol('FrameManagerEvents.FrameAttached'),
  FrameDetached: Symbol('FrameManagerEvents.FrameDetached'),
  Load: Symbol('FrameManagerEvents.Load'),
  DOMContentLoaded: Symbol('FrameManagerEvents.DOMContentLoaded'),
};

const frameDataSymbol = Symbol('frameData');
type FrameData = {
  frameId: string,
  lastCommittedNavigationId: string,
};

export class FrameManager extends EventEmitter implements frames.FrameDelegate, PageDelegate {
  readonly rawMouse: RawMouseImpl;
  readonly rawKeyboard: RawKeyboardImpl;
  readonly screenshotterDelegate: FFScreenshotDelegate;
  readonly _session: JugglerSession;
  readonly _page: Page<Browser, BrowserContext>;
  private readonly _networkManager: NetworkManager;
  private _mainFrame: frames.Frame;
  private readonly _frames: Map<string, frames.Frame>;
  private readonly _contextIdToContext: Map<string, js.ExecutionContext>;
  private _eventListeners: RegisteredListener[];

  constructor(session: JugglerSession, browserContext: BrowserContext) {
    super();
    this._session = session;
    this.rawKeyboard = new RawKeyboardImpl(session);
    this.rawMouse = new RawMouseImpl(session);
    this.screenshotterDelegate = new FFScreenshotDelegate(session, this);
    this._networkManager = new NetworkManager(session, this);
    this._mainFrame = null;
    this._frames = new Map();
    this._contextIdToContext = new Map();
    this._eventListeners = [
      helper.addEventListener(this._session, 'Page.eventFired', this._onEventFired.bind(this)),
      helper.addEventListener(this._session, 'Page.frameAttached', this._onFrameAttached.bind(this)),
      helper.addEventListener(this._session, 'Page.frameDetached', this._onFrameDetached.bind(this)),
      helper.addEventListener(this._session, 'Page.navigationCommitted', this._onNavigationCommitted.bind(this)),
      helper.addEventListener(this._session, 'Page.sameDocumentNavigation', this._onSameDocumentNavigation.bind(this)),
      helper.addEventListener(this._session, 'Runtime.executionContextCreated', this._onExecutionContextCreated.bind(this)),
      helper.addEventListener(this._session, 'Runtime.executionContextDestroyed', this._onExecutionContextDestroyed.bind(this)),
      helper.addEventListener(this._session, 'Page.uncaughtError', this._onUncaughtError.bind(this)),
      helper.addEventListener(this._session, 'Runtime.console', this._onConsole.bind(this)),
      helper.addEventListener(this._session, 'Page.dialogOpened', this._onDialogOpened.bind(this)),
      helper.addEventListener(this._session, 'Page.bindingCalled', this._onBindingCalled.bind(this)),
      helper.addEventListener(this._session, 'Page.fileChooserOpened', this._onFileChooserOpened.bind(this)),
      helper.addEventListener(this._networkManager, NetworkManagerEvents.Request, request => this._page.emit(CommonEvents.Page.Request, request)),
      helper.addEventListener(this._networkManager, NetworkManagerEvents.Response, response => this._page.emit(CommonEvents.Page.Response, response)),
      helper.addEventListener(this._networkManager, NetworkManagerEvents.RequestFinished, request => this._page.emit(CommonEvents.Page.RequestFinished, request)),
      helper.addEventListener(this._networkManager, NetworkManagerEvents.RequestFailed, request => this._page.emit(CommonEvents.Page.RequestFailed, request)),
    ];
    this._page = new Page(this, browserContext);
    (this._page as any).interception = new Interception(this._networkManager);
    (this._page as any).accessibility = new Accessibility(session);
  }

  async _initialize() {
    await Promise.all([
      this._session.send('Runtime.enable'),
      this._session.send('Network.enable'),
      this._session.send('Page.enable'),
      this._session.send('Page.setInterceptFileChooserDialog', { enabled: true })
    ]);
  }

  executionContextById(executionContextId) {
    return this._contextIdToContext.get(executionContextId) || null;
  }

  _onExecutionContextCreated({executionContextId, auxData}) {
    const frameId = auxData ? auxData.frameId : null;
    const frame = this._frames.get(frameId) || null;
    const context = new js.ExecutionContext(new ExecutionContextDelegate(this._session, executionContextId));
    if (frame) {
      context._domWorld = new dom.DOMWorld(context, new DOMWorldDelegate(this, frame));
      frame._contextCreated('main', context);
      frame._contextCreated('utility', context);
    }
    this._contextIdToContext.set(executionContextId, context);
  }

  _onExecutionContextDestroyed({executionContextId}) {
    const context = this._contextIdToContext.get(executionContextId);
    if (!context)
      return;
    this._contextIdToContext.delete(executionContextId);
    if (context.frame())
      context.frame()._contextDestroyed(context);
  }

  _frameData(frame: frames.Frame): FrameData {
    return (frame as any)[frameDataSymbol];
  }

  frame(frameId: string): frames.Frame {
    return this._frames.get(frameId);
  }

  mainFrame(): frames.Frame {
    return this._mainFrame;
  }

  frames() {
    const frames: Array<frames.Frame> = [];
    collect(this._mainFrame);
    return frames;

    function collect(frame: frames.Frame) {
      frames.push(frame);
      for (const subframe of frame.childFrames())
        collect(subframe);
    }
  }

  _onNavigationCommitted(params) {
    const frame = this._frames.get(params.frameId);
    frame._navigated(params.url, params.name);
    const data = this._frameData(frame);
    data.lastCommittedNavigationId = params.navigationId;
    frame._firedLifecycleEvents.clear();
    this.emit(FrameManagerEvents.FrameNavigated, frame);
    this._page.emit(CommonEvents.Page.FrameNavigated, frame);
  }

  _onSameDocumentNavigation(params) {
    const frame = this._frames.get(params.frameId);
    frame._navigated(params.url, frame.name());
    this.emit(FrameManagerEvents.FrameNavigated, frame);
    this._page.emit(CommonEvents.Page.FrameNavigated, frame);
  }

  _onFrameAttached(params) {
    const parentFrame = this._frames.get(params.parentFrameId) || null;
    const frame = new frames.Frame(this, this._page._timeoutSettings, parentFrame);
    const data: FrameData = {
      frameId: params.frameId,
      lastCommittedNavigationId: '',
    };
    frame[frameDataSymbol] = data;
    if (!parentFrame) {
      assert(!this._mainFrame, 'INTERNAL ERROR: re-attaching main frame!');
      this._mainFrame = frame;
    }
    this._frames.set(params.frameId, frame);
    this.emit(FrameManagerEvents.FrameAttached, frame);
    this._page.emit(CommonEvents.Page.FrameAttached, frame);
  }

  _onFrameDetached(params) {
    const frame = this._frames.get(params.frameId);
    this._frames.delete(params.frameId);
    frame._detach();
    this.emit(FrameManagerEvents.FrameDetached, frame);
    this._page.emit(CommonEvents.Page.FrameDetached, frame);
  }

  _onEventFired({frameId, name}) {
    const frame = this._frames.get(frameId);
    if (name === 'load') {
      frame._firedLifecycleEvents.add('load');
      if (frame === this._mainFrame) {
        this.emit(FrameManagerEvents.Load);
        this._page.emit(CommonEvents.Page.Load);
      }
    }
    if (name === 'DOMContentLoaded') {
      frame._firedLifecycleEvents.add('domcontentloaded');
      if (frame === this._mainFrame) {
        this.emit(FrameManagerEvents.DOMContentLoaded);
        this._page.emit(CommonEvents.Page.DOMContentLoaded);
      }
    }
  }

  _onUncaughtError(params) {
    const error = new Error(params.message);
    error.stack = params.stack;
    this._page.emit(Events.Page.PageError, error);
  }

  _onConsole({type, args, executionContextId, location}) {
    const context = this.executionContextById(executionContextId);
    this._page._addConsoleMessage(type, args.map(arg => context._createHandle(arg)), location);
  }

  _onDialogOpened(params) {
    this._page.emit(Events.Page.Dialog, new dialog.Dialog(
      params.type as dialog.DialogType,
      params.message,
      async (accept: boolean, promptText?: string) => {
        await this._session.send('Page.handleDialog', { dialogId: params.dialogId, accept, promptText }).catch(debugError);
      },
      params.defaultValue));
  }

  _onBindingCalled(event: Protocol.Page.bindingCalledPayload) {
    const context = this.executionContextById(event.executionContextId);
    this._page._onBindingCalled(event.payload, context);
  }

  async _onFileChooserOpened({executionContextId, element}) {
    const context = this.executionContextById(executionContextId);
    const handle = context._createHandle(element).asElement()!;
    this._page._onFileChooserOpened(handle);
  }

  async exposeBinding(name: string, bindingFunction: string): Promise<void> {
    await this._session.send('Page.addBinding', {name: name});
    await this._session.send('Page.addScriptToEvaluateOnNewDocument', {script: bindingFunction});
    await Promise.all(this.frames().map(frame => frame.evaluate(bindingFunction).catch(debugError)));
  }

  didClose() {
    helper.removeEventListeners(this._eventListeners);
    this._networkManager.dispose();
  }

  async waitForFrameNavigation(frame: frames.Frame, options: frames.NavigateOptions = {}) {
    const {
      timeout = this._page._timeoutSettings.navigationTimeout(),
      waitUntil = (['load'] as frames.LifecycleEvent[]),
    } = options;
    const normalizedWaitUntil = normalizeWaitUntil(waitUntil);

    const timeoutError = new TimeoutError('Navigation timeout of ' + timeout + ' ms exceeded');
    let timeoutCallback;
    const timeoutPromise = new Promise(resolve => timeoutCallback = resolve.bind(null, timeoutError));
    const timeoutId = timeout ? setTimeout(timeoutCallback, timeout) : null;

    const nextNavigationDog = new NextNavigationWatchdog(this, frame);
    const error1 = await Promise.race([
      nextNavigationDog.promise(),
      timeoutPromise,
    ]);
    nextNavigationDog.dispose();

    // If timeout happened first - throw.
    if (error1) {
      clearTimeout(timeoutId);
      throw error1;
    }

    const {navigationId, url} = nextNavigationDog.navigation();

    if (!navigationId) {
      // Same document navigation happened.
      clearTimeout(timeoutId);
      return null;
    }

    const watchDog = new NavigationWatchdog(this, frame, this._networkManager, navigationId, url, normalizedWaitUntil);
    const error = await Promise.race([
      timeoutPromise,
      watchDog.promise(),
    ]);
    watchDog.dispose();
    clearTimeout(timeoutId);
    if (error)
      throw error;
    return watchDog.navigationResponse();
  }

  async navigateFrame(frame: frames.Frame, url: string, options: frames.GotoOptions = {}) {
    const {
      timeout = this._page._timeoutSettings.navigationTimeout(),
      waitUntil = (['load'] as frames.LifecycleEvent[]),
      referer,
    } = options;
    const normalizedWaitUntil = normalizeWaitUntil(waitUntil);
    const {navigationId} = await this._session.send('Page.navigate', {
      frameId: this._frameData(frame).frameId,
      referer,
      url,
    });
    if (!navigationId)
      return;

    const timeoutError = new TimeoutError('Navigation timeout of ' + timeout + ' ms exceeded');
    let timeoutCallback;
    const timeoutPromise = new Promise(resolve => timeoutCallback = resolve.bind(null, timeoutError));
    const timeoutId = timeout ? setTimeout(timeoutCallback, timeout) : null;

    const watchDog = new NavigationWatchdog(this, frame, this._networkManager, navigationId, url, normalizedWaitUntil);
    const error = await Promise.race([
      timeoutPromise,
      watchDog.promise(),
    ]);
    watchDog.dispose();
    clearTimeout(timeoutId);
    if (error)
      throw error;
    return watchDog.navigationResponse();
  }

  async setFrameContent(frame: frames.Frame, html: string) {
    const context = await frame._utilityContext();
    await context.evaluate(html => {
      document.open();
      document.write(html);
      document.close();
    }, html);
  }

  setExtraHTTPHeaders(extraHTTPHeaders: network.Headers): Promise<void> {
    return this._networkManager.setExtraHTTPHeaders(extraHTTPHeaders);
  }

  async setUserAgent(userAgent: string): Promise<void> {
    await this._session.send('Page.setUserAgent', { userAgent });
  }

  async setJavaScriptEnabled(enabled: boolean): Promise<void> {
    await this._session.send('Page.setJavascriptEnabled', { enabled });
  }

  async setBypassCSP(enabled: boolean): Promise<void> {
    await this._session.send('Page.setBypassCSP', { enabled });
  }

  async setViewport(viewport: types.Viewport): Promise<void> {
    const {
      width,
      height,
      isMobile = false,
      deviceScaleFactor = 1,
      hasTouch = false,
      isLandscape = false,
    } = viewport;
    await this._session.send('Page.setViewport', {
      viewport: { width, height, isMobile, deviceScaleFactor, hasTouch, isLandscape },
    });
  }

  async setEmulateMedia(mediaType: input.MediaType | null, mediaColorScheme: input.MediaColorScheme | null): Promise<void> {
    await this._session.send('Page.setEmulatedMedia', {
      type: mediaType === null ? undefined : mediaType,
      colorScheme: mediaColorScheme === null ? undefined : mediaColorScheme
    });
  }

  async setCacheEnabled(enabled: boolean): Promise<void> {
    await this._session.send('Page.setCacheDisabled', {cacheDisabled: !enabled});
  }

  private async _go(action: () => Promise<{ navigationId: string | null, navigationURL: string | null }>, options: frames.NavigateOptions = {}) {
    const {
      timeout = this._page._timeoutSettings.navigationTimeout(),
      waitUntil = (['load'] as frames.LifecycleEvent[]),
    } = options;
    const frame = this.mainFrame();
    const normalizedWaitUntil = normalizeWaitUntil(waitUntil);
    const { navigationId, navigationURL } = await action();
    if (!navigationId)
      return null;

    const timeoutError = new TimeoutError('Navigation timeout of ' + timeout + ' ms exceeded');
    let timeoutCallback;
    const timeoutPromise = new Promise(resolve => timeoutCallback = resolve.bind(null, timeoutError));
    const timeoutId = timeout ? setTimeout(timeoutCallback, timeout) : null;

    const watchDog = new NavigationWatchdog(this, frame, this._networkManager, navigationId, navigationURL, normalizedWaitUntil);
    const error = await Promise.race([
      timeoutPromise,
      watchDog.promise(),
    ]);
    watchDog.dispose();
    clearTimeout(timeoutId);
    if (error)
      throw error;
    return watchDog.navigationResponse();
  }

  reload(options?: frames.NavigateOptions): Promise<network.Response | null> {
    return this._go(() => this._session.send('Page.reload', { frameId: this._frameData(this.mainFrame()).frameId }), options);
  }

  goBack(options?: frames.NavigateOptions): Promise<network.Response | null> {
    return this._go(() => this._session.send('Page.goBack', { frameId: this._frameData(this.mainFrame()).frameId }), options);
  }

  goForward(options?: frames.NavigateOptions): Promise<network.Response | null> {
    return this._go(() => this._session.send('Page.goForward', { frameId: this._frameData(this.mainFrame()).frameId }), options);
  }

  async evaluateOnNewDocument(source: string): Promise<void> {
    await this._session.send('Page.addScriptToEvaluateOnNewDocument', { script: source });
  }

  async closePage(runBeforeUnload: boolean): Promise<void> {
    await this._session.send('Page.close', { runBeforeUnload });
  }
}

export function normalizeWaitUntil(waitUntil: frames.LifecycleEvent | frames.LifecycleEvent[]): frames.LifecycleEvent[] {
  if (!Array.isArray(waitUntil))
    waitUntil = [waitUntil];
  for (const condition of waitUntil) {
    if (condition !== 'load' && condition !== 'domcontentloaded')
      throw new Error('Unknown waitUntil condition: ' + condition);
  }
  return waitUntil;
}
