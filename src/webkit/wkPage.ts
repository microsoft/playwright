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

import * as frames from '../frames';
import { debugError, helper, RegisteredListener } from '../helper';
import * as dom from '../dom';
import * as network from '../network';
import { WKTargetSession } from './wkConnection';
import { Events } from '../events';
import { WKExecutionContext, EVALUATION_SCRIPT_URL } from './wkExecutionContext';
import { WKNetworkManager } from './wkNetworkManager';
import { Page, PageDelegate } from '../page';
import { Protocol } from './protocol';
import * as dialog from '../dialog';
import { WKBrowser } from './wkBrowser';
import { BrowserContext } from '../browserContext';
import { RawMouseImpl, RawKeyboardImpl } from './wkInput';
import * as input from '../input';
import * as types from '../types';
import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const UTILITY_WORLD_NAME = '__playwright_utility_world__';
const BINDING_CALL_MESSAGE = '__playwright_binding_call__';
const JSON_CALL_MESSAGE = '__playwright_json_call__';
const JSON_SAVE_SCRIPT = `console.debug('${JSON_CALL_MESSAGE}', JSON.stringify.bind(JSON))`;

export class WKPage implements PageDelegate {
  readonly rawMouse: RawMouseImpl;
  readonly rawKeyboard: RawKeyboardImpl;
  _session: WKTargetSession;
  readonly _page: Page;
  private _browser: WKBrowser;
  private readonly _networkManager: WKNetworkManager;
  private readonly _contextIdToContext: Map<number, dom.FrameExecutionContext>;
  private _isolatedWorlds: Set<string>;
  private _sessionListeners: RegisteredListener[] = [];
  private readonly _bootstrapScripts: string[] = [ JSON_SAVE_SCRIPT ];

  constructor(browser: WKBrowser, browserContext: BrowserContext) {
    this._browser = browser;
    this.rawKeyboard = new RawKeyboardImpl();
    this.rawMouse = new RawMouseImpl();
    this._contextIdToContext = new Map();
    this._isolatedWorlds = new Set();
    this._page = new Page(this, browserContext);
    this._networkManager = new WKNetworkManager(this._page);
  }

  setSession(session: WKTargetSession) {
    helper.removeEventListeners(this._sessionListeners);
    this.disconnectFromTarget();
    this._session = session;
    this.rawKeyboard.setSession(session);
    this.rawMouse.setSession(session);
    this._addSessionListeners();
    this._networkManager.setSession(session);
    this._isolatedWorlds = new Set();
    // New bootstrap scripts may have been added during provisional load, push them
    // again to be on the safe side.
    if (this._bootstrapScripts.length)
      this._setBootstrapScripts(session).catch(e => debugError(e));
  }

  // This method is called for provisional targets as well. The session passed as the parameter
  // may be different from the current session and may be destroyed without becoming current.
  async _initializeSession(session: WKTargetSession) {
    const promises : Promise<any>[] = [
      // Page agent must be enabled before Runtime.
      session.send('Page.enable'),
      session.send('Page.getResourceTree').then(({frameTree}) => this._handleFrameTree(frameTree)),
      // Resource tree should be received before first execution context.
      session.send('Runtime.enable').then(() => this._ensureIsolatedWorld(UTILITY_WORLD_NAME)),
      session.send('Console.enable'),
      session.send('Page.setInterceptFileChooserDialog', { enabled: true }),
      this._networkManager.initializeSession(session, this._page._state.interceptNetwork, this._page._state.offlineMode, this._page._state.credentials),
    ];
    if (!session.isProvisional()) {
      // FIXME: move dialog agent to web process.
      // Dialog agent resides in the UI process and should not be re-enabled on navigation.
      promises.push(session.send('Dialog.enable'));
    }
    const contextOptions = this._page.browserContext()._options;
    if (contextOptions.userAgent)
      promises.push(session.send('Page.overrideUserAgent', { value: contextOptions.userAgent }));
    if (this._page._state.mediaType || this._page._state.colorScheme)
      promises.push(this._setEmulateMedia(session, this._page._state.mediaType, this._page._state.colorScheme));
    if (contextOptions.javaScriptEnabled === false)
      promises.push(session.send('Emulation.setJavaScriptEnabled', { enabled: false }));
    if (session.isProvisional())
      promises.push(this._setBootstrapScripts(session));
    if (contextOptions.bypassCSP)
      promises.push(session.send('Page.setBypassCSP', { enabled: true }));
    if (this._page._state.extraHTTPHeaders !== null)
      promises.push(this._setExtraHTTPHeaders(session, this._page._state.extraHTTPHeaders));
    if (this._page._state.viewport)
      promises.push(WKPage._setViewport(session, this._page._state.viewport));
    await Promise.all(promises);
    await this._page.evaluate(JSON_SAVE_SCRIPT);
  }

  didClose() {
    helper.removeEventListeners(this._sessionListeners);
    this._networkManager.dispose();
    this.disconnectFromTarget();
    this._page._didClose();
  }

  _addSessionListeners() {
    this._sessionListeners = [
      helper.addEventListener(this._session, 'Page.frameNavigated', event => this._onFrameNavigated(event.frame, false)),
      helper.addEventListener(this._session, 'Page.navigatedWithinDocument', event => this._onFrameNavigatedWithinDocument(event.frameId, event.url)),
      helper.addEventListener(this._session, 'Page.frameAttached', event => this._onFrameAttached(event.frameId, event.parentFrameId)),
      helper.addEventListener(this._session, 'Page.frameDetached', event => this._onFrameDetached(event.frameId)),
      helper.addEventListener(this._session, 'Page.frameStoppedLoading', event => this._onFrameStoppedLoading(event.frameId)),
      helper.addEventListener(this._session, 'Page.loadEventFired', event => this._onLifecycleEvent(event.frameId, 'load')),
      helper.addEventListener(this._session, 'Page.domContentEventFired', event => this._onLifecycleEvent(event.frameId, 'domcontentloaded')),
      helper.addEventListener(this._session, 'Runtime.executionContextCreated', event => this._onExecutionContextCreated(event.context)),
      helper.addEventListener(this._session, 'Console.messageAdded', event => this._onConsoleMessage(event)),
      helper.addEventListener(this._session, 'Dialog.javascriptDialogOpening', event => this._onDialog(event)),
      helper.addEventListener(this._session, 'Page.fileChooserOpened', event => this._onFileChooserOpened(event))
    ];
  }

  disconnectFromTarget() {
    for (const context of this._contextIdToContext.values()) {
      (context._delegate as WKExecutionContext)._dispose();
      context.frame._contextDestroyed(context);
    }
    this._contextIdToContext.clear();
  }

  _onFrameStoppedLoading(frameId: string) {
    this._page._frameManager.frameStoppedLoading(frameId);
  }

  _onLifecycleEvent(frameId: string, event: frames.LifecycleEvent) {
    this._page._frameManager.frameLifecycleEvent(frameId, event);
  }

  _handleFrameTree(frameTree: Protocol.Page.FrameResourceTree) {
    this._onFrameAttached(frameTree.frame.id, frameTree.frame.parentId);
    this._onFrameNavigated(frameTree.frame, true);
    if (!frameTree.childFrames)
      return;

    for (const child of frameTree.childFrames)
      this._handleFrameTree(child);
  }

  _onFrameAttached(frameId: string, parentFrameId: string | null) {
    this._page._frameManager.frameAttached(frameId, parentFrameId);
  }

  _onFrameNavigated(framePayload: Protocol.Page.Frame, initial: boolean) {
    const frame = this._page._frameManager.frame(framePayload.id);
    for (const [contextId, context] of this._contextIdToContext) {
      if (context.frame === frame) {
        (context._delegate as WKExecutionContext)._dispose();
        this._contextIdToContext.delete(contextId);
        frame._contextDestroyed(context);
      }
    }
    // Append session id to avoid cross-process loaderId clash.
    const documentId = this._session._sessionId + '::' + framePayload.loaderId;
    this._page._frameManager.frameCommittedNewDocumentNavigation(framePayload.id, framePayload.url, framePayload.name || '', documentId, initial);
  }

  _onFrameNavigatedWithinDocument(frameId: string, url: string) {
    this._page._frameManager.frameCommittedSameDocumentNavigation(frameId, url);
  }

  _onFrameDetached(frameId: string) {
    this._page._frameManager.frameDetached(frameId);
  }

  _onExecutionContextCreated(contextPayload : Protocol.Runtime.ExecutionContextDescription) {
    if (this._contextIdToContext.has(contextPayload.id))
      return;
    const frame = this._page._frameManager.frame(contextPayload.frameId);
    if (!frame)
      return;
    const delegate = new WKExecutionContext(this._session, contextPayload);
    const context = new dom.FrameExecutionContext(delegate, frame);
    if (contextPayload.isPageContext)
      frame._contextCreated('main', context);
    else if (contextPayload.name === UTILITY_WORLD_NAME)
      frame._contextCreated('utility', context);
    this._contextIdToContext.set(contextPayload.id, context);
  }

  async navigateFrame(frame: frames.Frame, url: string, referrer: string | undefined): Promise<frames.GotoResult> {
    await this._session.send('Page.navigate', { url, frameId: frame._id, referrer });
    return {};  // We cannot get loaderId of cross-process navigation in advance.
  }

  needsLifecycleResetOnSetContent(): boolean {
    return true;
  }

  async _onConsoleMessage(event: Protocol.Console.messageAddedPayload) {
    const { type, level, text, parameters, url, line: lineNumber, column: columnNumber, source } = event.message;
    if (level === 'debug' && parameters && parameters[0].value === BINDING_CALL_MESSAGE) {
      const parsedObjectId = JSON.parse(parameters[1].objectId);
      const context = this._contextIdToContext.get(parsedObjectId.injectedScriptId);
      this._page._onBindingCalled(parameters[2].value, context);
      return;
    }
    if (level === 'debug' && parameters && parameters[0].value === JSON_CALL_MESSAGE) {
      const parsedObjectId = JSON.parse(parameters[1].objectId);
      const context = this._contextIdToContext.get(parsedObjectId.injectedScriptId);
      (context._delegate as WKExecutionContext)._jsonStringifyObjectId = parameters[1].objectId;
      return;
    }
    if (level === 'error' && source === 'javascript') {
      const error = new Error(text);
      error.stack = '';
      this._page.emit(Events.Page.PageError, error);
      return;
    }

    let derivedType: string = type;
    if (type === 'log')
      derivedType = level;
    else if (type === 'timing')
      derivedType = 'timeEnd';

    const mainFrameContext = await this._page.mainFrame()._mainContext();
    const handles = (parameters || []).map(p => {
      let context: dom.FrameExecutionContext | null = null;
      if (p.objectId) {
        const objectId = JSON.parse(p.objectId);
        context = this._contextIdToContext.get(objectId.injectedScriptId);
      } else {
        context = mainFrameContext;
      }
      return context._createHandle(p);
    });
    this._page._addConsoleMessage(derivedType, handles, { url, lineNumber: lineNumber - 1, columnNumber: columnNumber - 1 }, handles.length ? undefined : text);
  }

  _onDialog(event: Protocol.Dialog.javascriptDialogOpeningPayload) {
    this._page.emit(Events.Page.Dialog, new dialog.Dialog(
      event.type as dialog.DialogType,
      event.message,
      async (accept: boolean, promptText?: string) => {
        await this._session.send('Dialog.handleJavaScriptDialog', { accept, promptText });
      },
      event.defaultPrompt));
  }

  async _onFileChooserOpened(event: {frameId: Protocol.Network.FrameId, element: Protocol.Runtime.RemoteObject}) {
    const context = await this._page._frameManager.frame(event.frameId)._mainContext();
    const handle = context._createHandle(event.element).asElement()!;
    this._page._onFileChooserOpened(handle);
  }

  async _ensureIsolatedWorld(name: string) {
    if (this._isolatedWorlds.has(name))
      return;
    this._isolatedWorlds.add(name);
    await this._session.send('Page.createIsolatedWorld', {
      name,
      source: `//# sourceURL=${EVALUATION_SCRIPT_URL}`
    });
  }

  private async _setExtraHTTPHeaders(session: WKTargetSession, headers: network.Headers): Promise<void> {
    await session.send('Network.setExtraHTTPHeaders', { headers });
  }

  private async _setEmulateMedia(session: WKTargetSession, mediaType: input.MediaType | null, mediaColorScheme: input.ColorScheme | null): Promise<void> {
    const promises = [];
    promises.push(session.send('Page.setEmulatedMedia', { media: mediaType || '' }));
    if (mediaColorScheme !== null) {
      let appearance: any = '';
      switch (mediaColorScheme) {
        case 'light': appearance = 'Light'; break;
        case 'dark': appearance = 'Dark'; break;
      }
      promises.push(session.send('Page.setForcedAppearance', { appearance }));
    }
    await Promise.all(promises);
  }

  async setExtraHTTPHeaders(headers: network.Headers): Promise<void> {
    await this._setExtraHTTPHeaders(this._session, headers);
  }

  async setEmulateMedia(mediaType: input.MediaType | null, mediaColorScheme: input.ColorScheme | null): Promise<void> {
    await this._setEmulateMedia(this._session, mediaType, mediaColorScheme);
  }

  async setViewport(viewport: types.Viewport): Promise<void> {
    return WKPage._setViewport(this._session, viewport);
  }

  private static async _setViewport(session: WKTargetSession, viewport: types.Viewport): Promise<void> {
    if (viewport.isMobile || viewport.isLandscape || viewport.hasTouch)
      throw new Error('Not implemented');
    const width = viewport.width;
    const height = viewport.height;
    await session.send('Emulation.setDeviceMetricsOverride', { width, height, fixedLayout: false, deviceScaleFactor: viewport.deviceScaleFactor || 1 });
  }

  setCacheEnabled(enabled: boolean): Promise<void> {
    return this._networkManager.setCacheEnabled(enabled);
  }

  setRequestInterception(enabled: boolean): Promise<void> {
    return this._networkManager.setRequestInterception(enabled);
  }

  async setOfflineMode(value: boolean) {
    await this._networkManager.setOfflineMode(value);
  }

  async authenticate(credentials: types.Credentials | null) {
    await this._networkManager.authenticate(credentials);
  }

  async reload(): Promise<void> {
    await this._session.send('Page.reload');
  }

  goBack(): Promise<boolean> {
    return this._session.send('Page.goBack').then(() => true).catch(error => {
      if (error instanceof Error && error.message.includes(`Protocol error (Page.goBack): Failed to go`))
        return false;
      throw error;
    });
  }

  goForward(): Promise<boolean> {
    return this._session.send('Page.goForward').then(() => true).catch(error => {
      if (error instanceof Error && error.message.includes(`Protocol error (Page.goForward): Failed to go`))
        return false;
      throw error;
    });
  }

  async exposeBinding(name: string, bindingFunction: string): Promise<void> {
    const script = `self.${name} = (param) => console.debug('${BINDING_CALL_MESSAGE}', {}, param); ${bindingFunction}`;
    this._bootstrapScripts.unshift(script);
    await this._setBootstrapScripts(this._session);
    await Promise.all(this._page.frames().map(frame => frame.evaluate(script).catch(debugError)));
  }

  async evaluateOnNewDocument(script: string): Promise<void> {
    this._bootstrapScripts.push(script);
    await this._setBootstrapScripts(this._session);
  }

  private async _setBootstrapScripts(session: WKTargetSession) {
    const source = this._bootstrapScripts.join(';');
    await session.send('Page.setBootstrapScript', { source });
  }

  async closePage(runBeforeUnload: boolean): Promise<void> {
    this._browser._closePage(this._session._sessionId, runBeforeUnload);
  }

  getBoundingBoxForScreenshot(handle: dom.ElementHandle<Node>): Promise<types.Rect | null> {
    return handle.boundingBox();
  }

  canScreenshotOutsideViewport(): boolean {
    return false;
  }

  async setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void> {
    // TODO: line below crashes, sort it out.
    this._session.send('Page.setDefaultBackgroundColorOverride', { color });
  }

  async takeScreenshot(format: string, options: types.ScreenshotOptions, viewport: types.Viewport): Promise<Buffer> {
    const rect = options.clip || { x: 0, y: 0, width: viewport.width, height: viewport.height };
    const result = await this._session.send('Page.snapshotRect', { ...rect, coordinateSystem: options.fullPage ? 'Page' : 'Viewport' });
    const prefix = 'data:image/png;base64,';
    let buffer = Buffer.from(result.dataURL.substr(prefix.length), 'base64');
    if (format === 'jpeg')
      buffer = jpeg.encode(PNG.sync.read(buffer)).data;
    return buffer;
  }

  async resetViewport(oldSize: types.Size): Promise<void> {
    await this._session.send('Emulation.setDeviceMetricsOverride', { ...oldSize, fixedLayout: false, deviceScaleFactor: 0 });
  }

  async getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    const nodeInfo = await this._session.send('DOM.describeNode', {
      objectId: toRemoteObject(handle).objectId
    });
    if (!nodeInfo.contentFrameId)
      return null;
    return this._page._frameManager.frame(nodeInfo.contentFrameId);
  }

  async getOwnerFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    const remoteObject = toRemoteObject(handle);
    if (!remoteObject.objectId)
      return null;
    const nodeInfo = await this._session.send('DOM.describeNode', {
      objectId: remoteObject.objectId
    });
    if (!nodeInfo.ownerFrameId)
      return null;
    return this._page._frameManager.frame(nodeInfo.ownerFrameId);
  }

  isElementHandle(remoteObject: any): boolean {
    return (remoteObject as Protocol.Runtime.RemoteObject).subtype === 'node';
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
    const result = await this._session.send('DOM.getContentQuads', {
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
    return this._page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  }

  async setInputFiles(handle: dom.ElementHandle, files: input.FilePayload[]): Promise<void> {
    const objectId = toRemoteObject(handle).objectId;
    await this._session.send('DOM.setInputFiles', { objectId, files });
  }

  async adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>> {
    const result = await this._session.send('DOM.resolveNode', {
      objectId: toRemoteObject(handle).objectId,
      executionContextId: (to._delegate as WKExecutionContext)._contextId
    }).catch(debugError);
    if (!result || result.object.subtype === 'null')
      throw new Error('Unable to adopt element handle from a different document');
    return to._createHandle(result.object) as dom.ElementHandle<T>;
  }
}

function toRemoteObject(handle: dom.ElementHandle): Protocol.Runtime.RemoteObject {
  return handle._remoteObject as Protocol.Runtime.RemoteObject;
}
