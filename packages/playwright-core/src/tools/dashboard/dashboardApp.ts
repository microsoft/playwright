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
import { ManualPromise } from '@isomorphic/manualPromise';
import { libPath } from '../../package';
import { playwright } from '../../inprocess';
import { findChromiumChannelBestEffort, registryDirectory } from '../../server/registry/index';
import { minimist } from '../cli-client/minimist';
import { DashboardConnection } from './dashboardController';
import { RegistrySessionProvider } from './registrySessionProvider';
import { IdentitySessionProvider } from './identitySessionProvider';

import type * as api from '../../..';
import type { AnnotateResult } from './dashboardController';
import type { SessionProvider } from './sessionProvider';

// HMR: build-time flag — `true` in watch builds, `false` in release. esbuild
// replaces the identifier via `define`, so the static branch pays zero runtime
// cost and the dev-server code (incl. `import('vite')`) is DCE'd in release.
declare const __PW_HMR__: boolean;

type DashboardServer = {
  url: string;
  reveal: (options: DashboardOptions) => Promise<void>;
  triggerAnnotate: (signal: AbortSignal) => Promise<AnnotateResult>;
  close: () => Promise<void>;
};

async function startDashboardServer(provider: SessionProvider, options: DashboardOptions): Promise<DashboardServer> {
  const dashboardDir = libPath('vite', 'dashboard');
  const httpServer = new HttpServer(dashboardDir);

  const connections = new Set<DashboardConnection>();
  let connectionLanded = new ManualPromise<void>();

  httpServer.createWebSocket(() => {
    let connection: DashboardConnection;
    // eslint-disable-next-line prefer-const
    connection = new DashboardConnection(provider, () => {
      connections.delete(connection);
      if (connections.size === 0)
        connectionLanded = new ManualPromise<void>();
    }, () => {
      connectionLanded.resolve();
    });
    connections.add(connection);
    return connection;
  });

  const wsGuid = httpServer.wsGuid()!;
  httpServer.routePath('/', (_, response) => {
    response.statusCode = 302;
    response.setHeader('Location', `/index.html?ws=${wsGuid}`);
    response.end();
    return true;
  });

  // HMR: watch builds serve the dashboard through an embedded Vite dev server
  // so edits to packages/dashboard/src/* reload live. Release builds always
  // take the static branch (the dev-server arm is DCE'd). Set
  // PW_HMR_STATIC=1 during watch to exercise the bundled output.
  if (__PW_HMR__ && process.env.PW_HMR_STATIC !== '1')
    await attachDashboardDevServer(httpServer);
  else
    attachDashboardStaticServer(httpServer, dashboardDir);
  await httpServer.start({ port: options.port, host: options.host });

  const reveal = async (next: DashboardOptions): Promise<void> => {
    await connectionLanded;
    await Promise.all([...connections].map(async c => {
      if (next.pageId)
        await c.revealPage(next.pageId);
      else if (next.sessionName)
        await c.revealSession(next.sessionName, next.workspaceDir);
    }));
  };

  const triggerAnnotate = async (cancellation: AbortSignal): Promise<AnnotateResult> => {
    await connectionLanded;
    if (cancellation.aborted || connections.size === 0)
      return { type: 'cancelled' };
    // Multiple dashboard connections is theoretical today (one UI per daemon), server mode does not support annotate.
    // If two ever land, the first to submit wins but the losers stay in
    // annotation mode until their UI reloads — revisit if that becomes a real
    // scenario.
    return await Promise.race([...connections].map(c => c.emitAnnotate({ signal: cancellation })));
  };

  const close = async () => {
    for (const c of connections)
      c.close?.();
    await httpServer.stop();
  };
  return { url: httpServer.urlPrefix('human-readable'), reveal, triggerAnnotate, close };
}

function attachDashboardStaticServer(httpServer: HttpServer, dashboardDir: string) {
  httpServer.routePrefix('/', (request: http.IncomingMessage, response: http.ServerResponse) => {
    const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;
    const filePath = pathname === '/' ? 'index.html' : pathname.substring(1);
    const resolved = path.join(dashboardDir, filePath);
    return httpServer.serveFile(request, response, resolved);
  });
}

// HMR begin: dev-mode branch — wires a Vite dev server into HttpServer.
async function attachDashboardDevServer(httpServer: HttpServer) {
  const dashboardRoot = path.resolve(__dirname, '..', '..', 'dashboard');
  const devServer = await httpServer.createViteDevServer({ root: dashboardRoot });
  httpServer.routePrefix('/', (request: http.IncomingMessage, response: http.ServerResponse) => {
    devServer.middlewares(request, response, HttpServer.notFoundFallback(response));
    return true;
  });
}
// HMR end

async function innerOpenDashboardApp(options: DashboardOptions): Promise<{ page: api.Page; server: DashboardServer }> {
  const server = await startDashboardServer(new RegistrySessionProvider(), options);
  void server.reveal(options).catch(() => {});
  const { page } = await launchApp('dashboard', { onClose: () => gracefullyProcessExitDoNotHang(0) });
  await page.goto(server.url);
  return { page, server };
}

async function launchApp(appName: string, options?: { onClose?: () => void }) {
  const channel = findChromiumChannelBestEffort('javascript');
  const context = await playwright.chromium.launchPersistentContext('', {
    ignoreDefaultArgs: ['--enable-automation'],
    channel,
    headless: !!process.env.PWTEST_DASHBOARD_APP_BIND_TITLE,
    args: [
      '--app=data:text/html,',
      '--test-type=',
      `--window-size=1280,800`,
      `--window-position=100,100`,
    ],
    viewport: null,
  });
  if (process.env.PWTEST_DASHBOARD_APP_BIND_TITLE)
    await context.browser()?.bind(process.env.PWTEST_DASHBOARD_APP_BIND_TITLE, { workspaceDir: process.cwd() });

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

  page.on('close', () => options?.onClose?.());

  const image = await fs.promises.readFile(libPath('tools', 'dashboard', 'appIcon.png'));
  // This is local Playwright, so I can access private methods.
  // eslint-disable-next-line no-restricted-syntax -- it is not essential, can regress.
  await (page as any)._setDockTile?.(image);
  await syncLocalStorageWithSettings(page, appName);
  return { context, page };
}

export async function syncLocalStorageWithSettings(page: api.Page, appName: string) {
  const settingsFile = process.env.PWTEST_DASHBOARD_SETTINGS_FILE ?? path.join(registryDirectory, '.settings', `${appName}.json`);

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

type DashboardOptions = {
  sessionName?: string;
  workspaceDir?: string;
  pageId?: string;
  kill?: boolean;
  annotate?: boolean;
  port?: number;
  host?: string;
};

function parseOpenArgs(): DashboardOptions {
  const args = minimist(process.argv.slice(2), { string: ['sessionName', 'workspaceDir', 'host', 'pageId'], boolean: ['annotate', 'kill'] });
  const portStr = args.port as string | undefined;
  return {
    sessionName: args.sessionName as string | undefined,
    workspaceDir: args.workspaceDir as string | undefined,
    pageId: args.pageId as string | undefined,
    port: portStr !== undefined ? Number(portStr) : undefined,
    host: args.host as string | undefined,
    annotate: !!args.annotate,
    kill: !!args.kill,
  };
}

type AcquireResult =
  | { role: 'winner', server: net.Server }
  | { role: 'loser', daemonPid: number };

async function acquireSingleton(options: DashboardOptions): Promise<AcquireResult> {
  const socketPath = dashboardSocketPath();
  if (process.platform !== 'win32')
    await fs.promises.mkdir(path.dirname(socketPath), { recursive: true });

  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(socketPath, () => resolve({ role: 'winner', server }));
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code !== 'EADDRINUSE' && err.code !== 'EEXIST')
        return reject(err);
      let ackBuffer = '';
      const client = net.connect(socketPath, () => {
        client.write(JSON.stringify(options) + '\n');
      });
      client.on('data', chunk => { ackBuffer += chunk.toString(); });
      client.on('end', () => {
        try {
          const { pid } = JSON.parse(ackBuffer.trim());
          resolve({ role: 'loser', daemonPid: pid });
        } catch (e) {
          reject(e);
        }
      });
      client.on('error', () => {
        if (process.platform !== 'win32')
          fs.unlinkSync(socketPath);
        server.listen(socketPath, () => resolve({ role: 'winner', server }));
      });
    });
  });
}

export async function openDashboardApp() {
  const options = parseOpenArgs();
  if (options.kill) {
    await runKillClient();
    return;
  }
  if (options.annotate) {
    await runAnnotateClient(options);
    return;
  }
  process.on('unhandledRejection', error => {
    // eslint-disable-next-line no-console
    console.error('Unhandled promise rejection:', error);
  });
  if (options.port !== undefined) {
    const server = await startDashboardServer(new RegistrySessionProvider(), options);
    void server.reveal(options).catch(() => {});
    // eslint-disable-next-line no-console
    console.log(`Listening on ${server.url}`);
    // eslint-disable-next-line no-restricted-properties
    await new Promise(f => process.stdout.write('', f));  // Make sure stdout is flushed.
    selfDestructOnParentGone();
    return;
  }
  // Self-destruct if the parent CLI dies before we signal READY. Unregistered
  // before we signal so the daemon outlives the parent.
  const stopSelfDestruct = selfDestructOnParentGone();
  const acquired = await acquireSingleton(options);
  if (acquired.role === 'loser') {
    // Another daemon is already running, signal success.
    stopSelfDestruct();
    // eslint-disable-next-line no-console
    console.log(`Dashboard is running pid=${acquired.daemonPid}`);
    // eslint-disable-next-line no-restricted-properties
    await new Promise(f => process.stdout.write('', f));  // Make sure stdout is flushed.
    return;
  }
  const { server } = acquired;
  process.on('exit', () => server.close());
  try {
    await startApp(server, options);
    stopSelfDestruct();
    // eslint-disable-next-line no-console
    console.log(`Dashboard is running pid=${process.pid}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(error);
    gracefullyProcessExitDoNotHang(1);
  }
}

async function startApp(server: net.Server, options: DashboardOptions) {
  const statePromise = innerOpenDashboardApp(options);
  server.on('connection', socket => {
    let buffer = '';
    socket.on('data', async data => {
      buffer += data.toString();
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex === -1)
        return;
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      let parsed: DashboardOptions | undefined;
      try {
        parsed = JSON.parse(line);
      } catch {
        // no-op
      }
      if (!parsed) {
        socket.end();
        return;
      }
      const { page, server: dashboard } = await statePromise;
      if (parsed.annotate) {
        const cancellation = new AbortController();
        socket.on('close', () => cancellation.abort());
        socket.on('error', () => cancellation.abort());
        try {
          await page?.bringToFront();
          await dashboard.reveal(parsed);
          const result = await dashboard.triggerAnnotate(cancellation.signal);
          socket.end(JSON.stringify(result));
        } catch (e) {
          socket.end(e);
        }
      } else if (parsed.kill) {
        await dashboard.close().catch(() => {});
        gracefullyProcessExitDoNotHang(0, () => new Promise(r => socket.end(r)));
      } else {
        try {
          await page?.bringToFront();
          await dashboard.reveal(parsed);
          socket.end(JSON.stringify({ pid: process.pid }) + '\n');
        } catch (e) {
          socket.end(e);
        }
      }
    });
  });
  await statePromise;
}

export async function openDashboardForContext(context: api.BrowserContext): Promise<void> {
  const server = await startDashboardServer(new IdentitySessionProvider(context), {});

  let closed = false;
  const close = async () => {
    if (closed)
      return;
    closed = true;
    await server.close();
  };

  const { page } = await launchApp('dashboard', { onClose: () => { void close(); } });
  context.on('close', () => { void close(); });
  await page.goto(server.url);
}

async function runKillClient(): Promise<void> {
  const socketPath = dashboardSocketPath();
  await new Promise<void>(resolve => {
    const client = net.connect(socketPath);
    client.once('connect', () => {
      client.write(JSON.stringify({ kill: true }) + '\n');
    });
    client.once('end', () => resolve());
    client.once('error', () => resolve());
  });
}

async function runAnnotateClient(options: DashboardOptions): Promise<void> {
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
  socket.write(JSON.stringify(options) + '\n');
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
  // eslint-disable-next-line no-console
  console.log(text);
}

function selfDestructOnParentGone(): () => void {
  const onClose = () => gracefullyProcessExitDoNotHang(0);
  process.stdin.on('close', onClose);
  return () => process.stdin.off('close', onClose);
}
