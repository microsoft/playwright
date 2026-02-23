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

import { chromium } from 'playwright-core';
import { gracefullyProcessExitDoNotHang, HttpServer } from 'playwright-core/lib/utils';
import { findChromiumChannelBestEffort, registryDirectory } from 'playwright-core/lib/server/registry/index';

import { createClientInfo, Registry } from './registry';
import { Session } from './session';

import type http from 'http';
import type { Page } from 'playwright-core';
import type { ClientInfo, SessionConfig } from './registry';

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

function sendJSON(response: http.ServerResponse, data: any, statusCode = 200) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(data));
}

async function handleApiRequest(clientInfo: ClientInfo, request: http.IncomingMessage, response: http.ServerResponse) {
  const url = new URL(request.url!, `http://${request.headers.host}`);
  const apiPath = url.pathname;

  if (apiPath === '/api/sessions/list' && request.method === 'GET') {
    const registry = await Registry.load();
    const sessions: { config: SessionConfig, canConnect: boolean }[] = [];
    for (const [, entries] of registry.entryMap()) {
      for (const entry of entries) {
        const session = new Session(clientInfo, entry.config);
        const canConnect = await session.canConnect();
        if (canConnect || entry.config.cli.persistent)
          sessions.push({ config: entry.config, canConnect });
      }
    }
    sendJSON(response, { sessions, clientInfo });
    return;
  }

  if (apiPath === '/api/sessions/close' && request.method === 'POST') {
    const body = await readBody(request);
    if (!body.config)
      throw new Error('Missing "config" parameter');
    await new Session(clientInfo, body.config).stop();
    sendJSON(response, { success: true });
    return;
  }

  if (apiPath === '/api/sessions/delete-data' && request.method === 'POST') {
    const body = await readBody(request);
    if (!body.config)
      throw new Error('Missing "config" parameter');
    await new Session(clientInfo, body.config).deleteData();
    sendJSON(response, { success: true });
    return;
  }

  if (apiPath === '/api/sessions/run' && request.method === 'POST') {
    const body = await readBody(request);
    if (!body.config)
      throw new Error('Missing "config" parameter');
    if (!body.args)
      throw new Error('Missing "args" parameter');
    const result = await new Session(clientInfo, body.config).run(body.args);
    sendJSON(response, { result });
    return;
  }

  if (apiPath === '/api/sessions/devtools-start' && request.method === 'POST') {
    const body = await readBody(request);
    if (!body.config)
      throw new Error('Missing "config" parameter');
    const result = await new Session(clientInfo, body.config).run({ _: ['devtools-start'] });
    const match = result.text.match(/Server is listening on: (.+)/);
    if (!match)
      throw new Error('Failed to parse screencast URL from: ' + result.text);
    sendJSON(response, { url: match[1] });
    return;
  }

  response.statusCode = 404;
  response.end(JSON.stringify({ error: 'Not found' }));
}

async function openDevToolsApp(): Promise<Page> {
  const httpServer = new HttpServer();
  const libDir = require.resolve('playwright-core/package.json');
  const devtoolsDir = path.join(path.dirname(libDir), 'lib/vite/devtools');
  const clientInfo = createClientInfo();

  httpServer.routePrefix('/api/', (request: http.IncomingMessage, response: http.ServerResponse) => {
    handleApiRequest(clientInfo, request, response).catch(e => {
      response.statusCode = 500;
      response.end(JSON.stringify({ error: e.message }));
    });
    return true;
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

export async function syncLocalStorageWithSettings(page: Page, appName: string) {
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
  return process.platform === 'win32'
    ? `\\\\.\\pipe\\playwright-devtools-${process.env.USERNAME || 'default'}`
    : path.join(socketsDirectory(), 'devtools.sock');
}

async function acquireSingleton(): Promise<net.Server> {
  const socketPath = devtoolsSocketPath();

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
