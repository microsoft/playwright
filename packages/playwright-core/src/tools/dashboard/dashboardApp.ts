/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import path from 'path';
import net from 'net';
import http from 'http';

import { HttpServer, Transport } from '@utils/httpServer';
import { makeSocketPath } from '@utils/fileUtils';
import { gracefullyProcessExitDoNotHang } from '@utils/processLauncher';
import { eventsHelper } from '@utils/eventsHelper';
import { SocketServerTransport, WebSocketServerTransport } from '@utils/serverTransport';
import { libPath } from '../../package';
import { playwright } from '../../inprocess';
import { findChromiumChannelBestEffort, registryDirectory } from '../../server/registry/index';
import { serverRegistry } from '../../serverRegistry';
import { connectToBrowserAcrossVersions } from '../utils/connect';
import { ws } from '../../utilsBundle';
import { createClientInfo } from '../cli-client/registry';

import type * as api from '../../..';
import type { SessionStatus } from '../../../../dashboard/src/sessionModel';
import type { BrowserDescriptor } from '../../serverRegistry';
import type { ServerTransport } from '@utils/serverTransport';

function readBody(request: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString();
        resolve(text ? JSON.parse(text) : {});
      } catch (e) {
        reject(e);
      }
    });
    request.on('error', reject);
  });
}

async function parseRequest(request: http.IncomingMessage): Promise<{ guid: string }> {
  const body = await readBody(request);
  if (!body.guid)
    throw new Error('Dashboard app is too old, please close it and open again');
  return { guid: body.guid };
}

function sendJSON(response: http.ServerResponse, data: any, statusCode = 200) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(data));
}

async function loadBrowserDescriptorSessions(wsPath: string): Promise<SessionStatus[]> {
  const entriesByWorkspace = await serverRegistry.list();
  const sessions: SessionStatus[] = [];
  for (const [, entries] of entriesByWorkspace) {
    for (const entry of entries) {
      let wsUrl: string | undefined;
      if (entry.canConnect) {
        const url = new URL(wsPath, 'http://localhost');
        url.searchParams.set('guid', entry.browser.guid);
        wsUrl = url.pathname + url.search;
      }
      sessions.push({ ...entry, wsUrl });
    }
  }
  return sessions;
}

async function handleApiRequest(httpServer: HttpServer, request: http.IncomingMessage, response: http.ServerResponse) {
  const url = new URL(request.url!,  httpServer.urlPrefix('human-readable'));
  const apiPath = url.pathname;

  if (apiPath === '/api/sessions/list' && request.method === 'GET') {
    const sessions = await loadBrowserDescriptorSessions(httpServer.wsGuid()!);
    const clientInfo = createClientInfo();
    sendJSON(response, { sessions, clientInfo });
    return;
  }

  if (apiPath === '/api/sessions/close' && request.method === 'POST') {
    const { guid } = await parseRequest(request);
    let browser: api.Browser;
    try {
      const browserDescriptor = serverRegistry.readDescriptor(guid);
      browser = await connectToBrowserAcrossVersions(browserDescriptor);
    } catch (e) {
      sendJSON(response, { error: 'Failed to connect to browser socket: ' + e.message }, 500);
      return;
    }
    try {
      await Promise.all(browser.contexts().map(context => context.close()));
      await browser.close();
      sendJSON(response, { success: true });
      return;
    } catch (e) {
      sendJSON(response, { error: 'Failed to close browser: ' + e.message }, 500);
      return;
    }
  }

  if (apiPath === '/api/sessions/delete-data' && request.method === 'POST') {
    const { guid } = await parseRequest(request);
    try {
      await serverRegistry.deleteUserData(guid);
    } catch (e) {
      sendJSON(response, { error: 'Failed to delete session data: ' + e.message }, 500);
      return;
    }
    sendJSON(response, { success: true });
    return;
  }

  response.statusCode = 404;
  response.end(JSON.stringify({ error: 'Not found' }));
}

async function innerOpenDashboardApp(): Promise<api.Page> {
  const httpServer = new HttpServer();
  const dashboardDir = libPath('vite', 'dashboard');

  httpServer.routePrefix('/api/', (request: http.IncomingMessage, response: http.ServerResponse) => {
    handleApiRequest(httpServer, request, response).catch(e => {
      response.statusCode = 500;
      response.end(JSON.stringify({ error: e.message }));
    });
    return true;
  });

  httpServer.createWebSocket(url => {
    const guid = url.searchParams.get('guid');
    if (!guid)
      throw new Error('Unsupported WebSocket URL: ' + url.toString());
    const browserDescriptor = serverRegistry.readDescriptor(guid);

    const cdpPageId = url.searchParams.get('cdpPageId');
    if (cdpPageId)
      return new CDPConnection(browserDescriptor, cdpPageId);

    // eslint-disable-next-line no-restricted-syntax
    const endpoint = browserDescriptor.endpoint ?? ((browserDescriptor as any).pipeName as string);
    if (endpoint.startsWith('ws://') || endpoint.startsWith('http://')) {
      const websocket = new ws.WebSocket(endpoint, { followRedirects: false });
      return wrapServerTransport(new WebSocketServerTransport(websocket));
    }

    return wrapServerTransport(new SocketServerTransport(net.connect(endpoint)));
  });

  httpServer.routePrefix('/', (request: http.IncomingMessage, response: http.ServerResponse) => {
    const url = new URL(request.url!, `http://${request.headers.host}`);

    if (url.pathname.startsWith('/devtools')) {
      const [, , guid, ...relativePath] = url.pathname.split('/');
      if (!guid)
        throw new Error('missing guid');
      const browserDescriptor = serverRegistry.readDescriptor(guid);
      if (!browserDescriptor)
        throw new Error('browser not found for guid');

      // eslint-disable-next-line no-restricted-syntax -- cdpPort is not in the public launchoptions type
      const cdpPort = (browserDescriptor.browser.launchOptions as any).cdpPort;
      if (cdpPort)
        return httpServer.proxy(request, response, `http://localhost:${cdpPort}/devtools/${relativePath.join('/')}`);

      void connectToBrowserAcrossVersions(browserDescriptor).then(async browser => {
        const session = await browser.newBrowserCDPSession();
        const version = await session.send('Browser.getVersion');
        await session.detach();
        httpServer.proxy(request, response, `https://chrome-devtools-frontend.appspot.com/serve_rev/${version.revision}/${relativePath.join('/')}`);
      }).catch(e => {
        response.statusCode = 500;
        response.end(JSON.stringify({ error: 'Failed to connect to browser socket: ' + e.message }));
      });
      return true;
    }

    if (url.pathname.startsWith('/dashboardBundle.js')) {
      const guid = url.searchParams.get('guid');
      if (!guid)
        throw new Error('missing guid');
      const browserDescriptor = serverRegistry.readDescriptor(guid);
      if (!browserDescriptor || !browserDescriptor.playwrightDashboardBundle)
        throw new Error('browser not found for guid');
      return httpServer.serveFile(request, response, browserDescriptor.playwrightDashboardBundle);
    }

    const filePath = url.pathname === '/' ? 'index.html' : url.pathname.substring(1);
    const resolved = path.join(dashboardDir, filePath);
    if (!resolved.startsWith(dashboardDir))
      return false;
    return httpServer.serveFile(request, response, resolved);
  });
  await httpServer.start();
  const url = httpServer.urlPrefix('human-readable');

  const { page } = await launchApp('dashboard');
  await page.goto(url);
  return page;
}

async function launchApp(appName: string) {
  const channel = findChromiumChannelBestEffort('javascript');
  const debugPort = parseInt(process.env.PLAYWRIGHT_DASHBOARD_DEBUG_PORT!, 10) || undefined;
  const context = await playwright.chromium.launchPersistentContext('', {
    ignoreDefaultArgs: ['--enable-automation'],
    channel,
    headless: debugPort !== undefined,
    args: [
      '--app=data:text/html,',
      '--test-type=',
      `--window-size=1280,800`,
      `--window-position=100,100`,
      ...(debugPort !== undefined ? [`--remote-debugging-port=${debugPort}`] : []),
    ],
    viewport: null,
  });

  const [page] = context.pages();
  // Chromium on macOS opens a new tab when clicking on the dock icon.
  // See https://github.com/microsoft/playwright/issues/9434
  if (process.platform === 'darwin') {
    context.on('page', async newPage => {
      if (newPage.mainFrame().url() === 'chrome://new-tab-page/') {
        await page.bringToFront();
        await newPage.close();
      }
    });
  }

  page.on('close', () => {
    gracefullyProcessExitDoNotHang(0);
  });

  const image = await fs.promises.readFile(libPath('tools', 'dashboard', 'appIcon.png'));
  // This is local Playwright, so I can access private methods.
  // eslint-disable-next-line no-restricted-syntax -- it is not essential, can regress.
  await (page as any)._setDockTile?.(image);
  await syncLocalStorageWithSettings(page, appName);
  return { context, page };
}

export async function syncLocalStorageWithSettings(page: api.Page, appName: string) {
  const settingsFile = path.join(registryDirectory, '.settings', `${appName}.json`);

  await page.exposeBinding('_saveSerializedSettings', (_, settings) => {
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile, settings);
  });

  const settings = await fs.promises.readFile(settingsFile, 'utf-8').catch(() => ('{}'));
  await page.addInitScript(
      `(${String((settings: any) => {
        // iframes w/ snapshots, etc.
        if (location && location.protocol === 'data:')
          return;
        if (window.top !== window)
          return;
        Object.entries(settings).map(([k, v]) => localStorage[k] = v);
        // eslint-disable-next-line no-restricted-syntax
        (window as any).saveSettings = () => {
          // eslint-disable-next-line no-restricted-syntax
          (window as any)._saveSerializedSettings(JSON.stringify({ ...localStorage }));
        };
      })})(${settings});
  `);
}

function dashboardSocketPath() {
  return makeSocketPath('dashboard', 'app');
}

async function acquireSingleton(): Promise<net.Server> {
  const socketPath = dashboardSocketPath();
  if (process.platform !== 'win32')
    await fs.promises.mkdir(path.dirname(socketPath), { recursive: true });

  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(socketPath, () => resolve(server));
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code !== 'EADDRINUSE')
        return reject(err);
      const client = net.connect(socketPath, () => {
        client.write('bringToFront');
        client.end();
        reject(new Error('already running'));
      });
      client.on('error', () => {
        if (process.platform !== 'win32')
          fs.unlinkSync(socketPath);
        server.listen(socketPath, () => resolve(server));
      });
    });
  });
}

export async function openDashboardApp() {
  let server: net.Server | undefined;
  process.on('exit', () => server?.close());
  process.on('unhandledRejection', error => {
    // eslint-disable-next-line no-console
    console.error('Unhandled promise rejection:', error);
  });
  const underTest = !!process.env.PLAYWRIGHT_DASHBOARD_DEBUG_PORT;
  if (!underTest) {
    try {
      server = await acquireSingleton();
    } catch {
      return;
    }
  }
  const page = await innerOpenDashboardApp();
  server?.on('connection', socket => {
    socket.on('data', data => {
      if (data.toString() === 'bringToFront')
        page?.bringToFront().catch(() => {});
    });
  });
}

class CDPConnection implements Transport {
  sendMessage?: (message: string) => void;
  close?: () => void;

  private _browserDescriptor: BrowserDescriptor;
  private _pageId: string;
  private _rawSession: api.CDPSession | null = null;
  private _rawSessionListeners: { dispose: () => Promise<void> }[] = [];
  private _initializePromise: Promise<void> | undefined;

  constructor(browserDescriptor: BrowserDescriptor, pageId: string) {
    this._browserDescriptor = browserDescriptor;
    this._pageId = pageId;
  }

  onconnect() {
    this._initializePromise = this._initializeRawSession();
  }

  async onmessage(message: string) {
    const { id, method, params } = JSON.parse(message);
    try {
      await this._initializePromise;
      if (!this._rawSession)
        throw new Error('CDP session is not initialized');
      const result = await this._rawSession.send(method as Parameters<api.CDPSession['send']>[0], params);
      this.sendMessage?.(JSON.stringify({ id, result }));
    } catch (e) {
      this.sendMessage?.(JSON.stringify({ id, error: String(e) }));
    }
  }

  onclose() {
    this._rawSessionListeners.forEach(listener => listener.dispose());
    this._rawSession?.detach().catch(() => {});
    this._rawSession = null;
    this._initializePromise = undefined;
  }

  private async _initializeRawSession() {
    // consider going via special daemon endpoint instead of full Playwright connection.
    const browser = await connectToBrowserAcrossVersions(this._browserDescriptor);
    // eslint-disable-next-line no-restricted-syntax -- _guid is very conservative.
    const page = browser.contexts().flatMap(c => c.pages()).find(p => (p as any)._guid === this._pageId);
    if (!page)
      throw new Error('Page not found for page ID: ' + this._pageId);
    const session = await page.context().newCDPSession(page);
    this._rawSession = session;
    this._rawSessionListeners = [
      eventsHelper.addEventListener(session, 'event', ({ method, params }) => {
        this.sendMessage?.(JSON.stringify({ method, params }));
      }),
      eventsHelper.addEventListener(session, 'close', () => {
        this.close?.();
      }),
    ];
  }
}

function wrapServerTransport(transport: ServerTransport): Transport {
  return {
    onconnect() {
      transport.on('message', message => this.sendMessage?.(message));
      transport.on('close', () => this.close?.());
    },
    onmessage(message) {
      transport.send(message);
    },
    onclose() {
      transport.close();
    },
  };
}
