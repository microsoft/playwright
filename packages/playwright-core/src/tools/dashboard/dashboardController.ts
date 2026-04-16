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

import path from 'path';
import os from 'os';
import fs from 'fs';
import { execFile } from 'child_process';
import { eventsHelper } from '@utils/eventsHelper';
import { TraceLoader } from '@isomorphic/trace/traceLoader';
import { connectToBrowserAcrossVersions } from '../utils/connect';
import { serverRegistry } from '../../serverRegistry';
import { createClientInfo } from '../cli-client/registry';
import { DirTraceLoaderBackend } from '../trace/traceParser';

import type * as api from '../../..';
import type { Transport } from '@utils/httpServer';
import type { Tab } from '@dashboard/dashboardChannel';
import type { ContextEntry } from '@isomorphic/trace/entries';
import type { BrowserDescriptor, BrowserStatus } from '../../serverRegistry';

type Disposable = { dispose: () => Promise<void> };

export class DashboardConnection implements Transport {
  readonly version = 2;

  sendEvent?: (method: string, params: any) => void;
  close?: () => void;

  private _attached = new Map<string, AttachedBrowser>();
  private _onclose: () => void;
  private _serverRegistryDispose?: () => void;
  private _pushSessionsScheduled = false;
  private _visible = true;

  _recordingDir: string;
  _traceMap: Map<string, TraceLoader>;

  constructor(onclose: () => void, traceMap: Map<string, TraceLoader>) {
    this._onclose = onclose;
    this._traceMap = traceMap;
    this._recordingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-recordings-'));
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

  async reveal(params: { path: string }) {
    switch (os.platform()) {
      case 'darwin':
        execFile('open', ['-R', params.path]);
        break;
      case 'win32':
        execFile('explorer', ['/select,', params.path]);
        break;
      case 'linux':
        execFile('xdg-open', [path.dirname(params.path)]);
        break;
    }
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

  emitElementPicked(att: AttachedBrowser, pageGuid: string, selector: string, ariaSnapshot?: string) {
    this.sendEvent?.('elementPicked', {
      target: { browser: att.browserGuid, context: att.contextGuid, page: pageGuid },
      selector,
      ariaSnapshot,
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
  private _recordingPath: string | null = null;
  private _tracingStarted = false;
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
    this._recordingPath = null;
    if (this._tracingStarted)
      this._context.tracing.stop().catch(() => {});
    this._tracingStarted = false;
    this._selectedPage = null;
    const tracesDir = this._descriptor.browser.launchOptions.tracesDir;
    if (tracesDir)
      this._owner._traceMap.delete(tracesDir);
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
    this._owner.emitElementPicked(this, this._pageId(page), locator.toString(), await locator.ariaSnapshot());
  }

  async cancelPickLocator(params: { page: string }) {
    await this.pageForId(params.page)?.cancelPickLocator();
  }

  async startTracing() {
    if (this._tracingStarted)
      return;
    await this._context.tracing.start({
      snapshots: true,
      live: true,
    });
    this._tracingStarted = true;
  }

  async traceContextEntries(): Promise<{ contextEntries: ContextEntry[]; tracesDir: string }> {
    const tracesDir = this._descriptor.browser.launchOptions.tracesDir;
    if (!tracesDir)
      throw new Error('Tracing requires launchOptions.tracesDir');
    const backend = new DirTraceLoaderBackend(tracesDir);
    const loader = new TraceLoader();
    await loader.load(backend);
    this._owner._traceMap.set(tracesDir, loader);
    const contextEntries = loader.contextEntries.filter(entry => entry.contextId === this.contextGuid);
    return { contextEntries, tracesDir };
  }

  async startRecording(params: { page: string }) {
    const page = this.pageForId(params.page);
    if (!page)
      return;
    const artifactsDir = this._descriptor.browser.launchOptions.artifactsDir ?? this._owner._recordingDir;
    this._recordingPath = path.join(artifactsDir, `recording-${Date.now()}.webm`);
    if (page === this._selectedPage && this._screencastRunning)
      await this._restartScreencast(page);
  }

  async stopRecording(params: { page: string }): Promise<{ path: string }> {
    const path = this._recordingPath;
    if (!path)
      throw new Error('No recording in progress');
    this._recordingPath = null;
    const page = this.pageForId(params.page);
    if (page && page === this._selectedPage && this._screencastRunning)
      await this._restartScreencast(page);
    return { path };
  }

  async screenshot(params: { page: string }): Promise<string> {
    const page = this.pageForId(params.page);
    if (!page)
      throw new Error('No page selected');
    const buffer = await page.screenshot({ type: 'png' });
    return buffer.toString('base64');
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
      this._recordingPath = null;
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
      ...(this._recordingPath ? { path: this._recordingPath } : {}),
    });
    void page.screenshot().catch(() => {}); // TODO: this is necessary to trigger a first frame - should this be in screencast.start() implementation?
  }

  private async _restartScreencast(page: api.Page) {
    await page.screencast.stop().catch(() => {});
    await this._startScreencast(page);
  }

  private _deselectPage() {
    if (!this._selectedPage)
      return;
    this._pageListeners.forEach(d => d.dispose());
    this._pageListeners = [];
    if (this._screencastRunning)
      this._selectedPage.screencast.stop().catch(() => {});
    this._screencastRunning = false;
    this._recordingPath = null;
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
    return await Promise.all(pages.map(async page => {
      const title = await page.title();
      return {
        browser: this.browserGuid,
        context: this.contextGuid,
        page: this._pageId(page),
        title,
        url: page.url(),
        selected: page === this._selectedPage,
        faviconUrl: await this._faviconUrl(page),
      };
    }));
  }

  private _pageId(p: api.Page): string {
    // eslint-disable-next-line no-restricted-syntax -- _guid is very conservative.
    return (p as any)._guid;
  }

  private async _faviconUrl(page: api.Page): Promise<string | undefined> {
    const url = await page.evaluate(async () => {
      const response = await fetch(document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.href ?? '/favicon.ico');
      if (!response.ok)
        return undefined;
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }).catch(() => undefined);
    const timeout = new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), 3000));
    return await Promise.race([url, timeout]);
  }
}
