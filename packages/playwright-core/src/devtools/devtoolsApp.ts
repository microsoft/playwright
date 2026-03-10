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
import os from 'os';
import net from 'net';
import http from 'http';

import { chromium } from '../..';
import { HttpServer } from '../server/utils/httpServer';
import { gracefullyProcessExitDoNotHang } from '../server/utils/processLauncher';
import { findChromiumChannelBestEffort, registryDirectory } from '../server/registry/index';
import { calculateSha1 } from '../utils';
import { CDPConnection, DevToolsConnection } from './devtoolsController';
import { serverRegistry } from '../serverRegistry';
import { connectToBrowserAcrossVersions } from '../client/connect';

import type * as api from '../..';
import type { SessionStatus } from '@devtools/sessionModel';

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

const browserGuidToDevToolsConnection = new Map<string, DevToolsConnection>();

async function handleApiRequest(httpServer: HttpServer, request: http.IncomingMessage, response: http.ServerResponse) {
  const url = new URL(request.url!,  httpServer.urlPrefix('human-readable'));
  const apiPath = url.pathname;

  if (apiPath === '/api/sessions/list' && request.method === 'GET') {
    const sessions = await loadBrowserDescriptorSessions(httpServer.wsGuid()!);
    sendJSON(response, { sessions });
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

async function openDevToolsApp(): Promise<api.Page> {
  const httpServer = new HttpServer();
  const libDir = require.resolve('playwright-core/package.json');
  const devtoolsDir = path.join(path.dirname(libDir), 'lib/vite/devtools');

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
    if (cdpPageId) {
      const connection = browserGuidToDevToolsConnection.get(guid);
      if (!connection)
        throw new Error('CDP connection not found for session: ' + guid);
      const page = connection.pageForId(cdpPageId);
      if (!page)
        throw new Error('Page not found for page ID: ' + cdpPageId);
      return new CDPConnection(page);
    }

    const cdpUrl = new URL(httpServer.urlPrefix('human-readable'));
    cdpUrl.pathname = httpServer.wsGuid()!;
    cdpUrl.searchParams.set('guid', guid);
    const connection = new DevToolsConnection(browserDescriptor, cdpUrl, () => browserGuidToDevToolsConnection.delete(guid));
    browserGuidToDevToolsConnection.set(guid, connection);
    return connection;
  });

  httpServer.routePrefix('/', (request: http.IncomingMessage, response: http.ServerResponse) => {
    const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;
    const filePath = pathname === '/' ? 'index.html' : pathname.substring(1);
    const resolved = path.join(devtoolsDir, filePath);
    if (!resolved.startsWith(devtoolsDir))
      return false;
    return httpServer.serveFile(request, response, resolved);
  });
  await httpServer.start();
  const url = httpServer.urlPrefix('human-readable');

  const { page } = await launchApp('devtools');
  await page.goto(url);
  return page;
}

async function launchApp(appName: string) {
  const channel = findChromiumChannelBestEffort('javascript');
  const context = await chromium.launchPersistentContext('', {
    ignoreDefaultArgs: ['--enable-automation'],
    channel,
    headless: false,
    args: [
      '--app=data:text/html,',
      '--test-type=',
      `--window-size=1280,800`,
      `--window-position=100,100`,
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

  const image = await fs.promises.readFile(path.join(__dirname, 'appIcon.png'));
  await (page as any)._setDockTile(image);
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
        (window as any).saveSettings = () => {
          (window as any)._saveSerializedSettings(JSON.stringify({ ...localStorage }));
        };
      })})(${settings});
  `);
}

function socketsDirectory() {
  return process.env.PLAYWRIGHT_DAEMON_SOCKETS_DIR || path.join(os.tmpdir(), 'playwright-cli');
}

function devtoolsSocketPath() {
  const userNameHash = calculateSha1(process.env.USERNAME || 'default').slice(0, 8);
  return process.platform === 'win32'
    ? `\\\\.\\pipe\\playwright-devtools-${userNameHash}`
    : path.join(socketsDirectory(), `devtools-${userNameHash}.sock`);
}

async function acquireSingleton(): Promise<net.Server> {
  const socketPath = devtoolsSocketPath();
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

async function main() {
  let server: net.Server | undefined;
  process.on('exit', () => server?.close());
  try {
    server = await acquireSingleton();
  } catch {
    return;
  }
  const page = await openDevToolsApp();
  server.on('connection', socket => {
    socket.on('data', data => {
      if (data.toString() === 'bringToFront')
        page?.bringToFront().catch(() => {});
    });
  });
}

void main();
