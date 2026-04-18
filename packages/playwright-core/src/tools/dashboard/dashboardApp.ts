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
import { saveOutputFile } from '../trace/traceUtils';
import { DashboardConnection } from './dashboardController';

import type * as api from '../../..';
import type { AnnotationData } from '@dashboard/dashboardChannel';

type RevealOptions = { sessionName?: string; workspaceDir?: string };

type DashboardCommand = RevealOptions & { command: 'bringToFront' | 'annotate' };

type DashboardServer = {
  url: string;
  reveal: (options: RevealOptions) => void;
  triggerAnnotate: () => void;
  registerAnnotateWaiter: (socket: net.Socket) => void;
};

async function startDashboardServer(options: { port?: number; host?: string; reveal?: RevealOptions } = {}): Promise<DashboardServer> {
  const httpServer = new HttpServer();
  const dashboardDir = libPath('vite', 'dashboard');

  const connections = new Set<DashboardConnection>();
  let currentReveal: RevealOptions = options.reveal ?? {};
  let pendingAnnotate = false;
  const waitingSockets = new Set<net.Socket>();

  const submitAnnotation = (base64Png: string, annotations: AnnotationData[]) => {
    if (waitingSockets.size === 0)
      return;
    const payload = JSON.stringify({ png: base64Png, annotations });
    for (const socket of waitingSockets) {
      socket.write(payload);
      socket.end();
    }
    waitingSockets.clear();
  };

  httpServer.createWebSocket(() => {
    let connection: DashboardConnection;
    // eslint-disable-next-line prefer-const
    connection = new DashboardConnection(() => connections.delete(connection), () => {
      if (currentReveal.sessionName)
        connection.revealSession(currentReveal.sessionName, currentReveal.workspaceDir);
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
  await httpServer.start({ port: options.port, host: options.host });

  const reveal = (next: RevealOptions) => {
    currentReveal = next;
    if (!next.sessionName)
      return;
    for (const connection of connections)
      connection.revealSession(next.sessionName, next.workspaceDir);
  };

  const triggerAnnotate = () => {
    if (connections.size === 0) {
      pendingAnnotate = true;
      return;
    }
    for (const connection of connections)
      connection.emitAnnotate();
  };

  const registerAnnotateWaiter = (socket: net.Socket) => {
    waitingSockets.add(socket);
    const cleanup = () => waitingSockets.delete(socket);
    socket.on('close', cleanup);
    socket.on('error', cleanup);
  };

  return { url: httpServer.urlPrefix('human-readable'), reveal, triggerAnnotate, registerAnnotateWaiter };
}

async function innerOpenDashboardApp(initialReveal: RevealOptions): Promise<{ page: api.Page; server: DashboardServer }> {
  const server = await startDashboardServer({ reveal: initialReveal });
  const { page } = await launchApp('dashboard');
  await page.goto(server.url);
  return { page, server };
}

async function launchApp(appName: string) {
  const channel = findChromiumChannelBestEffort('javascript');
  const context = await playwright.chromium.launchPersistentContext('', {
    ignoreDefaultArgs: ['--enable-automation'],
    channel,
    headless: !!process.env.PW_DASHBOARD_APP_BIND_TITLE,
    args: [
      '--app=data:text/html,',
      '--test-type=',
      `--window-size=1280,800`,
      `--window-position=100,100`,
    ],
    viewport: null,
  });
  if (process.env.PW_DASHBOARD_APP_BIND_TITLE)
    await context.browser()?.bind(process.env.PW_DASHBOARD_APP_BIND_TITLE, { workspaceDir: process.cwd() });

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

type OpenArgs = { reveal: RevealOptions; port?: number; host?: string; annotate: boolean };

function parseOpenArgs(): OpenArgs {
  const args = minimist(process.argv.slice(2), { string: ['session', 'workspace', 'host'], boolean: ['annotate'] });
  const portStr = args.port as string | undefined;
  return {
    reveal: {
      sessionName: (args.session as string) || undefined,
      workspaceDir: (args.workspace as string) || undefined,
    },
    port: portStr !== undefined ? Number(portStr) : undefined,
    host: (args.host as string) || undefined,
    annotate: !!args.annotate,
  };
}

async function acquireSingleton(reveal: RevealOptions): Promise<net.Server> {
  const socketPath = dashboardSocketPath();
  if (process.platform !== 'win32')
    await fs.promises.mkdir(path.dirname(socketPath), { recursive: true });

  return await new Promise((resolve, reject) => {
    const server = net.createServer({ allowHalfOpen: true });
    server.listen(socketPath, () => resolve(server));
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code !== 'EADDRINUSE')
        return reject(err);
      const client = net.connect(socketPath, () => {
        const message: DashboardCommand = { command: 'bringToFront', ...reveal };
        client.write(JSON.stringify(message));
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
  const args = parseOpenArgs();
  if (args.annotate) {
    await runAnnotateClient(args);
    return;
  }
  process.on('unhandledRejection', error => {
    // eslint-disable-next-line no-console
    console.error('Unhandled promise rejection:', error);
  });
  if (args.port !== undefined) {
    const { url } = await startDashboardServer({ port: args.port, host: args.host, reveal: args.reveal });
    // eslint-disable-next-line no-console
    console.log(`Listening on ${url}`);
    selfDestructOnParentGone();
    return;
  }
  let server: net.Server | undefined;
  process.on('exit', () => server?.close());
  try {
    server = await acquireSingleton(args.reveal);
  } catch {
    return;
  }
  const statePromise = innerOpenDashboardApp(args.reveal);
  server?.on('connection', socket => {
    let buffer = '';
    const processMessage = async (message: string) => {
      let parsed: DashboardCommand | undefined;
      try {
        parsed = JSON.parse(message);
      } catch {
        // no-op
      }
      if (!parsed?.command)
        return;
      const { page, server: dashboard } = await statePromise;
      const revealTo = { sessionName: parsed.sessionName, workspaceDir: parsed.workspaceDir };
      if (parsed.command === 'bringToFront') {
        page?.bringToFront().catch(() => {});
        dashboard.reveal(revealTo);
      } else if (parsed.command === 'annotate') {
        page?.bringToFront().catch(() => {});
        dashboard.reveal(revealTo);
        dashboard.triggerAnnotate();
        dashboard.registerAnnotateWaiter(socket);
      }
    };
    socket.on('data', data => {
      buffer += data.toString();
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex !== -1)
        processMessage(buffer.slice(0, newlineIndex));
    });
    // Support legacy callers that use socket.end(data) without newline.
    socket.on('end', () => {
      if (buffer.length > 0 && !buffer.includes('\n'))
        processMessage(buffer);
    });
  });
  await statePromise;
}

async function runAnnotateClient(args: OpenArgs): Promise<void> {
  selfDestructOnParentGone();

  const socketPath = dashboardSocketPath();
  const tryConnect = () => new Promise<net.Socket | undefined>(resolve => {
    const s = net.connect(socketPath);
    const onError = () => { s.destroy(); resolve(undefined); };
    s.once('connect', () => { s.off('error', onError); resolve(s); });
    s.once('error', onError);
  });
  const deadline = Date.now() + 15000;
  let socket: net.Socket | undefined;
  while (Date.now() < deadline) {
    socket = await tryConnect();
    if (socket)
      break;
    await new Promise(r => setTimeout(r, 200));
  }
  if (!socket) {
    // eslint-disable-next-line no-console
    console.error('Dashboard did not start in time.');
    gracefullyProcessExitDoNotHang(1);
    return;
  }
  const message: DashboardCommand = { command: 'annotate', ...args.reveal };
  socket.write(JSON.stringify(message) + '\n');
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    socket!.on('data', chunk => chunks.push(chunk));
    socket!.on('end', () => resolve());
    socket!.on('error', reject);
  });
  socket.destroy();
  const text = Buffer.concat(chunks).toString();
  if (!text)
    return;
  const { png, annotations } = JSON.parse(text) as { png: string; annotations: AnnotationData[] };
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = await saveOutputFile(`annotations-${timestamp}.png`, Buffer.from(png, 'base64'));
  for (const a of annotations) {
    // eslint-disable-next-line no-console
    console.log(`{ x: ${a.x}, y: ${a.y}, width: ${a.width}, height: ${a.height} }: ${a.text}`);
  }
  // eslint-disable-next-line no-console
  console.log(`image available at: ${path.relative(process.cwd(), filePath)}`);
}

function selfDestructOnParentGone() {
  process.stdin.on('close', () => {
    gracefullyProcessExitDoNotHang(0);
  });
}
