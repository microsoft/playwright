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
import { wsServer } from '../utilsBundle';

import type { RegisteredListener } from '../utils';
import type { WebSocket, WebSocketServer } from '../utilsBundle';
import type http from 'http';

export class RemoteControl {
  private _context: BrowserContext;
  private _httpServer: HttpServer;
  private _wsServer: WebSocketServer | undefined;
  private _lastFrameData: string | null = null;
  private _lastViewportSize: { width: number, height: number } | null = null;
  private _selectedPage: Page | null = null;
  private _screencastOptions: { width: number, height: number, quality: number } = { width: 800, height: 600, quality: 90 };
  private _contextListeners: RegisteredListener[] = [];
  private _pageListeners: RegisteredListener[] = [];

  constructor(context: BrowserContext) {
    this._context = context;
    this._httpServer = new HttpServer();
  }

  async start(options: { width: number, height: number, quality: number, port?: number, host?: string }): Promise<string> {
    this._screencastOptions = options;

    const rcDir = path.join(__dirname, 'rc');
    const allowedFiles: Record<string, string> = {
      '/': 'index.html',
      '/rc.css': 'rc.css',
      '/rc.js': 'rc.js',
    };
    this._httpServer.routePrefix('/', (request: http.IncomingMessage, response: http.ServerResponse) => {
      const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;
      const file = allowedFiles[pathname];
      if (!file)
        return false;
      return this._httpServer.serveFile(request, response, path.join(rcDir, file));
    });

    this._wsServer = new wsServer({ server: this._httpServer.server(), path: '/ws' });
    this._wsServer.on('connection', (ws: WebSocket) => {
      const wasEmpty = this._clientCount() === 1;
      if (wasEmpty)
        this._engage();

      if (this._lastFrameData)
        ws.send(JSON.stringify({ type: 'frame', data: this._lastFrameData, viewportWidth: this._lastViewportSize?.width, viewportHeight: this._lastViewportSize?.height }));
      if (this._selectedPage) {
        const url = this._selectedPage.mainFrame().url();
        if (url)
          ws.send(JSON.stringify({ type: 'url', url }));
      }
      this._getTabList().then(tabs => ws.send(JSON.stringify({ type: 'tabs', tabs })));
      ws.on('message', (raw: Buffer) => {
        this._handleMessage(raw).catch(() => {});
      });
      ws.on('close', () => {
        if (this._clientCount() === 0)
          this._disengage();
      });
    });

    await this._httpServer.start({ port: options.port, host: options.host });
    return this._httpServer.urlPrefix('human-readable');
  }

  private _clientCount(): number {
    return this._wsServer?.clients.size ?? 0;
  }

  private _engage() {
    // Listen for new pages in the context.
    this._contextListeners.push(
        eventsHelper.addEventListener(this._context, BrowserContext.Events.Page, (page: Page) => {
          this._broadcastTabList();
          // If no page is selected, auto-select the new one.
          if (!this._selectedPage)
            this._selectPage(page);
        }),
        eventsHelper.addEventListener(this._context, BrowserContext.Events.PageClosed, (page: Page) => {
          if (this._selectedPage === page) {
            eventsHelper.removeEventListeners(this._pageListeners);
            this._pageListeners = [];
            this._selectedPage = null;
            this._lastFrameData = null;
            this._lastViewportSize = null;
            // Auto-select next available page.
            const pages = this._context.pages();
            if (pages.length > 0)
              this._selectPage(pages[0]);
            else
              this._broadcast({ type: 'noPages' });
          }
          this._broadcastTabList();
        }),
        eventsHelper.addEventListener(this._context, BrowserContext.Events.InternalFrameNavigatedToNewDocument, (frame, page) => {
          if (frame === page.mainFrame()) {
            this._broadcastTabList();
            if (page === this._selectedPage)
              this._broadcast({ type: 'url', url: frame.url() });
          }
        }),
    );

    // Auto-select first page.
    const pages = this._context.pages();
    if (pages.length > 0)
      this._selectPage(pages[0]);
  }

  private async _disengage() {
    // Stop screencast on selected page.
    if (this._selectedPage) {
      await this._selectedPage.screencast.stopScreencastForClient(this);
      this._selectedPage = null;
    }

    eventsHelper.removeEventListeners(this._pageListeners);
    this._pageListeners = [];
    eventsHelper.removeEventListeners(this._contextListeners);
    this._contextListeners = [];

    this._lastFrameData = null;
    this._lastViewportSize = null;
  }

  private async _getTabList(): Promise<{ id: string, title: string, url: string, selected: boolean }[]> {
    return await Promise.all(this._context.pages().map(async page => ({
      id: page.guid,
      title: await page.mainFrame().title().catch(() => '') || page.mainFrame().url(),
      url: page.mainFrame().url(),
      selected: page === this._selectedPage,
    })));
  }

  private async _broadcastTabList() {
    this._broadcast({ type: 'tabs', tabs: await this._getTabList() });
  }

  private async _selectPage(page: Page) {
    if (this._selectedPage === page)
      return;

    // Stop screencast on old page.
    if (this._selectedPage) {
      eventsHelper.removeEventListeners(this._pageListeners);
      this._pageListeners = [];
      await this._selectedPage.screencast.stopScreencastForClient(this);
    }

    this._selectedPage = page;
    this._lastFrameData = null;
    this._lastViewportSize = null;

    // Start screencast on new page.
    this._pageListeners.push(
        eventsHelper.addEventListener(page, Page.Events.ScreencastFrame, frame => this._writeFrame(frame.buffer, frame.width, frame.height))
    );

    await page.screencast.startScreencastForClient(this, this._screencastOptions);

    // Broadcast updated tab list and URL.
    await this._broadcastTabList();
    const url = page.mainFrame().url();
    if (url)
      this._broadcast({ type: 'url', url });
  }

  private _writeFrame(frame: Buffer, viewportWidth: number, viewportHeight: number) {
    const data = frame.toString('base64');
    this._lastFrameData = data;
    this._lastViewportSize = { width: viewportWidth, height: viewportHeight };
    this._broadcast({ type: 'frame', data, viewportWidth, viewportHeight });
  }

  private _broadcast(msg: object) {
    if (!this._wsServer)
      return;
    const message = JSON.stringify(msg);
    for (const client of this._wsServer.clients) {
      if (client.readyState === client.OPEN)
        client.send(message);
    }
  }

  private async _handleMessage(raw: Buffer) {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'selectTab') {
      const page = this._context.pages().find(p => p.guid === msg.id);
      if (page)
        await this._selectPage(page);
      return;
    }

    if (msg.type === 'closeTab') {
      const page = this._context.pages().find(p => p.guid === msg.id);
      if (page)
        await page.close({ reason: 'Closed from remote control' });
      return;
    }

    if (msg.type === 'newTab') {
      await ProgressController.runInternalTask(async progress => {
        const page = await this._context.newPage(progress);
        await this._selectPage(page);
      });
      return;
    }

    if (!this._selectedPage)
      return;

    const page = this._selectedPage;
    if (msg.type === 'navigate' && msg.url)
      await ProgressController.runInternalTask(async progress => { await page.mainFrame().goto(progress, msg.url); });
    else if (msg.type === 'back')
      await ProgressController.runInternalTask(async progress => { await page.goBack(progress, {}); });
    else if (msg.type === 'forward')
      await ProgressController.runInternalTask(async progress => { await page.goForward(progress, {}); });
    else if (msg.type === 'reload')
      await ProgressController.runInternalTask(async progress => { await page.reload(progress, {}); });
    else if (msg.type === 'mousemove')
      await ProgressController.runInternalTask(async progress => { await page.mouse.move(progress, msg.x, msg.y); });
    else if (msg.type === 'mousedown')
      await ProgressController.runInternalTask(async progress => { await page.mouse.move(progress, msg.x, msg.y); await page.mouse.down(progress, { button: msg.button || 'left' }); });
    else if (msg.type === 'mouseup')
      await ProgressController.runInternalTask(async progress => { await page.mouse.move(progress, msg.x, msg.y); await page.mouse.up(progress, { button: msg.button || 'left' }); });
    else if (msg.type === 'wheel')
      await ProgressController.runInternalTask(async progress => { await page.mouse.wheel(progress, msg.deltaX, msg.deltaY); });
    else if (msg.type === 'keydown')
      await ProgressController.runInternalTask(async progress => { await page.keyboard.down(progress, msg.key); });
    else if (msg.type === 'keyup')
      await ProgressController.runInternalTask(async progress => { await page.keyboard.up(progress, msg.key); });
  }

  async stop() {
    await this._disengage();

    if (this._wsServer) {
      for (const client of this._wsServer.clients)
        client.terminate();
      await new Promise<void>(f => this._wsServer!.close(() => f()));
      this._wsServer = undefined;
    }
    await this._httpServer.stop();
  }
}
