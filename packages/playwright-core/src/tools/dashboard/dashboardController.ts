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
import { ManualPromise } from '@isomorphic/manualPromise';
import { eventsHelper } from '@utils/eventsHelper';
import { createClientInfo } from '../cli-client/registry';

import { SessionProviderEvent } from './sessionProvider';

import type * as api from '../../..';
import type { Transport } from '@utils/httpServer';
import type { SubmittedAnnotationFrame, Tab } from '@dashboard/dashboardChannel';
import type { BrowserDescriptor } from '../../serverRegistry';
import type { SessionProvider } from './sessionProvider';

export type AnnotateResult =
  | { type: 'submitted', frames: SubmittedAnnotationFrame[], feedback: string }
  | { type: 'cancelled' };

export class DashboardConnection implements Transport {
  sendEvent?: (method: string, params: any) => void;
  close?: () => void;

  private _provider: SessionProvider;
  private _attachedPage: AttachedPage | undefined;
  private _onclose: () => void;
  private _onconnected?: () => void;
  private _pushTabsScheduled = false;
  private _visible = true;
  private _pendingReveal: { sessionName?: string; workspaceDir?: string; pageId?: string; done: ManualPromise<void> } | undefined;
  private _pendingAnnotate: { resolve: (result: AnnotateResult) => void; dispose: () => void } | undefined;

  _recordingDir: string;
  _streams = new Map<string, { handle: fs.promises.FileHandle; path: string }>();

  constructor(provider: SessionProvider, onclose: () => void, onconnected?: () => void) {
    this._provider = provider;
    this._onclose = onclose;
    this._onconnected = onconnected;
    this._recordingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-recordings-'));
  }

  onconnect() {
    this._provider.on(SessionProviderEvent.SessionsChanged, () => {
      this._pushSessions();
      void this._tryRevealPending();
    });
    this._provider.on(SessionProviderEvent.TabsChanged, () => {
      this._pushTabs();
      void this._tryRevealPending();
    });
    this._provider.on(SessionProviderEvent.ContextClosed, context => {
      if (this._attachedPage?.page.context() === context) {
        this._attachedPage.dispose();
        this._attachedPage = undefined;
      }
    });
    this._provider.on(SessionProviderEvent.AttachRequested, page => { void this._switchAttachedTo(page); });
    this._provider.start();
    this._onconnected?.();
  }

  onclose() {
    this._provider.dispose();
    this._attachedPage?.dispose();
    this._attachedPage = undefined;
    // Reject any in-flight reveal so callers awaiting it don't hang.
    this._pendingReveal?.done.reject(new Error('Dashboard connection closed'));
    this._pendingReveal = undefined;
    this._resolvePendingAnnotate({ type: 'cancelled' });
    for (const stream of this._streams.values()) {
      void stream.handle.close()
          .catch(() => {})
          .then(() => fs.promises.unlink(stream.path))
          .catch(() => {});
    }
    this._streams.clear();
    void fs.promises.rm(this._recordingDir, { recursive: true, force: true }).catch(() => {});
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
    const page = this._provider.findPage(params);
    if (page)
      await this._switchAttachedTo(page);
    this._pushTabs();
  }

  async newTab(params: { browser: string; context: string }) {
    const context = this._provider.findContext(params);
    if (!context)
      return;
    const page = await context.newPage();
    await this._switchAttachedTo(page);
    this._pushTabs();
  }

  async closeTab(params: { browser: string; context: string; page: string }) {
    const page = this._provider.findPage(params);
    await page?.close({ reason: 'Closed in Dashboard' });
  }

  async closeSession(params: { browser: string }) {
    await this._provider.closeSession(params.browser);
  }

  async setVisible(params: { visible: boolean }) {
    if (this._visible === params.visible)
      return;
    this._visible = params.visible;
    await this._attachedPage?.setScreencastActive(params.visible);
  }

  revealSession(sessionName: string, workspaceDir?: string): Promise<void> {
    const existing = this._pendingReveal;
    if (existing
        && existing.pageId === undefined
        && existing.sessionName === sessionName
        && existing.workspaceDir === workspaceDir)
      return existing.done;
    existing?.done.reject(new Error('Reveal superseded'));
    const done = new ManualPromise<void>();
    this._pendingReveal = { sessionName, workspaceDir, done };
    void this._tryRevealPending();
    return done;
  }

  revealPage(pageId: string): Promise<void> {
    const existing = this._pendingReveal;
    if (existing && existing.pageId === pageId)
      return existing.done;
    existing?.done.reject(new Error('Reveal superseded'));
    const done = new ManualPromise<void>();
    this._pendingReveal = { pageId, done };
    void this._tryRevealPending();
    return done;
  }

  private async _tryRevealPending() {
    const pending = this._pendingReveal;
    if (!pending)
      return;
    const allPages = this._provider.contextEntries().flatMap(e => e.context.pages().map(page => ({ entry: e, page })));
    let page: api.Page | undefined;
    if (pending.pageId !== undefined) {
      page = allPages.find(({ page: p }) => pageId(p) === pending.pageId)?.page;
    } else if (pending.sessionName !== undefined) {
      page = allPages.find(({ entry }) =>
        entry.descriptor.title === pending.sessionName
          && (pending.workspaceDir === undefined || entry.descriptor.workspaceDir === pending.workspaceDir))?.page;
    }
    if (!page)
      return;
    this._pendingReveal = undefined;
    try {
      await this._switchAttachedTo(page);
      this._pushTabs();
      pending.done.resolve();
    } catch (e) {
      pending.done.reject(e instanceof Error ? e : new Error(String(e)));
      throw e;
    }
  }

  async submitAnnotation(params: { frames: SubmittedAnnotationFrame[]; feedback: string }) {
    this._resolvePendingAnnotate({ type: 'submitted', frames: params.frames, feedback: params.feedback });
  }

  async cancelAnnotation() {
    this._resolvePendingAnnotate({ type: 'cancelled' });
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

  emitSessions(sessions: BrowserDescriptor[]) {
    this.sendEvent?.('sessions', { sessions, clientInfo: createClientInfo() });
  }

  emitTabs(tabs: Tab[]) {
    this.sendEvent?.('tabs', { tabs });
  }

  emitFrame(data: string, viewportWidth: number, viewportHeight: number) {
    this.sendEvent?.('frame', { data, viewportWidth, viewportHeight });
  }

  emitAnnotate({ signal }: { signal: AbortSignal }): Promise<AnnotateResult> {
    return new Promise<AnnotateResult>(resolve => {
      if (signal.aborted) {
        resolve({ type: 'cancelled' });
        return;
      }
      // Latest emitAnnotate supersedes any in-flight one on the same connection.
      this._resolvePendingAnnotate({ type: 'cancelled' });
      const onAbort = () => {
        if (this._pendingAnnotate !== pending)
          return;
        this._pendingAnnotate = undefined;
        pending.dispose();
        this.sendEvent?.('cancelAnnotate', {});
        resolve({ type: 'cancelled' });
      };
      const pending: NonNullable<typeof this._pendingAnnotate> = {
        resolve,
        dispose: () => signal.removeEventListener('abort', onAbort),
      };
      this._pendingAnnotate = pending;
      signal.addEventListener('abort', onAbort);
      this._tryFireAnnotate();
    });
  }

  private _tryFireAnnotate() {
    // Defer until a page is attached so the client can fetch a screenshot.
    if (!this._pendingAnnotate || !this._attachedPage)
      return;
    this.sendEvent?.('annotate', {});
  }

  private _resolvePendingAnnotate(result: AnnotateResult) {
    this._pendingAnnotate?.resolve(result);
    this._pendingAnnotate?.dispose();
    this._pendingAnnotate = undefined;
  }

  artifactsDirFor(context: api.BrowserContext): string {
    for (const entry of this._provider.contextEntries()) {
      if (entry.context === context)
        return entry.descriptor.browser.launchOptions.artifactsDir ?? this._recordingDir;
    }
    return this._recordingDir;
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

  private _pushSessions() {
    void (async () => {
      try {
        const sessions = await this._provider.sessions();
        this.emitSessions(sessions);
      } catch {
        // best-effort
      }
    })();
  }

  private async _aggregateTabs(): Promise<Tab[]> {
    const attachedPage = this._attachedPage?.page;
    const tasks: Promise<Tab>[] = [];
    for (const { browser, context } of this._provider.contextEntries()) {
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
    return await Promise.all(tasks);
  }

  private async _switchAttachedTo(page: api.Page) {
    if (this._attachedPage?.page === page)
      return;
    this._attachedPage?.dispose();
    const attached = new AttachedPage(this, page);
    this._attachedPage = attached;
    try {
      await attached.init();
    } catch (e) {
      if (this._attachedPage === attached)
        this._attachedPage = undefined;
      attached.dispose();
      throw e;
    }
    if (this._attachedPage === attached)
      this._tryFireAnnotate();
  }

  _handleAttachedPageClose(context: api.BrowserContext) {
    this._attachedPage?.dispose();
    this._attachedPage = undefined;
    const next = context.pages()[0];
    if (next)
      void this._switchAttachedTo(next);
    this._pushTabs();
  }
}

class AttachedPage {
  private _owner: DashboardConnection;
  private _page: api.Page;
  private _listeners: Disposable[] = [];
  private _screencastRunning = false;
  private _recordingPath: string | null = null;
  private _disposed = false;

  constructor(owner: DashboardConnection, page: api.Page) {
    this._owner = owner;
    this._page = page;
  }

  get page(): api.Page { return this._page; }

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

  async startRecording() {
    const artifactsDir = this._owner.artifactsDirFor(this._page.context());
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

  async screenshot(): Promise<{ data: string; viewportWidth: number; viewportHeight: number; ariaSnapshot: string }> {
    const buffer = await this._page.screenshot({ type: 'png' });
    const ariaSnapshot = await this._page.ariaSnapshot({ boxes: true, mode: 'ai' });
    const vp = await this._viewportSize();
    return {
      data: buffer.toString('base64'),
      viewportWidth: vp.width,
      viewportHeight: vp.height,
      ariaSnapshot,
    };
  }

  private async _viewportSize(): Promise<{ width: number; height: number }> {
    // Pages whose context was created with `viewport: null` (e.g. headed `playwright-cli open --headed`)
    // have no fixed viewport, so `viewportSize()` returns null. Fall back to the live window size.
    const vp = this._page.viewportSize();
    if (vp)
      return vp;
    return await this._page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  }

  private async _startScreencast(page: api.Page) {
    await page.screencast.start({
      onFrame: ({ data, viewportWidth, viewportHeight }) => {
        if (this._disposed)
          return;
        this._owner.emitFrame(data.toString('base64'), viewportWidth, viewportHeight);
      },
      size: { width: 1280, height: 800 },
      ...(this._recordingPath ? { path: this._recordingPath } : {}),
    });
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
