/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createGuid, eventsHelper } from '../utils';
import { HttpServer } from './utils/httpServer';
import { BrowserContext } from './browserContext';
import { Page } from './page';
import { ProgressController } from './progress';
import { Recorder, RecorderEvent } from './recorder';
import { CRPage } from './chromium/crPage';
import { CDPSession } from './chromium/crConnection';
import { CRBrowserContext } from './chromium/crBrowser';

import type { RegisteredListener } from '../utils';
import type { Transport } from './utils/httpServer';
import type { CRBrowser } from './chromium/crBrowser';
import type { ElementInfo } from '@recorder/recorderTypes';
import type { DevToolsChannel, DevToolsChannelEvents, Tab } from '@devtools/devtoolsChannel';

export class DevToolsController {
  private _context: BrowserContext;
  private _url: string | undefined;
  private _httpServer: HttpServer | undefined;

  constructor(context: BrowserContext) {
    this._context = context;
  }

  async start(options: { width: number, height: number, quality: number, port?: number, host?: string }): Promise<string> {
    if (!this._url) {
      const guid = createGuid();
      this._httpServer = new HttpServer();
      this._httpServer.createWebSocket(url => {
        if (url.searchParams.has('cdp'))
          return new CDPConnection(this._context, url.searchParams.get('cdp')!);
        return new DevToolsConnection(this._context, this._url!);
      }, guid);
      await this._httpServer.start({ port: options.port, host: options.host });
      this._url = (this._httpServer.urlPrefix('human-readable') + `/${guid}`).replace('http://', 'ws://');
    }
    return this._url;
  }

  async dispose() {
    await this._httpServer?.stop();
  }
}

class DevToolsConnection implements Transport, DevToolsChannel {
  readonly version = 1;

  sendEvent?: (method: string, params: any) => void;
  close?: () => void;

  selectedPage: Page | null = null;
  private _lastFrameData: string | null = null;
  private _lastViewportSize: { width: number, height: number } | null = null;
  private _pageListeners: RegisteredListener[] = [];
  private _contextListeners: RegisteredListener[] = [];
  private _recorderListeners: RegisteredListener[] = [];
  private _context: BrowserContext;
  private _controllerUrl: string;
  private _recorder: Recorder | null = null;
  private _eventListeners = new Map<string, Set<Function>>();

  constructor(context: BrowserContext, controllerUrl: string) {
    this._context = context;
    this._controllerUrl = controllerUrl;
  }

  on<K extends keyof DevToolsChannelEvents>(event: K, listener: (params: DevToolsChannelEvents[K]) => void): void {
    let set = this._eventListeners.get(event);
    if (!set) {
      set = new Set();
      this._eventListeners.set(event, set);
    }
    set.add(listener);
  }

  off<K extends keyof DevToolsChannelEvents>(event: K, listener: (params: DevToolsChannelEvents[K]) => void): void {
    this._eventListeners.get(event)?.delete(listener);
  }

  private _emit<K extends keyof DevToolsChannelEvents>(event: K, params: DevToolsChannelEvents[K]): void {
    this.sendEvent?.(event, params);
    const set = this._eventListeners.get(event);
    if (set) {
      for (const fn of set)
        fn(params);
    }
  }

  onconnect() {
    const context = this._context;

    this._contextListeners.push(
        eventsHelper.addEventListener(context, BrowserContext.Events.Page, (page: Page) => {
          this._sendTabList();
          if (!this.selectedPage)
            this._selectPage(page);
        }),
        eventsHelper.addEventListener(context, BrowserContext.Events.PageClosed, (page: Page) => {
          if (this.selectedPage === page) {
            this._deselectPage();
            const pages = context.pages();
            if (pages.length > 0)
              this._selectPage(pages[0]);
          }
          this._sendTabList();
        }),
        eventsHelper.addEventListener(context, BrowserContext.Events.InternalFrameNavigatedToNewDocument, (frame, page) => {
          if (frame === page.mainFrame())
            this._sendTabList();
        }),
    );

    // Auto-select first page.
    const pages = context.pages();
    if (pages.length > 0)
      this._selectPage(pages[0]);

    this._sendCachedState();
  }

  onclose() {
    this._cancelPicking();
    this._deselectPage();
    eventsHelper.removeEventListeners(this._contextListeners);
    this._contextListeners = [];
  }

  async dispatch(method: string, params: any): Promise<any> {
    return (this as any)[method]?.(params);
  }

  async selectTab(params: { pageId: string }) {
    const page = this._context.pages().find(p => p.guid === params.pageId);
    if (page)
      await this._selectPage(page);
  }

  async closeTab(params: { pageId: string }) {
    const page = this._context.pages().find(p => p.guid === params.pageId);
    if (page)
      await page.close({ reason: 'Closed from devtools' });
  }

  async newTab() {
    await ProgressController.runInternalTask(async progress => {
      const page = await this._context.newPage(progress);
      await this._selectPage(page);
    });
  }

  async navigate(params: { url: string }) {
    if (!this.selectedPage || !params.url)
      return;
    const page = this.selectedPage;
    await ProgressController.runInternalTask(async progress => { await page.mainFrame().goto(progress, params.url); });
  }

  async back() {
    if (!this.selectedPage)
      return;
    const page = this.selectedPage;
    await ProgressController.runInternalTask(async progress => { await page.goBack(progress, {}); });
  }

  async forward() {
    if (!this.selectedPage)
      return;
    const page = this.selectedPage;
    await ProgressController.runInternalTask(async progress => { await page.goForward(progress, {}); });
  }

  async reload() {
    if (!this.selectedPage)
      return;
    const page = this.selectedPage;
    await ProgressController.runInternalTask(async progress => { await page.reload(progress, {}); });
  }

  async mousemove(params: { x: number; y: number }) {
    if (!this.selectedPage)
      return;
    const page = this.selectedPage;
    await ProgressController.runInternalTask(async progress => { await page.mouse.move(progress, params.x, params.y); });
  }

  async mousedown(params: { x: number; y: number; button?: 'left' | 'right' | 'middle' }) {
    if (!this.selectedPage)
      return;
    const page = this.selectedPage;
    await ProgressController.runInternalTask(async progress => { await page.mouse.move(progress, params.x, params.y); await page.mouse.down(progress, { button: params.button || 'left' }); });
  }

  async mouseup(params: { x: number; y: number; button?: 'left' | 'right' | 'middle' }) {
    if (!this.selectedPage)
      return;
    const page = this.selectedPage;
    await ProgressController.runInternalTask(async progress => { await page.mouse.move(progress, params.x, params.y); await page.mouse.up(progress, { button: params.button || 'left' }); });
  }

  async wheel(params: { deltaX: number; deltaY: number }) {
    if (!this.selectedPage)
      return;
    const page = this.selectedPage;
    await ProgressController.runInternalTask(async progress => { await page.mouse.wheel(progress, params.deltaX, params.deltaY); });
  }

  async keydown(params: { key: string }) {
    if (!this.selectedPage)
      return;
    const page = this.selectedPage;
    await ProgressController.runInternalTask(async progress => { await page.keyboard.down(progress, params.key); });
  }

  async keyup(params: { key: string }) {
    if (!this.selectedPage)
      return;
    const page = this.selectedPage;
    await ProgressController.runInternalTask(async progress => { await page.keyboard.up(progress, params.key); });
  }

  private async _selectPage(page: Page) {
    if (this.selectedPage === page)
      return;

    if (this.selectedPage) {
      eventsHelper.removeEventListeners(this._pageListeners);
      this._pageListeners = [];
      await this.selectedPage.screencast.stopScreencast(this);
    }

    this.selectedPage = page;
    this._lastFrameData = null;
    this._lastViewportSize = null;
    this._sendTabList();

    this._pageListeners.push(
        eventsHelper.addEventListener(page, Page.Events.ScreencastFrame, frame => this._writeFrame(frame.buffer, frame.width, frame.height))
    );

    await page.screencast.startScreencast(this, { width: 1280, height: 800, quality: 90 });
  }

  private _deselectPage() {
    if (!this.selectedPage)
      return;
    this._cancelPicking();
    eventsHelper.removeEventListeners(this._pageListeners);
    this._pageListeners = [];
    this.selectedPage.screencast.stopScreencast(this);
    this.selectedPage = null;
    this._lastFrameData = null;
    this._lastViewportSize = null;
  }

  async pickLocator() {
    this._cancelPicking();
    const recorder = await Recorder.forContext(this._context, { omitCallTracking: true });
    this._recorder = recorder;
    this._recorderListeners.push(
        eventsHelper.addEventListener(recorder, RecorderEvent.ElementPicked, (elementInfo: ElementInfo) => {
          this._emit('elementPicked', { selector: elementInfo.selector });
          this._cancelPicking();
        }),
    );
    recorder.setMode('inspecting');
  }

  async cancelPickLocator() {
    this._cancelPicking();
  }

  private _cancelPicking() {
    eventsHelper.removeEventListeners(this._recorderListeners);
    this._recorderListeners = [];
    if (this._recorder) {
      this._recorder.setMode('none');
      this._recorder = null;
    }
  }

  private _sendCachedState() {
    if (this._lastFrameData && this._lastViewportSize)
      this._emit('frame', { data: this._lastFrameData, viewportWidth: this._lastViewportSize.width, viewportHeight: this._lastViewportSize.height });
    this._sendTabList();
  }

  async tabs(): Promise<{ tabs: Tab[] }> {
    return { tabs: await this._tabList() };
  }

  private async _tabList(): Promise<Tab[]> {
    return await Promise.all(this._context.pages().map(async page => ({
      pageId: page.guid,
      title: await page.mainFrame().title().catch(() => '') || page.mainFrame().url(),
      url: page.mainFrame().url(),
      selected: page === this.selectedPage,
      inspectorUrl: this._inspectorUrl(page),
    })));
  }

  private _devtoolsURL() {
    if (this._context._browser.options.wsEndpoint) {
      const url = new URL('/devtools/', this._context._browser.options.wsEndpoint);
      if (url.protocol === 'ws:')
        url.protocol = 'http:';
      if (url.protocol === 'wss:')
        url.protocol = 'https:';
      return url;
    }

    return new URL(`https://chrome-devtools-frontend.appspot.com/serve_rev/@${(this._context._browser as CRBrowser)._revision}/`);
  }

  private _inspectorUrl(page: Page): string | undefined {
    if (!(page.delegate instanceof CRPage))
      return;
    const inspector = new URL('./devtools_app.html', this._devtoolsURL());
    const cdp = new URL(this._controllerUrl);
    cdp.searchParams.set('cdp', page.guid);
    inspector.searchParams.set('ws', `${cdp.host}${cdp.pathname}${cdp.search}`);
    return inspector.toString();
  }

  private _sendTabList() {
    this._tabList().then(tabs => this._emit('tabs', { tabs }));
  }

  private _writeFrame(frame: Buffer, viewportWidth: number, viewportHeight: number) {
    const data = frame.toString('base64');
    this._lastFrameData = data;
    this._lastViewportSize = { width: viewportWidth, height: viewportHeight };
    this._emit('frame', { data, viewportWidth, viewportHeight });
  }
}

class CDPConnection implements Transport {
  sendEvent?: (method: string, params: any) => void;
  close?: () => void;

  private _context: BrowserContext;
  private _pageId: string;
  private _rawSession: CDPSession | null = null;
  private _rawSessionListeners: RegisteredListener[] = [];
  private _initializePromise: Promise<void> | undefined;

  constructor(context: BrowserContext, pageId: string) {
    this._context = context;
    this._pageId = pageId;
  }

  onconnect() {
    this._initializePromise = this._initializeRawSession(this._pageId);
  }

  async dispatch(method: string, params: any): Promise<any> {
    await this._initializePromise;
    if (!this._rawSession)
      throw new Error('CDP session is not initialized');
    return await this._rawSession.send(method, params);
  }

  onclose() {
    eventsHelper.removeEventListeners(this._rawSessionListeners);
    if (this._rawSession)
      void this._rawSession.detach().catch(() => {});
    this._rawSession = null;
    this._initializePromise = undefined;
  }

  private async _initializeRawSession(pageId: string) {
    const page = this._context.pages().find(p => p.guid === pageId);
    if (!page) {
      this.close?.();
      return;
    }
    const crContext = this._context as CRBrowserContext;
    const session = await crContext.newCDPSession(page);
    this._rawSession = session;
    this._rawSessionListeners = [
      eventsHelper.addEventListener(session, CDPSession.Events.Event, (event: { method: string, params?: any }) => {
        this.sendEvent?.(event.method, event.params);
      }),
      eventsHelper.addEventListener(session, CDPSession.Events.Closed, () => {
        this.close?.();
      }),
    ];
  }
}
