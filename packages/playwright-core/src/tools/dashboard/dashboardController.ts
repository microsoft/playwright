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
import { eventsHelper } from '@utils/eventsHelper';
import { connectToBrowserAcrossVersions } from '../utils/connect';
import { serverRegistry } from '../../serverRegistry';
import { createClientInfo } from '../cli-client/registry';

import type * as api from '../../..';
import type { Transport } from '@utils/httpServer';
import type { AnnotationData, Tab } from '@dashboard/dashboardChannel';
import type { BrowserDescriptor, BrowserStatus } from '../../serverRegistry';

type Disposable = { dispose: () => Promise<void> };

type BrowserSlot = {
  guid: string;
  contextGuid: string;
  descriptor: BrowserDescriptor;
  context: api.BrowserContext;
  listeners: Disposable[];
};

export class DashboardConnection implements Transport {
  sendEvent?: (method: string, params: any) => void;
  close?: () => void;

  private _browsers = new Map<string, BrowserSlot>();
  private _attachedBrowser: AttachedBrowser | undefined;
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
    this._attachedBrowser?.dispose();
    this._attachedBrowser = undefined;
    for (const stream of this._streams.values()) {
      void stream.handle.close()
          .catch(() => {})
          .then(() => fs.promises.unlink(stream.path))
          .catch(() => {});
    }
    this._streams.clear();
    for (const slot of this._browsers.values())
      slot.listeners.forEach(d => d.dispose());
    this._browsers.clear();
    this._onclose();
  }

  async dispatch(method: string, params: any): Promise<any> {
    // eslint-disable-next-line no-restricted-syntax
    const handler = (this as any)[method];
    if (typeof handler === 'function')
      return handler.call(this, params);
    const attached = this._attachedBrowser;
    if (!attached)
      return;
    // eslint-disable-next-line no-restricted-syntax
    const onAtt = (attached as any)[method];
    if (typeof onAtt === 'function')
      return onAtt.call(attached, params);
  }

  async selectTab(params: { browser: string; page: string }) {
    await this._switchAttachedTo(params.browser);
    await this._attachedBrowser?.selectPageByGuid(params.page);
    this._pushTabs();
  }

  async newTab(params: { browser: string }) {
    const slot = this._browsers.get(params.browser);
    if (!slot)
      return;
    const page = await slot.context.newPage();
    await this._switchAttachedTo(params.browser);
    await this._attachedBrowser?.selectPage(page);
    this._pushTabs();
  }

  async closeTab(params: { browser: string; page: string }) {
    const slot = this._browsers.get(params.browser);
    if (!slot)
      return;
    const page = slot.context.pages().find(p => pageId(p) === params.page);
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
    await this._attachedBrowser?.setScreencastActive(params.visible);
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
    this._pendingReveal = undefined;
    await this._switchAttachedTo(slot.guid);
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
    const tasks: Promise<Tab>[] = [];
    for (const slot of this._browsers.values()) {
      const selectedPage = this._attachedBrowser?.browserGuid === slot.guid
        ? this._attachedBrowser.selectedPage()
        : null;
      for (const page of slot.context.pages()) {
        tasks.push((async () => ({
          browser: slot.guid,
          context: slot.contextGuid,
          page: pageId(page),
          title: await page.title().catch(() => ''),
          url: page.url(),
          selected: page === selectedPage,
          faviconUrl: await faviconUrl(page),
        }))());
      }
    }
    return await Promise.all(tasks);
  }

  private async _switchAttachedTo(guid: string) {
    if (this._attachedBrowser?.browserGuid === guid)
      return;
    this._attachedBrowser?.dispose();
    this._attachedBrowser = undefined;
    const slot = this._browsers.get(guid);
    if (!slot)
      return;
    const attached = new AttachedBrowser(this, slot);
    await attached.init();
    this._attachedBrowser = attached;
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
      if (this._attachedBrowser?.browserGuid === guid) {
        this._attachedBrowser.dispose();
        this._attachedBrowser = undefined;
      }
      slot.listeners.forEach(d => d.dispose());
      this._browsers.delete(guid);
    }

    for (const [guid, status] of connectable) {
      if (this._browsers.has(guid))
        continue;
      try {
        const browser = await connectToBrowserAcrossVersions(status);
        if (this._browsers.has(guid))
          continue;
        const context = browser.contexts()[0];
        if (!context)
          continue;
        const slot: BrowserSlot = {
          guid,
          // eslint-disable-next-line no-restricted-syntax -- _guid is very conservative.
          contextGuid: (context as any)._guid,
          descriptor: status,
          context,
          listeners: [],
        };
        const watchPage = (page: api.Page) => {
          slot.listeners.push(
              eventsHelper.addEventListener(page, 'load', () => this._pushTabs()),
              eventsHelper.addEventListener(page, 'framenavigated', (frame: api.Frame) => {
                if (frame === page.mainFrame())
                  this._pushTabs();
              }),
              eventsHelper.addEventListener(page, 'close', () => this._pushTabs()),
          );
        };
        slot.listeners.push(
            eventsHelper.addEventListener(context, 'page', (page: api.Page) => {
              watchPage(page);
              this._pushTabs();
            }),
            eventsHelper.addEventListener(context, 'picklocator', (page: api.Page) => {
              this._onPickLocator(guid, page).catch(() => {});
            }),
        );
        for (const page of context.pages())
          watchPage(page);
        this._browsers.set(guid, slot);
        this._pushTabs();
      } catch {
        // best-effort
      }
    }
  }

  private async _onPickLocator(guid: string, page: api.Page) {
    await this._switchAttachedTo(guid);
    await this._attachedBrowser?.selectPage(page);
    this.emitPickLocator();
  }
}

class AttachedBrowser {
  private _owner: DashboardConnection;
  private _slot: BrowserSlot;

  private _selectedPage: api.Page | null = null;
  private _screencastRunning = false;
  private _recordingPath: string | null = null;
  private _pageListeners: Disposable[] = [];
  private _contextListeners: Disposable[] = [];

  constructor(owner: DashboardConnection, slot: BrowserSlot) {
    this._owner = owner;
    this._slot = slot;
  }

  get browserGuid(): string { return this._slot.guid; }
  get contextGuid(): string { return this._slot.contextGuid; }
  private get _context(): api.BrowserContext { return this._slot.context; }
  private get _descriptor(): BrowserDescriptor { return this._slot.descriptor; }

  async init() {
    this._contextListeners.push(
        eventsHelper.addEventListener(this._context, 'page', page => {
          if (!this._selectedPage)
            this._selectPage(page).catch(() => {});
        }),
    );
    const pages = this._context.pages();
    if (pages.length > 0)
      await this._selectPage(pages[0]);
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
    this._selectedPage = null;
    this._owner._pushTabs();
  }

  selectedPage(): api.Page | null {
    return this._selectedPage;
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

  async selectPage(page: api.Page) {
    await this._selectPage(page);
  }

  async selectPageByGuid(guid: string) {
    const page = this._context.pages().find(p => pageId(p) === guid);
    if (page)
      await this._selectPage(page);
  }

  async navigate(params: { url: string }) {
    if (!params.url)
      return;
    await this._selectedPage?.goto(params.url);
  }

  async back() {
    await this._selectedPage?.goBack();
  }

  async forward() {
    await this._selectedPage?.goForward();
  }

  async reload() {
    await this._selectedPage?.reload();
  }

  async mousemove(params: { x: number; y: number }) {
    await this._selectedPage?.mouse.move(params.x, params.y);
  }

  async mousedown(params: { x: number; y: number; button?: 'left' | 'middle' | 'right' }) {
    const page = this._selectedPage;
    if (!page)
      return;
    await page.mouse.move(params.x, params.y);
    await page.mouse.down({ button: params.button || 'left' });
  }

  async mouseup(params: { x: number; y: number; button?: 'left' | 'middle' | 'right' }) {
    const page = this._selectedPage;
    if (!page)
      return;
    await page.mouse.move(params.x, params.y);
    await page.mouse.up({ button: params.button || 'left' });
  }

  async wheel(params: { deltaX: number; deltaY: number }) {
    await this._selectedPage?.mouse.wheel(params.deltaX, params.deltaY);
  }

  async keydown(params: { key: string }) {
    await this._selectedPage?.keyboard.down(params.key);
  }

  async keyup(params: { key: string }) {
    await this._selectedPage?.keyboard.up(params.key);
  }

  async pickLocator() {
    const page = this._selectedPage;
    if (!page)
      return;
    const locator = await page.pickLocator();
    this._owner.emitElementPicked(locator.toString(), await locator.ariaSnapshot());
  }

  async cancelPickLocator() {
    await this._selectedPage?.cancelPickLocator();
  }

  async startRecording() {
    const page = this._selectedPage;
    if (!page)
      return;
    const artifactsDir = this._descriptor.browser.launchOptions.artifactsDir ?? this._owner._recordingDir;
    this._recordingPath = path.join(artifactsDir, `recording-${Date.now()}.webm`);
    if (this._screencastRunning)
      await this._restartScreencast(page);
  }

  async stopRecording(): Promise<{ streamId: string }> {
    const p = this._recordingPath;
    if (!p)
      throw new Error('No recording in progress');
    this._recordingPath = null;
    if (this._selectedPage && this._screencastRunning)
      await this._restartScreencast(this._selectedPage);
    const handle = await fs.promises.open(p, 'r');
    const streamId = crypto.randomUUID();
    this._owner._streams.set(streamId, { handle, path: p });
    return { streamId };
  }

  async screenshot(): Promise<string> {
    const page = this._selectedPage;
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
    this._owner._pushTabs();

    this._pageListeners.push(
        eventsHelper.addEventListener(page, 'close', () => {
          this._deselectPage();
          const pages = page.context().pages();
          if (pages.length > 0)
            this._selectPage(pages[0]).catch(() => {});
          this._owner._pushTabs();
        }),
        eventsHelper.addEventListener(page, 'framenavigated', frame => {
          if (frame === page.mainFrame())
            this._owner._pushTabs();
        }),
    );

    if (this._owner.visible()) {
      this._screencastRunning = true;
      await this._startScreencast(page);
    }
  }

  private async _startScreencast(page: api.Page) {
    await page.screencast.start({
      onFrame: ({ data }: { data: Buffer }) => this._owner.emitFrame(data.toString('base64'), page.viewportSize()?.width ?? 0, page.viewportSize()?.height ?? 0),
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
}

function pageId(p: api.Page): string {
  // eslint-disable-next-line no-restricted-syntax -- _guid is very conservative.
  return (p as any)._guid;
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
