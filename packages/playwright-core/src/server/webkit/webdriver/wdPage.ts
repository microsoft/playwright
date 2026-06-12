/**
 * Copyright (c) Microsoft Corporation.
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

import { PNG } from 'pngjs';
import jpegjs from 'jpeg-js';
import { ManualPromise } from '@isomorphic/manualPromise';
import { createGuid } from '@utils/crypto';
import * as dom from '../../dom';
import * as network from '../../network';
import { Page } from '../../page';
import { WDExecutionContext } from './wdExecutionContext';
import { RawKeyboardImpl, RawMouseImpl, RawTouchscreenImpl } from './wdInput';

import type { WDPageEvent } from './wdExecutionContext';
import type { WDBrowserContext } from './wdBrowser';
import type { WDSession } from './wdConnection';
import type * as frames from '../../frames';
import type { InitScript, PageDelegate } from '../../page';
import type { Progress } from '../../progress';
import type * as types from '../../types';
import type { PagePdfParams } from '@protocol/channels';

/**
 * PageDelegate backed by a classic W3C WebDriver session.
 *
 * WebDriver pushes no events, so this delegate synthesizes the frame, execution
 * context and lifecycle events the core expects: a single main frame, one
 * execution context recreated on each navigation, and lifecycle events fired
 * after a (blocking) WebDriver navigation returns.
 */
export class WDPage implements PageDelegate {
  readonly rawMouse: RawMouseImpl;
  readonly rawKeyboard: RawKeyboardImpl;
  readonly rawTouchscreen: RawTouchscreenImpl;
  readonly _page: Page;
  readonly _browserContext: WDBrowserContext;
  private readonly _session: WDSession;
  private _mainFrameId: string = 'main';
  private _context: dom.FrameExecutionContext | undefined;
  private readonly _initializedPromise = new ManualPromise<void>();

  pdf?: ((options: PagePdfParams) => Promise<Buffer>) | undefined;
  coverage?: (() => any) | undefined;
  cspErrorsAsynchronousForInlineScripts?: boolean | undefined;

  constructor(browserContext: WDBrowserContext, session: WDSession) {
    this._browserContext = browserContext;
    this._session = session;
    this.rawKeyboard = new RawKeyboardImpl();
    this.rawMouse = new RawMouseImpl();
    this.rawTouchscreen = new RawTouchscreenImpl();
    this.rawKeyboard.setSession(session);
    this.rawMouse.setSession(session);
    this.rawTouchscreen.setSession(session);
    this._page = new Page(this, browserContext);
  }

  waitForInitialized(): Promise<void> {
    return this._initializedPromise;
  }

  async _initialize(): Promise<void> {
    let pageOrError: Page | Error;
    try {
      // The top-level window handle is a stable id for the main frame.
      this._mainFrameId = await this._session.windowHandle().catch(() => 'main');
      this._page.frameManager.frameAttached(this._mainFrameId, null);
      this._createContext();
      const url = await this._session.currentUrl().catch(() => 'about:blank');
      this._page.frameManager.frameCommittedNewDocumentNavigation(this._mainFrameId, url, '', createGuid(), true);
      this._page.frameManager.frameLifecycleEvent(this._mainFrameId, 'domcontentloaded');
      this._page.frameManager.frameLifecycleEvent(this._mainFrameId, 'load');
      pageOrError = this._page;
    } catch (e) {
      pageOrError = e as Error;
    }
    await this._page.reportAsNew(undefined, pageOrError instanceof Page ? undefined : pageOrError);
    this._initializedPromise.resolve();
  }

  private _mainFrame(): frames.Frame {
    return this._page.frameManager.frame(this._mainFrameId)!;
  }

  private _createContext(): void {
    const frame = this._mainFrame();
    const delegate = new WDExecutionContext(this._session, (events, readyState) => this._processPageEvents(events, readyState));
    const context = new dom.FrameExecutionContext(delegate, frame, 'main');
    this._context = context;
    frame.contextCreated('main', context);
  }

  // Console + lifecycle events synthesized from the side-channel piggybacked on
  // every evaluate. Delivering console messages drives the setContent tag handler
  // (which clears lifecycle); we then re-fire lifecycle from readyState.
  private _processPageEvents(events: WDPageEvent[], readyState: string): void {
    const location = { url: this._mainFrame().url(), lineNumber: 0, columnNumber: 0 };
    for (const event of events)
      this._page.addConsoleMessage(null, event.type, [], location, event.text, Date.now());
    if (readyState === 'interactive' || readyState === 'complete')
      this._page.frameManager.frameLifecycleEvent(this._mainFrameId, 'domcontentloaded');
    if (readyState === 'complete')
      this._page.frameManager.frameLifecycleEvent(this._mainFrameId, 'load');
  }

  // Synthesizes commit + context + lifecycle events after a (blocking) WebDriver
  // navigation completes. The returned documentId must match the one gotoImpl awaits.
  private async _didNavigate(fallbackUrl: string): Promise<frames.GotoResult> {
    const frame = this._mainFrame();
    if (this._context) {
      frame.contextDestroyed(this._context);
      this._context = undefined;
    }
    const url = await this._session.currentUrl().catch(() => fallbackUrl);
    const documentId = createGuid();
    // WebDriver exposes no network events; synthesize a main-document
    // request/response so page.goto() resolves to a Response. The HTTP status is
    // read from PerformanceNavigationTiming once the new document is available.
    let request: network.Request | undefined;
    if (/^https?:/i.test(url)) {
      request = new network.Request(this._page.browserContext, frame, null, null, documentId, url, 'document', 'GET', null, []);
      this._page.frameManager.requestStarted(request);
    }
    this._page.frameManager.frameCommittedNewDocumentNavigation(this._mainFrameId, url, '', documentId, false);
    this._createContext();
    if (request) {
      const status = await this._navigationStatus();
      const response = new network.Response(request, status, statusText(status), [], kNoTiming, async () => Buffer.from(''), false);
      this._page.frameManager.requestReceivedResponse(response);
      this._page.frameManager.reportRequestFinished(request, response);
    }
    this._page.frameManager.frameLifecycleEvent(this._mainFrameId, 'domcontentloaded');
    this._page.frameManager.frameLifecycleEvent(this._mainFrameId, 'load');
    return { newDocumentId: documentId };
  }

  private async _navigationStatus(): Promise<number> {
    const status = await this._context!.rawEvaluateJSON('(performance.getEntriesByType("navigation")[0] || {}).responseStatus || 0').catch(() => 0);
    return status || 200;
  }

  async navigateFrame(frame: frames.Frame, url: string, referrer: string | undefined): Promise<frames.GotoResult> {
    if (frame.parentFrame())
      throw new Error('Only main-frame navigation is supported over WebDriver.');
    await this._session.navigate(url);
    return await this._didNavigate(url);
  }

  async reload(): Promise<void> {
    await this._session.reload();
    await this._didNavigate(this._mainFrame().url());
  }

  async goBack(): Promise<boolean> {
    await this._session.back();
    await this._didNavigate(this._mainFrame().url());
    return true;
  }

  async goForward(): Promise<boolean> {
    await this._session.forward();
    await this._didNavigate(this._mainFrame().url());
    return true;
  }

  async takeScreenshot(progress: Progress, format: string, documentRect: types.Rect | undefined, viewportRect: types.Rect | undefined, quality: number | undefined, fitsViewport: boolean, scale: 'css' | 'device'): Promise<Buffer> {
    // WebDriver only exposes a viewport screenshot.
    const base64 = await progress.race(this._session.screenshot());
    let buffer: Buffer = Buffer.from(base64, 'base64');
    if (format === 'jpeg')
      buffer = jpegjs.encode(PNG.sync.read(buffer), quality).data;
    return buffer;
  }

  async getContentQuads(handle: dom.ElementHandle): Promise<types.Quad[] | null | 'error:notconnected'> {
    const result = await handle.evaluateInUtility(([, node]) => {
      let element: Element | null = node as Element;
      while (element && element.nodeType !== 1 /* Node.ELEMENT_NODE */)
        element = element.parentNode as Element | null;
      if (!element)
        return null;
      const rects = element.getClientRects();
      if (!rects.length)
        return null;
      return Array.from(rects, r => [
        { x: r.left, y: r.top },
        { x: r.right, y: r.top },
        { x: r.right, y: r.bottom },
        { x: r.left, y: r.bottom },
      ]);
    }, {});
    if (!result || typeof result === 'string')
      return null;
    return result as types.Quad[];
  }

  async getBoundingBox(handle: dom.ElementHandle): Promise<types.Rect | null> {
    const quads = await this.getContentQuads(handle);
    if (!quads || quads === 'error:notconnected' || !quads.length)
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
    const result = await handle.evaluateInUtility(([, node, rect]) => {
      if (!node.isConnected)
        return 'error:notconnected';
      if (!(node instanceof Element))
        return 'error:notvisible';
      const box = node.getBoundingClientRect();
      if (!box.width && !box.height && !node.getClientRects().length)
        return 'error:notvisible';
      const innerW = document.documentElement.clientWidth;
      const innerH = document.documentElement.clientHeight;
      const target = rect
        ? { left: box.left + rect.x, top: box.top + rect.y, right: box.left + rect.x + rect.width, bottom: box.top + rect.y + rect.height }
        : { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
      const fullyVisible = target.left >= 0 && target.top >= 0 && target.right <= innerW && target.bottom <= innerH;
      if (!fullyVisible)
        node.scrollIntoView({ block: 'center', inline: 'center' });
      return 'done';
    }, rect ?? null);
    if (result === 'error:notvisible' || result === 'error:notconnected' || result === 'done')
      return result;
    return 'error:notconnected';
  }

  async closePage(runBeforeUnload: boolean): Promise<void> {
    await this._session.delete();
    this.didClose();
  }

  didClose() {
    this._session.connection.close();
    this._page._didClose();
  }

  // ---- No-op / best-effort PageDelegate surface for the proof-of-concept. ----

  async setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void> {}
  async bringToFront(): Promise<void> {}
  async updateExtraHTTPHeaders(): Promise<void> {}
  async updateEmulatedViewportSize(): Promise<void> {}
  async updateEmulateMedia(): Promise<void> {}
  async updateRequestInterception(): Promise<void> {}
  async updateFileChooserInterception(): Promise<void> {}
  async addInitScript(initScript: InitScript): Promise<void> {}
  async removeInitScripts(): Promise<void> {}
  async requestGC(): Promise<void> {}
  async inputActionEpilogue(): Promise<void> {}
  async resetForReuse(progress: Progress): Promise<void> {}
  async setDockTile(image: Buffer): Promise<void> {}
  async exposePlaywrightBinding(): Promise<void> {}

  noUtilityWorld(): boolean {
    return true;
  }

  rafCountForStablePosition(): number {
    return 1;
  }

  shouldToggleStyleSheetToSyncAnimations(): boolean {
    return false;
  }

  // ---- Unsupported over classic WebDriver. ----

  startScreencast(): void {
    throw new Error('Screencast is not supported over WebDriver.');
  }

  stopScreencast(): void {
    throw new Error('Screencast is not supported over WebDriver.');
  }

  async getContentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    throw new Error('Frames are not supported over WebDriver.');
  }

  async getOwnerFrame(handle: dom.ElementHandle): Promise<string | null> {
    throw new Error('Frames are not supported over WebDriver.');
  }

  async getFrameElement(frame: frames.Frame): Promise<dom.ElementHandle> {
    throw new Error('Frames are not supported over WebDriver.');
  }

  async setInputFilePaths(progress: Progress, handle: dom.ElementHandle<HTMLInputElement>, files: string[]): Promise<void> {
    throw new Error('Setting input files is not supported over WebDriver.');
  }

  async adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.FrameExecutionContext): Promise<dom.ElementHandle<T>> {
    throw new Error('Adopting element handles is not supported over WebDriver.');
  }
}

const kNoTiming: network.ResourceTiming = {
  startTime: 0, domainLookupStart: -1, domainLookupEnd: -1, connectStart: -1,
  secureConnectionStart: -1, connectEnd: -1, requestStart: -1, responseStart: -1,
};

function statusText(status: number): string {
  return status === 200 ? 'OK' : '';
}
