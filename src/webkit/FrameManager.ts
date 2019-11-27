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
import { Events } from './events';
import { assert, debugError, helper, RegisteredListener } from '../helper';
import { TimeoutSettings } from '../TimeoutSettings';
import { TargetSession } from './Connection';
import { ExecutionContext } from './ExecutionContext';
import { ElementHandle, JSHandle } from './JSHandle';
import { NetworkManager, NetworkManagerEvents, Request, Response } from './NetworkManager';
import { Page } from './Page';
import { Protocol } from './protocol';
import * as frames from '../frames';

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

export type Frame = frames.Frame<JSHandle, ElementHandle, ExecutionContext, Response>;

export class FrameManager extends EventEmitter implements frames.FrameDelegate<JSHandle, ElementHandle, ExecutionContext, Response> {
  _session: TargetSession;
  _page: Page;
  _networkManager: NetworkManager;
  _timeoutSettings: TimeoutSettings;
  _frames: Map<string, Frame>;
  _contextIdToContext: Map<number, ExecutionContext>;
  _isolatedWorlds: Set<string>;
  _sessionListeners: RegisteredListener[];
  _mainFrame: Frame;

  constructor(session: TargetSession, page: Page, timeoutSettings: TimeoutSettings) {
    super();
    this._session = session;
    this._page = page;
    this._networkManager = new NetworkManager(session, this);
    this._timeoutSettings = timeoutSettings;
    this._frames = new Map();
    this._contextIdToContext = new Map();
    this._isolatedWorlds = new Set();

    this._addSessionListeners();
  }

  async initialize() {
    const [,{frameTree}] = await Promise.all([
      // Page agent must be enabled before Runtime.
      this._session.send('Page.enable'),
      this._session.send('Page.getResourceTree'),
    ]);
    this._handleFrameTree(frameTree);
    await Promise.all([
      this._session.send('Runtime.enable'),
      this._networkManager.initialize(),
    ]);
  }

  _addSessionListeners() {
    this._sessionListeners = [
      helper.addEventListener(this._session, 'Page.frameNavigated', event => this._onFrameNavigated(event.frame)),
      helper.addEventListener(this._session, 'Page.navigatedWithinDocument', event => this._onFrameNavigatedWithinDocument(event.frameId, event.url)),
      helper.addEventListener(this._session, 'Page.frameDetached', event => this._onFrameDetached(event.frameId)),
      helper.addEventListener(this._session, 'Page.frameStoppedLoading', event => this._onFrameStoppedLoading(event.frameId)),
      helper.addEventListener(this._session, 'Runtime.executionContextCreated', event => this._onExecutionContextCreated(event.context)),
    ];
  }

  async _swapTargetOnNavigation(newSession) {
    helper.removeEventListeners(this._sessionListeners);
    this.disconnectFromTarget();
    this._session = newSession;
    this._addSessionListeners();
    this._networkManager.setSession(newSession);
    this.emit(FrameManagerEvents.TargetSwappedOnNavigation);
    // this.initialize() will be called by page.
  }

  disconnectFromTarget() {
    for (const context of this._contextIdToContext.values()) {
      context._dispose();
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

  page(): Page {
    return this._page;
  }

  mainFrame(): Frame {
    return this._mainFrame;
  }

  frames(): Array<Frame> {
    return Array.from(this._frames.values());
  }

  frame(frameId: string): Frame | null {
    return this._frames.get(frameId) || null;
  }

  _frameData(frame: Frame): FrameData {
    return (frame as any)[frameDataSymbol];
  }

  _onFrameAttached(frameId: string, parentFrameId: string | null) {
    if (this._frames.has(frameId))
      return;
    assert(parentFrameId);
    const parentFrame = this._frames.get(parentFrameId);
    const frame = new frames.Frame(this, parentFrame);
    const data: FrameData = {
      id: frameId,
    };
    frame[frameDataSymbol] = data;
    this._frames.set(frameId, frame);
    this.emit(FrameManagerEvents.FrameAttached, frame);
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
      }
    } else if (isMainFrame) {
      // Initial frame navigation.
      frame = new frames.Frame(this, null);
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
        context._dispose();
        frame._contextDestroyed(context);
      }
    }

    this.emit(FrameManagerEvents.FrameNavigated, frame);
  }

  _onFrameNavigatedWithinDocument(frameId: string, url: string) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    frame._navigated(url, frame.name());
    this.emit(FrameManagerEvents.FrameNavigatedWithinDocument, frame);
    this.emit(FrameManagerEvents.FrameNavigated, frame);
  }

  _onFrameDetached(frameId: string) {
    const frame = this._frames.get(frameId);
    if (frame)
      this._removeFramesRecursively(frame);
  }

  _onExecutionContextCreated(contextPayload : Protocol.Runtime.ExecutionContextDescription) {
    if (!contextPayload.isPageContext)
      return;
    const frameId = contextPayload.frameId;
    // If the frame was attached manually there is no navigation event.
    // FIXME: support frameAttached event in WebKit protocol.
    const frame = this._frames.get(frameId) || null;
    if (!frame)
      return;
    const context: ExecutionContext = new ExecutionContext(this._session, contextPayload, frame);
    if (frame) {
      frame._contextCreated('main', context);
      frame._contextCreated('utility', context);
    }
    this._contextIdToContext.set(contextPayload.id, context);
  }

  executionContextById(contextId: number): ExecutionContext {
    const context = this._contextIdToContext.get(contextId);
    assert(context, 'INTERNAL ERROR: missing context with id = ' + contextId);
    return context;
  }

  _removeFramesRecursively(frame: Frame) {
    for (const child of frame.childFrames())
      this._removeFramesRecursively(child);
    frame._detach();
    this._frames.delete(this._frameData(frame).id);
    this.emit(FrameManagerEvents.FrameDetached, frame);
  }

  timeoutSettings(): TimeoutSettings {
    return this._timeoutSettings;
  }

  async navigateFrame(frame: Frame, url: string, options: { referer?: string; timeout?: number; waitUntil?: string | Array<string>; } | undefined = {}): Promise<Response | null> {
    const {
      timeout = this._timeoutSettings.navigationTimeout(),
    } = options;
    const watchDog = new NextNavigationWatchdog(this, frame, timeout);
    await this._session.send('Page.navigate', {url});
    return watchDog.waitForNavigation();
  }

  async waitForFrameNavigation(frame: Frame, options?: frames.NavigateOptions): Promise<Response | null> {
    // FIXME: this method only works for main frames.
    const watchDog = new NextNavigationWatchdog(this, frame, 10000);
    return watchDog.waitForNavigation();
  }

  async adoptElementHandle(elementHandle: ElementHandle, context: ExecutionContext): Promise<ElementHandle> {
    assert(false, 'Multiple isolated worlds are not implemented');
    return elementHandle;
  }

  async setFrameContent(frame: Frame, html: string, options: { timeout?: number; waitUntil?: string | Array<string>; } | undefined = {}) {
    // We rely upon the fact that document.open() will trigger Page.loadEventFired.
    const watchDog = new NextNavigationWatchdog(this, frame, 1000);
    await frame.evaluate(html => {
      document.open();
      document.write(html);
      document.close();
    }, html);
    await watchDog.waitForNavigation();
  }
}

/**
 * @internal
 */
class NextNavigationWatchdog {
  _frameManager: FrameManager;
  _frame: Frame;
  _newDocumentNavigationPromise: Promise<unknown>;
  _newDocumentNavigationCallback: (value?: unknown) => void;
  _sameDocumentNavigationPromise: Promise<unknown>;
  _sameDocumentNavigationCallback: (value?: unknown) => void;
  _navigationRequest: any;
  _eventListeners: RegisteredListener[];
  _timeoutPromise: Promise<unknown>;
  _timeoutId: NodeJS.Timer;

  constructor(frameManager: FrameManager, frame: Frame, timeout) {
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

  _onRequest(request: Request) {
    if (request.frame() !== this._frame || !request.isNavigationRequest())
      return;
    this._navigationRequest = request;
  }

  navigationResponse(): Response | null {
    return this._navigationRequest ? this._navigationRequest.response() : null;
  }

  dispose() {
    helper.removeEventListeners(this._eventListeners);
    clearTimeout(this._timeoutId);
  }
}
