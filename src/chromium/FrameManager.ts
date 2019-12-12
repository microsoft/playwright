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
import * as dom from '../dom';
import * as frames from '../frames';
import { assert, debugError } from '../helper';
import * as js from '../javascript';
import * as network from '../network';
import { CDPSession } from './Connection';
import { EVALUATION_SCRIPT_URL, ExecutionContextDelegate } from './ExecutionContext';
import { NetworkManager, NetworkManagerEvents } from './NetworkManager';
import { Page } from '../page';
import { Protocol } from './protocol';
import { Events } from '../events';
import { toConsoleMessageLocation, exceptionToError, releaseObject } from './protocolHelper';
import * as dialog from '../dialog';
import { PageDelegate } from '../page';
import { RawMouseImpl, RawKeyboardImpl } from './Input';
import { Accessibility } from './features/accessibility';
import { Coverage } from './features/coverage';
import { PDF } from './features/pdf';
import { Workers } from './features/workers';
import { Overrides } from './features/overrides';
import { Interception } from './features/interception';
import { Browser } from './Browser';
import { BrowserContext } from '../browserContext';
import * as types from '../types';
import * as input from '../input';
import { ConsoleMessage } from '../console';

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
};

export class FrameManager extends EventEmitter implements PageDelegate {
  _client: CDPSession;
  private _page: Page;
  private _networkManager: NetworkManager;
  private _frames = new Map<string, frames.Frame>();
  private _contextIdToContext = new Map<number, js.ExecutionContext>();
  private _isolatedWorlds = new Set<string>();
  private _mainFrame: frames.Frame;
  rawMouse: RawMouseImpl;
  rawKeyboard: RawKeyboardImpl;

  constructor(client: CDPSession, browserContext: BrowserContext, ignoreHTTPSErrors: boolean) {
    super();
    this._client = client;
    this.rawKeyboard = new RawKeyboardImpl(client);
    this.rawMouse = new RawMouseImpl(client);
    this._networkManager = new NetworkManager(client, ignoreHTTPSErrors, this);
    this._page = new Page(this, browserContext);
    (this._page as any).accessibility = new Accessibility(client);
    (this._page as any).coverage = new Coverage(client);
    (this._page as any).pdf = new PDF(client);
    (this._page as any).workers = new Workers(client, this._page._addConsoleMessage.bind(this._page), error => this._page.emit(Events.Page.PageError, error));
    (this._page as any).overrides = new Overrides(client);
    (this._page as any).interception = new Interception(this._networkManager);

    this._networkManager.on(NetworkManagerEvents.Request, event => this._page.emit(Events.Page.Request, event));
    this._networkManager.on(NetworkManagerEvents.Response, event => this._page.emit(Events.Page.Response, event));
    this._networkManager.on(NetworkManagerEvents.RequestFailed, event => this._page.emit(Events.Page.RequestFailed, event));
    this._networkManager.on(NetworkManagerEvents.RequestFinished, event => this._page.emit(Events.Page.RequestFinished, event));

    this._client.on('Inspector.targetCrashed', event => this._onTargetCrashed());
    this._client.on('Log.entryAdded', event => this._onLogEntryAdded(event));
    this._client.on('Page.domContentEventFired', event => this._page.emit(Events.Page.DOMContentLoaded));
    this._client.on('Page.fileChooserOpened', event => this._onFileChooserOpened(event));
    this._client.on('Page.frameAttached', event => this._onFrameAttached(event.frameId, event.parentFrameId));
    this._client.on('Page.frameDetached', event => this._onFrameDetached(event.frameId));
    this._client.on('Page.frameNavigated', event => this._onFrameNavigated(event.frame));
    this._client.on('Page.frameStoppedLoading', event => this._onFrameStoppedLoading(event.frameId));
    this._client.on('Page.javascriptDialogOpening', event => this._onDialog(event));
    this._client.on('Page.lifecycleEvent', event => this._onLifecycleEvent(event));
    this._client.on('Page.loadEventFired', event => this._page.emit(Events.Page.Load));
    this._client.on('Page.navigatedWithinDocument', event => this._onFrameNavigatedWithinDocument(event.frameId, event.url));
    this._client.on('Runtime.bindingCalled', event => this._onBindingCalled(event));
    this._client.on('Runtime.consoleAPICalled', event => this._onConsoleAPI(event));
    this._client.on('Runtime.exceptionThrown', exception => this._handleException(exception.exceptionDetails));
    this._client.on('Runtime.executionContextCreated', event => this._onExecutionContextCreated(event.context));
    this._client.on('Runtime.executionContextDestroyed', event => this._onExecutionContextDestroyed(event.executionContextId));
    this._client.on('Runtime.executionContextsCleared', event => this._onExecutionContextsCleared());
  }

  async initialize() {
    const [,{frameTree}] = await Promise.all([
      this._client.send('Page.enable'),
      this._client.send('Page.getFrameTree'),
    ]);
    this._handleFrameTree(frameTree);
    await Promise.all([
      this._client.send('Log.enable', {}),
      this._client.send('Page.setInterceptFileChooserDialog', {enabled: true}),
      this._client.send('Page.setLifecycleEventsEnabled', { enabled: true }),
      this._client.send('Runtime.enable', {}).then(() => this._ensureIsolatedWorld(UTILITY_WORLD_NAME)),
      this._networkManager.initialize(),
    ]);
  }

  didClose() {
    // TODO: remove listeners.
  }

  networkManager(): NetworkManager {
    return this._networkManager;
  }

  _frameData(frame: frames.Frame): FrameData {
    return (frame as any)[frameDataSymbol];
  }

  async navigateFrame(frame: frames.Frame, url: string, options: frames.GotoOptions = {}): Promise<network.Response | null> {
    assertNoLegacyNavigationOptions(options);
    const {
      referer = this._networkManager.extraHTTPHeaders()['referer'],
      waitUntil = (['load'] as frames.LifecycleEvent[]),
      timeout = this._page._timeoutSettings.navigationTimeout(),
    } = options;

    const watcher = new frames.LifecycleWatcher(frame, waitUntil, timeout);
    let ensureNewDocumentNavigation = false;
    let error = await Promise.race([
      navigate(this._client, url, referer, this._frameData(frame).id),
      watcher.timeoutOrTerminationPromise,
    ]);
    if (!error) {
      error = await Promise.race([
        watcher.timeoutOrTerminationPromise,
        ensureNewDocumentNavigation ? watcher.newDocumentNavigationPromise : watcher.sameDocumentNavigationPromise,
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

  async waitForFrameNavigation(frame: frames.Frame, options: frames.NavigateOptions = {}): Promise<network.Response | null> {
    assertNoLegacyNavigationOptions(options);
    const {
      waitUntil = (['load'] as frames.LifecycleEvent[]),
      timeout = this._page._timeoutSettings.navigationTimeout(),
    } = options;
    const watcher = new frames.LifecycleWatcher(frame, waitUntil, timeout);
    const error = await Promise.race([
      watcher.timeoutOrTerminationPromise,
      watcher.sameDocumentNavigationPromise,
      watcher.newDocumentNavigationPromise,
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
    // We rely upon the fact that document.open() will reset frame lifecycle with "init"
    // lifecycle event. @see https://crrev.com/608658
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

  _onLifecycleEvent(event: Protocol.Page.lifecycleEventPayload) {
    const frame = this._frames.get(event.frameId);
    if (!frame)
      return;
    if (event.name === 'init') {
      frame._firedLifecycleEvents.clear();
      frame._onExpectedNewDocumentNavigation(event.loaderId);
    } else if (event.name === 'load') {
      frame._lifecycleEvent('load');
    } else if (event.name === 'DOMContentLoaded') {
      frame._lifecycleEvent('domcontentloaded');
    }
    this.emit(FrameManagerEvents.LifecycleEvent, frame);
  }

  _onFrameStoppedLoading(frameId: string) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    frame._lifecycleEvent('domcontentloaded');
    frame._lifecycleEvent('load');
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

  mainFrame(): frames.Frame {
    return this._mainFrame;
  }

  frames(): frames.Frame[] {
    return Array.from(this._frames.values());
  }

  frame(frameId: string): frames.Frame | null {
    return this._frames.get(frameId) || null;
  }

  _onFrameAttached(frameId: string, parentFrameId: string | null) {
    if (this._frames.has(frameId))
      return;
    assert(parentFrameId);
    const parentFrame = this._frames.get(parentFrameId);
    const frame = new frames.Frame(this._page, parentFrame);
    const data: FrameData = {
      id: frameId,
    };
    (frame as any)[frameDataSymbol] = data;
    this._frames.set(frameId, frame);
    this.emit(FrameManagerEvents.FrameAttached, frame);
    this._page.emit(Events.Page.FrameAttached, frame);
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
        frame = new frames.Frame(this._page, null);
        const data: FrameData = {
          id: framePayload.id,
        };
        (frame as any)[frameDataSymbol] = data;
      }
      this._frames.set(framePayload.id, frame);
      this._mainFrame = frame;
    }

    frame._onCommittedNewDocumentNavigation(framePayload.url, framePayload.name, framePayload.loaderId);

    this.emit(FrameManagerEvents.FrameNavigated, frame);
    this._page.emit(Events.Page.FrameNavigated, frame);
  }

  async _ensureIsolatedWorld(name: string) {
    if (this._isolatedWorlds.has(name))
      return;
    this._isolatedWorlds.add(name);
    await this._client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `//# sourceURL=${EVALUATION_SCRIPT_URL}`,
      worldName: name,
    });
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
    frame._onCommittedSameDocumentNavigation(url);
    this.emit(FrameManagerEvents.FrameNavigatedWithinDocument, frame);
    this.emit(FrameManagerEvents.FrameNavigated, frame);
    this._page.emit(Events.Page.FrameNavigated, frame);
  }

  _onFrameDetached(frameId: string) {
    const frame = this._frames.get(frameId);
    if (frame)
      this._removeFramesRecursively(frame);
  }

  _onExecutionContextCreated(contextPayload: Protocol.Runtime.ExecutionContextDescription) {
    const frameId = contextPayload.auxData ? contextPayload.auxData.frameId : null;
    const frame = this._frames.get(frameId) || null;
    if (contextPayload.auxData && contextPayload.auxData.type === 'isolated')
      this._isolatedWorlds.add(contextPayload.name);
    const context = new js.ExecutionContext(new ExecutionContextDelegate(this._client, contextPayload));
    if (frame)
      context._domWorld = new dom.DOMWorld(context, frame);
    if (frame) {
      if (contextPayload.auxData && !!contextPayload.auxData.isDefault)
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

  executionContextById(contextId: number): js.ExecutionContext {
    const context = this._contextIdToContext.get(contextId);
    assert(context, 'INTERNAL ERROR: missing context with id = ' + contextId);
    return context;
  }

  _removeFramesRecursively(frame: frames.Frame) {
    for (const child of frame.childFrames())
      this._removeFramesRecursively(child);
    frame._onDetached();
    this._frames.delete(this._frameData(frame).id);
    this.emit(FrameManagerEvents.FrameDetached, frame);
    this._page.emit(Events.Page.FrameDetached, frame);
  }

  async _onConsoleAPI(event: Protocol.Runtime.consoleAPICalledPayload) {
    if (event.executionContextId === 0) {
      // DevTools protocol stores the last 1000 console messages. These
      // messages are always reported even for removed execution contexts. In
      // this case, they are marked with executionContextId = 0 and are
      // reported upon enabling Runtime agent.
      //
      // Ignore these messages since:
      // - there's no execution context we can use to operate with message
      //   arguments
      // - these messages are reported before Playwright clients can subscribe
      //   to the 'console'
      //   page event.
      //
      // @see https://github.com/GoogleChrome/puppeteer/issues/3865
      return;
    }
    const context = this.executionContextById(event.executionContextId);
    const values = event.args.map(arg => context._createHandle(arg));
    this._page._addConsoleMessage(event.type, values, toConsoleMessageLocation(event.stackTrace));
  }

  async exposeBinding(name: string, bindingFunction: string) {
    await this._client.send('Runtime.addBinding', {name: name});
    await this._client.send('Page.addScriptToEvaluateOnNewDocument', {source: bindingFunction});
    await Promise.all(this.frames().map(frame => frame.evaluate(bindingFunction).catch(debugError)));
  }

  _onBindingCalled(event: Protocol.Runtime.bindingCalledPayload) {
    const context = this.executionContextById(event.executionContextId);
    this._page._onBindingCalled(event.payload, context);
  }

  _onDialog(event : Protocol.Page.javascriptDialogOpeningPayload) {
    this._page.emit(Events.Page.Dialog, new dialog.Dialog(
      event.type as dialog.DialogType,
      event.message,
      async (accept: boolean, promptText?: string) => {
        await this._client.send('Page.handleJavaScriptDialog', { accept, promptText });
      },
      event.defaultPrompt));
  }

  _handleException(exceptionDetails: Protocol.Runtime.ExceptionDetails) {
    this._page.emit(Events.Page.PageError, exceptionToError(exceptionDetails));
  }

  _onTargetCrashed() {
    this._page.emit('error', new Error('Page crashed!'));
  }

  _onLogEntryAdded(event: Protocol.Log.entryAddedPayload) {
    const {level, text, args, source, url, lineNumber} = event.entry;
    if (args)
      args.map(arg => releaseObject(this._client, arg));
    if (source !== 'worker')
      this._page.emit(Events.Page.Console, new ConsoleMessage(level, text, [], {url, lineNumber}));
  }

  async _onFileChooserOpened(event: Protocol.Page.fileChooserOpenedPayload) {
    const frame = this.frame(event.frameId);
    const utilityWorld = await frame._utilityDOMWorld();
    const handle = await this.adoptBackendNodeId(event.backendNodeId, utilityWorld);
    this._page._onFileChooserOpened(handle);
  }

  setExtraHTTPHeaders(extraHTTPHeaders: network.Headers): Promise<void> {
    return this._networkManager.setExtraHTTPHeaders(extraHTTPHeaders);
  }

  setUserAgent(userAgent: string): Promise<void> {
    return this._networkManager.setUserAgent(userAgent);
  }

  async setJavaScriptEnabled(enabled: boolean): Promise<void> {
    await this._client.send('Emulation.setScriptExecutionDisabled', { value: !enabled });
  }

  async setBypassCSP(enabled: boolean): Promise<void> {
    await this._client.send('Page.setBypassCSP', { enabled });
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
    const screenOrientation: Protocol.Emulation.ScreenOrientation = isLandscape ? { angle: 90, type: 'landscapePrimary' } : { angle: 0, type: 'portraitPrimary' };
    await Promise.all([
      this._client.send('Emulation.setDeviceMetricsOverride', { mobile: isMobile, width, height, deviceScaleFactor, screenOrientation }),
      this._client.send('Emulation.setTouchEmulationEnabled', {
        enabled: hasTouch
      })
    ]);
  }

  async setEmulateMedia(mediaType: input.MediaType | null, mediaColorScheme: input.MediaColorScheme | null): Promise<void> {
    const features = mediaColorScheme ? [{ name: 'prefers-color-scheme', value: mediaColorScheme }] : [];
    await this._client.send('Emulation.setEmulatedMedia', { media: mediaType || '', features });
  }

  setCacheEnabled(enabled: boolean): Promise<void> {
    return this._networkManager.setCacheEnabled(enabled);
  }

  async reload(options?: frames.NavigateOptions): Promise<network.Response | null> {
    const [response] = await Promise.all([
      this._page.waitForNavigation(options),
      this._client.send('Page.reload')
    ]);
    return response;
  }

  private async _go(delta: number, options?: frames.NavigateOptions): Promise<network.Response | null> {
    const history = await this._client.send('Page.getNavigationHistory');
    const entry = history.entries[history.currentIndex + delta];
    if (!entry)
      return null;
    const [response] = await Promise.all([
      this._page.waitForNavigation(options),
      this._client.send('Page.navigateToHistoryEntry', {entryId: entry.id}),
    ]);
    return response;
  }

  goBack(options?: frames.NavigateOptions): Promise<network.Response | null> {
    return this._go(-1, options);
  }

  goForward(options?: frames.NavigateOptions): Promise<network.Response | null> {
    return this._go(+1, options);
  }

  async evaluateOnNewDocument(source: string): Promise<void> {
    await this._client.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }

  async closePage(runBeforeUnload: boolean): Promise<void> {
    if (runBeforeUnload)
      await this._client.send('Page.close');
    else
      await (this._page.browser() as Browser)._closePage(this._page);
  }

  async getBoundingBoxForScreenshot(handle: dom.ElementHandle<Node>): Promise<types.Rect | null> {
    const rect = await handle.boundingBox();
    if (!rect)
      return rect;
    const { layoutViewport: { pageX, pageY } } = await this._client.send('Page.getLayoutMetrics');
    rect.x += pageX;
    rect.y += pageY;
    return rect;
  }

  canScreenshotOutsideViewport(): boolean {
    return false;
  }

  async setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void> {
    await this._client.send('Emulation.setDefaultBackgroundColorOverride', { color });
  }

  async takeScreenshot(format: 'png' | 'jpeg', options: types.ScreenshotOptions): Promise<Buffer> {
    const clip = options.clip ? { ...options.clip, scale: 1 } : undefined;
    const result = await this._client.send('Page.captureScreenshot', { format, quality: options.quality, clip });
    return Buffer.from(result.data, 'base64');
  }

  async resetViewport(): Promise<void> {
    await this._client.send('Emulation.setDeviceMetricsOverride', { mobile: false, width: 0, height: 0, deviceScaleFactor: 0 });
  }

  async getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    const nodeInfo = await this._client.send('DOM.describeNode', {
      objectId: toRemoteObject(handle).objectId
    });
    if (typeof nodeInfo.node.frameId !== 'string')
      return null;
    return this.frame(nodeInfo.node.frameId);
  }

  isElementHandle(remoteObject: any): boolean {
    return (remoteObject as Protocol.Runtime.RemoteObject).subtype === 'node';
  }

  async getBoundingBox(handle: dom.ElementHandle): Promise<types.Rect | null> {
    const result = await this._client.send('DOM.getBoxModel', {
      objectId: toRemoteObject(handle).objectId
    }).catch(debugError);
    if (!result)
      return null;
    const quad = result.model.border;
    const x = Math.min(quad[0], quad[2], quad[4], quad[6]);
    const y = Math.min(quad[1], quad[3], quad[5], quad[7]);
    const width = Math.max(quad[0], quad[2], quad[4], quad[6]) - x;
    const height = Math.max(quad[1], quad[3], quad[5], quad[7]) - y;
    return {x, y, width, height};
  }

  async getContentQuads(handle: dom.ElementHandle): Promise<types.Quad[] | null> {
    const result = await this._client.send('DOM.getContentQuads', {
      objectId: toRemoteObject(handle).objectId
    }).catch(debugError);
    if (!result)
      return null;
    return result.quads.map(quad => [
      { x: quad[0], y: quad[1] },
      { x: quad[2], y: quad[3] },
      { x: quad[4], y: quad[5] },
      { x: quad[6], y: quad[7] }
    ]);
  }

  async layoutViewport(): Promise<{ width: number, height: number }> {
    const layoutMetrics = await this._client.send('Page.getLayoutMetrics');
    return { width: layoutMetrics.layoutViewport.clientWidth, height: layoutMetrics.layoutViewport.clientHeight };
  }

  async setInputFiles(handle: dom.ElementHandle, files: input.FilePayload[]): Promise<void> {
    await handle.evaluate(input.setFileInputFunction, files);
  }

  async adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.DOMWorld): Promise<dom.ElementHandle<T>> {
    const nodeInfo = await this._client.send('DOM.describeNode', {
      objectId: toRemoteObject(handle).objectId,
    });
    return this.adoptBackendNodeId(nodeInfo.node.backendNodeId, to) as Promise<dom.ElementHandle<T>>;
  }

  async adoptBackendNodeId(backendNodeId: Protocol.DOM.BackendNodeId, to: dom.DOMWorld): Promise<dom.ElementHandle> {
    const result = await this._client.send('DOM.resolveNode', {
      backendNodeId,
      executionContextId: (to.context._delegate as ExecutionContextDelegate)._contextId,
    }).catch(debugError);
    if (!result)
      throw new Error('Unable to adopt element handle from a different document');
    return to.context._createHandle(result.object).asElement()!;
  }
}

function assertNoLegacyNavigationOptions(options: frames.NavigateOptions) {
  assert((options as any)['networkIdleTimeout'] === undefined, 'ERROR: networkIdleTimeout option is no longer supported.');
  assert((options as any)['networkIdleInflight'] === undefined, 'ERROR: networkIdleInflight option is no longer supported.');
  assert((options as any).waitUntil !== 'networkidle', 'ERROR: "networkidle" option is no longer supported. Use "networkidle2" instead');
}

function toRemoteObject(handle: dom.ElementHandle): Protocol.Runtime.RemoteObject {
  return handle._remoteObject as Protocol.Runtime.RemoteObject;
}
