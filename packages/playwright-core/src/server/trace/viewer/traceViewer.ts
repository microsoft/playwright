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

import path from 'path';
import fs from 'fs';
import { HttpServer } from '../../../utils/httpServer';
import type { Transport } from '../../../utils/httpServer';
import { gracefullyProcessExitDoNotHang, isUnderTest } from '../../../utils';
import { syncLocalStorageWithSettings } from '../../launchApp';
import { serverSideCallMetadata } from '../../instrumentation';
import { createPlaywright } from '../../playwright';
import { ProgressController } from '../../progress';
import { open } from '../../../utilsBundle';
import type { Page } from '../../page';
import type { BrowserType } from '../../browserType';
import { launchApp } from '../../launchApp';

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
  workers?: number | string;
  headed?: boolean;
  timeout?: number;
  reporter?: string[];
  webApp?: string;
  isServer?: boolean;
  outputDir?: string;
  updateSnapshots?: 'all' | 'none' | 'missing';
};

export type TraceViewerAppOptions = {
  headless?: boolean;
  persistentContextOptions?: Parameters<BrowserType['launchPersistentContext']>[2];
};

function validateTraceUrls(traceUrls: string[]) {
  for (const traceUrl of traceUrls) {
    let traceFile = traceUrl;
    // If .json is requested, we'll synthesize it.
    if (traceUrl.endsWith('.json'))
      traceFile = traceUrl.substring(0, traceUrl.length - '.json'.length);

    if (!traceUrl.startsWith('http://') && !traceUrl.startsWith('https://') && !fs.existsSync(traceFile) && !fs.existsSync(traceFile + '.trace'))
      throw new Error(`Trace file ${traceUrl} does not exist!`);
  }
}

export async function startTraceViewerServer(options?: TraceViewerServerOptions): Promise<HttpServer> {
  const server = new HttpServer();
  server.routePrefix('/trace', (request, response) => {
    const url = new URL('http://localhost' + request.url!);
    const relativePath = url.pathname.slice('/trace'.length);
    if (relativePath.endsWith('/stall.js'))
      return true;
    if (relativePath.startsWith('/file')) {
      try {
        const filePath = url.searchParams.get('path')!;
        if (fs.existsSync(filePath))
          return server.serveFile(request, response, url.searchParams.get('path')!);

        // If .json is requested, we'll synthesize it for zip-less operation.
        if (filePath.endsWith('.json')) {
          const traceName = filePath.substring(0, filePath.length - '.json'.length);
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(traceDescriptor(traceName)));
          return true;
        }
      } catch (e) {
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
    server.createWebSocket(transport);

  const { host, port } = options || {};
  await server.start({ preferredPort: port, host });
  return server;
}

export async function installRootRedirect(server: HttpServer, traceUrls: string[], options: TraceViewerRedirectOptions) {
  const params = new URLSearchParams();
  for (const traceUrl of traceUrls)
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
  if (options.workers)
    params.append('workers', String(options.workers));
  if (options.timeout)
    params.append('timeout', String(options.timeout));
  if (options.headed)
    params.append('headed', '');
  if (options.outputDir)
    params.append('outputDir', options.outputDir);
  if (options.updateSnapshots)
    params.append('updateSnapshots', options.updateSnapshots);
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

export async function runTraceViewerApp(traceUrls: string[], browserName: string, options: TraceViewerServerOptions & { headless?: boolean }, exitOnClose?: boolean) {
  validateTraceUrls(traceUrls);
  const server = await startTraceViewerServer(options);
  await installRootRedirect(server, traceUrls, options);
  const page = await openTraceViewerApp(server.urlPrefix('precise'), browserName, options);
  if (exitOnClose)
    page.on('close', () => gracefullyProcessExitDoNotHang(0));
  return page;
}

export async function runTraceInBrowser(traceUrls: string[], options: TraceViewerServerOptions) {
  validateTraceUrls(traceUrls);
  const server = await startTraceViewerServer(options);
  await installRootRedirect(server, traceUrls, options);
  await openTraceInBrowser(server.urlPrefix('human-readable'));
}

export async function openTraceViewerApp(url: string, browserName: string, options?: TraceViewerAppOptions): Promise<Page> {
  const traceViewerPlaywright = createPlaywright({ sdkLanguage: 'javascript', isInternalPlaywright: true });
  const traceViewerBrowser = isUnderTest() ? 'chromium' : browserName;

  const { context, page } = await launchApp(traceViewerPlaywright[traceViewerBrowser as 'chromium'], {
    // TODO: store language in the trace.
    sdkLanguage: traceViewerPlaywright.options.sdkLanguage,
    windowSize: { width: 1280, height: 800 },
    persistentContextOptions: {
      ...options?.persistentContextOptions,
      useWebSocket: isUnderTest(),
      headless: !!options?.headless,
    },
  });

  const controller = new ProgressController(serverSideCallMetadata(), context._browser);
  await controller.run(async progress => {
    await context._browser._defaultContext!._loadDefaultContextAsIs(progress);
  });

  if (process.env.PWTEST_PRINT_WS_ENDPOINT)
    process.stderr.write('DevTools listening on: ' + context._browser.options.wsEndpoint + '\n');

  if (!isUnderTest())
    await syncLocalStorageWithSettings(page, 'traceviewer');

  if (isUnderTest())
    page.on('close', () => context.close({ reason: 'Trace viewer closed' }).catch(() => {}));

  await page.mainFrame().goto(serverSideCallMetadata(), url);
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

function traceDescriptor(traceName: string) {
  const result: { entries: { name: string, path: string }[] } = {
    entries: []
  };

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
