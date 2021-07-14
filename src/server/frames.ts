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

import * as channels from '../protocol/channels';
import { ConsoleMessage } from './console';
import * as dom from './dom';
import { helper } from './helper';
import { eventsHelper, RegisteredListener } from '../utils/eventsHelper';
import * as js from './javascript';
import * as network from './network';
import { Page } from './page';
import * as types from './types';
import { BrowserContext } from './browserContext';
import { Progress, ProgressController } from './progress';
import { assert, constructURLBasedOnBaseURL, makeWaitForNextTask } from '../utils/utils';
import { debugLogger } from '../utils/debugLogger';
import { CallMetadata, internalCallMetadata, SdkObject } from './instrumentation';
import { ElementStateWithoutStable } from './injected/injectedScript';

type ContextData = {
  contextPromise: Promise<dom.FrameExecutionContext>;
  contextResolveCallback: (c: dom.FrameExecutionContext) => void;
  context: dom.FrameExecutionContext | null;
  rerunnableTasks: Set<RerunnableTask>;
};

type DocumentInfo = {
  // Unfortunately, we don't have documentId when we find out about
  // a pending navigation from things like frameScheduledNavigaiton.
  documentId: string | undefined,
  request: network.Request | undefined,
};

export type GotoResult = {
  newDocumentId?: string,
};

type ConsoleTagHandler = () => void;

export type FunctionWithSource = (source: { context: BrowserContext, page: Page, frame: Frame}, ...args: any) => any;

export type NavigationEvent = {
  // New frame url after navigation.
  url: string,
  // New frame name after navigation.
  name: string,
  // Information about the new document for cross-document navigations.
  // Undefined for same-document navigations.
  newDocument?: DocumentInfo,
  // Error for cross-document navigations if any. When error is present,
  // the navigation did not commit.
  error?: Error,
};

export class FrameManager {
  private _page: Page;
  private _frames = new Map<string, Frame>();
  private _mainFrame: Frame;
  readonly _consoleMessageTags = new Map<string, ConsoleTagHandler>();
  readonly _signalBarriers = new Set<SignalBarrier>();
  private _webSockets = new Map<string, network.WebSocket>();
  readonly _responses: network.Response[] = [];

  constructor(page: Page) {
    this._page = page;
    this._mainFrame = undefined as any as Frame;
  }

  dispose() {
    for (const frame of this._frames.values())
      frame._stopNetworkIdleTimer();
  }

  mainFrame(): Frame {
    return this._mainFrame;
  }

  frames() {
    const frames: Frame[] = [];
    collect(this._mainFrame);
    return frames;

    function collect(frame: Frame) {
      frames.push(frame);
      for (const subframe of frame.childFrames())
        collect(subframe);
    }
  }

  frame(frameId: string): Frame | null {
    return this._frames.get(frameId) || null;
  }

  frameAttached(frameId: string, parentFrameId: string | null | undefined): Frame {
    const parentFrame = parentFrameId ? this._frames.get(parentFrameId)! : null;
    if (!parentFrame) {
      if (this._mainFrame) {
        // Update frame id to retain frame identity on cross-process navigation.
        this._frames.delete(this._mainFrame._id);
        this._mainFrame._id = frameId;
      } else {
        assert(!this._frames.has(frameId));
        this._mainFrame = new Frame(this._page, frameId, parentFrame);
      }
      this._frames.set(frameId, this._mainFrame);
      return this._mainFrame;
    } else {
      assert(!this._frames.has(frameId));
      const frame = new Frame(this._page, frameId, parentFrame);
      this._frames.set(frameId, frame);
      this._page.emit(Page.Events.FrameAttached, frame);
      return frame;
    }
  }

  async waitForSignalsCreatedBy<T>(progress: Progress | null, noWaitAfter: boolean | undefined, action: () => Promise<T>, source?: 'input'): Promise<T> {
    if (noWaitAfter)
      return action();
    const barrier = new SignalBarrier(progress);
    this._signalBarriers.add(barrier);
    if (progress)
      progress.cleanupWhenAborted(() => this._signalBarriers.delete(barrier));
    const result = await action();
    if (source === 'input')
      await this._page._delegate.inputActionEpilogue();
    await barrier.waitFor();
    this._signalBarriers.delete(barrier);
    // Resolve in the next task, after all waitForNavigations.
    await new Promise<void>(makeWaitForNextTask());
    return result;
  }

  frameWillPotentiallyRequestNavigation() {
    for (const barrier of this._signalBarriers)
      barrier.retain();
  }

  frameDidPotentiallyRequestNavigation() {
    for (const barrier of this._signalBarriers)
      barrier.release();
  }

  frameRequestedNavigation(frameId: string, documentId?: string) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    for (const barrier of this._signalBarriers)
      barrier.addFrameNavigation(frame);
    if (frame.pendingDocument() && frame.pendingDocument()!.documentId === documentId) {
      // Do not override request with undefined.
      return;
    }
    frame.setPendingDocument({ documentId, request: undefined });
  }

  frameCommittedNewDocumentNavigation(frameId: string, url: string, name: string, documentId: string, initial: boolean) {
    const frame = this._frames.get(frameId)!;
    this.removeChildFramesRecursively(frame);
    this.clearWebSockets(frame);
    frame._url = url;
    frame._name = name;

    let keepPending: DocumentInfo | undefined;
    const pendingDocument = frame.pendingDocument();
    if (pendingDocument) {
      if (pendingDocument.documentId === undefined) {
        // Pending with unknown documentId - assume it is the one being committed.
        pendingDocument.documentId = documentId;
      }
      if (pendingDocument.documentId === documentId) {
        // Committing a pending document.
        frame._currentDocument = pendingDocument;
      } else {
        // Sometimes, we already have a new pending when the old one commits.
        // An example would be Chromium error page followed by a new navigation request,
        // where the error page commit arrives after Network.requestWillBeSent for the
        // new navigation.
        // We commit, but keep the pending request since it's not done yet.
        keepPending = pendingDocument;
        frame._currentDocument = { documentId, request: undefined };
      }
      frame.setPendingDocument(undefined);
    } else {
      // No pending - just commit a new document.
      frame._currentDocument = { documentId, request: undefined };
    }

    frame._onClearLifecycle();
    const navigationEvent: NavigationEvent = { url, name, newDocument: frame._currentDocument };
    frame.emit(Frame.Events.Navigation, navigationEvent);
    this._responses.length = 0;
    if (!initial) {
      debugLogger.log('api', `  navigated to "${url}"`);
      this._page.frameNavigatedToNewDocument(frame);
    }
    // Restore pending if any - see comments above about keepPending.
    frame.setPendingDocument(keepPending);
  }

  frameCommittedSameDocumentNavigation(frameId: string, url: string) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    frame._url = url;
    const navigationEvent: NavigationEvent = { url, name: frame._name };
    frame.emit(Frame.Events.Navigation, navigationEvent);
    debugLogger.log('api', `  navigated to "${url}"`);
  }

  frameAbortedNavigation(frameId: string, errorText: string, documentId?: string) {
    const frame = this._frames.get(frameId);
    if (!frame || !frame.pendingDocument())
      return;
    if (documentId !== undefined && frame.pendingDocument()!.documentId !== documentId)
      return;
    const navigationEvent: NavigationEvent = {
      url: frame._url,
      name: frame._name,
      newDocument: frame.pendingDocument(),
      error: new Error(errorText),
    };
    frame.setPendingDocument(undefined);
    frame.emit(Frame.Events.Navigation, navigationEvent);
  }

  frameDetached(frameId: string) {
    const frame = this._frames.get(frameId);
    if (frame)
      this._removeFramesRecursively(frame);
  }

  frameStoppedLoading(frameId: string) {
    this.frameLifecycleEvent(frameId, 'domcontentloaded');
    this.frameLifecycleEvent(frameId, 'load');
  }

  frameLifecycleEvent(frameId: string, event: types.LifecycleEvent) {
    const frame = this._frames.get(frameId);
    if (frame)
      frame._onLifecycleEvent(event);
  }

  requestStarted(request: network.Request) {
    const frame = request.frame();
    this._inflightRequestStarted(request);
    if (request._documentId)
      frame.setPendingDocument({ documentId: request._documentId, request });
    if (request._isFavicon) {
      const route = request._route();
      if (route)
        route.continue();
      return;
    }
    this._page._browserContext.emit(BrowserContext.Events.Request, request);
    this._page._requestStarted(request);
  }

  requestReceivedResponse(response: network.Response) {
    if (response.request()._isFavicon)
      return;
    this._responses.push(response);
    this._page._browserContext.emit(BrowserContext.Events.Response, response);
  }

  requestFinished(request: network.Request) {
    this._inflightRequestFinished(request);
    if (request._isFavicon)
      return;
    this._page._browserContext.emit(BrowserContext.Events.RequestFinished, request);
  }

  requestFailed(request: network.Request, canceled: boolean) {
    const frame = request.frame();
    this._inflightRequestFinished(request);
    if (frame.pendingDocument() && frame.pendingDocument()!.request === request) {
      let errorText = request.failure()!.errorText;
      if (canceled)
        errorText += '; maybe frame was detached?';
      this.frameAbortedNavigation(frame._id, errorText, frame.pendingDocument()!.documentId);
    }
    if (request._isFavicon)
      return;
    this._page._browserContext.emit(BrowserContext.Events.RequestFailed, request);
  }

  removeChildFramesRecursively(frame: Frame) {
    for (const child of frame.childFrames())
      this._removeFramesRecursively(child);
  }

  private _removeFramesRecursively(frame: Frame) {
    this.removeChildFramesRecursively(frame);
    frame._onDetached();
    this._frames.delete(frame._id);
    if (!this._page.isClosed())
      this._page.emit(Page.Events.FrameDetached, frame);
  }

  private _inflightRequestFinished(request: network.Request) {
    const frame = request.frame();
    if (request._isFavicon)
      return;
    if (!frame._inflightRequests.has(request))
      return;
    frame._inflightRequests.delete(request);
    if (frame._inflightRequests.size === 0)
      frame._startNetworkIdleTimer();
  }

  private _inflightRequestStarted(request: network.Request) {
    const frame = request.frame();
    if (request._isFavicon)
      return;
    frame._inflightRequests.add(request);
    if (frame._inflightRequests.size === 1)
      frame._stopNetworkIdleTimer();
  }

  interceptConsoleMessage(message: ConsoleMessage): boolean {
    if (message.type() !== 'debug')
      return false;
    const tag = message.text();
    const handler = this._consoleMessageTags.get(tag);
    if (!handler)
      return false;
    this._consoleMessageTags.delete(tag);
    handler();
    return true;
  }

  clearWebSockets(frame: Frame) {
    // TODO: attribute sockets to frames.
    if (frame.parentFrame())
      return;
    this._webSockets.clear();
  }

  onWebSocketCreated(requestId: string, url: string) {
    const ws = new network.WebSocket(this._page, url);
    this._webSockets.set(requestId, ws);
  }

  onWebSocketRequest(requestId: string) {
    const ws = this._webSockets.get(requestId);
    if (ws)
      this._page.emit(Page.Events.WebSocket, ws);
  }

  onWebSocketResponse(requestId: string, status: number, statusText: string) {
    const ws = this._webSockets.get(requestId);
    if (status < 400)
      return;
    if (ws)
      ws.error(`${statusText}: ${status}`);
  }

  onWebSocketFrameSent(requestId: string, opcode: number, data: string) {
    const ws = this._webSockets.get(requestId);
    if (ws)
      ws.frameSent(opcode, data);
  }

  webSocketFrameReceived(requestId: string, opcode: number, data: string) {
    const ws = this._webSockets.get(requestId);
    if (ws)
      ws.frameReceived(opcode, data);
  }

  webSocketClosed(requestId: string) {
    const ws = this._webSockets.get(requestId);
    if (ws)
      ws.closed();
    this._webSockets.delete(requestId);
  }

  webSocketError(requestId: string, errorMessage: string): void {
    const ws = this._webSockets.get(requestId);
    if (ws)
      ws.error(errorMessage);
  }
}

export class Frame extends SdkObject {
  static Events = {
    Navigation: 'navigation',
    AddLifecycle: 'addlifecycle',
    RemoveLifecycle: 'removelifecycle',
  };

  _id: string;
  private _firedLifecycleEvents = new Set<types.LifecycleEvent>();
  _subtreeLifecycleEvents = new Set<types.LifecycleEvent>();
  _currentDocument: DocumentInfo;
  private _pendingDocument: DocumentInfo | undefined;
  readonly _page: Page;
  private _parentFrame: Frame | null;
  _url = '';
  private _detached = false;
  private _contextData = new Map<types.World, ContextData>();
  private _childFrames = new Set<Frame>();
  _name = '';
  _inflightRequests = new Set<network.Request>();
  private _networkIdleTimer: NodeJS.Timer | undefined;
  private _setContentCounter = 0;
  readonly _detachedPromise: Promise<void>;
  private _detachedCallback = () => {};
  private _nonStallingEvaluations = new Set<(error: Error) => void>();

  constructor(page: Page, id: string, parentFrame: Frame | null) {
    super(page, 'frame');
    this.attribution.frame = this;
    this._id = id;
    this._page = page;
    this._parentFrame = parentFrame;
    this._currentDocument = { documentId: undefined, request: undefined };

    this._detachedPromise = new Promise<void>(x => this._detachedCallback = x);

    this._contextData.set('main', { contextPromise: new Promise(() => {}), contextResolveCallback: () => {}, context: null, rerunnableTasks: new Set() });
    this._contextData.set('utility', { contextPromise: new Promise(() => {}), contextResolveCallback: () => {}, context: null, rerunnableTasks: new Set() });
    this._setContext('main', null);
    this._setContext('utility', null);

    if (this._parentFrame)
      this._parentFrame._childFrames.add(this);
  }

  _onLifecycleEvent(event: types.LifecycleEvent) {
    if (this._firedLifecycleEvents.has(event))
      return;
    this._firedLifecycleEvents.add(event);
    // Recalculate subtree lifecycle for the whole tree - it should not be that big.
    this._page.mainFrame()._recalculateLifecycle();
  }

  _onClearLifecycle() {
    this._firedLifecycleEvents.clear();
    // Recalculate subtree lifecycle for the whole tree - it should not be that big.
    this._page.mainFrame()._recalculateLifecycle();
    // Keep the current navigation request if any.
    this._inflightRequests = new Set(Array.from(this._inflightRequests).filter(request => request === this._currentDocument.request));
    this._stopNetworkIdleTimer();
    if (this._inflightRequests.size === 0)
      this._startNetworkIdleTimer();
  }

  setPendingDocument(documentInfo: DocumentInfo | undefined) {
    this._pendingDocument = documentInfo;
    if (documentInfo)
      this._invalidateNonStallingEvaluations();
  }

  pendingDocument(): DocumentInfo | undefined {
    return this._pendingDocument;
  }

  private async _invalidateNonStallingEvaluations() {
    if (!this._nonStallingEvaluations)
      return;
    const error = new Error('Navigation interrupted the evaluation');
    for (const callback of this._nonStallingEvaluations)
      callback(error);
  }

  async nonStallingRawEvaluateInExistingMainContext(expression: string): Promise<any> {
    if (this._pendingDocument)
      throw new Error('Frame is currently attempting a navigation');
    const context = this._existingMainContext();
    if (!context)
      throw new Error('Frame does not yet have a main execution context');

    let callback = () => {};
    const frameInvalidated = new Promise<void>((f, r) => callback = r);
    this._nonStallingEvaluations.add(callback);
    try {
      return await Promise.race([
        context.rawEvaluateJSON(expression),
        frameInvalidated
      ]);
    } finally {
      this._nonStallingEvaluations.delete(callback);
    }
  }

  async nonStallingEvaluateInExistingContext(expression: string, isFunction: boolean|undefined, world: types.World): Promise<any> {
    if (this._pendingDocument)
      throw new Error('Frame is currently attempting a navigation');
    const context = this._contextData.get(world)?.context;
    if (!context)
      throw new Error('Frame does not yet have the execution context');

    let callback = () => {};
    const frameInvalidated = new Promise<void>((f, r) => callback = r);
    this._nonStallingEvaluations.add(callback);
    try {
      return await Promise.race([
        context.evaluateExpression(expression, isFunction),
        frameInvalidated
      ]);
    } finally {
      this._nonStallingEvaluations.delete(callback);
    }
  }

  private _recalculateLifecycle() {
    const events = new Set<types.LifecycleEvent>(this._firedLifecycleEvents);
    for (const child of this._childFrames) {
      child._recalculateLifecycle();
      // We require a particular lifecycle event to be fired in the whole
      // frame subtree, and then consider it done.
      for (const event of events) {
        if (!child._subtreeLifecycleEvents.has(event))
          events.delete(event);
      }
    }
    const mainFrame = this._page.mainFrame();
    for (const event of events) {
      // Checking whether we have already notified about this event.
      if (!this._subtreeLifecycleEvents.has(event)) {
        this.emit(Frame.Events.AddLifecycle, event);
        if (this === mainFrame && this._url !== 'about:blank')
          debugLogger.log('api', `  "${event}" event fired`);
        if (this === mainFrame && event === 'load')
          this._page.emit(Page.Events.Load);
        if (this === mainFrame && event === 'domcontentloaded')
          this._page.emit(Page.Events.DOMContentLoaded);
      }
    }
    for (const event of this._subtreeLifecycleEvents) {
      if (!events.has(event))
        this.emit(Frame.Events.RemoveLifecycle, event);
    }
    this._subtreeLifecycleEvents = events;
  }

  async raceNavigationAction<T>(action: () => Promise<T>): Promise<T> {
    return Promise.race([
      this._page._disconnectedPromise.then(() => { throw new Error('Navigation failed because page was closed!'); }),
      this._page._crashedPromise.then(() => { throw new Error('Navigation failed because page crashed!'); }),
      this._detachedPromise.then(() => { throw new Error('Navigating frame was detached!'); }),
      action(),
    ]);
  }

  async goto(metadata: CallMetadata, url: string, options: types.GotoOptions = {}): Promise<network.Response | null> {
    const constructedNavigationURL = constructURLBasedOnBaseURL(this._page._browserContext._options.baseURL, url);
    const controller = new ProgressController(metadata, this);
    return controller.run(progress => this._goto(progress, constructedNavigationURL, options), this._page._timeoutSettings.navigationTimeout(options));
  }

  private async _goto(progress: Progress, url: string, options: types.GotoOptions): Promise<network.Response | null> {
    return this.raceNavigationAction(async () => {
      const waitUntil = verifyLifecycle('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
      progress.log(`navigating to "${url}", waiting until "${waitUntil}"`);
      const headers = this._page._state.extraHTTPHeaders || [];
      const refererHeader = headers.find(h => h.name.toLowerCase() === 'referer');
      let referer = refererHeader ? refererHeader.value : undefined;
      if (options.referer !== undefined) {
        if (referer !== undefined && referer !== options.referer)
          throw new Error('"referer" is already specified as extra HTTP header');
        referer = options.referer;
      }
      url = helper.completeUserURL(url);

      const sameDocument = helper.waitForEvent(progress, this, Frame.Events.Navigation, (e: NavigationEvent) => !e.newDocument);
      const navigateResult = await this._page._delegate.navigateFrame(this, url, referer);

      let event: NavigationEvent;
      if (navigateResult.newDocumentId) {
        sameDocument.dispose();
        event = await helper.waitForEvent(progress, this, Frame.Events.Navigation, (event: NavigationEvent) => {
          // We are interested either in this specific document, or any other document that
          // did commit and replaced the expected document.
          return event.newDocument && (event.newDocument.documentId === navigateResult.newDocumentId || !event.error);
        }).promise;

        if (event.newDocument!.documentId !== navigateResult.newDocumentId) {
          // This is just a sanity check. In practice, new navigation should
          // cancel the previous one and report "request cancelled"-like error.
          throw new Error('Navigation interrupted by another one');
        }
        if (event.error)
          throw event.error;
      } else {
        event = await sameDocument.promise;
      }

      if (!this._subtreeLifecycleEvents.has(waitUntil))
        await helper.waitForEvent(progress, this, Frame.Events.AddLifecycle, (e: types.LifecycleEvent) => e === waitUntil).promise;

      const request = event.newDocument ? event.newDocument.request : undefined;
      const response = request ? request._finalRequest().response() : null;
      await this._page._doSlowMo();
      return response;
    });
  }

  async _waitForNavigation(progress: Progress, options: types.NavigateOptions): Promise<network.Response | null> {
    const waitUntil = verifyLifecycle('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
    progress.log(`waiting for navigation until "${waitUntil}"`);

    const navigationEvent: NavigationEvent = await helper.waitForEvent(progress, this, Frame.Events.Navigation, (event: NavigationEvent) => {
      // Any failed navigation results in a rejection.
      if (event.error)
        return true;
      progress.log(`  navigated to "${this._url}"`);
      return true;
    }).promise;
    if (navigationEvent.error)
      throw navigationEvent.error;

    if (!this._subtreeLifecycleEvents.has(waitUntil))
      await helper.waitForEvent(progress, this, Frame.Events.AddLifecycle, (e: types.LifecycleEvent) => e === waitUntil).promise;

    const request = navigationEvent.newDocument ? navigationEvent.newDocument.request : undefined;
    return request ? request._finalRequest().response() : null;
  }

  async _waitForLoadState(progress: Progress, state: types.LifecycleEvent): Promise<void> {
    const waitUntil = verifyLifecycle('state', state);
    if (!this._subtreeLifecycleEvents.has(waitUntil))
      await helper.waitForEvent(progress, this, Frame.Events.AddLifecycle, (e: types.LifecycleEvent) => e === waitUntil).promise;
  }

  async frameElement(): Promise<dom.ElementHandle> {
    return this._page._delegate.getFrameElement(this);
  }

  _context(world: types.World): Promise<dom.FrameExecutionContext> {
    if (this._detached)
      throw new Error(`Execution Context is not available in detached frame "${this.url()}" (are you trying to evaluate?)`);
    return this._contextData.get(world)!.contextPromise;
  }

  _mainContext(): Promise<dom.FrameExecutionContext> {
    return this._context('main');
  }

  private _existingMainContext(): dom.FrameExecutionContext | null {
    return this._contextData.get('main')?.context || null;
  }

  _utilityContext(): Promise<dom.FrameExecutionContext> {
    return this._context('utility');
  }

  async evaluateExpressionHandleAndWaitForSignals(expression: string, isFunction: boolean | undefined, arg: any, world: types.World = 'main'): Promise<any> {
    const context = await this._context(world);
    const handle = await context.evaluateExpressionHandleAndWaitForSignals(expression, isFunction, arg);
    if (world === 'main')
      await this._page._doSlowMo();
    return handle;
  }

  async evaluateExpression(expression: string, isFunction: boolean | undefined, arg: any, world: types.World = 'main'): Promise<any> {
    const context = await this._context(world);
    const value = await context.evaluateExpression(expression, isFunction, arg);
    if (world === 'main')
      await this._page._doSlowMo();
    return value;
  }

  async evaluateExpressionAndWaitForSignals(expression: string, isFunction: boolean | undefined, arg: any, world: types.World = 'main'): Promise<any> {
    const context = await this._context(world);
    const value = await context.evaluateExpressionAndWaitForSignals(expression, isFunction, arg);
    if (world === 'main')
      await this._page._doSlowMo();
    return value;
  }

  async $(selector: string): Promise<dom.ElementHandle<Element> | null> {
    debugLogger.log('api', `    finding element using the selector "${selector}"`);
    return this._page.selectors._query(this, selector);
  }

  async waitForSelector(metadata: CallMetadata, selector: string, options: types.WaitForElementOptions = {}): Promise<dom.ElementHandle<Element> | null> {
    const controller = new ProgressController(metadata, this);
    if ((options as any).visibility)
      throw new Error('options.visibility is not supported, did you mean options.state?');
    if ((options as any).waitFor && (options as any).waitFor !== 'visible')
      throw new Error('options.waitFor is not supported, did you mean options.state?');
    const { state = 'visible' } = options;
    if (!['attached', 'detached', 'visible', 'hidden'].includes(state))
      throw new Error(`state: expected one of (attached|detached|visible|hidden)`);
    const info = this._page.selectors._parseSelector(selector);
    const task = dom.waitForSelectorTask(info, state);
    return controller.run(async progress => {
      progress.log(`waiting for selector "${selector}"${state === 'attached' ? '' : ' to be ' + state}`);
      while (progress.isRunning()) {
        const result = await this._scheduleRerunnableHandleTask(progress, info.world, task);
        if (!result.asElement()) {
          result.dispose();
          return null;
        }
        if ((options as any).__testHookBeforeAdoptNode)
          await (options as any).__testHookBeforeAdoptNode();
        try {
          const handle = result.asElement() as dom.ElementHandle<Element>;
          const adopted = await handle._adoptTo(await this._mainContext());
          return adopted;
        } catch (e) {
          // Navigated while trying to adopt the node.
          if (!js.isContextDestroyedError(e) && !e.message.includes(dom.kUnableToAdoptErrorMessage))
            throw e;
          result.dispose();
        }
      }
      return null;
    }, this._page._timeoutSettings.timeout(options));
  }

  async dispatchEvent(metadata: CallMetadata, selector: string, type: string, eventInit?: Object, options: types.TimeoutOptions = {}): Promise<void> {
    const controller = new ProgressController(metadata, this);
    const info = this._page.selectors._parseSelector(selector);
    const task = dom.dispatchEventTask(info, type, eventInit || {});
    await controller.run(async progress => {
      progress.log(`Dispatching "${type}" event on selector "${selector}"...`);
      // Note: we always dispatch events in the main world.
      await this._scheduleRerunnableTask(progress, 'main', task);
    }, this._page._timeoutSettings.timeout(options));
    await this._page._doSlowMo();
  }

  async evalOnSelectorAndWaitForSignals(selector: string, expression: string, isFunction: boolean | undefined, arg: any): Promise<any> {
    const handle = await this.$(selector);
    if (!handle)
      throw new Error(`Error: failed to find element matching selector "${selector}"`);
    const result = await handle.evaluateExpressionAndWaitForSignals(expression, isFunction, true, arg);
    handle.dispose();
    return result;
  }

  async evalOnSelectorAllAndWaitForSignals(selector: string, expression: string, isFunction: boolean | undefined, arg: any): Promise<any> {
    const arrayHandle = await this._page.selectors._queryArray(this, selector);
    const result = await arrayHandle.evaluateExpressionAndWaitForSignals(expression, isFunction, true, arg);
    arrayHandle.dispose();
    return result;
  }

  async $$(selector: string): Promise<dom.ElementHandle<Element>[]> {
    return this._page.selectors._queryAll(this, selector, undefined, true /* adoptToMain */);
  }

  async content(): Promise<string> {
    const context = await this._utilityContext();
    return context.evaluate(() => {
      let retVal = '';
      if (document.doctype)
        retVal = new XMLSerializer().serializeToString(document.doctype);
      if (document.documentElement)
        retVal += document.documentElement.outerHTML;
      return retVal;
    });
  }

  async setContent(metadata: CallMetadata, html: string, options: types.NavigateOptions = {}): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(progress => this.raceNavigationAction(async () => {
      const waitUntil = options.waitUntil === undefined ? 'load' : options.waitUntil;
      progress.log(`setting frame content, waiting until "${waitUntil}"`);
      const tag = `--playwright--set--content--${this._id}--${++this._setContentCounter}--`;
      const context = await this._utilityContext();
      const lifecyclePromise = new Promise((resolve, reject) => {
        this._page._frameManager._consoleMessageTags.set(tag, () => {
          // Clear lifecycle right after document.open() - see 'tag' below.
          this._onClearLifecycle();
          this._waitForLoadState(progress, waitUntil).then(resolve).catch(reject);
        });
      });
      const contentPromise = context.evaluate(({ html, tag }) => {
        window.stop();
        document.open();
        console.debug(tag);  // eslint-disable-line no-console
        document.write(html);
        document.close();
      }, { html, tag });
      await Promise.all([contentPromise, lifecyclePromise]);
      await this._page._doSlowMo();
    }), this._page._timeoutSettings.navigationTimeout(options));
  }

  name(): string {
    return this._name || '';
  }

  url(): string {
    return this._url;
  }

  parentFrame(): Frame | null {
    return this._parentFrame;
  }

  childFrames(): Frame[] {
    return Array.from(this._childFrames);
  }

  async addScriptTag(params: {
      url?: string,
      content?: string,
      type?: string,
    }): Promise<dom.ElementHandle> {
    const {
      url = null,
      content = null,
      type = ''
    } = params;
    if (!url && !content)
      throw new Error('Provide an object with a `url`, `path` or `content` property');

    const context = await this._mainContext();
    return this._raceWithCSPError(async () => {
      if (url !== null)
        return (await context.evaluateHandle(addScriptUrl, { url, type })).asElement()!;
      const result = (await context.evaluateHandle(addScriptContent, { content: content!, type })).asElement()!;
      // Another round trip to the browser to ensure that we receive CSP error messages
      // (if any) logged asynchronously in a separate task on the content main thread.
      if (this._page._delegate.cspErrorsAsynchronousForInlineScipts)
        await context.evaluate(() => true);
      return result;
    });

    async function addScriptUrl(params: { url: string, type: string }): Promise<HTMLElement> {
      const script = document.createElement('script');
      script.src = params.url;
      if (params.type)
        script.type = params.type;
      const promise = new Promise((res, rej) => {
        script.onload = res;
        script.onerror = e => rej(typeof e === 'string' ? new Error(e) : new Error(`Failed to load script at ${script.src}`));
      });
      document.head.appendChild(script);
      await promise;
      return script;
    }

    function addScriptContent(params: { content: string, type: string }): HTMLElement {
      const script = document.createElement('script');
      script.type = params.type || 'text/javascript';
      script.text = params.content;
      let error = null;
      script.onerror = e => error = e;
      document.head.appendChild(script);
      if (error)
        throw error;
      return script;
    }
  }

  async addStyleTag(params: { url?: string, content?: string }): Promise<dom.ElementHandle> {
    const {
      url = null,
      content = null
    } = params;
    if (!url && !content)
      throw new Error('Provide an object with a `url`, `path` or `content` property');

    const context = await this._mainContext();
    return this._raceWithCSPError(async () => {
      if (url !== null)
        return (await context.evaluateHandle(addStyleUrl, url)).asElement()!;
      return (await context.evaluateHandle(addStyleContent, content!)).asElement()!;
    });

    async function addStyleUrl(url: string): Promise<HTMLElement> {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      const promise = new Promise((res, rej) => {
        link.onload = res;
        link.onerror = rej;
      });
      document.head.appendChild(link);
      await promise;
      return link;
    }

    async function addStyleContent(content: string): Promise<HTMLElement> {
      const style = document.createElement('style');
      style.type = 'text/css';
      style.appendChild(document.createTextNode(content));
      const promise = new Promise((res, rej) => {
        style.onload = res;
        style.onerror = rej;
      });
      document.head.appendChild(style);
      await promise;
      return style;
    }
  }

  private async _raceWithCSPError(func: () => Promise<dom.ElementHandle>): Promise<dom.ElementHandle> {
    const listeners: RegisteredListener[] = [];
    let result: dom.ElementHandle;
    let error: Error | undefined;
    let cspMessage: ConsoleMessage | undefined;
    const actionPromise = new Promise<void>(async resolve => {
      try {
        result = await func();
      } catch (e) {
        error = e;
      }
      resolve();
    });
    const errorPromise = new Promise<void>(resolve => {
      listeners.push(eventsHelper.addEventListener(this._page, Page.Events.Console, (message: ConsoleMessage) => {
        if (message.type() === 'error' && message.text().includes('Content Security Policy')) {
          cspMessage = message;
          resolve();
        }
      }));
    });
    await Promise.race([actionPromise, errorPromise]);
    eventsHelper.removeEventListeners(listeners);
    if (cspMessage)
      throw new Error(cspMessage.text());
    if (error)
      throw error;
    return result!;
  }

  private async _retryWithProgressIfNotConnected<R>(
    progress: Progress,
    selector: string,
    action: (handle: dom.ElementHandle<Element>) => Promise<R | 'error:notconnected'>): Promise<R> {
    const info = this._page.selectors._parseSelector(selector);
    while (progress.isRunning()) {
      progress.log(`waiting for selector "${selector}"`);
      const task = dom.waitForSelectorTask(info, 'attached');
      const handle = await this._scheduleRerunnableHandleTask(progress, info.world, task);
      const element = handle.asElement() as dom.ElementHandle<Element>;
      progress.cleanupWhenAborted(() => {
        // Do not await here to avoid being blocked, either by stalled
        // page (e.g. alert) or unresolved navigation in Chromium.
        element.dispose();
      });
      const result = await action(element);
      element.dispose();
      if (result === 'error:notconnected') {
        progress.log('element was detached from the DOM, retrying');
        continue;
      }
      return result;
    }
    return undefined as any;
  }

  private async _retryWithSelectorIfNotConnected<R>(
    controller: ProgressController,
    selector: string, options: types.TimeoutOptions,
    action: (progress: Progress, handle: dom.ElementHandle<Element>) => Promise<R | 'error:notconnected'>): Promise<R> {
    return controller.run(async progress => {
      return this._retryWithProgressIfNotConnected(progress, selector, handle => action(progress, handle));
    }, this._page._timeoutSettings.timeout(options));
  }

  async click(metadata: CallMetadata, selector: string, options: types.MouseClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, handle => handle._click(progress, options)));
    }, this._page._timeoutSettings.timeout(options));
  }

  async dblclick(metadata: CallMetadata, selector: string, options: types.MouseMultiClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, handle => handle._dblclick(progress, options)));
    }, this._page._timeoutSettings.timeout(options));
  }

  async tap(metadata: CallMetadata, selector: string, options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, handle => handle._tap(progress, options)));
    }, this._page._timeoutSettings.timeout(options));
  }

  async fill(metadata: CallMetadata, selector: string, value: string, options: types.NavigatingActionWaitOptions & { force?: boolean }) {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, handle => handle._fill(progress, value, options)));
    }, this._page._timeoutSettings.timeout(options));
  }

  async focus(metadata: CallMetadata, selector: string, options: types.TimeoutOptions = {}) {
    const controller = new ProgressController(metadata, this);
    await this._retryWithSelectorIfNotConnected(controller, selector, options, (progress, handle) => handle._focus(progress));
    await this._page._doSlowMo();
  }

  async textContent(metadata: CallMetadata, selector: string, options: types.TimeoutOptions = {}): Promise<string | null> {
    const controller = new ProgressController(metadata, this);
    const info = this._page.selectors._parseSelector(selector);
    const task = dom.textContentTask(info);
    return controller.run(async progress => {
      progress.log(`  retrieving textContent from "${selector}"`);
      return this._scheduleRerunnableTask(progress, info.world, task);
    }, this._page._timeoutSettings.timeout(options));
  }

  async innerText(metadata: CallMetadata, selector: string, options: types.TimeoutOptions = {}): Promise<string> {
    const controller = new ProgressController(metadata, this);
    const info = this._page.selectors._parseSelector(selector);
    const task = dom.innerTextTask(info);
    return controller.run(async progress => {
      progress.log(`  retrieving innerText from "${selector}"`);
      const result = dom.throwFatalDOMError(await this._scheduleRerunnableTask(progress, info.world, task));
      return result.innerText;
    }, this._page._timeoutSettings.timeout(options));
  }

  async innerHTML(metadata: CallMetadata, selector: string, options: types.TimeoutOptions = {}): Promise<string> {
    const controller = new ProgressController(metadata, this);
    const info = this._page.selectors._parseSelector(selector);
    const task = dom.innerHTMLTask(info);
    return controller.run(async progress => {
      progress.log(`  retrieving innerHTML from "${selector}"`);
      return this._scheduleRerunnableTask(progress, info.world, task);
    }, this._page._timeoutSettings.timeout(options));
  }

  async getAttribute(metadata: CallMetadata, selector: string, name: string, options: types.TimeoutOptions = {}): Promise<string | null> {
    const controller = new ProgressController(metadata, this);
    const info = this._page.selectors._parseSelector(selector);
    const task = dom.getAttributeTask(info, name);
    return controller.run(async progress => {
      progress.log(`  retrieving attribute "${name}" from "${selector}"`);
      return this._scheduleRerunnableTask(progress, info.world, task);
    }, this._page._timeoutSettings.timeout(options));
  }

  async inputValue(metadata: CallMetadata, selector: string, options: types.TimeoutOptions = {}): Promise<string> {
    const controller = new ProgressController(metadata, this);
    const info = this._page.selectors._parseSelector(selector);
    const task = dom.inputValueTask(info);
    return controller.run(async progress => {
      progress.log(`  retrieving value from "${selector}"`);
      return dom.throwFatalDOMError(await this._scheduleRerunnableTask(progress, info.world, task));
    }, this._page._timeoutSettings.timeout(options));
  }

  private async _checkElementState(metadata: CallMetadata, selector: string, state: ElementStateWithoutStable, options: types.TimeoutOptions = {}): Promise<boolean> {
    const controller = new ProgressController(metadata, this);
    const info = this._page.selectors._parseSelector(selector);
    const task = dom.elementStateTask(info, state);
    const result = await controller.run(async progress => {
      progress.log(`  checking "${state}" state of "${selector}"`);
      return this._scheduleRerunnableTask(progress, info.world, task);
    }, this._page._timeoutSettings.timeout(options));
    return dom.throwFatalDOMError(dom.throwRetargetableDOMError(result));
  }

  async isVisible(metadata: CallMetadata, selector: string, options: types.TimeoutOptions = {}): Promise<boolean> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      progress.log(`  checking visibility of "${selector}"`);
      const element = await this.$(selector);
      return element ? await element.isVisible() : false;
    }, this._page._timeoutSettings.timeout(options));
  }

  async isHidden(metadata: CallMetadata, selector: string, options: types.TimeoutOptions = {}): Promise<boolean> {
    return !(await this.isVisible(metadata, selector, options));
  }

  async isDisabled(metadata: CallMetadata, selector: string, options: types.TimeoutOptions = {}): Promise<boolean> {
    return this._checkElementState(metadata, selector, 'disabled', options);
  }

  async isEnabled(metadata: CallMetadata, selector: string, options: types.TimeoutOptions = {}): Promise<boolean> {
    return this._checkElementState(metadata, selector, 'enabled', options);
  }

  async isEditable(metadata: CallMetadata, selector: string, options: types.TimeoutOptions = {}): Promise<boolean> {
    return this._checkElementState(metadata, selector, 'editable', options);
  }

  async isChecked(metadata: CallMetadata, selector: string, options: types.TimeoutOptions = {}): Promise<boolean> {
    return this._checkElementState(metadata, selector, 'checked', options);
  }

  async hover(metadata: CallMetadata, selector: string, options: types.PointerActionOptions & types.PointerActionWaitOptions = {}) {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, handle => handle._hover(progress, options)));
    }, this._page._timeoutSettings.timeout(options));
  }

  async selectOption(metadata: CallMetadata, selector: string, elements: dom.ElementHandle[], values: types.SelectOption[], options: types.NavigatingActionWaitOptions & types.ForceOptions = {}): Promise<string[]> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      return await this._retryWithProgressIfNotConnected(progress, selector, handle => handle._selectOption(progress, elements, values, options));
    }, this._page._timeoutSettings.timeout(options));
  }

  async setInputFiles(metadata: CallMetadata, selector: string, files: channels.ElementHandleSetInputFilesParams['files'], options: types.NavigatingActionWaitOptions = {}): Promise<void> {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, handle => handle._setInputFiles(progress, files, options)));
    }, this._page._timeoutSettings.timeout(options));
  }

  async type(metadata: CallMetadata, selector: string, text: string, options: { delay?: number } & types.NavigatingActionWaitOptions = {}) {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, handle => handle._type(progress, text, options)));
    }, this._page._timeoutSettings.timeout(options));
  }

  async press(metadata: CallMetadata, selector: string, key: string, options: { delay?: number } & types.NavigatingActionWaitOptions = {}) {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, handle => handle._press(progress, key, options)));
    }, this._page._timeoutSettings.timeout(options));
  }

  async check(metadata: CallMetadata, selector: string, options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, handle => handle._setChecked(progress, true, options)));
    }, this._page._timeoutSettings.timeout(options));
  }

  async uncheck(metadata: CallMetadata, selector: string, options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    const controller = new ProgressController(metadata, this);
    return controller.run(async progress => {
      return dom.assertDone(await this._retryWithProgressIfNotConnected(progress, selector, handle => handle._setChecked(progress, false, options)));
    }, this._page._timeoutSettings.timeout(options));
  }

  async _waitForFunctionExpression<R>(metadata: CallMetadata, expression: string, isFunction: boolean | undefined, arg: any, options: types.WaitForFunctionOptions, world: types.World = 'main'): Promise<js.SmartHandle<R>> {
    const controller = new ProgressController(metadata, this);
    if (typeof options.pollingInterval === 'number')
      assert(options.pollingInterval > 0, 'Cannot poll with non-positive interval: ' + options.pollingInterval);
    expression = js.normalizeEvaluationExpression(expression, isFunction);
    const task: dom.SchedulableTask<R> = injectedScript => injectedScript.evaluateHandle((injectedScript, { expression, isFunction, polling, arg }) => {
      const predicate = (arg: any): R => {
        let result = self.eval(expression);
        if (isFunction === true) {
          result = result(arg);
        } else if (isFunction === false) {
          result = result;
        } else {
          // auto detect.
          if (typeof result === 'function')
            result = result(arg);
        }
        return result;
      };
      if (typeof polling !== 'number')
        return injectedScript.pollRaf((progress, continuePolling) => predicate(arg) || continuePolling);
      return injectedScript.pollInterval(polling, (progress, continuePolling) => predicate(arg) || continuePolling);
    }, { expression, isFunction, polling: options.pollingInterval, arg });
    return controller.run(
        progress => this._scheduleRerunnableHandleTask(progress, world, task),
        this._page._timeoutSettings.timeout(options));
  }

  async waitForFunctionValueInUtility<R>(progress: Progress, pageFunction: js.Func1<any, R>) {
    const expression = `() => {
      const result = (${pageFunction})();
      if (!result)
        return result;
      return JSON.stringify(result);
    }`;
    const handle = await this._waitForFunctionExpression(internalCallMetadata(), expression, true, undefined, { timeout: progress.timeUntilDeadline() }, 'utility');
    return JSON.parse(handle.rawValue()) as R;
  }

  async title(): Promise<string> {
    const context = await this._utilityContext();
    return context.evaluate(() => document.title);
  }

  _onDetached() {
    this._stopNetworkIdleTimer();
    this._detached = true;
    this._detachedCallback();
    for (const data of this._contextData.values()) {
      for (const rerunnableTask of data.rerunnableTasks)
        rerunnableTask.terminate(new Error('waitForFunction failed: frame got detached.'));
    }
    if (this._parentFrame)
      this._parentFrame._childFrames.delete(this);
    this._parentFrame = null;
  }

  private _scheduleRerunnableTask<T>(progress: Progress, world: types.World, task: dom.SchedulableTask<T>): Promise<T> {
    const data = this._contextData.get(world)!;
    const rerunnableTask = new RerunnableTask(data, progress, task, true /* returnByValue */);
    if (this._detached)
      rerunnableTask.terminate(new Error('waitForFunction failed: frame got detached.'));
    if (data.context)
      rerunnableTask.rerun(data.context);
    return rerunnableTask.promise;
  }

  private _scheduleRerunnableHandleTask<T>(progress: Progress, world: types.World, task: dom.SchedulableTask<T>): Promise<js.SmartHandle<T>> {
    const data = this._contextData.get(world)!;
    const rerunnableTask = new RerunnableTask(data, progress, task, false /* returnByValue */);
    if (this._detached)
      rerunnableTask.terminate(new Error('waitForFunction failed: frame got detached.'));
    if (data.context)
      rerunnableTask.rerun(data.context);
    return rerunnableTask.promise;
  }

  private _setContext(world: types.World, context: dom.FrameExecutionContext | null) {
    const data = this._contextData.get(world)!;
    data.context = context;
    if (context) {
      data.contextResolveCallback.call(null, context);
      for (const rerunnableTask of data.rerunnableTasks)
        rerunnableTask.rerun(context);
    } else {
      data.contextPromise = new Promise(fulfill => {
        data.contextResolveCallback = fulfill;
      });
    }
  }

  _contextCreated(world: types.World, context: dom.FrameExecutionContext) {
    const data = this._contextData.get(world)!;
    // In case of multiple sessions to the same target, there's a race between
    // connections so we might end up creating multiple isolated worlds.
    // We can use either.
    if (data.context)
      this._setContext(world, null);
    this._setContext(world, context);
  }

  _contextDestroyed(context: dom.FrameExecutionContext) {
    for (const [world, data] of this._contextData) {
      if (data.context === context)
        this._setContext(world, null);
    }
  }

  _startNetworkIdleTimer() {
    assert(!this._networkIdleTimer);
    // We should not start a timer and report networkidle in detached frames.
    // This happens at least in Firefox for child frames, where we may get requestFinished
    // after the frame was detached - probably a race in the Firefox itself.
    if (this._firedLifecycleEvents.has('networkidle') || this._detached)
      return;
    this._networkIdleTimer = setTimeout(() => this._onLifecycleEvent('networkidle'), 500);
  }

  _stopNetworkIdleTimer() {
    if (this._networkIdleTimer)
      clearTimeout(this._networkIdleTimer);
    this._networkIdleTimer = undefined;
  }

  async extendInjectedScript(world: types.World, source: string, arg?: any): Promise<js.JSHandle> {
    const context = await this._context(world);
    const injectedScriptHandle = await context.injectedScript();
    return injectedScriptHandle.evaluateHandle((injectedScript, {source, arg}) => {
      return injectedScript.extend(source, arg);
    }, { source, arg });
  }
}

class RerunnableTask {
  readonly promise: Promise<any>;
  private _task: dom.SchedulableTask<any>;
  private _resolve: (result: any) => void = () => {};
  private _reject: (reason: Error) => void = () => {};
  private _progress: Progress;
  private _returnByValue: boolean;
  private _contextData: ContextData;

  constructor(data: ContextData, progress: Progress, task: dom.SchedulableTask<any>, returnByValue: boolean) {
    this._task = task;
    this._progress = progress;
    this._returnByValue = returnByValue;
    this._contextData = data;
    this._contextData.rerunnableTasks.add(this);
    this.promise = new Promise<any>((resolve, reject) => {
      // The task is either resolved with a value, or rejected with a meaningful evaluation error.
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  terminate(error: Error) {
    this._reject(error);
  }

  async rerun(context: dom.FrameExecutionContext) {
    try {
      const injectedScript = await context.injectedScript();
      const pollHandler = new dom.InjectedScriptPollHandler(this._progress, await this._task(injectedScript));
      const result = this._returnByValue ? await pollHandler.finish() : await pollHandler.finishHandle();
      this._contextData.rerunnableTasks.delete(this);
      this._resolve(result);
    } catch (e) {
      // We will try again in the new execution context.
      if (js.isContextDestroyedError(e))
        return;
      this._contextData.rerunnableTasks.delete(this);
      this._reject(e);
    }
  }
}

class SignalBarrier {
  private _progress: Progress | null;
  private _protectCount = 0;
  private _promise: Promise<void>;
  private _promiseCallback = () => {};

  constructor(progress: Progress | null) {
    this._progress = progress;
    this._promise = new Promise(f => this._promiseCallback = f);
    this.retain();
  }

  waitFor(): Promise<void> {
    this.release();
    return this._promise;
  }

  async addFrameNavigation(frame: Frame) {
    // Auto-wait top-level navigations only.
    if (frame.parentFrame())
      return;
    this.retain();
    const waiter = helper.waitForEvent(null, frame, Frame.Events.Navigation, (e: NavigationEvent) => {
      if (!e.error && this._progress)
        this._progress.log(`  navigated to "${frame._url}"`);
      return true;
    });
    await Promise.race([
      frame._page._disconnectedPromise,
      frame._page._crashedPromise,
      frame._detachedPromise,
      waiter.promise,
    ]).catch(e => {});
    waiter.dispose();
    this.release();
  }

  retain() {
    ++this._protectCount;
  }

  release() {
    --this._protectCount;
    if (!this._protectCount)
      this._promiseCallback();
  }
}

function verifyLifecycle(name: string, waitUntil: types.LifecycleEvent): types.LifecycleEvent {
  if (waitUntil as unknown === 'networkidle0')
    waitUntil = 'networkidle';
  if (!types.kLifecycleEvents.has(waitUntil))
    throw new Error(`${name}: expected one of (load|domcontentloaded|networkidle)`);
  return waitUntil;
}
