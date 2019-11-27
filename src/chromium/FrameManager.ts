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

import { EventEmitter } from 'events';
import * as frames from '../frames';
import { assert, debugError } from '../helper';
import * as js from '../javascript';
import * as dom from '../dom';
import { TimeoutSettings } from '../TimeoutSettings';
import { CDPSession } from './Connection';
import { EVALUATION_SCRIPT_URL, ExecutionContext, ExecutionContextDelegate, toRemoteObject } from './ExecutionContext';
import { LifecycleWatcher } from './LifecycleWatcher';
import { NetworkManager, Response } from './NetworkManager';
import { Page } from './Page';
import { Protocol } from './protocol';

const UTILITY_WORLD_NAME = '__playwright_utility_world__';

export const FrameManagerEvents = {
  FrameAttached: Symbol('Events.FrameManager.FrameAttached'),
  FrameNavigated: Symbol('Events.FrameManager.FrameNavigated'),
  FrameDetached: Symbol('Events.FrameManager.FrameDetached'),
  LifecycleEvent: Symbol('Events.FrameManager.LifecycleEvent'),
  FrameNavigatedWithinDocument: Symbol('Events.FrameManager.FrameNavigatedWithinDocument'),
};

const frameDataSymbol = Symbol('frameData');
type FrameData = {
  id: string,
  loaderId: string,
  lifecycleEvents: Set<string>,
};

export type Frame = frames.Frame;

export class FrameManager extends EventEmitter implements frames.FrameDelegate {
  _client: CDPSession;
  private _page: Page;
  private _networkManager: NetworkManager;
  _timeoutSettings: TimeoutSettings;
  private _frames = new Map<string, Frame>();
  private _contextIdToContext = new Map<number, ExecutionContext>();
  private _isolatedWorlds = new Set<string>();
  private _mainFrame: Frame;

  constructor(client: CDPSession, page: Page, ignoreHTTPSErrors: boolean, timeoutSettings: TimeoutSettings) {
    super();
    this._client = client;
    this._page = page;
    this._networkManager = new NetworkManager(client, ignoreHTTPSErrors, this);
    this._timeoutSettings = timeoutSettings;

    this._client.on('Page.frameAttached', event => this._onFrameAttached(event.frameId, event.parentFrameId));
    this._client.on('Page.frameNavigated', event => this._onFrameNavigated(event.frame));
    this._client.on('Page.navigatedWithinDocument', event => this._onFrameNavigatedWithinDocument(event.frameId, event.url));
    this._client.on('Page.frameDetached', event => this._onFrameDetached(event.frameId));
    this._client.on('Page.frameStoppedLoading', event => this._onFrameStoppedLoading(event.frameId));
    this._client.on('Runtime.executionContextCreated', event => this._onExecutionContextCreated(event.context));
    this._client.on('Runtime.executionContextDestroyed', event => this._onExecutionContextDestroyed(event.executionContextId));
    this._client.on('Runtime.executionContextsCleared', event => this._onExecutionContextsCleared());
    this._client.on('Page.lifecycleEvent', event => this._onLifecycleEvent(event));
  }

  async initialize() {
    const [,{frameTree}] = await Promise.all([
      this._client.send('Page.enable'),
      this._client.send('Page.getFrameTree'),
    ]);
    this._handleFrameTree(frameTree);
    await Promise.all([
      this._client.send('Page.setLifecycleEventsEnabled', { enabled: true }),
      this._client.send('Runtime.enable', {}).then(() => this._ensureIsolatedWorld(UTILITY_WORLD_NAME)),
      this._networkManager.initialize(),
    ]);
  }

  networkManager(): NetworkManager {
    return this._networkManager;
  }

  _frameData(frame: Frame): FrameData {
    return (frame as any)[frameDataSymbol];
  }

  async navigateFrame(
    frame: Frame,
    url: string,
    options: { referer?: string; timeout?: number; waitUntil?: string | string[]; } = {}): Promise<Response | null> {
    assertNoLegacyNavigationOptions(options);
    const {
      referer = this._networkManager.extraHTTPHeaders()['referer'],
      waitUntil = ['load'],
      timeout = this._timeoutSettings.navigationTimeout(),
    } = options;

    const watcher = new LifecycleWatcher(this, frame, waitUntil, timeout);
    let ensureNewDocumentNavigation = false;
    let error = await Promise.race([
      navigate(this._client, url, referer, this._frameData(frame).id),
      watcher.timeoutOrTerminationPromise(),
    ]);
    if (!error) {
      error = await Promise.race([
        watcher.timeoutOrTerminationPromise(),
        ensureNewDocumentNavigation ? watcher.newDocumentNavigationPromise() : watcher.sameDocumentNavigationPromise(),
      ]);
    }
    watcher.dispose();
    if (error)
      throw error;
    return watcher.navigationResponse();

    async function navigate(client: CDPSession, url: string, referrer: string, frameId: string): Promise<Error | null> {
      try {
        const response = await client.send('Page.navigate', {url, referrer, frameId});
        ensureNewDocumentNavigation = !!response.loaderId;
        return response.errorText ? new Error(`${response.errorText} at ${url}`) : null;
      } catch (error) {
        return error;
      }
    }
  }

  async waitForFrameNavigation(
    frame: Frame,
    options: { timeout?: number; waitUntil?: string | string[]; } = {}
  ): Promise<Response | null> {
    assertNoLegacyNavigationOptions(options);
    const {
      waitUntil = ['load'],
      timeout = this._timeoutSettings.navigationTimeout(),
    } = options;
    const watcher = new LifecycleWatcher(this, frame, waitUntil, timeout);
    const error = await Promise.race([
      watcher.timeoutOrTerminationPromise(),
      watcher.sameDocumentNavigationPromise(),
      watcher.newDocumentNavigationPromise()
    ]);
    watcher.dispose();
    if (error)
      throw error;
    return watcher.navigationResponse();
  }

  async setFrameContent(frame: Frame, html: string, options: frames.NavigateOptions = {}) {
    const {
      waitUntil = ['load'],
      timeout = this._timeoutSettings.navigationTimeout(),
    } = options;
    const context = await frame._utilityContext();
    // We rely upon the fact that document.open() will reset frame lifecycle with "init"
    // lifecycle event. @see https://crrev.com/608658
    await context.evaluate(html => {
      document.open();
      document.write(html);
      document.close();
    }, html);
    const watcher = new LifecycleWatcher(this, frame, waitUntil, timeout);
    const error = await Promise.race([
      watcher.timeoutOrTerminationPromise(),
      watcher.lifecyclePromise(),
    ]);
    watcher.dispose();
    if (error)
      throw error;
  }

  timeoutSettings(): TimeoutSettings {
    return this._timeoutSettings;
  }

  async adoptElementHandle(elementHandle: dom.ElementHandle, context: ExecutionContext): Promise<dom.ElementHandle> {
    const nodeInfo = await this._client.send('DOM.describeNode', {
      objectId: toRemoteObject(elementHandle).objectId,
    });
    return (context._delegate as ExecutionContextDelegate).adoptBackendNodeId(context, nodeInfo.node.backendNodeId);
  }

  _onLifecycleEvent(event: Protocol.Page.lifecycleEventPayload) {
    const frame = this._frames.get(event.frameId);
    if (!frame)
      return;
    const data = this._frameData(frame);
    if (event.name === 'init') {
      data.loaderId = event.loaderId;
      data.lifecycleEvents.clear();
    }
    data.lifecycleEvents.add(event.name);
    this.emit(FrameManagerEvents.LifecycleEvent, frame);
  }

  _onFrameStoppedLoading(frameId: string) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    const data = this._frameData(frame);
    data.lifecycleEvents.add('DOMContentLoaded');
    data.lifecycleEvents.add('load');
    this.emit(FrameManagerEvents.LifecycleEvent, frame);
  }

  _handleFrameTree(frameTree: Protocol.Page.FrameTree) {
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

  frames(): Frame[] {
    return Array.from(this._frames.values());
  }

  frame(frameId: string): Frame | null {
    return this._frames.get(frameId) || null;
  }

  _onFrameAttached(frameId: string, parentFrameId: string | null) {
    if (this._frames.has(frameId))
      return;
    assert(parentFrameId);
    const parentFrame = this._frames.get(parentFrameId);
    const frame = new frames.Frame(this, parentFrame);
    const data: FrameData = {
      id: frameId,
      loaderId: '',
      lifecycleEvents: new Set(),
    };
    frame[frameDataSymbol] = data;
    this._frames.set(frameId, frame);
    this.emit(FrameManagerEvents.FrameAttached, frame);
  }

  _onFrameNavigated(framePayload: Protocol.Page.Frame) {
    const isMainFrame = !framePayload.parentId;
    let frame = isMainFrame ? this._mainFrame : this._frames.get(framePayload.id);
    assert(isMainFrame || frame, 'We either navigate top level or have old version of the navigated frame');

    // Detach all child frames first.
    if (frame) {
      for (const child of frame.childFrames())
        this._removeFramesRecursively(child);
    }

    // Update or create main frame.
    if (isMainFrame) {
      if (frame) {
        // Update frame id to retain frame identity on cross-process navigation.
        const data = this._frameData(frame);
        this._frames.delete(data.id);
        data.id = framePayload.id;
      } else {
        // Initial main frame navigation.
        frame = new frames.Frame(this, null);
        const data: FrameData = {
          id: framePayload.id,
          loaderId: '',
          lifecycleEvents: new Set(),
        };
        frame[frameDataSymbol] = data;
      }
      this._frames.set(framePayload.id, frame);
      this._mainFrame = frame;
    }

    // Update frame payload.
    frame._navigated(framePayload.url, framePayload.name);

    this.emit(FrameManagerEvents.FrameNavigated, frame);
  }

  async _ensureIsolatedWorld(name: string) {
    if (this._isolatedWorlds.has(name))
      return;
    this._isolatedWorlds.add(name);
    await this._client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `//# sourceURL=${EVALUATION_SCRIPT_URL}`,
      worldName: name,
    }),
    await Promise.all(this.frames().map(frame => this._client.send('Page.createIsolatedWorld', {
      frameId: this._frameData(frame).id,
      grantUniveralAccess: true,
      worldName: name,
    }).catch(debugError))); // frames might be removed before we send this
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

  _onExecutionContextCreated(contextPayload) {
    const frameId = contextPayload.auxData ? contextPayload.auxData.frameId : null;
    const frame = this._frames.get(frameId) || null;
    if (contextPayload.auxData && contextPayload.auxData['type'] === 'isolated')
      this._isolatedWorlds.add(contextPayload.name);
    const context: ExecutionContext = new js.ExecutionContext(new ExecutionContextDelegate(this._client, contextPayload), frame);
    if (frame) {
      if (contextPayload.auxData && !!contextPayload.auxData['isDefault'])
        frame._contextCreated('main', context);
      else if (contextPayload.name === UTILITY_WORLD_NAME)
        frame._contextCreated('utility', context);
    }
    this._contextIdToContext.set(contextPayload.id, context);
  }

  _onExecutionContextDestroyed(executionContextId: number) {
    const context = this._contextIdToContext.get(executionContextId);
    if (!context)
      return;
    this._contextIdToContext.delete(executionContextId);
    if (context.frame())
      context.frame()._contextDestroyed(context);
  }

  _onExecutionContextsCleared() {
    for (const contextId of Array.from(this._contextIdToContext.keys()))
      this._onExecutionContextDestroyed(contextId);
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
}

function assertNoLegacyNavigationOptions(options) {
  assert(options['networkIdleTimeout'] === undefined, 'ERROR: networkIdleTimeout option is no longer supported.');
  assert(options['networkIdleInflight'] === undefined, 'ERROR: networkIdleInflight option is no longer supported.');
  assert(options.waitUntil !== 'networkidle', 'ERROR: "networkidle" option is no longer supported. Use "networkidle2" instead');
}
