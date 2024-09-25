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
import type * as frames from '../frames';
import type { RegisteredListener } from '../../utils/eventsHelper';
import { eventsHelper } from '../../utils/eventsHelper';
import type { PageDelegate } from '../page';
import { InitScript } from '../page';
import { Page, Worker } from '../page';
import type * as types from '../types';
import { getAccessibilityTree } from './ffAccessibility';
import type { FFBrowserContext } from './ffBrowser';
import { FFSession } from './ffConnection';
import { FFExecutionContext } from './ffExecutionContext';
import { RawKeyboardImpl, RawMouseImpl, RawTouchscreenImpl } from './ffInput';
import { FFNetworkManager } from './ffNetworkManager';
import type { Protocol } from './protocol';
import type { Progress } from '../progress';
import { splitErrorMessage } from '../../utils/stackTrace';
import { debugLogger } from '../../utils/debugLogger';
import { ManualPromise } from '../../utils/manualPromise';
import { BrowserContext } from '../browserContext';
import { TargetClosedError } from '../errors';

export const UTILITY_WORLD_NAME = '__playwright_utility_world__';

export class FFPage implements PageDelegate {
  readonly cspErrorsAsynchronousForInlineScripts = true;
  readonly rawMouse: RawMouseImpl;
  readonly rawKeyboard: RawKeyboardImpl;
  readonly rawTouchscreen: RawTouchscreenImpl;
  readonly _session: FFSession;
  readonly _page: Page;
  readonly _networkManager: FFNetworkManager;
  readonly _browserContext: FFBrowserContext;
  private _pagePromise = new ManualPromise<Page | Error>();
  _initializedPage: Page | null = null;
  private _initializationFailed = false;
  readonly _opener: FFPage | null;
  private readonly _contextIdToContext: Map<string, dom.FrameExecutionContext>;
  private _eventListeners: RegisteredListener[];
  private _workers = new Map<string, { frameId: string, session: FFSession }>();
  private _screencastId: string | undefined;
  private _initScripts: { initScript: InitScript, worldName?: string }[] = [];

  constructor(session: FFSession, browserContext: FFBrowserContext, opener: FFPage | null) {
    this._session = session;
    this._opener = opener;
    this.rawKeyboard = new RawKeyboardImpl(session);
    this.rawMouse = new RawMouseImpl(session);
    this.rawTouchscreen = new RawTouchscreenImpl(session);
    this._contextIdToContext = new Map();
    this._browserContext = browserContext;
    this._page = new Page(this, browserContext);
    this.rawMouse.setPage(this._page);
    this._networkManager = new FFNetworkManager(session, this._page);
    this._page.on(Page.Events.FrameDetached, frame => this._removeContextsForFrame(frame));
    // TODO: remove Page.willOpenNewWindowAsynchronously from the protocol.
    this._eventListeners = [
      eventsHelper.addEventListener(this._session, 'Page.eventFired', this._onEventFired.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.frameAttached', this._onFrameAttached.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.frameDetached', this._onFrameDetached.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.navigationAborted', this._onNavigationAborted.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.navigationCommitted', this._onNavigationCommitted.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.navigationStarted', this._onNavigationStarted.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.sameDocumentNavigation', this._onSameDocumentNavigation.bind(this)),
      eventsHelper.addEventListener(this._session, 'Runtime.executionContextCreated', this._onExecutionContextCreated.bind(this)),
      eventsHelper.addEventListener(this._session, 'Runtime.executionContextDestroyed', this._onExecutionContextDestroyed.bind(this)),
      eventsHelper.addEventListener(this._session, 'Runtime.executionContextsCleared', this._onExecutionContextsCleared.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.linkClicked', event => this._onLinkClicked(event.phase)),
      eventsHelper.addEventListener(this._session, 'Page.uncaughtError', this._onUncaughtError.bind(this)),
      eventsHelper.addEventListener(this._session, 'Runtime.console', this._onConsole.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.dialogOpened', this._onDialogOpened.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.bindingCalled', this._onBindingCalled.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.fileChooserOpened', this._onFileChooserOpened.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.workerCreated', this._onWorkerCreated.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.workerDestroyed', this._onWorkerDestroyed.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.dispatchMessageFromWorker', this._onDispatchMessageFromWorker.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.crashed', this._onCrashed.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.videoRecordingStarted', this._onVideoRecordingStarted.bind(this)),

      eventsHelper.addEventListener(this._session, 'Page.webSocketCreated', this._onWebSocketCreated.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.webSocketClosed', this._onWebSocketClosed.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.webSocketFrameReceived', this._onWebSocketFrameReceived.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.webSocketFrameSent', this._onWebSocketFrameSent.bind(this)),
      eventsHelper.addEventListener(this._session, 'Page.screencastFrame', this._onScreencastFrame.bind(this)),

    ];
    this._session.once('Page.ready', async () => {
      await this._page.initOpener(this._opener);
      if (this._initializationFailed)
        return;
      // Note: it is important to call |reportAsNew| before resolving pageOrError promise,
      // so that anyone who awaits pageOrError got a ready and reported page.
      this._initializedPage = this._page;
      this._page.reportAsNew();
      this._pagePromise.resolve(this._page);
    });
    // Ideally, we somehow ensure that utility world is created before Page.ready arrives, but currently it is racy.
    // Therefore, we can end up with an initialized page without utility world, although very unlikely.
    this.addInitScript(new InitScript('', true), UTILITY_WORLD_NAME).catch(e => this._markAsError(e));
  }

  potentiallyUninitializedPage(): Page {
    return this._page;
  }

  async _markAsError(error: Error) {
    // Same error may be report twice: channer disconnected and session.send fails.
    if (this._initializationFailed)
      return;
    this._initializationFailed = true;

    if (!this._initializedPage) {
      await this._page.initOpener(this._opener);
      this._page.reportAsNew(error);
      this._pagePromise.resolve(error);
    }
  }

  async pageOrError(): Promise<Page | Error> {
    return this._pagePromise;
  }

  _onWebSocketCreated(event: Protocol.Page.webSocketCreatedPayload) {
    this._page._frameManager.onWebSocketCreated(webSocketId(event.frameId, event.wsid), event.requestURL);
    this._page._frameManager.onWebSocketRequest(webSocketId(event.frameId, event.wsid));
  }

  _onWebSocketClosed(event: Protocol.Page.webSocketClosedPayload) {
    if (event.error)
      this._page._frameManager.webSocketError(webSocketId(event.frameId, event.wsid), event.error);
    this._page._frameManager.webSocketClosed(webSocketId(event.frameId, event.wsid));
  }

  _onWebSocketFrameReceived(event: Protocol.Page.webSocketFrameReceivedPayload) {
    this._page._frameManager.webSocketFrameReceived(webSocketId(event.frameId, event.wsid), event.opcode, event.data);
  }

  _onWebSocketFrameSent(event: Protocol.Page.webSocketFrameSentPayload) {
    this._page._frameManager.onWebSocketFrameSent(webSocketId(event.frameId, event.wsid), event.opcode, event.data);
  }

  _onExecutionContextCreated(payload: Protocol.Runtime.executionContextCreatedPayload) {
    const { executionContextId, auxData } = payload;
    const frame = this._page._frameManager.frame(auxData.frameId!);
    if (!frame)
      return;
    const delegate = new FFExecutionContext(this._session, executionContextId);
    let worldName: types.World|null = null;
    if (auxData.name === UTILITY_WORLD_NAME)
      worldName = 'utility';
    else if (!auxData.name)
      worldName = 'main';
    const context = new dom.FrameExecutionContext(delegate, frame, worldName);
    (context as any)[contextDelegateSymbol] = delegate;
    if (worldName)
      frame._contextCreated(worldName, context);
    this._contextIdToContext.set(executionContextId, context);
  }

  _onExecutionContextDestroyed(payload: Protocol.Runtime.executionContextDestroyedPayload) {
    const { executionContextId } = payload;
    const context = this._contextIdToContext.get(executionContextId);
    if (!context)
      return;
    this._contextIdToContext.delete(executionContextId);
    context.frame._contextDestroyed(context);
  }

  _onExecutionContextsCleared() {
    for (const executionContextId of Array.from(this._contextIdToContext.keys()))
      this._onExecutionContextDestroyed({ executionContextId });
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
    const { frameId, name } = payload;
    if (name === 'load')
      this._page._frameManager.frameLifecycleEvent(frameId, 'load');
    if (name === 'DOMContentLoaded')
      this._page._frameManager.frameLifecycleEvent(frameId, 'domcontentloaded');
  }

  _onUncaughtError(params: Protocol.Page.uncaughtErrorPayload) {
    const { name, message } = splitErrorMessage(params.message);
    const error = new Error(message);
    error.stack = params.message + '\n' + params.stack.split('\n').filter(Boolean).map(a => a.replace(/([^@]*)@(.*)/, '    at $1 ($2)')).join('\n');
    error.name = name;
    this._page.emitOnContextOnceInitialized(BrowserContext.Events.PageError, error, this._page);
  }

  _onConsole(payload: Protocol.Runtime.consolePayload) {
    const { type, args, executionContextId, location } = payload;
    const context = this._contextIdToContext.get(executionContextId);
    if (!context)
      return;
    // Juggler reports 'warn' for some internal messages generated by the browser.
    this._page._addConsoleMessage(type === 'warn' ? 'warning' : type, args.map(arg => context.createHandle(arg)), location);
  }

  _onDialogOpened(params: Protocol.Page.dialogOpenedPayload) {
    this._page.emitOnContext(BrowserContext.Events.Dialog, new dialog.Dialog(
        this._page,
        params.type,
        params.message,
        async (accept: boolean, promptText?: string) => {
          await this._session.sendMayFail('Page.handleDialog', { dialogId: params.dialogId, accept, promptText });
        },
        params.defaultValue));
  }

  async _onBindingCalled(event: Protocol.Page.bindingCalledPayload) {
    const pageOrError = await this.pageOrError();
    if (!(pageOrError instanceof Error)) {
      const context = this._contextIdToContext.get(event.executionContextId);
      if (context)
        await this._page._onBindingCalled(event.payload, context);
    }
  }

  async _onFileChooserOpened(payload: Protocol.Page.fileChooserOpenedPayload) {
    const { executionContextId, element } = payload;
    const context = this._contextIdToContext.get(executionContextId);
    if (!context)
      return;
    const handle = context.createHandle(element).asElement()!;
    await this._page._onFileChooserOpened(handle);
  }

  async _onWorkerCreated(event: Protocol.Page.workerCreatedPayload) {
    const workerId = event.workerId;
    const worker = new Worker(this._page, event.url);
    const workerSession = new FFSession(this._session._connection, workerId, (message: any) => {
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
      const { type, args, location } = event;
      const context = worker._existingExecutionContext!;
      this._page._addConsoleMessage(type, args.map(arg => context.createHandle(arg)), location);
    });
    // Note: we receive worker exceptions directly from the page.
  }

  _onWorkerDestroyed(event: Protocol.Page.workerDestroyedPayload) {
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

  _onVideoRecordingStarted(event: Protocol.Page.videoRecordingStartedPayload) {
    this._browserContext._browser._videoStarted(this._browserContext, event.screencastId, event.file, this.pageOrError());
  }

  didClose() {
    this._markAsError(new TargetClosedError());
    this._session.dispose();
    eventsHelper.removeEventListeners(this._eventListeners);
    this._networkManager.dispose();
    this._page._didClose();
  }

  async navigateFrame(frame: frames.Frame, url: string, referer: string | undefined): Promise<frames.GotoResult> {
    const response = await this._session.send('Page.navigate', { url, referer, frameId: frame._id });
    return { newDocumentId: response.navigationId || undefined };
  }

  async updateExtraHTTPHeaders(): Promise<void> {
    await this._session.send('Network.setExtraHTTPHeaders', { headers: this._page.extraHTTPHeaders() || [] });
  }

  async updateEmulatedViewportSize(): Promise<void> {
    const viewportSize = this._page.viewportSize();
    await this._session.send('Page.setViewportSize', { viewportSize });
  }

  async bringToFront(): Promise<void> {
    await this._session.send('Page.bringToFront', {});
  }

  async updateEmulateMedia(): Promise<void> {
    const emulatedMedia = this._page.emulatedMedia();
    const colorScheme = emulatedMedia.colorScheme === 'no-override' ? undefined : emulatedMedia.colorScheme;
    const reducedMotion = emulatedMedia.reducedMotion === 'no-override' ? undefined : emulatedMedia.reducedMotion;
    const forcedColors = emulatedMedia.forcedColors === 'no-override' ? undefined : emulatedMedia.forcedColors;
    await this._session.send('Page.setEmulatedMedia', {
      // Empty string means reset.
      type: emulatedMedia.media === 'no-override' ? '' : emulatedMedia.media,
      colorScheme,
      reducedMotion,
      forcedColors,
    });
  }

  async updateRequestInterception(): Promise<void> {
    await this._networkManager.setRequestInterception(this._page.needsRequestInterception());
  }

  async updateFileChooserInterception() {
    const enabled = this._page.fileChooserIntercepted();
    await this._session.send('Page.setInterceptFileChooserDialog', { enabled }).catch(() => {}); // target can be closed.
  }

  async reload(): Promise<void> {
    await this._session.send('Page.reload');
  }

  async goBack(): Promise<boolean> {
    const { success } = await this._session.send('Page.goBack', { frameId: this._page.mainFrame()._id });
    return success;
  }

  async goForward(): Promise<boolean> {
    const { success } = await this._session.send('Page.goForward', { frameId: this._page.mainFrame()._id });
    return success;
  }

  async forceGarbageCollection(): Promise<void> {
    await this._session.send('Heap.collectGarbage');
  }

  async addInitScript(initScript: InitScript, worldName?: string): Promise<void> {
    this._initScripts.push({ initScript, worldName });
    await this._session.send('Page.setInitScripts', { scripts: this._initScripts.map(s => ({ script: s.initScript.source, worldName: s.worldName })) });
  }

  async removeNonInternalInitScripts() {
    this._initScripts = this._initScripts.filter(s => s.initScript.internal);
    await this._session.send('Page.setInitScripts', { scripts: this._initScripts.map(s => ({ script: s.initScript.source, worldName: s.worldName })) });
  }

  async closePage(runBeforeUnload: boolean): Promise<void> {
    await this._session.send('Page.close', { runBeforeUnload });
  }

  async setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void> {
    if (color)
      throw new Error('Not implemented');
  }

  async takeScreenshot(progress: Progress, format: 'png' | 'jpeg', documentRect: types.Rect | undefined, viewportRect: types.Rect | undefined, quality: number | undefined, fitsViewport: boolean, scale: 'css' | 'device'): Promise<Buffer> {
    if (!documentRect) {
      const scrollOffset = await this._page.mainFrame().waitForFunctionValueInUtility(progress, () => ({ x: window.scrollX, y: window.scrollY }));
      documentRect = {
        x: viewportRect!.x + scrollOffset.x,
        y: viewportRect!.y + scrollOffset.y,
        width: viewportRect!.width,
        height: viewportRect!.height,
      };
    }
    progress.throwIfAborted();
    const { data } = await this._session.send('Page.screenshot', {
      mimeType: ('image/' + format) as ('image/png' | 'image/jpeg'),
      clip: documentRect,
      quality,
      omitDeviceScaleFactor: scale === 'css',
    });
    return Buffer.from(data, 'base64');
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

  async setScreencastOptions(options: { width: number, height: number, quality: number } | null): Promise<void> {
    if (options) {
      const { screencastId } = await this._session.send('Page.startScreencast', options);
      this._screencastId = screencastId;
    } else {
      await this._session.send('Page.stopScreencast');
    }
  }

  private _onScreencastFrame(event: Protocol.Page.screencastFramePayload) {
    if (!this._screencastId)
      return;
    const screencastId = this._screencastId;
    this._page.throttleScreencastFrameAck(() => {
      this._session.send('Page.screencastFrameAck', { screencastId }).catch(e => debugLogger.log('error', e));
    });

    const buffer = Buffer.from(event.data, 'base64');
    this._page.emit(Page.Events.ScreencastFrame, {
      buffer,
      width: event.deviceWidth,
      height: event.deviceHeight,
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
    return result.quads.map(quad => [quad.p1, quad.p2, quad.p3, quad.p4]);
  }

  async setInputFiles(handle: dom.ElementHandle<HTMLInputElement>, files: types.FilePayload[]): Promise<void> {
    await handle.evaluateInUtility(([injected, node, files]) =>
      injected.setInputFiles(node, files), files);
  }

  async setInputFilePaths(handle: dom.ElementHandle<HTMLInputElement>, files: string[]): Promise<void> {
    await this._session.send('Page.setFileInputFiles', {
      frameId: handle._context.frame._id,
      objectId: handle._objectId,
      files
    });
  }

  async adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>> {
    const result = await this._session.send('Page.adoptNode', {
      frameId: handle._context.frame._id,
      objectId: handle._objectId,
      executionContextId: ((to as any)[contextDelegateSymbol] as FFExecutionContext)._executionContextId
    });
    if (!result.remoteObject)
      throw new Error(dom.kUnableToAdoptErrorMessage);
    return to.createHandle(result.remoteObject) as dom.ElementHandle<T>;
  }

  async getAccessibilityTree(needle?: dom.ElementHandle) {
    return getAccessibilityTree(this._session, needle);
  }

  async inputActionEpilogue(): Promise<void> {
  }

  async resetForReuse(): Promise<void> {
    // Firefox sometimes keeps the last mouse position in the page,
    // which affects things like hovered state.
    // See https://github.com/microsoft/playwright/issues/22432.
    // Move mouse to (-1, -1) to avoid anything being hovered.
    await this.rawMouse.move(-1, -1, 'none', new Set(), new Set(), false);
  }

  async getFrameElement(frame: frames.Frame): Promise<dom.ElementHandle> {
    const parent = frame.parentFrame();
    if (!parent)
      throw new Error('Frame has been detached.');
    const context = await parent._mainContext();
    const result = await this._session.send('Page.adoptNode', {
      frameId: frame._id,
      executionContextId: ((context as any)[contextDelegateSymbol] as FFExecutionContext)._executionContextId
    });
    if (!result.remoteObject)
      throw new Error('Frame has been detached.');
    return context.createHandle(result.remoteObject) as dom.ElementHandle;
  }

  shouldToggleStyleSheetToSyncAnimations(): boolean {
    return false;
  }
}

function webSocketId(frameId: string, wsid: string): string {
  return `${frameId}---${wsid}`;
}

const contextDelegateSymbol = Symbol('delegate');
