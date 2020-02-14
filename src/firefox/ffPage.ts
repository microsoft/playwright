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
import { helper, RegisteredListener, debugError, assert } from '../helper';
import * as dom from '../dom';
import { FFSession } from './ffConnection';
import { FFExecutionContext } from './ffExecutionContext';
import { Page, PageDelegate, Worker } from '../page';
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
  private readonly _openerResolver: () => Promise<Page | null>;
  private readonly _contextIdToContext: Map<string, dom.FrameExecutionContext>;
  private _eventListeners: RegisteredListener[];
  private _workers = new Map<string, { frameId: string, session: FFSession }>();

  constructor(session: FFSession, browserContext: BrowserContext, openerResolver: () => Promise<Page | null>) {
    this._session = session;
    this._openerResolver = openerResolver;
    this.rawKeyboard = new RawKeyboardImpl(session);
    this.rawMouse = new RawMouseImpl(session);
    this._contextIdToContext = new Map();
    this._page = new Page(this, browserContext);
    this._networkManager = new FFNetworkManager(session, this._page);
    this._page.on(Events.Page.FrameDetached, frame => this._removeContextsForFrame(frame));
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
      helper.addEventListener(this._session, 'Page.workerCreated', this._onWorkerCreated.bind(this)),
      helper.addEventListener(this._session, 'Page.workerDestroyed', this._onWorkerDestroyed.bind(this)),
      helper.addEventListener(this._session, 'Page.dispatchMessageFromWorker', this._onDispatchMessageFromWorker.bind(this)),
      helper.addEventListener(this._session, 'Page.crashed', this._onCrashed.bind(this)),
    ];
  }

  async _initialize() {
    await Promise.all([
      this._session.send('Page.addScriptToEvaluateOnNewDocument', {
        script: '',
        worldName: UTILITY_WORLD_NAME,
      }),
      new Promise(f => this._session.once('Page.ready', f)),
    ]);
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
    context.frame._contextDestroyed(context);
  }

  private _removeContextsForFrame(frame: frames.Frame) {
    for (const [contextId, context] of this._contextIdToContext) {
      if (context.frame === frame)
        this._contextIdToContext.delete(contextId);
    }
  }

  _onNavigationStarted() {
  }

  _onNavigationAborted(params: Protocol.Page.navigationAbortedPayload) {
    const frame = this._page._frameManager.frame(params.frameId)!;
    for (const watcher of frame._documentWatchers)
      watcher(params.navigationId, new Error(params.errorText));
  }

  _onNavigationCommitted(params: Protocol.Page.navigationCommittedPayload) {
    for (const [workerId, worker] of this._workers) {
      if (worker.frameId === params.frameId)
        this._onWorkerDestroyed({ workerId });
    }
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
        params.type,
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

  async _onWorkerCreated(event: Protocol.Page.workerCreatedPayload) {
    const workerId = event.workerId;
    const worker = new Worker(event.url);
    const workerSession = new FFSession(this._session._connection, 'worker', workerId, (message: any) => {
      this._session.send('Page.sendMessageToWorker', {
        frameId: event.frameId,
        workerId: workerId,
        message: JSON.stringify(message)
      }).catch(e => {
        workerSession.dispatchMessage({ id: message.id, method: '', params: {}, error: { message: e.message, data: undefined } });
      });
    });
    this._workers.set(workerId, { session: workerSession, frameId: event.frameId });
    this._page._addWorker(workerId, worker);
    workerSession.once('Runtime.executionContextCreated', event => {
      worker._createExecutionContext(new FFExecutionContext(workerSession, event.executionContextId));
    });
    workerSession.on('Runtime.console', event => {
      const {type, args, location} = event;
      const context = worker._existingExecutionContext!;
      this._page._addConsoleMessage(type, args.map(arg => context._createHandle(arg)), location);
    });
    // Note: we receive worker exceptions directly from the page.
  }

  async _onWorkerDestroyed(event: Protocol.Page.workerDestroyedPayload) {
    const workerId = event.workerId;
    const worker = this._workers.get(workerId);
    if (!worker)
      return;
    worker.session._onClosed();
    this._workers.delete(workerId);
    this._page._removeWorker(workerId);
  }

  async _onDispatchMessageFromWorker(event: Protocol.Page.dispatchMessageFromWorkerPayload) {
    const worker = this._workers.get(event.workerId);
    if (!worker)
      return;
    worker.session.dispatchMessage(JSON.parse(event.message));
  }

  async _onCrashed(event: Protocol.Page.crashedPayload) {
    this._page._didCrash();
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
    return { newDocumentId: response.navigationId || undefined };
  }

  async setExtraHTTPHeaders(headers: network.Headers): Promise<void> {
    const array = [];
    for (const [name, value] of Object.entries(headers))
      array.push({ name, value });
    await this._session.send('Network.setExtraHTTPHeaders', { headers: array });
  }

  async setViewportSize(viewportSize: types.Size): Promise<void> {
    assert(this._page._state.viewportSize === viewportSize);
    await this._session.send('Page.setViewportSize', {
      viewportSize: {
        width: viewportSize.width,
        height: viewportSize.height,
      },
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

  async authenticate(credentials: types.Credentials | null): Promise<void> {
    await this._session.send('Network.setAuthCredentials', credentials || { username: null, password: null });
  }

  async setFileChooserIntercepted(enabled: boolean) {
    await this._session.send('Page.setInterceptFileChooserDialog', { enabled }).catch(e => {}); // target can be closed.
  }

  async opener(): Promise<Page | null> {
    return await this._openerResolver();
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

  async takeScreenshot(format: 'png' | 'jpeg', options: types.ScreenshotOptions, viewportSize: types.Size): Promise<platform.BufferType> {
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
    await this._session.send('Page.setViewportSize', { viewportSize: null });
  }

  async getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    const { contentFrameId } = await this._session.send('Page.describeNode', {
      frameId: handle._context.frame._id,
      objectId: toRemoteObject(handle).objectId!,
    });
    if (!contentFrameId)
      return null;
    return this._page._frameManager.frame(contentFrameId);
  }

  async getOwnerFrame(handle: dom.ElementHandle): Promise<string | null> {
    const { ownerFrameId } = await this._session.send('Page.describeNode', {
      frameId: handle._context.frame._id,
      objectId: toRemoteObject(handle).objectId!,
    });
    return ownerFrameId || null;
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

  async scrollRectIntoViewIfNeeded(handle: dom.ElementHandle, rect?: types.Rect): Promise<void> {
    await this._session.send('Page.scrollIntoViewIfNeeded', {
      frameId: handle._context.frame._id,
      objectId: toRemoteObject(handle).objectId!,
      rect,
    });
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
    if (!result.remoteObject)
      throw new Error('Unable to adopt element handle from a different document');
    return to._createHandle(result.remoteObject) as dom.ElementHandle<T>;
  }

  async getAccessibilityTree(needle?: dom.ElementHandle) {
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
