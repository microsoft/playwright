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
import { eventsHelper } from '../utils';
import { HttpServer } from './utils/httpServer';
import { BrowserContext } from './browserContext';
import { Page } from './page';
import { ProgressController } from './progress';

import type { RegisteredListener } from '../utils';
import type { Transport } from './utils/httpServer';
import type http from 'http';

export class DevToolsController {
  private _contexts = new Set<BrowserContext>();
  private _contextCleanup = new Map<BrowserContext, () => void>();
  private _connections = new Set<DevToolsConnection>();
  private _screencastOptions: { width: number, height: number, quality: number } = { width: 800, height: 600, quality: 90 };
  private _httpServer: HttpServer;

  constructor() {
    this._httpServer = new HttpServer();
  }

  get contexts(): ReadonlySet<BrowserContext> {
    return this._contexts;
  }

  addContext(context: BrowserContext) {
    if (this._contexts.has(context))
      return;
    this._contexts.add(context);

    // Auto-remove when the context closes.
    const onClose = () => this.removeContext(context);
    context.on(BrowserContext.Events.BeforeClose, onClose);
    this._contextCleanup.set(context, onClose);

    // Notify all existing connections about the new context.
    for (const connection of this._connections)
      connection.onContextAdded(context);
  }

  removeContext(context: BrowserContext) {
    if (!this._contexts.has(context))
      return;
    this._contexts.delete(context);

    // Remove the auto-close listener.
    const onClose = this._contextCleanup.get(context);
    if (onClose) {
      context.off(BrowserContext.Events.BeforeClose, onClose);
      this._contextCleanup.delete(context);
    }

    // Notify all existing connections.
    for (const connection of this._connections)
      connection.onContextRemoved(context);
  }

  async start(options: { width: number, height: number, quality: number, port?: number, host?: string }): Promise<string> {
    this._screencastOptions = options;

    const devtoolsDir = path.join(__dirname, '..', 'vite', 'devtools');
    this._httpServer.routePrefix('/', (request: http.IncomingMessage, response: http.ServerResponse) => {
      const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;
      const filePath = pathname === '/' ? 'index.html' : pathname.substring(1);
      const resolved = path.join(devtoolsDir, filePath);
      if (!resolved.startsWith(devtoolsDir))
        return false;
      return this._httpServer.serveFile(request, response, resolved);
    });

    this._httpServer.createWebSocket(() => {
      const connection = new DevToolsConnection(this, this._screencastOptions);
      this._connections.add(connection);
      return connection;
    }, 'ws');

    await this._httpServer.start({ port: options.port, host: options.host });
    return this._httpServer.urlPrefix('human-readable');
  }

  async stop() {
    await this._httpServer.stop();
    // Clean up auto-close listeners.
    for (const [context, onClose] of this._contextCleanup)
      context.off(BrowserContext.Events.BeforeClose, onClose);
    this._contextCleanup.clear();
    this._contexts.clear();
    this._connections.clear();
  }
}


class DevToolsConnection implements Transport {
  sendEvent?: (method: string, params: any) => void;
  close?: () => void;

  selectedPage: Page | null = null;
  private _controller: DevToolsController;
  private _lastFrameData: string | null = null;
  private _lastViewportSize: { width: number, height: number } | null = null;
  private _pageListeners: RegisteredListener[] = [];
  private _contextListeners = new Map<BrowserContext, RegisteredListener[]>();
  private _screencastOptions: { width: number, height: number, quality: number };

  constructor(controller: DevToolsController, screencastOptions: { width: number, height: number, quality: number }) {
    this._controller = controller;
    this._screencastOptions = screencastOptions;
  }

  onconnect() {
    // Subscribe to all currently-known contexts.
    for (const context of this._controller.contexts)
      this._subscribeContext(context);

    // Auto-select first page across all contexts.
    const firstPage = this._allPages()[0];
    if (firstPage)
      this._selectPage(firstPage);

    this._sendCachedState();
  }

  onclose() {
    this._deselectPage();
    for (const [, listeners] of this._contextListeners)
      eventsHelper.removeEventListeners(listeners);
    this._contextListeners.clear();
    (this._controller as any)._connections.delete(this);
  }

  onContextAdded(context: BrowserContext) {
    this._subscribeContext(context);
    this._sendContextList();
    this._sendTabList();

    // Auto-select first page if none is selected.
    if (!this.selectedPage) {
      const pages = context.pages();
      if (pages.length > 0)
        this._selectPage(pages[0]);
    }
  }

  onContextRemoved(context: BrowserContext) {
    const listeners = this._contextListeners.get(context);
    if (listeners) {
      eventsHelper.removeEventListeners(listeners);
      this._contextListeners.delete(context);
    }

    // If the selected page belonged to this context, deselect and pick another.
    if (this.selectedPage && context.pages().includes(this.selectedPage)) {
      this._deselectPage();
      const allPages = this._allPages();
      if (allPages.length > 0)
        this._selectPage(allPages[0]);
      else
        this.sendEvent?.('selectPage', { pageId: undefined });
    }

    this._sendContextList();
    this._sendTabList();
  }

  async dispatch(method: string, params: any): Promise<any> {
    if (method === 'selectTab') {
      const found = this._findPage(params.id);
      if (found)
        await this._selectPage(found.page);
      return;
    }

    if (method === 'closeTab') {
      const found = this._findPage(params.id);
      if (found)
        await found.page.close({ reason: 'Closed from devtools' });
      return;
    }

    if (method === 'newTab') {
      const context = this._findContext(params.contextId);
      if (!context)
        throw new Error(`Context not found: ${params.contextId}`);
      await ProgressController.runInternalTask(async progress => {
        const page = await context.newPage(progress);
        await this._selectPage(page);
      });
      return;
    }

    if (!this.selectedPage)
      return;

    const page = this.selectedPage;
    if (method === 'navigate' && params.url)
      await ProgressController.runInternalTask(async progress => { await page.mainFrame().goto(progress, params.url); });
    else if (method === 'back')
      await ProgressController.runInternalTask(async progress => { await page.goBack(progress, {}); });
    else if (method === 'forward')
      await ProgressController.runInternalTask(async progress => { await page.goForward(progress, {}); });
    else if (method === 'reload')
      await ProgressController.runInternalTask(async progress => { await page.reload(progress, {}); });
    else if (method === 'mousemove')
      await ProgressController.runInternalTask(async progress => { await page.mouse.move(progress, params.x, params.y); });
    else if (method === 'mousedown')
      await ProgressController.runInternalTask(async progress => { await page.mouse.move(progress, params.x, params.y); await page.mouse.down(progress, { button: params.button || 'left' }); });
    else if (method === 'mouseup')
      await ProgressController.runInternalTask(async progress => { await page.mouse.move(progress, params.x, params.y); await page.mouse.up(progress, { button: params.button || 'left' }); });
    else if (method === 'wheel')
      await ProgressController.runInternalTask(async progress => { await page.mouse.wheel(progress, params.deltaX, params.deltaY); });
    else if (method === 'keydown')
      await ProgressController.runInternalTask(async progress => { await page.keyboard.down(progress, params.key); });
    else if (method === 'keyup')
      await ProgressController.runInternalTask(async progress => { await page.keyboard.up(progress, params.key); });
  }

  private _subscribeContext(context: BrowserContext) {
    const listeners: RegisteredListener[] = [
      eventsHelper.addEventListener(context, BrowserContext.Events.Page, (page: Page) => {
        this._sendTabList();
        if (!this.selectedPage)
          this._selectPage(page);
      }),
      eventsHelper.addEventListener(context, BrowserContext.Events.PageClosed, (page: Page) => {
        if (this.selectedPage === page) {
          this._deselectPage();
          const allPages = this._allPages();
          if (allPages.length > 0)
            this._selectPage(allPages[0]);
          else
            this.sendEvent?.('selectPage', { pageId: undefined });
        }
        this._sendTabList();
      }),
      eventsHelper.addEventListener(context, BrowserContext.Events.InternalFrameNavigatedToNewDocument, (frame, page) => {
        if (frame === page.mainFrame()) {
          this._sendTabList();
          if (page === this.selectedPage)
            this.sendEvent?.('url', { url: frame.url() });
        }
      }),
    ];
    this._contextListeners.set(context, listeners);
  }

  private _allPages(): Page[] {
    const pages: Page[] = [];
    for (const context of this._controller.contexts)
      pages.push(...context.pages());
    return pages;
  }

  private _findPage(id: string): { page: Page, context: BrowserContext } | undefined {
    for (const context of this._controller.contexts) {
      const page = context.pages().find(p => p.guid === id);
      if (page)
        return { page, context };
    }
    return undefined;
  }

  private _findContext(id: string): BrowserContext | undefined {
    for (const context of this._controller.contexts) {
      if (context.guid === id)
        return context;
    }
    return undefined;
  }

  private async _selectPage(page: Page) {
    if (this.selectedPage === page)
      return;

    // Stop screencast on old page.
    if (this.selectedPage) {
      eventsHelper.removeEventListeners(this._pageListeners);
      this._pageListeners = [];
      await this.selectedPage.screencast.stopScreencast(this);
    }

    this.selectedPage = page;
    this._lastFrameData = null;
    this._lastViewportSize = null;
    this.sendEvent?.('selectPage', { pageId: page.guid });

    // Start screencast on new page.
    this._pageListeners.push(
        eventsHelper.addEventListener(page, Page.Events.ScreencastFrame, frame => this._writeFrame(frame.buffer, frame.width, frame.height))
    );

    await page.screencast.startScreencast(this, this._screencastOptions);

    // Send URL to this client.
    const url = page.mainFrame().url();
    if (url)
      this.sendEvent?.('url', { url });
  }

  private _deselectPage() {
    if (!this.selectedPage)
      return;
    eventsHelper.removeEventListeners(this._pageListeners);
    this._pageListeners = [];
    this.selectedPage.screencast.stopScreencast(this);
    this.selectedPage = null;
    this._lastFrameData = null;
    this._lastViewportSize = null;
  }

  private _sendCachedState() {
    this._sendContextList();
    this.sendEvent?.('selectPage', { pageId: this.selectedPage?.guid });
    if (this._lastFrameData)
      this.sendEvent?.('frame', { data: this._lastFrameData, viewportWidth: this._lastViewportSize?.width, viewportHeight: this._lastViewportSize?.height });
    if (this.selectedPage) {
      const url = this.selectedPage.mainFrame().url();
      if (url)
        this.sendEvent?.('url', { url });
    }
    this._sendTabList();
  }

  private _sendContextList() {
    const contexts = [...this._controller.contexts].map(c => ({ id: c.guid }));
    this.sendEvent?.('contexts', { contexts });
  }

  private async _tabList(): Promise<{ id: string, title: string, url: string, contextId: string }[]> {
    const tabs: { id: string, title: string, url: string, contextId: string }[] = [];
    for (const context of this._controller.contexts) {
      const contextTabs = await Promise.all(context.pages().map(async page => ({
        id: page.guid,
        title: await page.mainFrame().title().catch(() => '') || page.mainFrame().url(),
        url: page.mainFrame().url(),
        contextId: context.guid,
      })));
      tabs.push(...contextTabs);
    }
    return tabs;
  }

  private _sendTabList() {
    this._tabList().then(tabs => this.sendEvent?.('tabs', { tabs }));
  }

  private _writeFrame(frame: Buffer, viewportWidth: number, viewportHeight: number) {
    const data = frame.toString('base64');
    this._lastFrameData = data;
    this._lastViewportSize = { width: viewportWidth, height: viewportHeight };
    this.sendEvent?.('frame', { data, viewportWidth, viewportHeight });
  }
}
