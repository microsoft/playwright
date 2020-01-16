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

import * as frames from '../frames';
import { helper, RegisteredListener, debugError } from '../helper';
import * as dom from '../dom';
import { FFSession } from './ffConnection';
import { FFExecutionContext } from './ffExecutionContext';
import { Page, PageDelegate, Coverage } from '../page';
import { FFNetworkManager } from './ffNetworkManager';
import { Events } from '../events';
import * as dialog from '../dialog';
import { Protocol } from './protocol';
import { RawMouseImpl, RawKeyboardImpl } from './ffInput';
import { BrowserContext } from '../browserContext';
import { getAccessibilityTree } from './ffAccessibility';
import * as network from '../network';
import * as types from '../types';
import * as platform from '../platform';
import { kScreenshotDuringNavigationError } from '../screenshotter';

const UTILITY_WORLD_NAME = '__playwright_utility_world__';

export class FFPage implements PageDelegate {
  readonly rawMouse: RawMouseImpl;
  readonly rawKeyboard: RawKeyboardImpl;
  readonly _session: FFSession;
  readonly _page: Page;
  readonly _networkManager: FFNetworkManager;
  private readonly _contextIdToContext: Map<string, dom.FrameExecutionContext>;
  private _eventListeners: RegisteredListener[];

  constructor(session: FFSession, browserContext: BrowserContext) {
    this._session = session;
    this.rawKeyboard = new RawKeyboardImpl(session);
    this.rawMouse = new RawMouseImpl(session);
    this._contextIdToContext = new Map();
    this._page = new Page(this, browserContext);
    this._networkManager = new FFNetworkManager(session, this._page);
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
    ];
  }

  async _initialize() {
    const promises: Promise<any>[] = [
      this._session.send('Runtime.enable').then(() => this._ensureIsolatedWorld(UTILITY_WORLD_NAME)),
      this._session.send('Network.enable'),
      this._session.send('Page.enable'),
      this._session.send('Page.setInterceptFileChooserDialog', { enabled: true })
    ];
    const options = this._page.browserContext()._options;
    if (options.viewport)
      promises.push(this.setViewport(options.viewport));
    if (options.bypassCSP)
      promises.push(this._session.send('Page.setBypassCSP', { enabled: true }));
    if (options.javaScriptEnabled === false)
      promises.push(this._session.send('Page.setJavascriptEnabled', { enabled: false }));
    if (options.userAgent)
      promises.push(this._session.send('Page.setUserAgent', { userAgent: options.userAgent }));
    await Promise.all(promises);
  }

  async _ensureIsolatedWorld(name: string) {
    await this._session.send('Page.addScriptToEvaluateOnNewDocument', {
      script: '',
      worldName: name,
    });
  }

  _onExecutionContextCreated(payload: Protocol.Runtime.executionContextCreatedPayload) {
    const {executionContextId, auxData} = payload;
    const frame = this._page._frameManager.frame(auxData ? auxData.frameId : null);
    if (!frame)
      return;
    const delegate = new FFExecutionContext(this._session, executionContextId);
    const context = new dom.FrameExecutionContext(delegate, frame);
    if (auxData.name === UTILITY_WORLD_NAME)
      frame._contextCreated('utility', context);
    else if (!auxData.name)
      frame._contextCreated('main', context);
    this._contextIdToContext.set(executionContextId, context);
  }

  _onExecutionContextDestroyed(payload: Protocol.Runtime.executionContextDestroyedPayload) {
    const {executionContextId} = payload;
    const context = this._contextIdToContext.get(executionContextId);
    if (!context)
      return;
    this._contextIdToContext.delete(executionContextId);
    context.frame._contextDestroyed(context as dom.FrameExecutionContext);
  }

  _onNavigationStarted() {
  }

  _onNavigationAborted(params: Protocol.Page.navigationAbortedPayload) {
    const frame = this._page._frameManager.frame(params.frameId)!;
    for (const watcher of this._page._frameManager._lifecycleWatchers)
      watcher._onAbortedNewDocumentNavigation(frame, params.navigationId, params.errorText);
  }

  _onNavigationCommitted(params: Protocol.Page.navigationCommittedPayload) {
    this._page._frameManager.frameCommittedNewDocumentNavigation(params.frameId, params.url, params.name || '', params.navigationId || '', false);
  }

  _onSameDocumentNavigation(params: Protocol.Page.sameDocumentNavigationPayload) {
    this._page._frameManager.frameCommittedSameDocumentNavigation(params.frameId, params.url);
  }

  _onFrameAttached(params: Protocol.Page.frameAttachedPayload) {
    this._page._frameManager.frameAttached(params.frameId, params.parentFrameId);
  }

  _onFrameDetached(params: Protocol.Page.frameDetachedPayload) {
    this._page._frameManager.frameDetached(params.frameId);
  }

  _onEventFired(payload: Protocol.Page.eventFiredPayload) {
    const {frameId, name} = payload;
    if (name === 'load')
      this._page._frameManager.frameLifecycleEvent(frameId, 'load');
    if (name === 'DOMContentLoaded')
      this._page._frameManager.frameLifecycleEvent(frameId, 'domcontentloaded');
  }

  _onUncaughtError(params: Protocol.Page.uncaughtErrorPayload) {
    const error = new Error(params.message);
    error.stack = params.stack;
    this._page.emit(Events.Page.PageError, error);
  }

  _onConsole(payload: Protocol.Runtime.consolePayload) {
    const {type, args, executionContextId, location} = payload;
    const context = this._contextIdToContext.get(executionContextId)!;
    this._page._addConsoleMessage(type, args.map(arg => context._createHandle(arg)), location);
  }

  _onDialogOpened(params: Protocol.Page.dialogOpenedPayload) {
    this._page.emit(Events.Page.Dialog, new dialog.Dialog(
      params.type as dialog.DialogType,
      params.message,
      async (accept: boolean, promptText?: string) => {
        await this._session.send('Page.handleDialog', { dialogId: params.dialogId, accept, promptText }).catch(debugError);
      },
      params.defaultValue));
  }

  _onBindingCalled(event: Protocol.Page.bindingCalledPayload) {
    const context = this._contextIdToContext.get(event.executionContextId)!;
    this._page._onBindingCalled(event.payload, context);
  }

  async _onFileChooserOpened(payload: Protocol.Page.fileChooserOpenedPayload) {
    const {executionContextId, element} = payload;
    const context = this._contextIdToContext.get(executionContextId)!;
    const handle = context._createHandle(element).asElement()!;
    this._page._onFileChooserOpened(handle);
  }

  async exposeBinding(name: string, bindingFunction: string): Promise<void> {
    await this._session.send('Page.addBinding', {name: name});
    await this._session.send('Page.addScriptToEvaluateOnNewDocument', {script: bindingFunction});
    await Promise.all(this._page.frames().map(frame => frame.evaluate(bindingFunction).catch(debugError)));
  }

  didClose() {
    helper.removeEventListeners(this._eventListeners);
    this._networkManager.dispose();
    this._page._didClose();
  }

  async navigateFrame(frame: frames.Frame, url: string, referer: string | undefined): Promise<frames.GotoResult> {
    const response = await this._session.send('Page.navigate', { url, referer, frameId: frame._id });
    return { newDocumentId: response.navigationId || undefined, isSameDocument: !response.navigationId };
  }

  needsLifecycleResetOnSetContent(): boolean {
    return true;
  }

  async setExtraHTTPHeaders(headers: network.Headers): Promise<void> {
    const array = [];
    for (const [name, value] of Object.entries(headers))
      array.push({ name, value });
    await this._session.send('Network.setExtraHTTPHeaders', { headers: array });
  }

  async setViewport(viewport: types.Viewport): Promise<void> {
    const {
      width,
      height,
      isMobile = false,
      deviceScaleFactor = 1,
    } = viewport;
    await this._session.send('Page.setViewport', {
      viewport: { width, height, isMobile, deviceScaleFactor, hasTouch: isMobile, isLandscape: width > height },
    });
  }

  async setEmulateMedia(mediaType: types.MediaType | null, colorScheme: types.ColorScheme | null): Promise<void> {
    await this._session.send('Page.setEmulatedMedia', {
      type: mediaType === null ? undefined : mediaType,
      colorScheme: colorScheme === null ? undefined : colorScheme
    });
  }

  async setCacheEnabled(enabled: boolean): Promise<void> {
    await this._session.send('Page.setCacheDisabled', {cacheDisabled: !enabled});
  }

  async setRequestInterception(enabled: boolean): Promise<void> {
    await this._networkManager.setRequestInterception(enabled);
  }

  async setOfflineMode(enabled: boolean): Promise<void> {
    throw new Error('Offline mode not implemented in Firefox');
  }

  async authenticate(credentials: types.Credentials): Promise<void> {
    throw new Error('Offline mode not implemented in Firefox');
  }

  async reload(): Promise<void> {
    await this._session.send('Page.reload', { frameId: this._page.mainFrame()._id });
  }

  async goBack(): Promise<boolean> {
    const { navigationId } = await this._session.send('Page.goBack', { frameId: this._page.mainFrame()._id });
    return navigationId !== null;
  }

  async goForward(): Promise<boolean> {
    const { navigationId } = await this._session.send('Page.goForward', { frameId: this._page.mainFrame()._id });
    return navigationId !== null;
  }

  async evaluateOnNewDocument(source: string): Promise<void> {
    await this._session.send('Page.addScriptToEvaluateOnNewDocument', { script: source });
  }

  async closePage(runBeforeUnload: boolean): Promise<void> {
    await this._session.send('Page.close', { runBeforeUnload });
  }

  async getBoundingBoxForScreenshot(handle: dom.ElementHandle<Node>): Promise<types.Rect | null> {
    const frameId = handle._context.frame._id;
    const response = await this._session.send('Page.getBoundingBox', {
      frameId,
      objectId: handle._remoteObject.objectId,
    });
    return response.boundingBox;
  }

  canScreenshotOutsideViewport(): boolean {
    return true;
  }

  async setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void> {
    if (color)
      throw new Error('Not implemented');
  }

  async takeScreenshot(format: 'png' | 'jpeg', options: types.ScreenshotOptions): Promise<platform.BufferType> {
    const { data } = await this._session.send('Page.screenshot', {
      mimeType: ('image/' + format) as ('image/png' | 'image/jpeg'),
      fullPage: options.fullPage,
      clip: options.clip,
    }).catch(e => {
      if (e instanceof Error && e.message.includes('document.documentElement is null'))
        e.message = kScreenshotDuringNavigationError;
      throw e;
    });
    return platform.Buffer.from(data, 'base64');
  }

  async resetViewport(): Promise<void> {
    await this._session.send('Page.setViewport', { viewport: null });
  }

  async getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    const { frameId } = await this._session.send('Page.contentFrame', {
      frameId: handle._context.frame._id,
      objectId: toRemoteObject(handle).objectId!,
    });
    if (!frameId)
      return null;
    return this._page._frameManager.frame(frameId);
  }

  async getOwnerFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    return handle._context.frame;
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
      frameId: handle._context.frame._id,
      objectId: toRemoteObject(handle).objectId!,
    }).catch(debugError);
    if (!result)
      return null;
    return result.quads.map(quad => [ quad.p1, quad.p2, quad.p3, quad.p4 ]);
  }

  async layoutViewport(): Promise<{ width: number, height: number }> {
    return this._page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  }

  async setInputFiles(handle: dom.ElementHandle<HTMLInputElement>, files: types.FilePayload[]): Promise<void> {
    await handle.evaluate(dom.setFileInputFunction, files);
  }

  async adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>> {
    const result = await this._session.send('Page.adoptNode', {
      frameId: handle._context.frame._id,
      objectId: toRemoteObject(handle).objectId!,
      executionContextId: (to._delegate as FFExecutionContext)._executionContextId
    });
    return to._createHandle(result.remoteObject) as dom.ElementHandle<T>;
  }

  async getAccessibilityTree(needle?: dom.ElementHandle) {
    return getAccessibilityTree(this._session, needle);
  }

  coverage(): Coverage | undefined {
    return undefined;
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

function toRemoteObject(handle: dom.ElementHandle): Protocol.Runtime.RemoteObject {
  return handle._remoteObject;
}
