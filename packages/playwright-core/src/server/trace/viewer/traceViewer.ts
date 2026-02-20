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

import { gracefullyProcessExitDoNotHang } from '../../../utils';
import { isUnderTest } from '../../../utils';
import { HttpServer } from '../../utils/httpServer';
import { open } from '../../../utilsBundle';
import { syncLocalStorageWithSettings } from '../../launchApp';
import { launchApp } from '../../launchApp';
import { createPlaywright } from '../../playwright';
import { ProgressController } from '../../progress';

import type { Transport } from '../../utils/httpServer';
import type { BrowserType } from '../../browserType';
import type { Page } from '../../page';
import type http from 'http';

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

const tracesDirMarker = 'traces.dir';

function validateTraceUrlOrPath(traceFileOrUrl: string | undefined): string | undefined {
  if (!traceFileOrUrl)
    return traceFileOrUrl;

  if (traceFileOrUrl.startsWith('http://') || traceFileOrUrl.startsWith('https://'))
    return traceFileOrUrl;

  let traceFile = traceFileOrUrl;
  // If .json is requested, we'll synthesize it.
  if (traceFile.endsWith('.json'))
    return toFilePathUrl(traceFile);

  try {
    const stat = fs.statSync(traceFile);
    // If the path is a directory, add 'trace.dir' which has a special handler.
    if (stat.isDirectory())
      traceFile = path.join(traceFile, tracesDirMarker);
    return toFilePathUrl(traceFile);
  } catch {
    throw new Error(`Trace file ${traceFileOrUrl} does not exist!`);
  }
}

export async function startTraceViewerServer(options?: TraceViewerServerOptions): Promise<HttpServer> {
  const server = new HttpServer();
  server.routePrefix('/trace', (request, response) => {
    const url = new URL('http://localhost' + request.url!);
    const relativePath = url.pathname.slice('/trace'.length);
    if (relativePath.startsWith('/file')) {
      try {
        const filePath = url.searchParams.get('path')!;
        if (fs.existsSync(filePath))
          return server.serveFile(request, response, url.searchParams.get('path')!);

        // If .json is requested, we'll synthesize it for zip-less operation.
        if (filePath.endsWith('.json')) {
          const fullPrefix = filePath.substring(0, filePath.length - '.json'.length);
          // Live traces are stored in the common artifacts directory. Trace files
          // corresponding to a particular test, all have the same unique prefix.
          return sendTraceDescriptor(response, path.dirname(fullPrefix), path.basename(fullPrefix));
        }

        // If 'trace.dir' is requested, return all trace files inside.
        if (filePath.endsWith(tracesDirMarker))
          return sendTraceDescriptor(response, path.dirname(filePath));
      } catch {
      }
      response.statusCode = 404;
      response.end();
      return true;
    }
    const absolutePath = path.join(__dirname, '..', '..', '..', 'vite', 'traceViewer', ...relativePath.split('/'));
    return server.serveFile(request, response, absolutePath);
  });

  const transport = options?.transport || (options?.isServer ? new StdinServer() : undefined);
  if (transport)
    server.createWebSocket(() => transport);

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

  const urlPath  = `./trace/${options.webApp || 'index.html'}?${params.toString()}`;
  server.routePath('/', (_, response) => {
    response.statusCode = 302;
    response.setHeader('Location', urlPath);
    response.end();
    return true;
  });
}

export async function runTraceViewerApp(traceUrl: string | undefined, browserName: string, options: TraceViewerServerOptions & { headless?: boolean }, exitOnClose?: boolean) {
  traceUrl = validateTraceUrlOrPath(traceUrl);
  const server = await startTraceViewerServer(options);
  await installRootRedirect(server, traceUrl, options);
  const page = await openTraceViewerApp(server.urlPrefix('precise'), browserName, options);
  if (exitOnClose)
    page.on('close', () => gracefullyProcessExitDoNotHang(0));
  return page;
}

export async function runTraceInBrowser(traceUrl: string | undefined, options: TraceViewerServerOptions) {
  traceUrl = validateTraceUrlOrPath(traceUrl);
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
      const url = validateTraceUrlOrPath(data.toString().trim());
      if (!url || url === this._traceUrl)
        return;
      if (url.endsWith('.json'))
        this._pollLoadTrace(url);
      else
        this._loadTrace(url);
    });
    process.stdin.on('close', () => gracefullyProcessExitDoNotHang(0));
  }

  onconnect() {
  }

  async dispatch(method: string, params: any) {
    if (method === 'initialize') {
      if (this._traceUrl)
        this._loadTrace(this._traceUrl);
    }
  }

  onclose() {
  }

  sendEvent?: (method: string, params: any) => void;
  close?: () => void;

  private _loadTrace(traceUrl: string) {
    this._traceUrl = traceUrl;
    clearTimeout(this._pollTimer);
    this.sendEvent?.('loadTraceRequested', { traceUrl });
  }

  private _pollLoadTrace(url: string) {
    this._loadTrace(url);
    this._pollTimer = setTimeout(() => {
      this._pollLoadTrace(url);
    }, 500);
  }
}

function sendTraceDescriptor(response: http.ServerResponse, traceDir: string, tracePrefix?: string) {
  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(traceDescriptor(traceDir, tracePrefix)));
  return true;
}

function traceDescriptor(traceDir: string, tracePrefix: string | undefined) {
  const result: { entries: { name: string, path: string }[] } = {
    entries: []
  };

  for (const name of fs.readdirSync(traceDir)) {
    if (!tracePrefix || name.startsWith(tracePrefix))
      result.entries.push({ name, path: toFilePathUrl(path.join(traceDir, name)) });
  }

  const resourcesDir = path.join(traceDir, 'resources');
  if (fs.existsSync(resourcesDir)) {
    for (const name of fs.readdirSync(resourcesDir))
      result.entries.push({ name: 'resources/' + name, path: toFilePathUrl(path.join(resourcesDir, name)) });
  }
  return result;
}


function toFilePathUrl(filePath: string): string {
  return `file?path=${encodeURIComponent(filePath)}`;
}
