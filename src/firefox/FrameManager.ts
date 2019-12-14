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
import * as frames from '../frames';
import { assert, helper, RegisteredListener, debugError } from '../helper';
import * as js from '../javascript';
import * as dom from '../dom';
import { JugglerSession } from './Connection';
import { ExecutionContextDelegate } from './ExecutionContext';
import { Page, PageDelegate } from '../page';
import { NetworkManager, NetworkManagerEvents } from './NetworkManager';
import { Events } from '../events';
import * as dialog from '../dialog';
import { Protocol } from './protocol';
import * as input from '../input';
import { RawMouseImpl, RawKeyboardImpl } from './Input';
import { BrowserContext } from '../browserContext';
import { Interception } from './features/interception';
import { Accessibility } from './features/accessibility';
import * as network from '../network';
import * as types from '../types';

export class FrameManager extends EventEmitter implements PageDelegate {
  readonly rawMouse: RawMouseImpl;
  readonly rawKeyboard: RawKeyboardImpl;
  readonly _session: JugglerSession;
  readonly _page: Page;
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
    this._networkManager = new NetworkManager(session, this);
    this._mainFrame = null;
    this._frames = new Map();
    this._contextIdToContext = new Map();
    this._eventListeners = [
      helper.addEventListener(this._session, 'Page.eventFired', this._onEventFired.bind(this)),
      helper.addEventListener(this._session, 'Page.frameAttached', this._onFrameAttached.bind(this)),
      helper.addEventListener(this._session, 'Page.frameDetached', this._onFrameDetached.bind(this)),
      helper.addEventListener(this._session, 'Page.navigationAborted', this._onNavigationAborted.bind(this)),
      helper.addEventListener(this._session, 'Page.navigationCommitted', this._onNavigationCommitted.bind(this)),
      helper.addEventListener(this._session, 'Page.navigationStarted', this._onNavigationStarted.bind(this)),
      helper.addEventListener(this._session, 'Page.sameDocumentNavigation', this._onSameDocumentNavigation.bind(this)),
      helper.addEventListener(this._session, 'Runtime.executionContextCreated', this._onExecutionContextCreated.bind(this)),
      helper.addEventListener(this._session, 'Runtime.executionContextDestroyed', this._onExecutionContextDestroyed.bind(this)),
      helper.addEventListener(this._session, 'Page.uncaughtError', this._onUncaughtError.bind(this)),
      helper.addEventListener(this._session, 'Runtime.console', this._onConsole.bind(this)),
      helper.addEventListener(this._session, 'Page.dialogOpened', this._onDialogOpened.bind(this)),
      helper.addEventListener(this._session, 'Page.bindingCalled', this._onBindingCalled.bind(this)),
      helper.addEventListener(this._session, 'Page.fileChooserOpened', this._onFileChooserOpened.bind(this)),
      helper.addEventListener(this._networkManager, NetworkManagerEvents.Request, request => this._page.emit(Events.Page.Request, request)),
      helper.addEventListener(this._networkManager, NetworkManagerEvents.Response, response => this._page.emit(Events.Page.Response, response)),
      helper.addEventListener(this._networkManager, NetworkManagerEvents.RequestFinished, request => this._page.emit(Events.Page.RequestFinished, request)),
      helper.addEventListener(this._networkManager, NetworkManagerEvents.RequestFailed, request => this._page.emit(Events.Page.RequestFailed, request)),
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
    const delegate = new ExecutionContextDelegate(this._session, executionContextId);
    if (frame) {
      const context = new dom.FrameExecutionContext(delegate, frame);
      frame._contextCreated('main', context);
      frame._contextCreated('utility', context);
      this._contextIdToContext.set(executionContextId, context);
    } else {
      this._contextIdToContext.set(executionContextId, new js.ExecutionContext(delegate));
    }
  }

  _onExecutionContextDestroyed({executionContextId}) {
    const context = this._contextIdToContext.get(executionContextId);
    if (!context)
      return;
    this._contextIdToContext.delete(executionContextId);
    if (context.frame())
      context.frame()._contextDestroyed(context as dom.FrameExecutionContext);
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

  _onNavigationStarted(params) {
  }

  _onNavigationAborted(params) {
    const frame = this._frames.get(params.frameId);
    frame._onAbortedNewDocumentNavigation(params.navigationId, params.errorText);
  }

  _onNavigationCommitted(params) {
    const frame = this._frames.get(params.frameId);
    frame._onCommittedNewDocumentNavigation(params.url, params.name, params.navigationId, false);
    this._page.emit(Events.Page.FrameNavigated, frame);
  }

  _onSameDocumentNavigation(params) {
    const frame = this._frames.get(params.frameId);
    frame._onCommittedSameDocumentNavigation(params.url);
    this._page.emit(Events.Page.FrameNavigated, frame);
  }

  _onFrameAttached(params) {
    const parentFrame = this._frames.get(params.parentFrameId) || null;
    const frame = new frames.Frame(this._page, params.frameId, parentFrame);
    if (!parentFrame) {
      assert(!this._mainFrame, 'INTERNAL ERROR: re-attaching main frame!');
      this._mainFrame = frame;
    }
    this._frames.set(params.frameId, frame);
    this._page.emit(Events.Page.FrameAttached, frame);
  }

  _onFrameDetached(params) {
    const frame = this._frames.get(params.frameId);
    this._frames.delete(params.frameId);
    frame._onDetached();
    this._page.emit(Events.Page.FrameDetached, frame);
  }

  _onEventFired({frameId, name}) {
    const frame = this._frames.get(frameId);
    if (name === 'load') {
      frame._lifecycleEvent('load');
      if (frame === this._mainFrame)
        this._page.emit(Events.Page.Load);
    }
    if (name === 'DOMContentLoaded') {
      frame._lifecycleEvent('domcontentloaded');
      if (frame === this._mainFrame)
        this._page.emit(Events.Page.DOMContentLoaded);
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

    const watcher = new frames.LifecycleWatcher(frame, waitUntil, timeout);
    const error = await Promise.race([
      watcher.timeoutOrTerminationPromise,
      watcher.newDocumentNavigationPromise,
      watcher.sameDocumentNavigationPromise,
    ]);
    watcher.dispose();
    if (error)
      throw error;
    return watcher.navigationResponse();
  }

  async navigateFrame(frame: frames.Frame, url: string, options: frames.GotoOptions = {}) {
    const {
      timeout = this._page._timeoutSettings.navigationTimeout(),
      waitUntil = (['load'] as frames.LifecycleEvent[]),
      referer,
    } = options;
    const watcher = new frames.LifecycleWatcher(frame, waitUntil, timeout);
    await this._session.send('Page.navigate', {
      frameId: frame._id,
      referer,
      url,
    });
    const error = await Promise.race([
      watcher.timeoutOrTerminationPromise,
      watcher.newDocumentNavigationPromise,
      watcher.sameDocumentNavigationPromise,
    ]);
    watcher.dispose();
    if (error)
      throw error;
    return watcher.navigationResponse();
  }

  async setFrameContent(frame: frames.Frame, html: string, options: frames.NavigateOptions = {}) {
    const {
      waitUntil = (['load'] as frames.LifecycleEvent[]),
      timeout = this._page._timeoutSettings.navigationTimeout(),
    } = options;
    const context = await frame._utilityContext();
    frame._firedLifecycleEvents.clear();
    await context.evaluate(html => {
      document.open();
      document.write(html);
      document.close();
    }, html);
    const watcher = new frames.LifecycleWatcher(frame, waitUntil, timeout);
    const error = await Promise.race([
      watcher.timeoutOrTerminationPromise,
      watcher.lifecyclePromise,
    ]);
    watcher.dispose();
    if (error)
      throw error;
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

  private async _go(action: () => Promise<{ navigationId: string | null, navigationURL: string | null }>, options: frames.NavigateOptions = {}): Promise<network.Response | null> {
    const {
      timeout = this._page._timeoutSettings.navigationTimeout(),
      waitUntil = (['load'] as frames.LifecycleEvent[]),
    } = options;
    const frame = this.mainFrame();
    const watcher = new frames.LifecycleWatcher(frame, waitUntil, timeout);
    const { navigationId } = await action();
    if (navigationId === null) {
      // Cannot go back/forward.
      watcher.dispose();
      return null;
    }
    const error = await Promise.race([
      watcher.timeoutOrTerminationPromise,
      watcher.newDocumentNavigationPromise,
      watcher.sameDocumentNavigationPromise,
    ]);
    watcher.dispose();
    if (error)
      throw error;
    return watcher.navigationResponse();
  }

  reload(options?: frames.NavigateOptions): Promise<network.Response | null> {
    return this._go(() => this._session.send('Page.reload', { frameId: this.mainFrame()._id }), options);
  }

  goBack(options?: frames.NavigateOptions): Promise<network.Response | null> {
    return this._go(() => this._session.send('Page.goBack', { frameId: this.mainFrame()._id }), options);
  }

  goForward(options?: frames.NavigateOptions): Promise<network.Response | null> {
    return this._go(() => this._session.send('Page.goForward', { frameId: this.mainFrame()._id }), options);
  }

  async evaluateOnNewDocument(source: string): Promise<void> {
    await this._session.send('Page.addScriptToEvaluateOnNewDocument', { script: source });
  }

  async closePage(runBeforeUnload: boolean): Promise<void> {
    await this._session.send('Page.close', { runBeforeUnload });
  }

  getBoundingBoxForScreenshot(handle: dom.ElementHandle<Node>): Promise<types.Rect | null> {
    const frameId = handle._context.frame()._id;
    return this._session.send('Page.getBoundingBox', {
      frameId,
      objectId: handle._remoteObject.objectId,
    });
  }

  canScreenshotOutsideViewport(): boolean {
    return true;
  }

  async setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void> {
    if (color)
      throw new Error('Not implemented');
  }

  async takeScreenshot(format: 'png' | 'jpeg', options: types.ScreenshotOptions): Promise<Buffer> {
    const { data } = await this._session.send('Page.screenshot', {
      mimeType: ('image/' + format) as ('image/png' | 'image/jpeg'),
      fullPage: options.fullPage,
      clip: options.clip,
    });
    return Buffer.from(data, 'base64');
  }

  async resetViewport(): Promise<void> {
    await this._session.send('Page.setViewport', { viewport: null });
  }

  async getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    const { frameId } = await this._session.send('Page.contentFrame', {
      frameId: handle._context.frame()._id,
      objectId: toRemoteObject(handle).objectId,
    });
    if (!frameId)
      return null;
    return this.frame(frameId);
  }

  isElementHandle(remoteObject: any): boolean {
    return remoteObject.subtype === 'node';
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

  async getContentQuads(handle: dom.ElementHandle): Promise<types.Quad[] | null> {
    const result = await this._session.send('Page.getContentQuads', {
      frameId: handle._context.frame()._id,
      objectId: toRemoteObject(handle).objectId,
    }).catch(debugError);
    if (!result)
      return null;
    return result.quads.map(quad => [ quad.p1, quad.p2, quad.p3, quad.p4 ]);
  }

  async layoutViewport(): Promise<{ width: number, height: number }> {
    return this._page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  }

  async setInputFiles(handle: dom.ElementHandle, files: input.FilePayload[]): Promise<void> {
    await handle.evaluate(input.setFileInputFunction, files);
  }

  async adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>> {
    assert(false, 'Multiple isolated worlds are not implemented');
    return handle;
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

function toRemoteObject(handle: dom.ElementHandle): Protocol.RemoteObject {
  return handle._remoteObject;
}
