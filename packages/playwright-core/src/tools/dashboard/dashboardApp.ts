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

import { HttpServer } from '@utils/httpServer';
import { makeSocketPath } from '@utils/fileUtils';
import { gracefullyProcessExitDoNotHang } from '@utils/processLauncher';
import { libPath } from '../../package';
import { playwright } from '../../inprocess';
import { findChromiumChannelBestEffort, registryDirectory } from '../../server/registry/index';
import { DashboardConnection } from './dashboardController';

import type * as api from '../../..';

type DashboardState = {
  triggerAnnotate: () => void;
  registerWaiter: (socket: net.Socket) => void;
  revealSession: (sessionTitle: string) => void;
};

async function innerOpenDashboardApp(): Promise<{ page: api.Page, state: DashboardState }> {
  const httpServer = new HttpServer();
  const dashboardDir = libPath('vite', 'dashboard');

  const connections = new Set<DashboardConnection>();
  let pendingAnnotate = false;
  let pendingRevealTitle: string | undefined;
  const waitingSockets = new Set<net.Socket>();

  const submitAnnotation = (base64Png: string) => {
    if (waitingSockets.size === 0)
      return;
    const buffer = Buffer.from(base64Png, 'base64');
    for (const socket of waitingSockets) {
      socket.write(buffer);
      socket.end();
    }
    waitingSockets.clear();
  };

  httpServer.createWebSocket(() => {
    let connection: DashboardConnection;
    // eslint-disable-next-line prefer-const
    connection = new DashboardConnection(() => connections.delete(connection), () => {
      if (pendingRevealTitle) {
        connection.revealSessionByTitle(pendingRevealTitle);
        pendingRevealTitle = undefined;
      }
      if (pendingAnnotate) {
        pendingAnnotate = false;
        connection.emitAnnotate();
      }
    }, submitAnnotation);
    connections.add(connection);
    return connection;
  }, 'ws');

  httpServer.routePrefix('/', (request: http.IncomingMessage, response: http.ServerResponse) => {
    const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;
    const filePath = pathname === '/' ? 'index.html' : pathname.substring(1);
    const resolved = path.join(dashboardDir, filePath);
    if (!resolved.startsWith(dashboardDir))
      return false;
    return httpServer.serveFile(request, response, resolved);
  });
  await httpServer.start();
  const url = httpServer.urlPrefix('human-readable');

  const { page } = await launchApp('dashboard');
  await page.goto(url);

  const triggerAnnotate = () => {
    if (connections.size === 0) {
      pendingAnnotate = true;
      return;
    }
    for (const connection of connections)
      connection.emitAnnotate();
  };

  const registerWaiter = (socket: net.Socket) => {
    waitingSockets.add(socket);
    const cleanup = () => waitingSockets.delete(socket);
    socket.on('close', cleanup);
    socket.on('error', cleanup);
  };

  const revealSession = (sessionTitle: string) => {
    if (!sessionTitle)
      return;
    if (connections.size === 0) {
      pendingRevealTitle = sessionTitle;
      return;
    }
    for (const connection of connections)
      connection.revealSessionByTitle(sessionTitle);
  };

  return { page, state: { triggerAnnotate, registerWaiter, revealSession } };
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
  const settingsFile = process.env.PLAYWRIGHT_DASHBOARD_SETTINGS_FILE_FOR_TEST ?? path.join(registryDirectory, '.settings', `${appName}.json`);

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
  const { page, state } = await innerOpenDashboardApp();
  server?.on('connection', socket => {
    socket.on('data', data => {
      const message = data.toString();
      const colon = message.indexOf(':');
      const action = colon === -1 ? message : message.slice(0, colon);
      const sessionTitle = colon === -1 ? '' : message.slice(colon + 1);
      if (action === 'bringToFront') {
        page?.bringToFront().catch(() => {});
        state.revealSession(sessionTitle);
      } else if (action === 'annotate') {
        page?.bringToFront().catch(() => {});
        state.revealSession(sessionTitle);
        state.triggerAnnotate();
        state.registerWaiter(socket);
      }
    });
  });
}
