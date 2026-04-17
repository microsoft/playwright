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
import { minimist } from '../cli-client/minimist';
import { DashboardConnection } from './dashboardController';

import type * as api from '../../..';

type RevealOptions = { sessionName?: string; workspaceDir?: string };

async function startDashboardServer(options: { port?: number; host?: string; reveal?: RevealOptions } = {}): Promise<{ url: string; reveal: (options: RevealOptions) => void }> {
  const httpServer = new HttpServer();
  const dashboardDir = libPath('vite', 'dashboard');
  const artifacts = new Map<string, string>();

  const connections = new Set<DashboardConnection>();
  let currentReveal: RevealOptions = options.reveal ?? {};

  httpServer.createWebSocket(() => {
    let connection: DashboardConnection;
    // eslint-disable-next-line prefer-const
    connection = new DashboardConnection(() => connections.delete(connection), artifacts);
    if (currentReveal.sessionName)
      connection.revealSession(currentReveal.sessionName, currentReveal.workspaceDir);
    connections.add(connection);
    return connection;
  }, 'ws');

  httpServer.routePrefix('/artifact/', (request: http.IncomingMessage, response: http.ServerResponse) => {
    const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;
    const id = decodeURIComponent(pathname.substring('/artifact/'.length));
    const artifactPath = artifacts.get(id);
    if (!artifactPath) {
      response.statusCode = 404;
      response.end();
      return true;
    }
    // we're not deleting the artifact on purpose, so that the user can restart the download from the omnibox
    return httpServer.serveFile(request, response, artifactPath, {
      'Content-Disposition': `attachment; filename="${path.basename(artifactPath)}"`,
    });
  });

  httpServer.routePrefix('/', (request: http.IncomingMessage, response: http.ServerResponse) => {
    const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;
    const filePath = pathname === '/' ? 'index.html' : pathname.substring(1);
    const resolved = path.join(dashboardDir, filePath);
    if (!resolved.startsWith(dashboardDir))
      return false;
    return httpServer.serveFile(request, response, resolved);
  });
  await httpServer.start({ port: options.port, host: options.host });

  const reveal = (next: RevealOptions) => {
    currentReveal = next;
    if (!next.sessionName)
      return;
    for (const connection of connections)
      connection.revealSession(next.sessionName, next.workspaceDir);
  };

  return { url: httpServer.urlPrefix('human-readable'), reveal };
}

async function innerOpenDashboardApp(initialReveal: RevealOptions): Promise<{ page: api.Page; reveal: (options: RevealOptions) => void }> {
  const { url, reveal } = await startDashboardServer({ reveal: initialReveal });
  const { page } = await launchApp('dashboard');
  await page.goto(url);
  return { page, reveal };
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

type OpenArgs = { reveal: RevealOptions; port?: number; host?: string };

function parseOpenArgs(): OpenArgs {
  const args = minimist(process.argv.slice(2), { string: ['session', 'workspace', 'host'] });
  const portStr = args.port as string | undefined;
  return {
    reveal: {
      sessionName: (args.session as string) || undefined,
      workspaceDir: (args.workspace as string) || undefined,
    },
    port: portStr !== undefined ? Number(portStr) : undefined,
    host: (args.host as string) || undefined,
  };
}

async function acquireSingleton(reveal: RevealOptions): Promise<net.Server> {
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
        client.write(JSON.stringify({ command: 'bringToFront', ...reveal }));
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
  const { reveal: revealOptions, port, host } = parseOpenArgs();
  process.on('unhandledRejection', error => {
    // eslint-disable-next-line no-console
    console.error('Unhandled promise rejection:', error);
  });
  if (port !== undefined) {
    const { url } = await startDashboardServer({ port, host, reveal: revealOptions });
    // eslint-disable-next-line no-console
    console.log(`Listening on ${url}`);
    return;
  }
  let server: net.Server | undefined;
  process.on('exit', () => server?.close());
  const underTest = !!process.env.PLAYWRIGHT_DASHBOARD_DEBUG_PORT;
  if (!underTest) {
    try {
      server = await acquireSingleton(revealOptions);
    } catch {
      return;
    }
  }
  const { page, reveal } = await innerOpenDashboardApp(revealOptions);
  server?.on('connection', socket => {
    const chunks: Buffer[] = [];
    socket.on('data', data => chunks.push(data));
    socket.on('end', () => {
      const message = Buffer.concat(chunks).toString();
      let parsed: { command?: string; sessionName?: string; workspaceDir?: string } | undefined;
      try {
        parsed = JSON.parse(message);
      } catch {
        // no-op
      }
      if (parsed?.command !== 'bringToFront')
        return;
      page?.bringToFront().catch(() => {});
      reveal({ sessionName: parsed.sessionName, workspaceDir: parsed.workspaceDir });
    });
  });
}
