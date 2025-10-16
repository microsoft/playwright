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
import { spawn, spawnSync } from 'child_process';
import { gracefullyProcessExitDoNotHang, isUnderTest } from '../../../utils';
import { HttpServer } from '../../utils/httpServer';
import { open } from '../../../utilsBundle';
import { launchApp, syncLocalStorageWithSettings } from '../../launchApp';
import { createPlaywright } from '../../playwright';
import { ProgressController } from '../../progress';
import type { Transport } from '../../utils/httpServer';
import type { BrowserType } from '../../browserType';
import type { Page } from '../../page';

export type TraceViewerServerOptions = {
  host?: string;
  port?: number;
  isServer?: boolean;
  transport?: Transport;
};

export type TraceViewerRedirectOptions = {
  args?: string[];
  grep?: string;
  grepInvert?: string;
  project?: string[];
  reporter?: string[];
  webApp?: string;
  isServer?: boolean;
};

export type TraceViewerAppOptions = {
  headless?: boolean;
  persistentContextOptions?: Parameters<BrowserType['launchPersistentContext']>[2];
};

function validateTraceUrl(traceUrl: string | undefined) {
  if (!traceUrl)
    return;
  let traceFile = traceUrl;
  if (traceUrl.endsWith('.json'))
    traceFile = traceUrl.substring(0, traceUrl.length - '.json'.length);

  if (
    !traceUrl.startsWith('http://') &&
    !traceUrl.startsWith('https://') &&
    !fs.existsSync(traceFile) &&
    !fs.existsSync(traceFile + '.trace')
  )
    throw new Error(`Trace file ${traceUrl} does not exist!`);
}

export async function startTraceViewerServer(options?: TraceViewerServerOptions): Promise<HttpServer> {
  const server = new HttpServer();
  server.routePrefix('/trace', (request, response) => {
    const url = new URL('http://localhost' + request.url!);
    const relativePath = url.pathname.slice('/trace'.length);

    // --- Enhanced: open-in-ide endpoint for VS Code, Cursor, WebStorm, Visual Studio, Notepad++ ---
    if (relativePath.startsWith('/open-in-ide')) {
      try {
        const ide = url.searchParams.get('ide');
        const file = url.searchParams.get('file');
        const line = url.searchParams.get('line');

        // --- IDE availability check handler ---
        if (url.searchParams.get('check') === '1') {
          const isWin = process.platform === 'win32';
          let exists = false;

          if (ide === 'vscode') {
            exists = true; // assume protocol handler exists
          } else if (ide === 'cursor') {
            const check = spawnSync('which', ['cursor']);
            exists = check.status === 0;
          } else if (ide === 'webstorm') {
            const check = spawnSync('which', ['webstorm']);
            exists = check.status === 0;
          } else if (ide === 'visualstudio' && isWin) {
            exists = true;
          } else if (ide === 'notepadpp' && isWin) {
            exists = true;
          }

          response.statusCode = exists ? 200 : 404;
          response.end();
          return true;
        }

        if (!file) {
          response.statusCode = 400;
          response.end('Missing file parameter');
          return true;
        }

        // ---- VS Code ----
        if (ide === 'vscode') {
          const vscodeUrl = `vscode://file//${file}${line ? `:${line}` : ''}`;
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ url: vscodeUrl }));
          return true;
        }

        // ---- Cursor ----
        if (ide === 'cursor') {
          const cursorUrl = `cursor://file//${file}${line ? `:${line}` : ''}`;
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ url: cursorUrl }));
          return true;
        }

        // ---- WebStorm ----
        if (ide === 'webstorm') {
          const args: string[] = [];
          if (line)
            args.push('--line', line);
          args.push(file);
          try {
            spawn('webstorm', args, { detached: true, stdio: 'ignore' });
          } catch (err) {
            console.error('Failed to launch WebStorm:', err);
          }
          response.statusCode = 200;
          response.end('ok');
          return true;
        }

        // ---- Visual Studio (Windows only) ----
        if (ide === 'visualstudio') {
          if (process.platform !== 'win32') {
            response.statusCode = 400;
            response.end('Visual Studio is only supported on Windows');
            return true;
          }
          const args: string[] = [];
          if (line)
            args.push('/Edit', file, '/Command', `Edit.Goto ${line}`);
          else
            args.push('/Edit', file);
          try {
            spawn('devenv', args, { detached: true, stdio: 'ignore' });
          } catch (err) {
            console.error('Failed to launch Visual Studio:', err);
          }
          response.statusCode = 200;
          response.end('ok');
          return true;
        }

        // ---- Notepad++ (Windows only) ----
        if (ide === 'notepadpp') {
          if (process.platform !== 'win32') {
            response.statusCode = 400;
            response.end('Notepad++ is only supported on Windows');
            return true;
          }
          const args: string[] = [];
          if (line)
            args.push(`-n${line}`);
          args.push(file);
          try {
            spawn('notepad++', args, { detached: true, stdio: 'ignore' });
          } catch (err) {
            console.error('Failed to launch Notepad++:', err);
          }
          response.statusCode = 200;
          response.end('ok');
          return true;
        }

        // ---- Unknown IDE ----
        response.statusCode = 400;
        response.end('Unknown IDE');
        return true;
      } catch (e) {
        console.error('Failed to open IDE:', e);
        response.statusCode = 500;
        response.end('Failed to open IDE');
        return true;
      }
    }
    // ---------------------------------------------------------------

    if (relativePath.startsWith('/file')) {
      try {
        const filePath = url.searchParams.get('path')!;
        if (fs.existsSync(filePath))
          return server.serveFile(request, response, url.searchParams.get('path')!);

        if (filePath.endsWith('.json')) {
          const traceName = filePath.substring(0, filePath.length - '.json'.length);
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(traceDescriptor(traceName)));
          return true;
        }
      } catch (e) {}
      response.statusCode = 404;
      response.end();
      return true;
    }

    const absolutePath = path.join(__dirname, '..', '..', '..', 'vite', 'traceViewer', ...relativePath.split('/'));
    return server.serveFile(request, response, absolutePath);
  });

  const transport = options?.transport || (options?.isServer ? new StdinServer() : undefined);
  if (transport)
    server.createWebSocket(transport);

  const { host, port } = options || {};
  await server.start({ preferredPort: port, host });
  return server;
}

export async function installRootRedirect(server: HttpServer, traceUrl: string | undefined, options: TraceViewerRedirectOptions) {
  const params = new URLSearchParams();
  if (path.sep !== path.posix.sep)
    params.set('pathSeparator', path.sep);
  if (traceUrl)
    params.append('trace', traceUrl);
  if (server.wsGuid())
    params.append('ws', server.wsGuid()!);
  if (options?.isServer)
    params.append('isServer', '');
  if (isUnderTest())
    params.append('isUnderTest', 'true');
  for (const arg of options.args || [])
    params.append('arg', arg);
  if (options.grep)
    params.append('grep', options.grep);
  if (options.grepInvert)
    params.append('grepInvert', options.grepInvert);
  for (const project of options.project || [])
    params.append('project', project);
  for (const reporter of options.reporter || [])
    params.append('reporter', reporter);

  const urlPath = `./trace/${options.webApp || 'index.html'}?${params.toString()}`;
  server.routePath('/', (_, response) => {
    response.statusCode = 302;
    response.setHeader('Location', urlPath);
    response.end();
    return true;
  });
}

export async function runTraceViewerApp(traceUrl: string | undefined, browserName: string, options: TraceViewerServerOptions & { headless?: boolean }, exitOnClose?: boolean) {
  validateTraceUrl(traceUrl);
  const server = await startTraceViewerServer(options);
  await installRootRedirect(server, traceUrl, options);
  const page = await openTraceViewerApp(server.urlPrefix('precise'), browserName, options);
  if (exitOnClose)
    page.on('close', () => gracefullyProcessExitDoNotHang(0));
  return page;
}

export async function runTraceInBrowser(traceUrl: string | undefined, options: TraceViewerServerOptions) {
  validateTraceUrl(traceUrl);
  const server = await startTraceViewerServer(options);
  await installRootRedirect(server, traceUrl, options);
  await openTraceInBrowser(server.urlPrefix('human-readable'));
}

export async function openTraceViewerApp(url: string, browserName: string, options?: TraceViewerAppOptions): Promise<Page> {
  const traceViewerPlaywright = createPlaywright({ sdkLanguage: 'javascript', isInternalPlaywright: true });
  const traceViewerBrowser = isUnderTest() ? 'chromium' : browserName;

  const { context, page } = await launchApp(traceViewerPlaywright[traceViewerBrowser as 'chromium'], {
    sdkLanguage: traceViewerPlaywright.options.sdkLanguage,
    windowSize: { width: 1280, height: 800 },
    persistentContextOptions: {
      ...options?.persistentContextOptions,
      cdpPort: isUnderTest() ? 0 : undefined,
      headless: !!options?.headless,
      colorScheme: isUnderTest() ? 'light' : undefined,
    },
  });

  const controller = new ProgressController();
  await controller.run(async progress => {
    await context._browser._defaultContext!._loadDefaultContextAsIs(progress);

    if (process.env.PWTEST_PRINT_WS_ENDPOINT) {
      // eslint-disable-next-line no-restricted-properties
      process.stderr.write('DevTools listening on: ' + context._browser.options.wsEndpoint + '\n');
    }

    if (!isUnderTest())
      await syncLocalStorageWithSettings(page, 'traceviewer');

    if (isUnderTest())
      page.on('close', () => context.close({ reason: 'Trace viewer closed' }).catch(() => {}));

    await page.mainFrame().goto(progress, url);
  });
  return page;
}

export async function openTraceInBrowser(url: string) {
  // eslint-disable-next-line no-console
  console.log('\nListening on ' + url);
  if (!isUnderTest())
    await open(url.replace('0.0.0.0', 'localhost')).catch(() => {});
}

class StdinServer implements Transport {
  private _pollTimer: NodeJS.Timeout | undefined;
  private _traceUrl: string | undefined;

  constructor() {
    process.stdin.on('data', data => {
      const url = data.toString().trim();
      if (url === this._traceUrl)
        return;
      if (url.endsWith('.json'))
        this._pollLoadTrace(url);
      else
        this._loadTrace(url);
    });
    process.stdin.on('close', () => gracefullyProcessExitDoNotHang(0));
  }

  onconnect() {}
  async dispatch(method: string, params: any) {
    if (method === 'initialize' && this._traceUrl)
      this._loadTrace(this._traceUrl);
  }
  onclose() {}
  sendEvent?: (method: string, params: any) => void;
  close?: () => void;

  private _loadTrace(traceUrl: string) {
    this._traceUrl = traceUrl;
    clearTimeout(this._pollTimer);
    this.sendEvent?.('loadTraceRequested', { traceUrl });
  }

  private _pollLoadTrace(url: string) {
    this._loadTrace(url);
    this._pollTimer = setTimeout(() => this._pollLoadTrace(url), 500);
  }
}

function traceDescriptor(traceName: string) {
  const result: { entries: { name: string; path: string }[] } = { entries: [] };
  const traceDir = path.dirname(traceName);
  const traceFile = path.basename(traceName);
  for (const name of fs.readdirSync(traceDir)) {
    if (name.startsWith(traceFile))
      result.entries.push({ name, path: path.join(traceDir, name) });
  }
  const resourcesDir = path.join(traceDir, 'resources');
  if (fs.existsSync(resourcesDir)) {
    for (const name of fs.readdirSync(resourcesDir))
      result.entries.push({ name: 'resources/' + name, path: path.join(resourcesDir, name) });
  }
  return result;
}
