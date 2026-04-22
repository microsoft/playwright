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
import crypto from 'crypto';
import { execFile } from 'child_process';
import { Disposable } from '@isomorphic/disposable';
import { eventsHelper } from '@utils/eventsHelper';
import { connectToBrowserAcrossVersions } from '../utils/connect';
import { serverRegistry } from '../../serverRegistry';
import { createClientInfo } from '../cli-client/registry';

import type * as api from '../../..';
import type { Transport } from '@utils/httpServer';
import type { AnnotationData, Tab } from '@dashboard/dashboardChannel';
import type { BrowserDescriptor, BrowserStatus } from '../../serverRegistry';

type BrowserTrackerCallbacks = {
  onTabsChanged: () => void;
  onPickLocator: (page: api.Page) => void;
  onContextClosed: (context: api.BrowserContext) => void;
};

class BrowserTracker {
  readonly descriptor: BrowserDescriptor;
  readonly browser: api.Browser;
  private _callbacks: BrowserTrackerCallbacks;
  private _contextListeners = new Map<api.BrowserContext, Disposable[]>();
  private _browserListeners: Disposable[] = [];

  static async create(descriptor: BrowserDescriptor, callbacks: BrowserTrackerCallbacks): Promise<BrowserTracker | undefined> {
    try {
      const browser = await connectToBrowserAcrossVersions(descriptor);
      const slot = new BrowserTracker(descriptor, browser, callbacks);
      for (const context of browser.contexts())
        slot._wireContext(context);
      slot._browserListeners.push(eventsHelper.addEventListener(browser, 'context', (context: api.BrowserContext) => {
        slot._wireContext(context);
      }));
      return slot;
    } catch {
      return undefined;
    }
  }

  private constructor(descriptor: BrowserDescriptor, browser: api.Browser, callbacks: BrowserTrackerCallbacks) {
    this.descriptor = descriptor;
    this.browser = browser;
    this._callbacks = callbacks;
  }

  contexts(): api.BrowserContext[] {
    return this.browser.contexts();
  }

  dispose() {
    this._browserListeners.forEach(d => d.dispose());
    this._browserListeners = [];
    for (const listeners of this._contextListeners.values())
      listeners.forEach(d => d.dispose());
    this._contextListeners.clear();
  }

  private _wireContext(context: api.BrowserContext) {
    if (this._contextListeners.has(context))
      return;
    const onTabsChanged = () => this._callbacks.onTabsChanged();
    const listeners: Disposable[] = [
      eventsHelper.addEventListener(context, 'page', onTabsChanged),
      eventsHelper.addEventListener(context, 'pageload', onTabsChanged),
      eventsHelper.addEventListener(context, 'pageclose', onTabsChanged),
      eventsHelper.addEventListener(context, 'framenavigated', (frame: api.Frame) => {
        if (frame === frame.page().mainFrame())
          this._callbacks.onTabsChanged();
      }),
      eventsHelper.addEventListener(context, 'picklocator', (page: api.Page) => {
        this._callbacks.onPickLocator(page);
      }),
      eventsHelper.addEventListener(context, 'close', () => {
        const ls = this._contextListeners.get(context);
        if (ls) {
          ls.forEach(d => d.dispose());
          this._contextListeners.delete(context);
        }
        this._callbacks.onContextClosed(context);
        this._callbacks.onTabsChanged();
      }),
    ];
    this._contextListeners.set(context, listeners);
    this._callbacks.onTabsChanged();
  }
}

export class DashboardConnection implements Transport {
  sendEvent?: (method: string, params: any) => void;
  close?: () => void;

  private _browsers = new Map<string, BrowserTracker>();
  private _attachedPage: AttachedPage | undefined;
  private _onclose: () => void;
  private _onconnected?: () => void;
  private _onAnnotationSubmit?: (base64Png: string, annotations: AnnotationData[]) => void;
  private _serverRegistryDispose?: () => void;
  private _pushSessionsScheduled = false;
  private _pushTabsScheduled = false;
  private _visible = true;
  private _pendingReveal: { sessionName: string; workspaceDir?: string } | undefined;

  _recordingDir: string;
  _streams = new Map<string, { handle: fs.promises.FileHandle; path: string }>();

  constructor(onclose: () => void, onconnected?: () => void, onAnnotationSubmit?: (base64Png: string, annotations: AnnotationData[]) => void) {
    this._onclose = onclose;
    this._onconnected = onconnected;
    this._onAnnotationSubmit = onAnnotationSubmit;
    this._recordingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-recordings-'));
  }

  onconnect() {
    this._serverRegistryDispose = serverRegistry.watch();
    serverRegistry.on('added', this._pushSessions);
    serverRegistry.on('removed', this._pushSessions);
    serverRegistry.on('changed', this._pushSessions);
    this._pushSessions();
    this._onconnected?.();
  }

  onclose() {
    serverRegistry.off('added', this._pushSessions);
    serverRegistry.off('removed', this._pushSessions);
    serverRegistry.off('changed', this._pushSessions);
    this._serverRegistryDispose?.();
    this._serverRegistryDispose = undefined;
    this._attachedPage?.dispose();
    this._attachedPage = undefined;
    for (const stream of this._streams.values()) {
      void stream.handle.close()
          .catch(() => {})
          .then(() => fs.promises.unlink(stream.path))
          .catch(() => {});
    }
    this._streams.clear();
    for (const tracker of this._browsers.values())
      tracker.dispose();
    this._browsers.clear();
    this._onclose();
  }

  async dispatch(method: string, params: any): Promise<any> {
    // eslint-disable-next-line no-restricted-syntax
    const handler = (this as any)[method];
    if (typeof handler === 'function')
      return handler.call(this, params);
    const attached = this._attachedPage;
    if (!attached)
      return;
    // eslint-disable-next-line no-restricted-syntax
    const onAtt = (attached as any)[method];
    if (typeof onAtt === 'function')
      return onAtt.call(attached, params);
  }

  async selectTab(params: { browser: string; context: string; page: string }) {
    const page = this._findPage(params);
    if (page)
      await this._switchAttachedTo(page);
    this._pushTabs();
  }

  async newTab(params: { browser: string; context: string }) {
    const context = this._findContext(params);
    if (!context)
      return;
    const page = await context.newPage();
    await this._switchAttachedTo(page);
    this._pushTabs();
  }

  async closeTab(params: { browser: string; context: string; page: string }) {
    const page = this._findPage(params);
    await page?.close({ reason: 'Closed in Dashboard' });
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
    await this._attachedPage?.setScreencastActive(params.visible);
  }

  revealSession(sessionName: string, workspaceDir?: string) {
    this._pendingReveal = { sessionName, workspaceDir };
    void this._tryRevealPending();
  }

  private async _tryRevealPending() {
    const pending = this._pendingReveal;
    if (!pending)
      return;
    const slot = [...this._browsers.values()].find(s =>
      s.descriptor.title === pending.sessionName
        && (pending.workspaceDir === undefined || s.descriptor.workspaceDir === pending.workspaceDir));
    if (!slot)
      return;
    const page = slot.browser.contexts().flatMap(c => c.pages())[0];
    if (!page)
      return;
    this._pendingReveal = undefined;
    await this._switchAttachedTo(page);
    this._pushTabs();
  }

  async submitAnnotation(params: { data: string; annotations: AnnotationData[] }) {
    this._onAnnotationSubmit?.(params.data, params.annotations);
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

  async readStream(params: { streamId: string }): Promise<{ data: string; eof: boolean }> {
    const stream = this._streams.get(params.streamId);
    if (!stream)
      throw new Error(`Unknown stream: ${params.streamId}`);
    const buffer = Buffer.alloc(256 * 1024);
    const { bytesRead } = await stream.handle.read(buffer, 0, buffer.length);
    if (bytesRead === 0) {
      this._streams.delete(params.streamId);
      await stream.handle.close().catch(() => {});
      await fs.promises.unlink(stream.path).catch(() => {});
      return { data: '', eof: true };
    }
    return { data: buffer.subarray(0, bytesRead).toString('base64'), eof: false };
  }

  visible(): boolean {
    return this._visible;
  }

  emitSessions(sessions: BrowserStatus[]) {
    this.sendEvent?.('sessions', { sessions, clientInfo: createClientInfo() });
  }

  emitTabs(tabs: Tab[]) {
    this.sendEvent?.('tabs', { tabs });
  }

  emitFrame(data: string, viewportWidth: number, viewportHeight: number) {
    this.sendEvent?.('frame', { data, viewportWidth, viewportHeight });
  }

  emitElementPicked(selector: string, ariaSnapshot?: string) {
    this.sendEvent?.('elementPicked', { selector, ariaSnapshot });
  }

  emitPickLocator() {
    this.sendEvent?.('pickLocator', {});
  }

  emitAnnotate() {
    this.sendEvent?.('annotate', {});
  }

  emitCancelAnnotate() {
    this.sendEvent?.('cancelAnnotate', {});
  }

  _pushTabs() {
    if (this._pushTabsScheduled)
      return;
    this._pushTabsScheduled = true;
    queueMicrotask(async () => {
      this._pushTabsScheduled = false;
      try {
        const tabs = await this._aggregateTabs();
        this.emitTabs(tabs);
      } catch {
        // best-effort
      }
    });
  }

  private async _aggregateTabs(): Promise<Tab[]> {
    const attachedPage = this._attachedPage?.page;
    const tasks: Promise<Tab>[] = [];
    for (const { browser } of this._browsers.values()) {
      for (const context of browser.contexts()) {
        for (const page of context.pages()) {
          tasks.push((async () => ({
            browser: browserId(browser),
            context: contextId(context),
            page: pageId(page),
            title: await page.title().catch(() => ''),
            url: page.url(),
            selected: page === attachedPage,
            faviconUrl: await faviconUrl(page),
          }))());
        }
      }
    }
    return await Promise.all(tasks);
  }

  private async _switchAttachedTo(page: api.Page) {
    if (this._attachedPage?.page === page)
      return;
    this._attachedPage?.dispose();
    const browser = page.context().browser();
    const slot = browser ? [...this._browsers.values()].find(s => s.browser === browser) : undefined;
    if (!slot) {
      this._attachedPage = undefined;
      return;
    }
    const attached = new AttachedPage(this, slot, page);
    this._attachedPage = attached;
    try {
      await attached.init();
    } catch (e) {
      if (this._attachedPage === attached)
        this._attachedPage = undefined;
      attached.dispose();
      throw e;
    }
  }

  _handleAttachedPageClose(context: api.BrowserContext) {
    this._attachedPage?.dispose();
    this._attachedPage = undefined;
    const next = context.pages()[0];
    if (next)
      void this._switchAttachedTo(next);
    this._pushTabs();
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
        for (const list of byWs.values()) {
          for (const status of list) {
            if (status.title.startsWith('--playwright-internal'))
              continue;
            sessions.push(status);
          }
        }
        await this._reconcile(sessions);
        await this._tryRevealPending();
        this.emitSessions(sessions);
        this._pushTabs();
      } catch {
        // best-effort
      }
    });
  };

  private async _reconcile(sessions: BrowserStatus[]) {
    const connectable = new Map<string, BrowserStatus>();
    for (const status of sessions) {
      if (status.canConnect)
        connectable.set(status.browser.guid, status);
    }

    for (const [guid, slot] of this._browsers) {
      if (connectable.has(guid))
        continue;
      if (this._attachedPage && this._attachedPage.page.context().browser() === slot.browser) {
        this._attachedPage.dispose();
        this._attachedPage = undefined;
      }
      slot.dispose();
      this._browsers.delete(guid);
    }

    for (const [guid, status] of connectable) {
      if (this._browsers.has(guid))
        continue;
      const slot = await BrowserTracker.create(status, {
        onTabsChanged: () => this._pushTabs(),
        onPickLocator: page => { this._onPickLocator(page).catch(() => {}); },
        onContextClosed: context => {
          if (this._attachedPage?.page.context() === context) {
            this._attachedPage.dispose();
            this._attachedPage = undefined;
          }
        },
      });
      if (!slot)
        continue;
      if (this._browsers.has(guid)) {
        slot.dispose();
        continue;
      }
      this._browsers.set(guid, slot);
    }
  }

  private _findContext(params: { browser: string; context: string }): api.BrowserContext | undefined {
    const slot = this._browsers.get(params.browser);
    if (!slot)
      return undefined;
    return slot.contexts().find(c => contextId(c) === params.context);
  }

  private _findPage(params: { browser: string; context: string; page: string }): api.Page | undefined {
    const context = this._findContext(params);
    return context?.pages().find(p => pageId(p) === params.page);
  }

  private async _onPickLocator(page: api.Page) {
    await this._switchAttachedTo(page);
    this.emitPickLocator();
  }
}

class AttachedPage {
  private _owner: DashboardConnection;
  private _slot: BrowserTracker;
  private _page: api.Page;
  private _listeners: Disposable[] = [];
  private _screencastRunning = false;
  private _recordingPath: string | null = null;
  private _disposed = false;

  constructor(owner: DashboardConnection, slot: BrowserTracker, page: api.Page) {
    this._owner = owner;
    this._slot = slot;
    this._page = page;
  }

  get page(): api.Page { return this._page; }
  private get _descriptor(): BrowserDescriptor { return this._slot.descriptor; }

  async init() {
    this._listeners.push(
        eventsHelper.addEventListener(this._page, 'close', () => {
          this._owner._handleAttachedPageClose(this._page.context());
        }),
        eventsHelper.addEventListener(this._page, 'framenavigated', (frame: api.Frame) => {
          if (frame === this._page.mainFrame())
            this._owner._pushTabs();
        }),
    );
    this._owner._pushTabs();
    if (this._owner.visible()) {
      this._screencastRunning = true;
      await this._startScreencast(this._page);
    }
  }

  dispose() {
    this._disposed = true;
    this._listeners.forEach(d => d.dispose());
    this._listeners = [];
    if (this._screencastRunning)
      this._page.screencast.stop().catch(() => {});
    this._screencastRunning = false;
    this._recordingPath = null;
  }

  async setScreencastActive(active: boolean) {
    if (active && !this._screencastRunning) {
      this._screencastRunning = true;
      await this._startScreencast(this._page);
    } else if (!active && this._screencastRunning) {
      this._screencastRunning = false;
      await this._page.screencast.stop().catch(() => {});
    }
  }

  async navigate(params: { url: string }) {
    if (!params.url)
      return;
    await this._page.goto(params.url);
  }

  async back() {
    await this._page.goBack();
  }

  async forward() {
    await this._page.goForward();
  }

  async reload() {
    await this._page.reload();
  }

  async mousemove(params: { x: number; y: number }) {
    await this._page.mouse.move(params.x, params.y);
  }

  async mousedown(params: { x: number; y: number; button?: 'left' | 'middle' | 'right' }) {
    await this._page.mouse.move(params.x, params.y);
    await this._page.mouse.down({ button: params.button || 'left' });
  }

  async mouseup(params: { x: number; y: number; button?: 'left' | 'middle' | 'right' }) {
    await this._page.mouse.move(params.x, params.y);
    await this._page.mouse.up({ button: params.button || 'left' });
  }

  async wheel(params: { deltaX: number; deltaY: number }) {
    await this._page.mouse.wheel(params.deltaX, params.deltaY);
  }

  async keydown(params: { key: string }) {
    await this._page.keyboard.down(params.key);
  }

  async keyup(params: { key: string }) {
    await this._page.keyboard.up(params.key);
  }

  async pickLocator() {
    const locator = await this._page.pickLocator();
    this._owner.emitElementPicked(locator.toString(), await locator.ariaSnapshot());
  }

  async cancelPickLocator() {
    await this._page.cancelPickLocator();
  }

  async startRecording() {
    const artifactsDir = this._descriptor.browser.launchOptions.artifactsDir ?? this._owner._recordingDir;
    this._recordingPath = path.join(artifactsDir, `recording-${Date.now()}.webm`);
    if (this._screencastRunning)
      await this._restartScreencast(this._page);
  }

  async stopRecording(): Promise<{ streamId: string }> {
    const p = this._recordingPath;
    if (!p)
      throw new Error('No recording in progress');
    this._recordingPath = null;
    if (this._screencastRunning)
      await this._restartScreencast(this._page);
    const handle = await fs.promises.open(p, 'r');
    const streamId = crypto.randomUUID();
    this._owner._streams.set(streamId, { handle, path: p });
    return { streamId };
  }

  async screenshot(): Promise<string> {
    const buffer = await this._page.screenshot({ type: 'png' });
    return buffer.toString('base64');
  }

  private async _startScreencast(page: api.Page) {
    await page.screencast.start({
      onFrame: ({ data }: { data: Buffer }) => {
        if (this._disposed)
          return;
        const vp = page.viewportSize();
        this._owner.emitFrame(data.toString('base64'), vp?.width ?? 0, vp?.height ?? 0);
      },
      size: { width: 1280, height: 800 },
      ...(this._recordingPath ? { path: this._recordingPath } : {}),
    });
    void page.screenshot().catch(() => {}); // TODO: this is necessary to trigger a first frame - should this be in screencast.start() implementation?
  }

  private async _restartScreencast(page: api.Page) {
    await page.screencast.stop().catch(() => {});
    await this._startScreencast(page);
  }
}

function browserId(browser: api.Browser): string {
  // eslint-disable-next-line no-restricted-syntax -- _guid is very conservative.
  return (browser as any)._guid;
}

function pageId(p: api.Page): string {
  // eslint-disable-next-line no-restricted-syntax -- _guid is very conservative.
  return (p as any)._guid;
}

function contextId(c: api.BrowserContext): string {
  // eslint-disable-next-line no-restricted-syntax -- _guid is very conservative.
  return (c as any)._guid;
}

async function faviconUrl(page: api.Page): Promise<string | undefined> {
  const url = page.evaluate(async () => {
    const response = await fetch(document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.href ?? '/favicon.ico');
    if (!response.ok)
      return undefined;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/'))
      return undefined;
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
