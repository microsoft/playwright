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

import { eventsHelper } from '../client/eventEmitter';

import type * as api from '../../types/types';
import type { Transport } from '../server/utils/httpServer';
import type { DevToolsChannel, DevToolsChannelEvents, Tab } from '@devtools/devtoolsChannel';

const pageIdSymbol = Symbol('pageId');

export class DevToolsConnection implements Transport, DevToolsChannel {
  readonly version = 1;

  sendEvent?: (method: string, params: any) => void;
  close?: () => void;

  selectedPage: api.Page | null = null;
  private _lastFrameData: string | null = null;
  private _lastViewportSize: { width: number, height: number } | null = null;
  private _pageListeners: { dispose: () => Promise<void> }[] = [];
  private _contextListeners: { dispose: () => Promise<void> }[] = [];
  private _eventListeners = new Map<string, Set<Function>>();
  private _context: api.BrowserContext;
  private _controllerUrl: URL;
  private _browserCdpPort?: number;

  private _nextPageId = 1;

  constructor(context: api.BrowserContext, controllerUrl: URL, cdpPort?: number) {
    this._context = context;
    this._controllerUrl = controllerUrl;
    this._browserCdpPort = cdpPort;
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
        eventsHelper.addEventListener(context, 'page', page => {
          this._sendTabList();
          if (!this.selectedPage)
            this._selectPage(page);
        }),
    );

    // Auto-select first page.
    const pages = context.pages();
    if (pages.length > 0)
      this._selectPage(pages[0]);

    this._sendCachedState();
  }

  onclose() {
    this._deselectPage();
    this._contextListeners.forEach(d => d.dispose());
    this._contextListeners = [];
  }

  async dispatch(method: string, params: any): Promise<any> {
    return (this as any)[method]?.(params);
  }

  async selectTab(params: { pageId: string }) {
    const page = this._context.pages().find(p => this._pageId(p) === params.pageId);
    if (page)
      await this._selectPage(page);
  }

  async closeTab(params: { pageId: string }) {
    const page = this._context.pages().find(p => this._pageId(p) === params.pageId);
    if (page)
      await page.close({ reason: 'Closed from devtools' });
  }

  async newTab() {
    const page = await this._context.newPage();
    await this._selectPage(page);
  }

  async navigate(params: { url: string }) {
    if (!this.selectedPage || !params.url)
      return;
    const page = this.selectedPage;
    await page.goto(params.url);
  }

  async back() {
    await this.selectedPage?.goBack();
  }

  async forward() {
    await this.selectedPage?.goForward();
  }

  async reload() {
    await this.selectedPage?.reload();
  }

  async mousemove(params: { x: number; y: number }) {
    await this.selectedPage?.mouse.move(params.x, params.y);
  }

  async mousedown(params: { x: number; y: number; button?: 'left' | 'right' | 'middle' }) {
    await this.selectedPage?.mouse.move(params.x, params.y);
    await this.selectedPage?.mouse.down({ button: params.button || 'left' });
  }

  async mouseup(params: { x: number; y: number; button?: 'left' | 'right' | 'middle' }) {
    await this.selectedPage?.mouse.move(params.x, params.y);
    await this.selectedPage?.mouse.up({ button: params.button || 'left' });
  }

  async wheel(params: { deltaX: number; deltaY: number }) {
    await this.selectedPage?.mouse.wheel(params.deltaX, params.deltaY);
  }

  async keydown(params: { key: string }) {
    await this.selectedPage?.keyboard.down(params.key);
  }

  async keyup(params: { key: string }) {
    await this.selectedPage?.keyboard.up(params.key);
  }

  private async _selectPage(page: api.Page) {
    if (this.selectedPage === page)
      return;

    if (this.selectedPage) {
      this._pageListeners.forEach(d => d.dispose());
      this._pageListeners = [];
      await this.selectedPage.inspector().stopScreencast();
    }

    this.selectedPage = page;
    this._lastFrameData = null;
    this._lastViewportSize = null;
    this._sendTabList();

    this._pageListeners.push(
        eventsHelper.addEventListener(page, 'close', () => {
          this._deselectPage();
          const pages = page.context().pages();
          if (pages.length > 0)
            this._selectPage(pages[0]);
          this._sendTabList();
        }),
        eventsHelper.addEventListener(page, 'framenavigated', frame => {
          if (frame === page.mainFrame())
            this._sendTabList();
        }),
        eventsHelper.addEventListener(page.inspector(), 'screencastframe', ({ data }) => this._writeFrame(data, page.viewportSize()?.width ?? 0, page.viewportSize()?.height ?? 0))
    );

    const maxSize = { width: 1280, height: 800 };
    await page.inspector().startScreencast({ maxSize });
  }

  private _deselectPage() {
    if (!this.selectedPage)
      return;
    this._pageListeners.forEach(d => d.dispose());
    this._pageListeners = [];
    this.selectedPage.inspector().stopScreencast().catch(() => {});
    this.selectedPage = null;
    this._lastFrameData = null;
    this._lastViewportSize = null;
  }

  async pickLocator() {
    if (!this.selectedPage)
      return;
    const locator = await this.selectedPage.inspector().pickLocator();
    this._emit('elementPicked', { selector: locator.toString() });
  }

  async cancelPickLocator() {
    await this.selectedPage?.inspector().cancelPickLocator();
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
    const pages = this._context.pages();
    if (pages.length === 0)
      return [];
    const devtoolsUrl = await this._devtoolsUrl(pages[0]);
    return await Promise.all(pages.map(async page => ({
      pageId: this._pageId(page),
      title: await page.title() || page.url(),
      url: page.url(),
      selected: page === this.selectedPage,
      inspectorUrl: devtoolsUrl ? await this._pageInspectorUrl(page, devtoolsUrl) : 'data:text/plain,DevTools only supported in Chromium based browsers',
    })));
  }

  pageForId(pageId: string) {
    return this._context.pages().find(p => this._pageId(p) === pageId);
  }

  private _pageId(p: api.Page): string {
    const page = p as any;
    if (!page[pageIdSymbol])
      page[pageIdSymbol] = 'page_' + this._nextPageId++;
    return page[pageIdSymbol];
  }

  private async _devtoolsUrl(page: api.Page) {
    if (this._browserCdpPort)
      return new URL(`http://localhost:${this._browserCdpPort}/devtools/`);

    const browserRevision = await getBrowserRevision(page);
    if (!browserRevision)
      return null;
    return new URL(`https://chrome-devtools-frontend.appspot.com/serve_rev/${browserRevision}/`);
  }

  private async _pageInspectorUrl(page: api.Page, devtoolsUrl: URL): Promise<string | undefined> {
    const inspector = new URL('./devtools_app.html', devtoolsUrl);
    const cdp = new URL(this._controllerUrl);
    cdp.searchParams.set('cdpPageId', this._pageId(page));
    inspector.searchParams.set('ws', `${cdp.host}${cdp.pathname}${cdp.search}`);
    const url = inspector.toString();
    return url;
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

async function getBrowserRevision(page: api.Page): Promise<string | null> {
  try {
    const session = await page.context().newCDPSession(page);
    const version = await session.send('Browser.getVersion');
    await session.detach();
    return version.revision;
  } catch (error) {
    return null;
  }
}

export class CDPConnection implements Transport {
  sendEvent?: (method: string, params: any) => void;
  close?: () => void;

  private _page: api.Page;
  private _rawSession: api.CDPSession | null = null;
  private _rawSessionListeners: { dispose: () => Promise<void> }[] = [];
  private _initializePromise: Promise<void> | undefined;

  constructor(page: api.Page) {
    this._page = page;
  }

  onconnect() {
    this._initializePromise = this._initializeRawSession();
  }

  async dispatch(method: string, params: any): Promise<any> {
    await this._initializePromise;
    if (!this._rawSession)
      throw new Error('CDP session is not initialized');
    return await this._rawSession.send(method as any, params);
  }

  onclose() {
    this._rawSessionListeners.forEach(listener => listener.dispose());
    this._rawSession?.detach().catch(() => {});
    this._rawSession = null;
    this._initializePromise = undefined;
  }

  private async _initializeRawSession() {
    const session = await this._page.context().newCDPSession(this._page);
    this._rawSession = session;
    this._rawSessionListeners = [
      eventsHelper.addEventListener(session, 'event', ({ method, params }) => {
        this.sendEvent?.(method, params);
      }),
      eventsHelper.addEventListener(session, 'close', () => {
        this.close?.();
      }),
    ];
  }
}
