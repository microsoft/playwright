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

import { eventsHelper } from '@utils/eventsHelper';
import { connectToBrowserAcrossVersions } from '../utils/connect';
import { serverRegistry } from '../../serverRegistry';
import { createClientInfo } from '../cli-client/registry';

import type * as api from '../../..';
import type { Transport } from '@utils/httpServer';
import type { Tab } from '@dashboard/dashboardChannel';
import type { BrowserDescriptor, BrowserStatus } from '../../serverRegistry';

type Disposable = { dispose: () => Promise<void> };

export class DashboardConnection implements Transport {
  readonly version = 2;

  sendEvent?: (method: string, params: any) => void;
  close?: () => void;

  private _attached = new Map<string, AttachedBrowser>();
  private _cdpUrl: URL;
  private _onclose: () => void;
  private _serverRegistryDispose?: () => void;
  private _pushSessionsScheduled = false;
  private _visible = true;

  constructor(cdpUrl: URL, onclose: () => void) {
    this._cdpUrl = cdpUrl;
    this._onclose = onclose;
  }

  onconnect() {
    this._serverRegistryDispose = serverRegistry.watch();
    serverRegistry.on('added', this._pushSessions);
    serverRegistry.on('removed', this._pushSessions);
    serverRegistry.on('changed', this._pushSessions);
    this._pushSessions();
  }

  onclose() {
    serverRegistry.off('added', this._pushSessions);
    serverRegistry.off('removed', this._pushSessions);
    serverRegistry.off('changed', this._pushSessions);
    this._serverRegistryDispose?.();
    this._serverRegistryDispose = undefined;
    for (const att of this._attached.values())
      att.dispose();
    this._attached.clear();
    this._onclose();
  }

  async dispatch(method: string, params: any): Promise<any> {
    // eslint-disable-next-line no-restricted-syntax
    const handler = (this as any)[method];
    if (typeof handler === 'function')
      return handler.call(this, params);
    const att = params?.browser ? this._attached.get(params.browser) : undefined;
    // eslint-disable-next-line no-restricted-syntax
    const onAtt = att ? (att as any)[method] : undefined;
    if (typeof onAtt === 'function')
      return onAtt.call(att, params);
  }

  async attach(params: { browser: string }): Promise<{ context: string }> {
    if (this._attached.has(params.browser))
      return { context: this._attached.get(params.browser)!.contextGuid };
    const descriptor = serverRegistry.readDescriptor(params.browser);
    const browser = await connectToBrowserAcrossVersions(descriptor);
    const context = browser.contexts()[0];
    const att = new AttachedBrowser(this, params.browser, descriptor, context);
    this._attached.set(params.browser, att);
    await att.init();
    return { context: att.contextGuid };
  }

  async detach(params: { browser: string }) {
    const att = this._attached.get(params.browser);
    if (att) {
      this._attached.delete(params.browser);
      att.dispose();
    }
  }

  async closeSession(params: { browser: string }) {
    const descriptor = serverRegistry.readDescriptor(params.browser);
    const browser = await connectToBrowserAcrossVersions(descriptor);
    try {
      await Promise.all(browser.contexts().map(context => context.close()));
      await browser.close();
    } catch {
      // best-effort
    }
  }

  async deleteSessionData(params: { browser: string }) {
    await serverRegistry.deleteUserData(params.browser);
  }

  async setVisible(params: { visible: boolean }) {
    if (this._visible === params.visible)
      return;
    this._visible = params.visible;
    await Promise.all([...this._attached.values()].map(att => att.setScreencastActive(params.visible)));
  }

  visible(): boolean {
    return this._visible;
  }

  pageForId(pageGuid: string): api.Page | undefined {
    for (const att of this._attached.values()) {
      const page = att.pageForId(pageGuid);
      if (page)
        return page;
    }
    return undefined;
  }

  cdpUrl(): URL {
    return this._cdpUrl;
  }

  emitSessions(sessions: BrowserStatus[]) {
    this.sendEvent?.('sessions', { sessions, clientInfo: createClientInfo() });
  }

  emitTabs(att: AttachedBrowser, tabs: Tab[]) {
    this.sendEvent?.('tabs', { target: { browser: att.browserGuid, context: att.contextGuid }, tabs });
  }

  emitFrame(att: AttachedBrowser, pageGuid: string, data: string, viewportWidth: number, viewportHeight: number) {
    this.sendEvent?.('frame', {
      target: { browser: att.browserGuid, context: att.contextGuid, page: pageGuid },
      data, viewportWidth, viewportHeight,
    });
  }

  emitElementPicked(att: AttachedBrowser, pageGuid: string, selector: string) {
    this.sendEvent?.('elementPicked', {
      target: { browser: att.browserGuid, context: att.contextGuid, page: pageGuid },
      selector,
    });
  }

  emitPickLocator(att: AttachedBrowser, pageGuid: string) {
    this.sendEvent?.('pickLocator', {
      target: { browser: att.browserGuid, context: att.contextGuid, page: pageGuid },
    });
  }

  private _pushSessions = () => {
    if (this._pushSessionsScheduled)
      return;
    this._pushSessionsScheduled = true;
    queueMicrotask(async () => {
      this._pushSessionsScheduled = false;
      try {
        const byWs = await serverRegistry.list();
        const sessions: BrowserStatus[] = [];
        for (const list of byWs.values())
          sessions.push(...list);
        this.emitSessions(sessions);
      } catch {
        // best-effort
      }
    });
  };
}

class AttachedBrowser {
  readonly browserGuid: string;
  readonly contextGuid: string;

  private _owner: DashboardConnection;
  private _descriptor: BrowserDescriptor;
  private _context: api.BrowserContext;

  private _selectedPage: api.Page | null = null;
  private _screencastRunning = false;
  private _pageListeners: Disposable[] = [];
  private _contextListeners: Disposable[] = [];

  constructor(owner: DashboardConnection, browserGuid: string, descriptor: BrowserDescriptor, context: api.BrowserContext) {
    this._owner = owner;
    this.browserGuid = browserGuid;
    this._descriptor = descriptor;
    this._context = context;
    // eslint-disable-next-line no-restricted-syntax -- _guid is very conservative.
    this.contextGuid = (context as any)._guid;
  }

  async init() {
    this._contextListeners.push(
        eventsHelper.addEventListener(this._context, 'page', page => {
          this._pushTabs();
          if (!this._selectedPage)
            this._selectPage(page).catch(() => {});
        }),
        eventsHelper.addEventListener(this._context, 'picklocator', page => {
          this._selectPage(page)
              .then(() => this._owner.emitPickLocator(this, this._pageId(page)))
              .catch(() => {});
        }),
    );
    const pages = this._context.pages();
    if (pages.length > 0)
      await this._selectPage(pages[0]);
    this._pushTabs();
  }

  dispose() {
    this._contextListeners.forEach(d => d.dispose());
    this._contextListeners = [];
    this._pageListeners.forEach(d => d.dispose());
    this._pageListeners = [];
    if (this._selectedPage && this._screencastRunning)
      this._selectedPage.screencast.stop().catch(() => {});
    this._screencastRunning = false;
    this._selectedPage = null;
  }

  async setScreencastActive(active: boolean) {
    if (!this._selectedPage)
      return;
    if (active && !this._screencastRunning) {
      this._screencastRunning = true;
      await this._startScreencast(this._selectedPage);
    } else if (!active && this._screencastRunning) {
      this._screencastRunning = false;
      await this._selectedPage.screencast.stop().catch(() => {});
    }
  }

  pageForId(pageGuid: string): api.Page | undefined {
    return this._context.pages().find(p => this._pageId(p) === pageGuid);
  }

  async tabs(): Promise<{ tabs: Tab[] }> {
    return { tabs: await this._tabList() };
  }

  async newTab(): Promise<{ page: string }> {
    const page = await this._context.newPage();
    await this._selectPage(page);
    return { page: this._pageId(page) };
  }

  async selectTab(params: { page: string }) {
    const page = this.pageForId(params.page);
    if (page)
      await this._selectPage(page);
  }

  async closeTab(params: { page: string }) {
    const page = this.pageForId(params.page);
    if (page)
      await page.close({ reason: 'Closed in Dashboard' });
  }

  async navigate(params: { page: string; url: string }) {
    if (!params.url)
      return;
    await this.pageForId(params.page)?.goto(params.url);
  }

  async back(params: { page: string }) {
    await this.pageForId(params.page)?.goBack();
  }

  async forward(params: { page: string }) {
    await this.pageForId(params.page)?.goForward();
  }

  async reload(params: { page: string }) {
    await this.pageForId(params.page)?.reload();
  }

  async mousemove(params: { page: string; x: number; y: number }) {
    await this.pageForId(params.page)?.mouse.move(params.x, params.y);
  }

  async mousedown(params: { page: string; x: number; y: number; button?: 'left' | 'middle' | 'right' }) {
    const page = this.pageForId(params.page);
    if (!page)
      return;
    await page.mouse.move(params.x, params.y);
    await page.mouse.down({ button: params.button || 'left' });
  }

  async mouseup(params: { page: string; x: number; y: number; button?: 'left' | 'middle' | 'right' }) {
    const page = this.pageForId(params.page);
    if (!page)
      return;
    await page.mouse.move(params.x, params.y);
    await page.mouse.up({ button: params.button || 'left' });
  }

  async wheel(params: { page: string; deltaX: number; deltaY: number }) {
    await this.pageForId(params.page)?.mouse.wheel(params.deltaX, params.deltaY);
  }

  async keydown(params: { page: string; key: string }) {
    await this.pageForId(params.page)?.keyboard.down(params.key);
  }

  async keyup(params: { page: string; key: string }) {
    await this.pageForId(params.page)?.keyboard.up(params.key);
  }

  async pickLocator(params: { page: string }) {
    const page = this.pageForId(params.page);
    if (!page)
      return;
    const locator = await page.pickLocator();
    this._owner.emitElementPicked(this, this._pageId(page), locator.toString());
  }

  async cancelPickLocator(params: { page: string }) {
    await this.pageForId(params.page)?.cancelPickLocator();
  }

  private async _selectPage(page: api.Page) {
    if (this._selectedPage === page)
      return;

    if (this._selectedPage) {
      this._pageListeners.forEach(d => d.dispose());
      this._pageListeners = [];
      if (this._screencastRunning)
        await this._selectedPage.screencast.stop();
      this._screencastRunning = false;
    }

    this._selectedPage = page;
    this._pushTabs();

    this._pageListeners.push(
        eventsHelper.addEventListener(page, 'close', () => {
          this._deselectPage();
          const pages = page.context().pages();
          if (pages.length > 0)
            this._selectPage(pages[0]).catch(() => {});
          this._pushTabs();
        }),
        eventsHelper.addEventListener(page, 'framenavigated', frame => {
          if (frame === page.mainFrame())
            this._pushTabs();
        }),
    );

    if (this._owner.visible()) {
      this._screencastRunning = true;
      await this._startScreencast(page);
    }
  }

  private async _startScreencast(page: api.Page) {
    await page.screencast.start({
      onFrame: ({ data }: { data: Buffer }) => this._writeFrame(page, data, page.viewportSize()?.width ?? 0, page.viewportSize()?.height ?? 0),
      size: { width: 1280, height: 800 },
    });
  }

  private _deselectPage() {
    if (!this._selectedPage)
      return;
    this._pageListeners.forEach(d => d.dispose());
    this._pageListeners = [];
    if (this._screencastRunning)
      this._selectedPage.screencast.stop().catch(() => {});
    this._screencastRunning = false;
    this._selectedPage = null;
  }

  private _pushTabs() {
    this._tabList().then(tabs => this._owner.emitTabs(this, tabs)).catch(() => {});
  }

  private _writeFrame(page: api.Page, frame: Buffer, viewportWidth: number, viewportHeight: number) {
    this._owner.emitFrame(this, this._pageId(page), frame.toString('base64'), viewportWidth, viewportHeight);
  }

  private async _tabList(): Promise<Tab[]> {
    const pages = this._context.pages();
    if (pages.length === 0)
      return [];
    const devtoolsUrl = await this._devtoolsUrl(pages[0]);
    return await Promise.all(pages.map(async page => {
      const title = await page.title();
      return {
        browser: this.browserGuid,
        context: this.contextGuid,
        page: this._pageId(page),
        title,
        url: page.url(),
        selected: page === this._selectedPage,
        inspectorUrl: devtoolsUrl ? await this._pageInspectorUrl(page, devtoolsUrl) : 'data:text/plain,Dashboard only supported in Chromium based browsers',
      };
    }));
  }

  private _pageId(p: api.Page): string {
    // eslint-disable-next-line no-restricted-syntax -- _guid is very conservative.
    return (p as any)._guid;
  }

  private async _devtoolsUrl(page: api.Page): Promise<URL | null> {
    // eslint-disable-next-line no-restricted-syntax -- cdpPort is not in the public LaunchOptions type, fine if regresses.
    const cdpPort = (this._descriptor.browser.launchOptions as any).cdpPort;
    if (cdpPort)
      return new URL(`http://localhost:${cdpPort}/devtools/`);

    const browserRevision = await getBrowserRevision(page);
    if (!browserRevision)
      return null;
    return new URL(`https://chrome-devtools-frontend.appspot.com/serve_rev/${browserRevision}/`);
  }

  private async _pageInspectorUrl(page: api.Page, devtoolsUrl: URL): Promise<string | undefined> {
    const inspector = new URL('./devtools_app.html', devtoolsUrl);
    const cdp = new URL(this._owner.cdpUrl());
    cdp.searchParams.set('cdpPageId', this._pageId(page));
    inspector.searchParams.set('ws', `${cdp.host}${cdp.pathname}${cdp.search}`);
    return inspector.toString();
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
    return await this._rawSession.send(method as Parameters<api.CDPSession['send']>[0], params);
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
