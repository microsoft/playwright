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
import { createGuid, eventsHelper } from '../utils';
import { HttpServer } from './utils/httpServer';
import { BrowserContext } from './browserContext';
import { Page } from './page';
import { ProgressController } from './progress';

import type { RegisteredListener } from '../utils';
import type { Transport } from './utils/httpServer';
import type http from 'http';

export class DevToolsController {
  private _context: BrowserContext;
  private _screencastOptions: { width: number, height: number, quality: number } = { width: 800, height: 600, quality: 90 };
  private _httpServer: HttpServer;

  constructor(context: BrowserContext) {
    this._context = context;
    this._httpServer = new HttpServer();
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

    const guid = createGuid();
    this._httpServer.createWebSocket(() => new DevToolsConnection(this._context, this._screencastOptions), guid);
    await this._httpServer.start({ port: options.port, host: options.host });
    return this._httpServer.urlPrefix('human-readable') + `?ws=${guid}`;
  }

  async stop() {
    await this._httpServer.stop();
  }
}


class DevToolsConnection implements Transport {
  sendEvent?: (method: string, params: any) => void;
  close?: () => void;

  selectedPage: Page | null = null;
  private _lastFrameData: string | null = null;
  private _lastViewportSize: { width: number, height: number } | null = null;
  private _pageListeners: RegisteredListener[] = [];
  private _contextListeners: RegisteredListener[] = [];
  private _context: BrowserContext;
  private _screencastOptions: { width: number, height: number, quality: number };

  constructor(context: BrowserContext, screencastOptions: { width: number, height: number, quality: number }) {
    this._context = context;
    this._screencastOptions = screencastOptions;
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
    );

    // Auto-select first page.
    const pages = context.pages();
    if (pages.length > 0)
      this._selectPage(pages[0]);

    this._sendCachedState();
  }

  onclose() {
    this._deselectPage();
    eventsHelper.removeEventListeners(this._contextListeners);
    this._contextListeners = [];
  }

  async dispatch(method: string, params: any): Promise<any> {
    if (method === 'selectTab') {
      const page = this._context.pages().find(p => p.guid === params.id);
      if (page)
        await this._selectPage(page);
      return;
    }

    if (method === 'closeTab') {
      const page = this._context.pages().find(p => p.guid === params.id);
      if (page)
        await page.close({ reason: 'Closed from devtools' });
      return;
    }

    if (method === 'newTab') {
      await ProgressController.runInternalTask(async progress => {
        const page = await this._context.newPage(progress);
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

  private async _tabList(): Promise<{ id: string, title: string, url: string }[]> {
    return await Promise.all(this._context.pages().map(async page => ({
      id: page.guid,
      title: await page.mainFrame().title().catch(() => '') || page.mainFrame().url(),
      url: page.mainFrame().url(),
    })));
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
