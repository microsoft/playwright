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

import * as dialog from '../dialog';
import * as dom from '../dom';
import * as frames from '../frames';
import { helper, RegisteredListener } from '../helper';
import { assert } from '../../utils/utils';
import { Page, PageBinding, PageDelegate, Worker } from '../page';
import { kScreenshotDuringNavigationError } from '../screenshotter';
import * as types from '../types';
import { getAccessibilityTree } from './ffAccessibility';
import { FFBrowserContext } from './ffBrowser';
import { FFSession, FFSessionEvents } from './ffConnection';
import { FFExecutionContext } from './ffExecutionContext';
import { RawKeyboardImpl, RawMouseImpl } from './ffInput';
import { FFNetworkManager } from './ffNetworkManager';
import { Protocol } from './protocol';
import { rewriteErrorMessage } from '../../utils/stackTrace';

const UTILITY_WORLD_NAME = '__playwright_utility_world__';

export class FFPage implements PageDelegate {
  readonly cspErrorsAsynchronousForInlineScipts = true;
  readonly rawMouse: RawMouseImpl;
  readonly rawKeyboard: RawKeyboardImpl;
  readonly _session: FFSession;
  readonly _page: Page;
  readonly _networkManager: FFNetworkManager;
  readonly _browserContext: FFBrowserContext;
  private _pagePromise: Promise<Page | Error>;
  _pageCallback: (pageOrError: Page | Error) => void = () => {};
  _initializedPage: Page | null = null;
  readonly _opener: FFPage | null;
  private readonly _contextIdToContext: Map<string, dom.FrameExecutionContext>;
  private _eventListeners: RegisteredListener[];
  private _workers = new Map<string, { frameId: string, session: FFSession }>();

  constructor(session: FFSession, browserContext: FFBrowserContext, opener: FFPage | null) {
    this._session = session;
    this._opener = opener;
    this.rawKeyboard = new RawKeyboardImpl(session);
    this.rawMouse = new RawMouseImpl(session);
    this._contextIdToContext = new Map();
    this._browserContext = browserContext;
    this._page = new Page(this, browserContext);
    this._networkManager = new FFNetworkManager(session, this._page);
    this._page.on(Page.Events.FrameDetached, frame => this._removeContextsForFrame(frame));
    // TODO: remove Page.willOpenNewWindowAsynchronously from the protocol.
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
      helper.addEventListener(this._session, 'Page.linkClicked', event => this._onLinkClicked(event.phase)),
      helper.addEventListener(this._session, 'Page.uncaughtError', this._onUncaughtError.bind(this)),
      helper.addEventListener(this._session, 'Runtime.console', this._onConsole.bind(this)),
      helper.addEventListener(this._session, 'Page.dialogOpened', this._onDialogOpened.bind(this)),
      helper.addEventListener(this._session, 'Page.bindingCalled', this._onBindingCalled.bind(this)),
      helper.addEventListener(this._session, 'Page.fileChooserOpened', this._onFileChooserOpened.bind(this)),
      helper.addEventListener(this._session, 'Page.workerCreated', this._onWorkerCreated.bind(this)),
      helper.addEventListener(this._session, 'Page.workerDestroyed', this._onWorkerDestroyed.bind(this)),
      helper.addEventListener(this._session, 'Page.dispatchMessageFromWorker', this._onDispatchMessageFromWorker.bind(this)),
      helper.addEventListener(this._session, 'Page.crashed', this._onCrashed.bind(this)),
      helper.addEventListener(this._session, 'Page.screencastStarted', this._onScreencastStarted.bind(this)),
    ];
    this._pagePromise = new Promise(f => this._pageCallback = f);
    session.once(FFSessionEvents.Disconnected, () => this._page._didDisconnect());
    this._session.once('Page.ready', () => {
      this._pageCallback(this._page);
      this._initializedPage = this._page;
    });
    // Ideally, we somehow ensure that utility world is created before Page.ready arrives, but currently it is racy.
    // Therefore, we can end up with an initialized page without utility world, although very unlikely.
    this._session.send('Page.addScriptToEvaluateOnNewDocument', { script: '', worldName: UTILITY_WORLD_NAME }).catch(this._pageCallback);
  }

  async pageOrError(): Promise<Page | Error> {
    return this._pagePromise;
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

  _onLinkClicked(phase: 'before' | 'after') {
    if (phase === 'before')
      this._page._frameManager.frameWillPotentiallyRequestNavigation();
    else
      this._page._frameManager.frameDidPotentiallyRequestNavigation();
  }

  _onNavigationStarted(params: Protocol.Page.navigationStartedPayload) {
    this._page._frameManager.frameRequestedNavigation(params.frameId, params.navigationId);
  }

  _onNavigationAborted(params: Protocol.Page.navigationAbortedPayload) {
    this._page._frameManager.frameAbortedNavigation(params.frameId, params.errorText, params.navigationId);
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
    const message = params.message.startsWith('Error: ') ? params.message.substring(7) : params.message;
    const error = new Error(message);
    error.stack = params.stack;
    this._page.emit(Page.Events.PageError, error);
  }

  _onConsole(payload: Protocol.Runtime.consolePayload) {
    const {type, args, executionContextId, location} = payload;
    const context = this._contextIdToContext.get(executionContextId)!;
    this._page._addConsoleMessage(type, args.map(arg => context.createHandle(arg)), location);
  }

  _onDialogOpened(params: Protocol.Page.dialogOpenedPayload) {
    this._page.emit(Page.Events.Dialog, new dialog.Dialog(
        params.type,
        params.message,
        async (accept: boolean, promptText?: string) => {
          await this._session.sendMayFail('Page.handleDialog', { dialogId: params.dialogId, accept, promptText });
        },
        params.defaultValue));
  }

  async _onBindingCalled(event: Protocol.Page.bindingCalledPayload) {
    const context = this._contextIdToContext.get(event.executionContextId)!;
    const pageOrError = await this.pageOrError();
    if (!(pageOrError instanceof Error))
      this._page._onBindingCalled(event.payload, context);
  }

  async _onFileChooserOpened(payload: Protocol.Page.fileChooserOpenedPayload) {
    const {executionContextId, element} = payload;
    const context = this._contextIdToContext.get(executionContextId)!;
    const handle = context.createHandle(element).asElement()!;
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
      this._page._addConsoleMessage(type, args.map(arg => context.createHandle(arg)), location);
    });
    // Note: we receive worker exceptions directly from the page.
  }

  async _onWorkerDestroyed(event: Protocol.Page.workerDestroyedPayload) {
    const workerId = event.workerId;
    const worker = this._workers.get(workerId);
    if (!worker)
      return;
    worker.session.dispose();
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
    this._session.markAsCrashed();
    this._page._didCrash();
  }

  _onScreencastStarted(event: Protocol.Page.screencastStartedPayload) {
    this._browserContext._browser._videoStarted(this._browserContext, event.screencastId, event.file, this.pageOrError());
  }

  async exposeBinding(binding: PageBinding) {
    await this._session.send('Page.addBinding', { name: binding.name, script: binding.source });
  }

  didClose() {
    this._session.dispose();
    helper.removeEventListeners(this._eventListeners);
    this._networkManager.dispose();
    this._page._didClose();
  }

  async navigateFrame(frame: frames.Frame, url: string, referer: string | undefined): Promise<frames.GotoResult> {
    const response = await this._session.send('Page.navigate', { url, referer, frameId: frame._id });
    return { newDocumentId: response.navigationId || undefined };
  }

  async updateExtraHTTPHeaders(): Promise<void> {
    await this._session.send('Network.setExtraHTTPHeaders', { headers: this._page._state.extraHTTPHeaders || [] });
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

  async bringToFront(): Promise<void> {
    await this._session.send('Page.bringToFront', {});
  }

  async updateEmulateMedia(): Promise<void> {
    const colorScheme = this._page._state.colorScheme || this._browserContext._options.colorScheme || 'light';
    await this._session.send('Page.setEmulatedMedia', {
      // Empty string means reset.
      type: this._page._state.mediaType === null ? '' : this._page._state.mediaType,
      colorScheme
    });
  }

  async updateRequestInterception(): Promise<void> {
    await this._networkManager.setRequestInterception(this._page._needsRequestInterception());
  }

  async setFileChooserIntercepted(enabled: boolean) {
    await this._session.send('Page.setInterceptFileChooserDialog', { enabled }).catch(e => {}); // target can be closed.
  }

  async opener(): Promise<Page | null> {
    if (!this._opener)
      return null;
    const result = await this._opener.pageOrError();
    if (result instanceof Page && !result.isClosed())
      return result;
    return null;
  }

  async reload(): Promise<void> {
    await this._session.send('Page.reload', { frameId: this._page.mainFrame()._id });
  }

  async goBack(): Promise<boolean> {
    const { success } = await this._session.send('Page.goBack', { frameId: this._page.mainFrame()._id });
    return success;
  }

  async goForward(): Promise<boolean> {
    const { success } = await this._session.send('Page.goForward', { frameId: this._page.mainFrame()._id });
    return success;
  }

  async evaluateOnNewDocument(source: string): Promise<void> {
    await this._session.send('Page.addScriptToEvaluateOnNewDocument', { script: source });
  }

  async closePage(runBeforeUnload: boolean): Promise<void> {
    await this._session.send('Page.close', { runBeforeUnload });
  }

  canScreenshotOutsideViewport(): boolean {
    return true;
  }

  async setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void> {
    if (color)
      throw new Error('Not implemented');
  }

  async startScreencast(options: types.PageScreencastOptions): Promise<void> {
    this._session.send('Page.startVideoRecording', {
      file: options.outputFile,
      width: options.width,
      height: options.height,
    });
  }

  async stopScreencast(): Promise<void> {
    await this._session.send('Page.stopVideoRecording');
  }

  async takeScreenshot(format: 'png' | 'jpeg', documentRect: types.Rect | undefined, viewportRect: types.Rect | undefined, quality: number | undefined): Promise<Buffer> {
    if (!documentRect) {
      const context = await this._page.mainFrame()._utilityContext();
      const scrollOffset = await context.evaluateInternal(() => ({ x: window.scrollX, y: window.scrollY }));
      documentRect = {
        x: viewportRect!.x + scrollOffset.x,
        y: viewportRect!.y + scrollOffset.y,
        width: viewportRect!.width,
        height: viewportRect!.height,
      };
    }
    // TODO: remove fullPage option from Page.screenshot.
    // TODO: remove Page.getBoundingBox method.
    const { data } = await this._session.send('Page.screenshot', {
      mimeType: ('image/' + format) as ('image/png' | 'image/jpeg'),
      clip: documentRect,
    }).catch(e => {
      if (e instanceof Error && e.message.includes('document.documentElement is null'))
        rewriteErrorMessage(e, kScreenshotDuringNavigationError);
      throw e;
    });
    return Buffer.from(data, 'base64');
  }

  async resetViewport(): Promise<void> {
    assert(false, 'Should not be called');
  }

  async getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    const { contentFrameId } = await this._session.send('Page.describeNode', {
      frameId: handle._context.frame._id,
      objectId: handle._objectId,
    });
    if (!contentFrameId)
      return null;
    return this._page._frameManager.frame(contentFrameId);
  }

  async getOwnerFrame(handle: dom.ElementHandle): Promise<string | null> {
    const { ownerFrameId } = await this._session.send('Page.describeNode', {
      frameId: handle._context.frame._id,
      objectId: handle._objectId
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

  async scrollRectIntoViewIfNeeded(handle: dom.ElementHandle, rect?: types.Rect): Promise<'error:notvisible' | 'error:notconnected' | 'done'> {
    return await this._session.send('Page.scrollIntoViewIfNeeded', {
      frameId: handle._context.frame._id,
      objectId: handle._objectId,
      rect,
    }).then(() => 'done' as const).catch(e => {
      if (e instanceof Error && e.message.includes('Node is detached from document'))
        return 'error:notconnected';
      if (e instanceof Error && e.message.includes('Node does not have a layout object'))
        return 'error:notvisible';
      throw e;
    });
  }

  rafCountForStablePosition(): number {
    return 1;
  }

  async getContentQuads(handle: dom.ElementHandle): Promise<types.Quad[] | null> {
    const result = await this._session.sendMayFail('Page.getContentQuads', {
      frameId: handle._context.frame._id,
      objectId: handle._objectId,
    });
    if (!result)
      return null;
    return result.quads.map(quad => [ quad.p1, quad.p2, quad.p3, quad.p4 ]);
  }

  async setInputFiles(handle: dom.ElementHandle<HTMLInputElement>, files: types.FilePayload[]): Promise<void> {
    await handle._evaluateInUtility(([injected, node, files]) =>
      injected.setInputFiles(node, files), files);
  }

  async adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>> {
    const result = await this._session.send('Page.adoptNode', {
      frameId: handle._context.frame._id,
      objectId: handle._objectId,
      executionContextId: (to._delegate as FFExecutionContext)._executionContextId
    });
    if (!result.remoteObject)
      throw new Error('Unable to adopt element handle from a different document');
    return to.createHandle(result.remoteObject) as dom.ElementHandle<T>;
  }

  async getAccessibilityTree(needle?: dom.ElementHandle) {
    return getAccessibilityTree(this._session, needle);
  }

  async inputActionEpilogue(): Promise<void> {
  }

  async getFrameElement(frame: frames.Frame): Promise<dom.ElementHandle> {
    const parent = frame.parentFrame();
    if (!parent)
      throw new Error('Frame has been detached.');
    const handles = await this._page.selectors._queryAll(parent, 'iframe', undefined);
    const items = await Promise.all(handles.map(async handle => {
      const frame = await handle.contentFrame().catch(e => null);
      return { handle, frame };
    }));
    const result = items.find(item => item.frame === frame);
    items.map(item => item === result ? Promise.resolve() : item.handle.dispose());
    if (!result)
      throw new Error('Frame has been detached.');
    return result.handle;
  }
}
