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

import * as dom from '../dom';
import * as js from '../javascript';
import * as frames from '../frames';
import { debugError, helper, RegisteredListener, assert } from '../helper';
import * as network from '../network';
import { CRSession, CRConnection } from './crConnection';
import { EVALUATION_SCRIPT_URL, CRExecutionContext } from './crExecutionContext';
import { CRNetworkManager } from './crNetworkManager';
import { Page, Worker, PageBinding } from '../page';
import { Protocol } from './protocol';
import { Events } from '../events';
import { toConsoleMessageLocation, exceptionToError, releaseObject } from './crProtocolHelper';
import * as dialog from '../dialog';
import { PageDelegate } from '../page';
import { RawMouseImpl, RawKeyboardImpl } from './crInput';
import { getAccessibilityTree } from './crAccessibility';
import { CRCoverage } from './crCoverage';
import { CRPDF } from './crPdf';
import { CRBrowser, CRBrowserContext } from './crBrowser';
import * as types from '../types';
import { ConsoleMessage } from '../console';
import * as platform from '../platform';
import { CRTarget } from './crTarget';

const UTILITY_WORLD_NAME = '__playwright_utility_world__';

export class CRPage implements PageDelegate {
  _client: CRSession;
  private readonly _page: Page;
  readonly _networkManager: CRNetworkManager;
  private _contextIdToContext = new Map<number, dom.FrameExecutionContext>();
  private _eventListeners: RegisteredListener[] = [];
  rawMouse: RawMouseImpl;
  rawKeyboard: RawKeyboardImpl;
  private _browser: CRBrowser;
  private _pdf: CRPDF;
  private _coverage: CRCoverage;
  private readonly _browserContext: CRBrowserContext;

  constructor(client: CRSession, browser: CRBrowser, browserContext: CRBrowserContext) {
    this._client = client;
    this._browser = browser;
    this.rawKeyboard = new RawKeyboardImpl(client);
    this.rawMouse = new RawMouseImpl(client);
    this._pdf = new CRPDF(client);
    this._coverage = new CRCoverage(client);
    this._browserContext = browserContext;
    this._page = new Page(this, browserContext);
    this._networkManager = new CRNetworkManager(client, this._page);
  }

  async initialize() {
    const promises: Promise<any>[] = [
      this._client.send('Page.enable'),
      this._client.send('Page.getFrameTree').then(({frameTree}) => {
        this._handleFrameTree(frameTree);
        this._eventListeners = [
          helper.addEventListener(this._client, 'Inspector.targetCrashed', event => this._onTargetCrashed()),
          helper.addEventListener(this._client, 'Log.entryAdded', event => this._onLogEntryAdded(event)),
          helper.addEventListener(this._client, 'Page.fileChooserOpened', event => this._onFileChooserOpened(event)),
          helper.addEventListener(this._client, 'Page.frameAttached', event => this._onFrameAttached(event.frameId, event.parentFrameId)),
          helper.addEventListener(this._client, 'Page.frameDetached', event => this._onFrameDetached(event.frameId)),
          helper.addEventListener(this._client, 'Page.frameNavigated', event => this._onFrameNavigated(event.frame, false)),
          helper.addEventListener(this._client, 'Page.frameRequestedNavigation', event => this._onFrameRequestedNavigation(event)),
          helper.addEventListener(this._client, 'Page.frameStoppedLoading', event => this._onFrameStoppedLoading(event.frameId)),
          helper.addEventListener(this._client, 'Page.javascriptDialogOpening', event => this._onDialog(event)),
          helper.addEventListener(this._client, 'Page.lifecycleEvent', event => this._onLifecycleEvent(event)),
          helper.addEventListener(this._client, 'Page.navigatedWithinDocument', event => this._onFrameNavigatedWithinDocument(event.frameId, event.url)),
          helper.addEventListener(this._client, 'Runtime.bindingCalled', event => this._onBindingCalled(event)),
          helper.addEventListener(this._client, 'Runtime.consoleAPICalled', event => this._onConsoleAPI(event)),
          helper.addEventListener(this._client, 'Runtime.exceptionThrown', exception => this._handleException(exception.exceptionDetails)),
          helper.addEventListener(this._client, 'Runtime.executionContextCreated', event => this._onExecutionContextCreated(event.context)),
          helper.addEventListener(this._client, 'Runtime.executionContextDestroyed', event => this._onExecutionContextDestroyed(event.executionContextId)),
          helper.addEventListener(this._client, 'Runtime.executionContextsCleared', event => this._onExecutionContextsCleared()),
          helper.addEventListener(this._client, 'Target.attachedToTarget', event => this._onAttachedToTarget(event)),
          helper.addEventListener(this._client, 'Target.detachedFromTarget', event => this._onDetachedFromTarget(event)),
        ];
        this._page.frames().map(frame => this._client.send('Page.createIsolatedWorld', {
          frameId: frame._id,
          grantUniveralAccess: true,
          worldName: UTILITY_WORLD_NAME,
        }).catch(debugError)); // frames might be removed before we send this.
      }),
      this._client.send('Log.enable', {}),
      this._client.send('Page.setLifecycleEventsEnabled', { enabled: true }),
      this._client.send('Runtime.enable', {}),
      this._client.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `//# sourceURL=${EVALUATION_SCRIPT_URL}`,
        worldName: UTILITY_WORLD_NAME,
      }),
      this._networkManager.initialize(),
      this._client.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }),
      this._client.send('Emulation.setFocusEmulationEnabled', { enabled: true }),
    ];
    const options = this._browserContext._options;
    if (options.bypassCSP)
      promises.push(this._client.send('Page.setBypassCSP', { enabled: true }));
    if (options.ignoreHTTPSErrors)
      promises.push(this._client.send('Security.setIgnoreCertificateErrors', { ignore: true }));
    if (options.viewport)
      promises.push(this._updateViewport(true /* updateTouch */));
    if (options.javaScriptEnabled === false)
      promises.push(this._client.send('Emulation.setScriptExecutionDisabled', { value: true }));
    if (options.userAgent || options.locale)
      promises.push(this._client.send('Emulation.setUserAgentOverride', { userAgent: options.userAgent || '', acceptLanguage: options.locale }));
    if (options.locale)
      promises.push(this._client.send('Emulation.setLocaleOverride', { locale: options.locale }));
    if (options.timezoneId)
      promises.push(emulateTimezone(this._client, options.timezoneId));
    if (options.geolocation)
      promises.push(this._client.send('Emulation.setGeolocationOverride', options.geolocation));
    promises.push(this.updateExtraHTTPHeaders());
    if (options.offline)
      promises.push(this._networkManager.setOffline(options.offline));
    if (options.httpCredentials)
      promises.push(this._networkManager.authenticate(options.httpCredentials));
    for (const binding of this._browserContext._pageBindings.values())
      promises.push(this._initBinding(binding));
    for (const source of this._browserContext._evaluateOnNewDocumentSources)
      promises.push(this.evaluateOnNewDocument(source));
    promises.push(this._client.send('Runtime.runIfWaitingForDebugger'));
    await Promise.all(promises);
  }

  didClose() {
    helper.removeEventListeners(this._eventListeners);
    this._networkManager.dispose();
    this._page._didClose();
  }

  async navigateFrame(frame: frames.Frame, url: string, referrer: string | undefined): Promise<frames.GotoResult> {
    const response = await this._client.send('Page.navigate', { url, referrer, frameId: frame._id });
    if (response.errorText)
      throw new Error(`${response.errorText} at ${url}`);
    return { newDocumentId: response.loaderId };
  }

  _onLifecycleEvent(event: Protocol.Page.lifecycleEventPayload) {
    if (event.name === 'load')
      this._page._frameManager.frameLifecycleEvent(event.frameId, 'load');
    else if (event.name === 'DOMContentLoaded')
      this._page._frameManager.frameLifecycleEvent(event.frameId, 'domcontentloaded');
  }

  _onFrameStoppedLoading(frameId: string) {
    this._page._frameManager.frameStoppedLoading(frameId);
  }

  _handleFrameTree(frameTree: Protocol.Page.FrameTree) {
    this._onFrameAttached(frameTree.frame.id, frameTree.frame.parentId || null);
    this._onFrameNavigated(frameTree.frame, true);
    if (!frameTree.childFrames)
      return;

    for (const child of frameTree.childFrames)
      this._handleFrameTree(child);
  }

  page(): Page {
    return this._page;
  }

  _onFrameAttached(frameId: string, parentFrameId: string | null) {
    this._page._frameManager.frameAttached(frameId, parentFrameId);
  }

  _onFrameNavigated(framePayload: Protocol.Page.Frame, initial: boolean) {
    this._page._frameManager.frameCommittedNewDocumentNavigation(framePayload.id, framePayload.url, framePayload.name || '', framePayload.loaderId, initial);
  }

  _onFrameRequestedNavigation(payload: Protocol.Page.frameRequestedNavigationPayload) {
    this._page._frameManager.frameRequestedNavigation(payload.frameId);
  }

  _onFrameNavigatedWithinDocument(frameId: string, url: string) {
    this._page._frameManager.frameCommittedSameDocumentNavigation(frameId, url);
  }

  _onFrameDetached(frameId: string) {
    this._page._frameManager.frameDetached(frameId);
  }

  _onExecutionContextCreated(contextPayload: Protocol.Runtime.ExecutionContextDescription) {
    const frame = contextPayload.auxData ? this._page._frameManager.frame(contextPayload.auxData.frameId) : null;
    if (!frame)
      return;
    const delegate = new CRExecutionContext(this._client, contextPayload);
    const context = new dom.FrameExecutionContext(delegate, frame);
    if (contextPayload.auxData && !!contextPayload.auxData.isDefault)
      frame._contextCreated('main', context);
    else if (contextPayload.name === UTILITY_WORLD_NAME)
      frame._contextCreated('utility', context);
    this._contextIdToContext.set(contextPayload.id, context);
  }

  _onExecutionContextDestroyed(executionContextId: number) {
    const context = this._contextIdToContext.get(executionContextId);
    if (!context)
      return;
    this._contextIdToContext.delete(executionContextId);
    context.frame._contextDestroyed(context);
  }

  _onExecutionContextsCleared() {
    for (const contextId of Array.from(this._contextIdToContext.keys()))
      this._onExecutionContextDestroyed(contextId);
  }

  _onAttachedToTarget(event: Protocol.Target.attachedToTargetPayload) {
    const session = CRConnection.fromSession(this._client).session(event.sessionId)!;
    if (event.targetInfo.type !== 'worker') {
      // Ideally, detaching should resume any target, but there is a bug in the backend.
      session.send('Runtime.runIfWaitingForDebugger').catch(debugError).then(() => {
        this._client.send('Target.detachFromTarget', { sessionId: event.sessionId }).catch(debugError);
      });
      return;
    }
    const url = event.targetInfo.url;
    const worker = new Worker(url);
    this._page._addWorker(event.sessionId, worker);
    session.once('Runtime.executionContextCreated', async event => {
      worker._createExecutionContext(new CRExecutionContext(session, event.context));
    });
    Promise.all([
      session.send('Runtime.enable'),
      session.send('Network.enable'),
      session.send('Runtime.runIfWaitingForDebugger'),
    ]).catch(debugError);  // This might fail if the target is closed before we initialize.
    session.on('Runtime.consoleAPICalled', event => {
      const args = event.args.map(o => worker._existingExecutionContext!._createHandle(o));
      this._page._addConsoleMessage(event.type, args, toConsoleMessageLocation(event.stackTrace));
    });
    session.on('Runtime.exceptionThrown', exception => this._page.emit(Events.Page.PageError, exceptionToError(exception.exceptionDetails)));
    this._networkManager.instrumentNetworkEvents(session);
  }

  _onDetachedFromTarget(event: Protocol.Target.detachedFromTargetPayload) {
    this._page._removeWorker(event.sessionId);
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
    const context = this._contextIdToContext.get(event.executionContextId)!;
    const values = event.args.map(arg => context._createHandle(arg));
    this._page._addConsoleMessage(event.type, values, toConsoleMessageLocation(event.stackTrace));
  }

  async exposeBinding(binding: PageBinding) {
    await this._initBinding(binding);
    await Promise.all(this._page.frames().map(frame => frame.evaluate(binding.source).catch(debugError)));
  }

  async _initBinding(binding: PageBinding) {
    await Promise.all([
      this._client.send('Runtime.addBinding', { name: binding.name }),
      this._client.send('Page.addScriptToEvaluateOnNewDocument', { source: binding.source })
    ]);
  }

  _onBindingCalled(event: Protocol.Runtime.bindingCalledPayload) {
    const context = this._contextIdToContext.get(event.executionContextId)!;
    this._page._onBindingCalled(event.payload, context);
  }

  _onDialog(event: Protocol.Page.javascriptDialogOpeningPayload) {
    this._page.emit(Events.Page.Dialog, new dialog.Dialog(
        event.type,
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
    this._page._didCrash();
  }

  _onLogEntryAdded(event: Protocol.Log.entryAddedPayload) {
    const {level, text, args, source, url, lineNumber} = event.entry;
    if (args)
      args.map(arg => releaseObject(this._client, arg));
    if (source !== 'worker')
      this._page.emit(Events.Page.Console, new ConsoleMessage(level, text, [], {url, lineNumber}));
  }

  async _onFileChooserOpened(event: Protocol.Page.fileChooserOpenedPayload) {
    const frame = this._page._frameManager.frame(event.frameId)!;
    const utilityContext = await frame._utilityContext();
    const handle = await this.adoptBackendNodeId(event.backendNodeId, utilityContext);
    this._page._onFileChooserOpened(handle);
  }

  async updateExtraHTTPHeaders(): Promise<void> {
    const headers = network.mergeHeaders([
      this._browserContext._options.extraHTTPHeaders,
      this._page._state.extraHTTPHeaders
    ]);
    await this._client.send('Network.setExtraHTTPHeaders', { headers });
  }

  async setViewportSize(viewportSize: types.Size): Promise<void> {
    assert(this._page._state.viewportSize === viewportSize);
    await this._updateViewport(false /* updateTouch */);
  }

  async _updateViewport(updateTouch: boolean): Promise<void> {
    let viewport = this._browserContext._options.viewport || { width: 0, height: 0 };
    const viewportSize = this._page._state.viewportSize;
    if (viewportSize)
      viewport = { ...viewport, ...viewportSize };
    const isLandscape = viewport.width > viewport.height;
    const promises = [
      this._client.send('Emulation.setDeviceMetricsOverride', {
        mobile: !!viewport.isMobile,
        width: viewport.width,
        height: viewport.height,
        screenWidth: viewport.width,
        screenHeight: viewport.height,
        deviceScaleFactor: viewport.deviceScaleFactor || 1,
        screenOrientation: isLandscape ? { angle: 90, type: 'landscapePrimary' } : { angle: 0, type: 'portraitPrimary' },
      }),
    ];
    if (updateTouch)
      promises.push(this._client.send('Emulation.setTouchEmulationEnabled', { enabled: !!viewport.isMobile }));
    await Promise.all(promises);
  }

  async setEmulateMedia(mediaType: types.MediaType | null, colorScheme: types.ColorScheme | null): Promise<void> {
    const features = colorScheme ? [{ name: 'prefers-color-scheme', value: colorScheme }] : [];
    await this._client.send('Emulation.setEmulatedMedia', { media: mediaType || '', features });
  }

  async setRequestInterception(enabled: boolean): Promise<void> {
    await this._networkManager.setRequestInterception(enabled);
  }

  async setFileChooserIntercepted(enabled: boolean) {
    await this._client.send('Page.setInterceptFileChooserDialog', { enabled }).catch(e => {}); // target can be closed.
  }

  async opener(): Promise<Page | null> {
    const openerTarget = CRTarget.fromPage(this._page).opener();
    if (!openerTarget)
      return null;
    const openerPage = await openerTarget.pageOrError();
    if (openerPage instanceof Page && !openerPage.isClosed())
      return openerPage;
    return null;
  }

  async reload(): Promise<void> {
    await this._client.send('Page.reload');
  }

  private async _go(delta: number): Promise<boolean> {
    const history = await this._client.send('Page.getNavigationHistory');
    const entry = history.entries[history.currentIndex + delta];
    if (!entry)
      return false;
    await this._client.send('Page.navigateToHistoryEntry', { entryId: entry.id });
    return true;
  }

  goBack(): Promise<boolean> {
    return this._go(-1);
  }

  goForward(): Promise<boolean> {
    return this._go(+1);
  }

  async evaluateOnNewDocument(source: string): Promise<void> {
    await this._client.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }

  async closePage(runBeforeUnload: boolean): Promise<void> {
    if (runBeforeUnload)
      await this._client.send('Page.close');
    else
      await this._browser._closePage(this._page);
  }

  canScreenshotOutsideViewport(): boolean {
    return false;
  }

  async setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void> {
    await this._client.send('Emulation.setDefaultBackgroundColorOverride', { color });
  }

  async takeScreenshot(format: 'png' | 'jpeg', documentRect: types.Rect | undefined, viewportRect: types.Rect | undefined, quality: number | undefined): Promise<platform.BufferType> {
    const { visualViewport } = await this._client.send('Page.getLayoutMetrics');
    if (!documentRect) {
      documentRect = {
        x: visualViewport.pageX + viewportRect!.x,
        y: visualViewport.pageY + viewportRect!.y,
        ...helper.enclosingIntSize({
          width: viewportRect!.width / visualViewport.scale,
          height: viewportRect!.height / visualViewport.scale,
        })
      };
    }
    await this._client.send('Page.bringToFront', {});
    // When taking screenshots with documentRect (based on the page content, not viewport),
    // ignore current page scale.
    const clip = { ...documentRect, scale: viewportRect ? visualViewport.scale : 1 };
    const result = await this._client.send('Page.captureScreenshot', { format, quality, clip });
    return platform.Buffer.from(result.data, 'base64');
  }

  async resetViewport(): Promise<void> {
    await this._client.send('Emulation.setDeviceMetricsOverride', { mobile: false, width: 0, height: 0, deviceScaleFactor: 0 });
  }

  async getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    const nodeInfo = await this._client.send('DOM.describeNode', {
      objectId: toRemoteObject(handle).objectId
    });
    if (!nodeInfo || typeof nodeInfo.node.frameId !== 'string')
      return null;
    return this._page._frameManager.frame(nodeInfo.node.frameId);
  }

  async getOwnerFrame(handle: dom.ElementHandle): Promise<string | null> {
    // document.documentElement has frameId of the owner frame.
    const documentElement = await handle.evaluateHandle(node => {
      const doc = node as Document;
      if (doc.documentElement && doc.documentElement.ownerDocument === doc)
        return doc.documentElement;
      return node.ownerDocument ? node.ownerDocument.documentElement : null;
    });
    if (!documentElement)
      return null;
    const remoteObject = toRemoteObject(documentElement);
    if (!remoteObject.objectId)
      return null;
    const nodeInfo = await this._client.send('DOM.describeNode', {
      objectId: remoteObject.objectId
    });
    const frameId = nodeInfo && typeof nodeInfo.node.frameId === 'string' ?
      nodeInfo.node.frameId : null;
    documentElement.dispose();
    return frameId;
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

  async scrollRectIntoViewIfNeeded(handle: dom.ElementHandle, rect?: types.Rect): Promise<void> {
    await this._client.send('DOM.scrollIntoViewIfNeeded', {
      objectId: toRemoteObject(handle).objectId,
      rect,
    }).catch(e => {
      if (e instanceof Error && e.message.includes('Node does not have a layout object'))
        e.message = 'Node is either not visible or not an HTMLElement';
      throw e;
    });
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

  async setInputFiles(handle: dom.ElementHandle<HTMLInputElement>, files: types.FilePayload[]): Promise<void> {
    await handle.evaluate(dom.setFileInputFunction, files);
  }

  async adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>> {
    const nodeInfo = await this._client.send('DOM.describeNode', {
      objectId: toRemoteObject(handle).objectId,
    });
    return this.adoptBackendNodeId(nodeInfo.node.backendNodeId, to) as Promise<dom.ElementHandle<T>>;
  }

  async adoptBackendNodeId(backendNodeId: Protocol.DOM.BackendNodeId, to: dom.FrameExecutionContext): Promise<dom.ElementHandle> {
    const result = await this._client.send('DOM.resolveNode', {
      backendNodeId,
      executionContextId: (to._delegate as CRExecutionContext)._contextId,
    }).catch(debugError);
    if (!result || result.object.subtype === 'null')
      throw new Error('Unable to adopt element handle from a different document');
    return to._createHandle(result.object).asElement()!;
  }

  async getAccessibilityTree(needle?: dom.ElementHandle) {
    return getAccessibilityTree(this._client, needle);
  }

  async inputActionEpilogue(): Promise<void> {
    await this._client.send('Page.enable').catch(e => {});
  }

  async pdf(options?: types.PDFOptions): Promise<platform.BufferType> {
    return this._pdf.generate(options);
  }

  coverage(): CRCoverage {
    return this._coverage;
  }

  async getFrameElement(frame: frames.Frame): Promise<dom.ElementHandle> {
    const { backendNodeId } = await this._client.send('DOM.getFrameOwner', { frameId: frame._id }).catch(e => {
      if (e instanceof Error && e.message.includes('Frame with the given id was not found.'))
        e.message = 'Frame has been detached.';
      throw e;
    });
    const parent = frame.parentFrame();
    if (!parent)
      throw new Error('Frame has been detached.');
    return this.adoptBackendNodeId(backendNodeId, await parent._mainContext());
  }
}

function toRemoteObject(handle: js.JSHandle): Protocol.Runtime.RemoteObject {
  return handle._remoteObject as Protocol.Runtime.RemoteObject;
}

async function emulateTimezone(session: CRSession, timezoneId: string) {
  try {
    await session.send('Emulation.setTimezoneOverride', { timezoneId: timezoneId });
  } catch (exception) {
    if (exception.message.includes('Invalid timezone'))
      throw new Error(`Invalid timezone ID: ${timezoneId}`);
    throw exception;
  }
}
