/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { assert } from '../../utils';
import { eventsHelper } from '../utils/eventsHelper';
import * as dialog from '../dialog';
import * as dom from '../dom';
import { Page } from '../page';
import { BidiExecutionContext, createHandle } from './bidiExecutionContext';
import { RawKeyboardImpl, RawMouseImpl, RawTouchscreenImpl } from './bidiInput';
import { BidiNetworkManager } from './bidiNetworkManager';
import { BidiPDF } from './bidiPdf';
import * as bidi from './third_party/bidiProtocol';

import type { RegisteredListener } from '../utils/eventsHelper';
import type * as accessibility from '../accessibility';
import type * as frames from '../frames';
import type { InitScript, PageDelegate } from '../page';
import type { Progress } from '../progress';
import type * as types from '../types';
import type { BidiBrowserContext } from './bidiBrowser';
import type { BidiSession } from './bidiConnection';
import type * as channels from '@protocol/channels';

const UTILITY_WORLD_NAME = '__playwright_utility_world__';
export const kPlaywrightBindingChannel = 'playwrightChannel';

export class BidiPage implements PageDelegate {
  readonly rawMouse: RawMouseImpl;
  readonly rawKeyboard: RawKeyboardImpl;
  readonly rawTouchscreen: RawTouchscreenImpl;
  readonly _page: Page;
  readonly _session: BidiSession;
  readonly _opener: BidiPage | null;
  readonly _realmToContext: Map<string, dom.FrameExecutionContext>;
  private _sessionListeners: RegisteredListener[] = [];
  readonly _browserContext: BidiBrowserContext;
  readonly _networkManager: BidiNetworkManager;
  private readonly _pdf: BidiPDF;
  private _initScriptIds = new Map<InitScript, string>();

  constructor(browserContext: BidiBrowserContext, bidiSession: BidiSession, opener: BidiPage | null) {
    this._session = bidiSession;
    this._opener = opener;
    this.rawKeyboard = new RawKeyboardImpl(bidiSession);
    this.rawMouse = new RawMouseImpl(bidiSession);
    this.rawTouchscreen = new RawTouchscreenImpl(bidiSession);
    this._realmToContext = new Map();
    this._page = new Page(this, browserContext);
    this._browserContext = browserContext;
    this._networkManager = new BidiNetworkManager(this._session, this._page, this._onNavigationResponseStarted.bind(this));
    this._pdf = new BidiPDF(this._session);
    this._page.on(Page.Events.FrameDetached, (frame: frames.Frame) => this._removeContextsForFrame(frame, false));
    this._sessionListeners = [
      eventsHelper.addEventListener(bidiSession, 'script.realmCreated', this._onRealmCreated.bind(this)),
      eventsHelper.addEventListener(bidiSession, 'script.message', this._onScriptMessage.bind(this)),
      eventsHelper.addEventListener(bidiSession, 'browsingContext.contextDestroyed', this._onBrowsingContextDestroyed.bind(this)),
      eventsHelper.addEventListener(bidiSession, 'browsingContext.navigationStarted', this._onNavigationStarted.bind(this)),
      eventsHelper.addEventListener(bidiSession, 'browsingContext.navigationAborted', this._onNavigationAborted.bind(this)),
      eventsHelper.addEventListener(bidiSession, 'browsingContext.navigationFailed', this._onNavigationFailed.bind(this)),
      eventsHelper.addEventListener(bidiSession, 'browsingContext.fragmentNavigated', this._onFragmentNavigated.bind(this)),
      eventsHelper.addEventListener(bidiSession, 'browsingContext.domContentLoaded', this._onDomContentLoaded.bind(this)),
      eventsHelper.addEventListener(bidiSession, 'browsingContext.load', this._onLoad.bind(this)),
      eventsHelper.addEventListener(bidiSession, 'browsingContext.userPromptOpened', this._onUserPromptOpened.bind(this)),
      eventsHelper.addEventListener(bidiSession, 'log.entryAdded', this._onLogEntryAdded.bind(this)),
    ];

    // Initialize main frame.
    // TODO: Wait for first execution context to be created and maybe about:blank navigated.
    this._initialize().then(
        () => this._page.reportAsNew(this._opener?._page),
        error => this._page.reportAsNew(this._opener?._page, error));
  }

  private async _initialize() {
    // Initialize main frame.
    this._onFrameAttached(this._session.sessionId, null);
    await Promise.all([
      this.updateHttpCredentials(),
      this.updateRequestInterception(),
      // If the page is created by the Playwright client's call, some initialization
      // may be pending. Wait for it to complete before reporting the page as new.
      //
      // TODO: ideally we'd wait only for the commands that created this page, but currently
      // there is no way in Bidi to track which command created this page.
      this._browserContext.waitForBlockingPageCreations(),
    ]);
  }

  didClose() {
    this._session.dispose();
    eventsHelper.removeEventListeners(this._sessionListeners);
    this._page._didClose();
  }

  private _onFrameAttached(frameId: string, parentFrameId: string | null): frames.Frame {
    return this._page.frameManager.frameAttached(frameId, parentFrameId);
  }

  private _removeContextsForFrame(frame: frames.Frame, notifyFrame: boolean) {
    for (const [contextId, context] of this._realmToContext) {
      if (context.frame === frame) {
        this._realmToContext.delete(contextId);
        if (notifyFrame)
          frame._contextDestroyed(context);
      }
    }
  }

  private _onRealmCreated(realmInfo: bidi.Script.RealmInfo) {
    if (this._realmToContext.has(realmInfo.realm))
      return;
    if (realmInfo.type !== 'window')
      return;
    const frame = this._page.frameManager.frame(realmInfo.context);
    if (!frame)
      return;
    let worldName: types.World;
    if (!realmInfo.sandbox) {
      worldName = 'main';
      // Force creating utility world every time the main world is created (e.g. due to navigation).
      this._touchUtilityWorld(realmInfo.context);
    } else if (realmInfo.sandbox === UTILITY_WORLD_NAME) {
      worldName = 'utility';
    } else {
      return;
    }
    const delegate = new BidiExecutionContext(this._session, realmInfo);
    const context = new dom.FrameExecutionContext(delegate, frame, worldName);
    frame._contextCreated(worldName, context);
    this._realmToContext.set(realmInfo.realm, context);
  }

  private async _touchUtilityWorld(context: bidi.BrowsingContext.BrowsingContext) {
    await this._session.sendMayFail('script.evaluate', {
      expression: '1 + 1',
      target: {
        context,
        sandbox: UTILITY_WORLD_NAME,
      },
      serializationOptions: {
        maxObjectDepth: 10,
        maxDomDepth: 10,
      },
      awaitPromise: true,
      userActivation: true,
    });
  }

  _onRealmDestroyed(params: bidi.Script.RealmDestroyedParameters): boolean {
    const context = this._realmToContext.get(params.realm);
    if (!context)
      return false;
    this._realmToContext.delete(params.realm);
    context.frame._contextDestroyed(context);
    return true;
  }

  // TODO: route the message directly to the browser
  private _onBrowsingContextDestroyed(params: bidi.BrowsingContext.Info) {
    this._browserContext._browser._onBrowsingContextDestroyed(params);
  }

  private _onNavigationStarted(params: bidi.BrowsingContext.NavigationInfo) {
    const frameId = params.context;
    this._page.frameManager.frameRequestedNavigation(frameId, params.navigation!);

    const url = params.url.toLowerCase();
    if (url.startsWith('file:') || url.startsWith('data:') || url === 'about:blank') {
      // Navigation to file urls doesn't emit network events, so we fire 'commit' event right when navigation is started.
      // Doing it in domcontentload would be too late as we'd clear frame tree.
      const frame = this._page.frameManager.frame(frameId)!;
      if (frame)
        this._page.frameManager.frameCommittedNewDocumentNavigation(frameId, params.url, '', params.navigation!, /* initial */ false);
    }
  }

  // TODO: there is no separate event for committed navigation, so we approximate it with responseStarted.
  private _onNavigationResponseStarted(params: bidi.Network.ResponseStartedParameters) {
    const frameId = params.context!;
    const frame = this._page.frameManager.frame(frameId);
    assert(frame);
    this._page.frameManager.frameCommittedNewDocumentNavigation(frameId, params.response.url, '', params.navigation!, /* initial */ false);
    // if (!initial)
    //   this._firstNonInitialNavigationCommittedFulfill();
  }

  private _onDomContentLoaded(params: bidi.BrowsingContext.NavigationInfo) {
    const frameId = params.context;
    this._page.frameManager.frameLifecycleEvent(frameId, 'domcontentloaded');
  }

  private _onLoad(params: bidi.BrowsingContext.NavigationInfo) {
    this._page.frameManager.frameLifecycleEvent(params.context, 'load');
  }

  private _onNavigationAborted(params: bidi.BrowsingContext.NavigationInfo) {
    this._page.frameManager.frameAbortedNavigation(params.context, 'Navigation aborted', params.navigation || undefined);
  }

  private _onNavigationFailed(params: bidi.BrowsingContext.NavigationInfo) {
    this._page.frameManager.frameAbortedNavigation(params.context, 'Navigation failed', params.navigation || undefined);
  }

  private _onFragmentNavigated(params: bidi.BrowsingContext.NavigationInfo) {
    this._page.frameManager.frameCommittedSameDocumentNavigation(params.context, params.url);
  }

  private _onUserPromptOpened(event: bidi.BrowsingContext.UserPromptOpenedParameters) {
    this._page.browserContext.dialogManager.dialogDidOpen(new dialog.Dialog(
        this._page,
        event.type as dialog.DialogType,
        event.message,
        async (accept: boolean, userText?: string) => {
          await this._session.send('browsingContext.handleUserPrompt', { context: event.context, accept, userText });
        },
        event.defaultValue));
  }

  private _onLogEntryAdded(params: bidi.Log.Entry) {
    if (params.type !== 'console')
      return;
    const entry: bidi.Log.ConsoleLogEntry = params as bidi.Log.ConsoleLogEntry;
    const context = this._realmToContext.get(params.source.realm);
    if (!context)
      return;
    const callFrame = params.stackTrace?.callFrames[0];
    const location = callFrame ?? { url: '', lineNumber: 1, columnNumber: 1 };
    this._page.addConsoleMessage(entry.method, entry.args.map(arg => createHandle(context, arg)), location, params.text || undefined);
  }

  async navigateFrame(frame: frames.Frame, url: string, referrer: string | undefined): Promise<frames.GotoResult> {
    const { navigation } = await this._session.send('browsingContext.navigate', {
      context: frame._id,
      url,
    });
    return { newDocumentId: navigation || undefined };
  }

  async updateExtraHTTPHeaders(): Promise<void> {
  }

  async updateEmulateMedia(): Promise<void> {
  }

  async updateUserAgent(): Promise<void> {
  }

  async bringToFront(): Promise<void> {
    await this._session.send('browsingContext.activate', {
      context: this._session.sessionId,
    });
  }

  async updateEmulatedViewportSize(): Promise<void> {
    const options = this._browserContext._options;
    const emulatedSize = this._page.emulatedSize();
    if (!emulatedSize)
      return;
    const viewportSize = emulatedSize.viewport;
    await this._session.send('browsingContext.setViewport', {
      context: this._session.sessionId,
      viewport: {
        width: viewportSize.width,
        height: viewportSize.height,
      },
      devicePixelRatio: options.deviceScaleFactor || 1
    });
  }

  async updateRequestInterception(): Promise<void> {
    await this._networkManager.setRequestInterception(this._page.needsRequestInterception());
  }

  async updateOffline() {
  }

  async updateHttpCredentials() {
    await this._networkManager.setCredentials(this._browserContext._options.httpCredentials);
  }

  async updateFileChooserInterception() {
  }

  async reload(): Promise<void> {
    await this._session.send('browsingContext.reload', {
      context: this._session.sessionId,
      // ignoreCache: true,
      wait: bidi.BrowsingContext.ReadinessState.Interactive,
    });
  }

  async goBack(): Promise<boolean> {
    return await this._session.send('browsingContext.traverseHistory', {
      context: this._session.sessionId,
      delta: -1,
    }).then(() => true).catch(() => false);
  }

  async goForward(): Promise<boolean> {
    return await this._session.send('browsingContext.traverseHistory', {
      context: this._session.sessionId,
      delta: +1,
    }).then(() => true).catch(() => false);
  }

  async requestGC(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  private async _onScriptMessage(event: bidi.Script.MessageParameters) {
    if (event.channel !== kPlaywrightBindingChannel)
      return;
    const pageOrError = await this._page.waitForInitializedOrError();
    if (pageOrError instanceof Error)
      return;
    const context = this._realmToContext.get(event.source.realm);
    if (!context)
      return;
    if (event.data.type !== 'string')
      return;
    await this._page.onBindingCalled(event.data.value, context);
  }

  async addInitScript(initScript: InitScript): Promise<void> {
    const { script } = await this._session.send('script.addPreloadScript', {
      // TODO: remove function call from the source.
      functionDeclaration: `() => { return ${initScript.source} }`,
      // TODO: push to iframes?
      contexts: [this._session.sessionId],
    });
    this._initScriptIds.set(initScript, script);
  }

  async removeInitScripts(initScripts: InitScript[]): Promise<void> {
    const ids: string[] = [];
    for (const script of initScripts) {
      const id = this._initScriptIds.get(script);
      if (id)
        ids.push(id);
      this._initScriptIds.delete(script);
    }
    await Promise.all(ids.map(script => this._session.send('script.removePreloadScript', { script })));
  }

  async closePage(runBeforeUnload: boolean): Promise<void> {
    await this._session.send('browsingContext.close', {
      context: this._session.sessionId,
      promptUnload: runBeforeUnload,
    });
  }

  async setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void> {
  }

  async takeScreenshot(progress: Progress, format: string, documentRect: types.Rect | undefined, viewportRect: types.Rect | undefined, quality: number | undefined, fitsViewport: boolean, scale: 'css' | 'device'): Promise<Buffer> {
    const rect = (documentRect || viewportRect)!;
    const { data } = await progress.race(this._session.send('browsingContext.captureScreenshot', {
      context: this._session.sessionId,
      format: {
        type: `image/${format === 'png' ? 'png' : 'jpeg'}`,
        quality: quality ? quality / 100 : 0.8,
      },
      origin: documentRect ? 'document' : 'viewport',
      clip: {
        type: 'box',
        ...rect,
      }
    }));
    return Buffer.from(data, 'base64');
  }

  async getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    const executionContext = toBidiExecutionContext(handle._context);
    const frameId = await executionContext.contentFrameIdForFrame(handle);
    if (!frameId)
      return null;
    return this._page.frameManager.frame(frameId);
  }

  async getOwnerFrame(handle: dom.ElementHandle): Promise<string | null> {
    // TODO: switch to utility world?
    const windowHandle = await handle.evaluateHandle(node => {
      const doc = node.ownerDocument ?? node as Document;
      return doc.defaultView;
    });
    if (!windowHandle)
      return null;
    const executionContext = toBidiExecutionContext(handle._context);
    return executionContext.frameIdForWindowHandle(windowHandle);
  }

  async getBoundingBox(handle: dom.ElementHandle): Promise<types.Rect | null> {
    const box = await handle.evaluate(element => {
      if (!(element instanceof Element))
        return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    if (!box)
      return null;
    const position = await this._framePosition(handle._frame);
    if (!position)
      return null;
    box.x += position.x;
    box.y += position.y;
    return box;
  }

  // TODO: move to Frame.
  private async _framePosition(frame: frames.Frame): Promise<types.Point | null> {
    if (frame === this._page.mainFrame())
      return { x: 0, y: 0 };
    const element = await frame.frameElement();
    const box = await element.boundingBox();
    if (!box)
      return null;
    const style = await element.evaluateInUtility(([injected, iframe]) => injected.describeIFrameStyle(iframe as Element), {}).catch(e => 'error:notconnected' as const);
    if (style === 'error:notconnected' || style === 'transformed')
      return null;
    // Content box is offset by border and padding widths.
    box.x += style.left;
    box.y += style.top;
    return box;
  }

  async scrollRectIntoViewIfNeeded(handle: dom.ElementHandle<Element>, rect?: types.Rect): Promise<'error:notvisible' | 'error:notconnected' | 'done'> {
    return await handle.evaluateInUtility(([injected, node]) => {
      node.scrollIntoView({
        block: 'center',
        inline: 'center',
        behavior: 'instant',
      });
    }, null).then(() => 'done' as const).catch(e => {
      if (e instanceof Error && e.message.includes('Node is detached from document'))
        return 'error:notconnected';
      if (e instanceof Error && e.message.includes('Node does not have a layout object'))
        return 'error:notvisible';
      throw e;
    });
  }

  async setScreencastOptions(options: { width: number, height: number, quality: number } | null): Promise<void> {
  }

  rafCountForStablePosition(): number {
    return 1;
  }

  async getContentQuads(handle: dom.ElementHandle<Element>): Promise<types.Quad[] | null | 'error:notconnected'> {
    const quads = await handle.evaluateInUtility(([injected, node]) => {
      if (!node.isConnected)
        return 'error:notconnected';
      const rects = node.getClientRects();
      if (!rects)
        return null;
      return [...rects].map(rect => [
        { x: rect.left, y: rect.top },
        { x: rect.right, y: rect.top },
        { x: rect.right, y: rect.bottom },
        { x: rect.left, y: rect.bottom },
      ]);
    }, null);
    if (!quads || quads === 'error:notconnected')
      return quads;
    // TODO: consider transforming quads to support clicks in iframes.
    const position = await this._framePosition(handle._frame);
    if (!position)
      return null;
    quads.forEach(quad => quad.forEach(point => {
      point.x += position.x;
      point.y += position.y;
    }));
    return quads as types.Quad[];
  }

  async setInputFilePaths(handle: dom.ElementHandle<HTMLInputElement>, paths: string[]): Promise<void> {
    const fromContext = toBidiExecutionContext(handle._context);
    await this._session.send('input.setFiles', {
      context: this._session.sessionId,
      element: await fromContext.nodeIdForElementHandle(handle),
      files: paths,
    });
  }

  async adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>> {
    const fromContext = toBidiExecutionContext(handle._context);
    const nodeId = await fromContext.nodeIdForElementHandle(handle);
    const executionContext = toBidiExecutionContext(to);
    return await executionContext.remoteObjectForNodeId(to, nodeId) as dom.ElementHandle<T>;
  }

  async getAccessibilityTree(needle?: dom.ElementHandle): Promise<{tree: accessibility.AXNode, needle: accessibility.AXNode | null}> {
    throw new Error('Method not implemented.');
  }

  async inputActionEpilogue(): Promise<void> {
  }

  async resetForReuse(progress: Progress): Promise<void> {
  }

  async pdf(options: channels.PagePdfParams): Promise<Buffer> {
    return this._pdf.generate(options);
  }

  async getFrameElement(frame: frames.Frame): Promise<dom.ElementHandle> {
    const parent = frame.parentFrame();
    if (!parent)
      throw new Error('Frame has been detached.');
    const parentContext = await parent._mainContext();
    const list = await parentContext.evaluateHandle(() => { return [...document.querySelectorAll('iframe,frame')]; });
    const length = await list.evaluate(list => list.length);
    let foundElement = null;
    for (let i = 0; i < length; i++) {
      const element = await list.evaluateHandle((list, i) => list[i], i);
      const candidate = await element.contentFrame();
      if (frame === candidate) {
        foundElement = element;
        break;
      } else {
        element.dispose();
      }
    }
    list.dispose();
    if (!foundElement)
      throw new Error('Frame has been detached.');
    return foundElement;
  }

  shouldToggleStyleSheetToSyncAnimations(): boolean {
    return true;
  }
}

function toBidiExecutionContext(executionContext: dom.FrameExecutionContext): BidiExecutionContext {
  return executionContext.delegate as BidiExecutionContext;
}
