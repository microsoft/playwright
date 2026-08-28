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

/* eslint-disable no-console */

import { TraceLoader } from '@isomorphic/trace/traceLoader';
import { gracefullyCloseAll } from '@utils/processLauncher';
import { HttpServer } from '@utils/httpServer';
import { SnapshotServer } from '@isomorphic/trace/snapshotServer';
import { BrowserBackend } from '../backend/browserBackend';
import { browserTools } from '../backend/tools';
import { playwright } from '../../inprocess';
import { parseCommand } from '../cli-daemon/command';
import { minimist } from '../cli-client/minimist';
import { commands } from '../cli-daemon/commands';
import { kActionPhases, loadTrace } from './traceUtils';

import type { SnapshotStorage } from '@isomorphic/trace/snapshotStorage';
import type { ActionPhase } from '@isomorphic/trace/trace';

export async function traceSnapshot(actionId: string, options: { phase?: string, serve?: boolean, browserArgs?: string[] }): Promise<void> {
  const trace = await loadTrace();

  const action = trace.resolveActionId(actionId);
  if (!action) {
    console.error(`Action '${actionId}' not found.`);
    process.exitCode = 1;
    return;
  }

  const callId = action.callId;
  const storage = trace.loader.storage();

  let phase: ActionPhase | undefined;
  if (options.phase) {
    phase = kActionPhases.find(p => p === options.phase);
    if (!phase) {
      console.error(`Unknown snapshot phase '${options.phase}', expected one of: ${kActionPhases.join(', ')}.`);
      process.exitCode = 1;
      return;
    }
  } else {
    phase = kActionPhases.find(p => storage.snapshotForCall(callId, p));
  }

  if (!phase || !storage.snapshotForCall(callId, phase)) {
    console.error(`No snapshot found for action '${actionId}'.`);
    process.exitCode = 1;
    return;
  }

  const server = await serveTraceSnapshot(storage, trace.loader, callId, phase);

  if (options.serve) {
    console.log(`Serving snapshot at ${server.url}`);
    await new Promise(() => {});
    return;
  }

  await runCommandOnSnapshot(server, options.browserArgs || []);
}

async function serveTraceSnapshot(storage: SnapshotStorage, loader: TraceLoader, callId: string, phase: ActionPhase): Promise<{ url: string, stop: () => Promise<void> }> {
  const snapshotServer = new SnapshotServer(storage, file => loader.resourceEntry(file));
  const httpServer = new HttpServer();

  httpServer.routePrefix('/snapshot/', (request: any, response: any) => {
    const url = new URL('http://localhost' + request.url!);
    const snapshotCallId = decodeURIComponent(url.pathname.substring('/snapshot/'.length));
    const snapshotResponse = snapshotServer.serveSnapshot(snapshotCallId, url.searchParams, url.href);
    response.statusCode = snapshotResponse.status;
    snapshotResponse.headers.forEach((value: string, key: string) => response.setHeader(key, value));
    snapshotResponse.text().then((text: string) => response.end(text));
    return true;
  });

  httpServer.routePath('/__pwsnapshot/sw.js', (_request: any, response: any) => {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/javascript');
    response.setHeader('Service-Worker-Allowed', '/');
    response.end(`(${snapshotServiceWorker.toString()})();`);
    return true;
  });

  httpServer.routePath('/__pwsnapshot/resource', (request: any, response: any) => {
    const url = new URL('http://localhost' + request.url!);
    const frame = new URL(url.searchParams.get('frame')!);
    const snapshotUrl = 'http://localhost' + frame.pathname + frame.search;
    const requestUrl = url.searchParams.get('url')!;
    const method = url.searchParams.get('method')!;
    snapshotServer.serveResource([requestUrl], method, snapshotUrl).then(async resp => {
      response.statusCode = resp.status;
      resp.headers.forEach((value: string, key: string) => response.appendHeader(key, value));
      response.end(Buffer.from(await resp.arrayBuffer()));
    }).catch(() => {
      response.statusCode = 500;
      response.end();
    });
    return true;
  });

  const startTime = Date.now();
  const snapshotUrl = `/snapshot/${encodeURIComponent(callId)}?phase=${phase}`;
  httpServer.routePrefix('/', (_request: any, response: any) => {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<!DOCTYPE html><html><body><script>(${bootstrapSnapshotPage.toString()})(${JSON.stringify(`/__pwsnapshot/sw.js?v=${startTime}`)}, ${JSON.stringify(snapshotUrl)});</script></body></html>`);
    return true;
  });

  await httpServer.start({ preferredPort: 0 });
  return { url: httpServer.urlPrefix('human-readable'), stop: () => httpServer.stop() };
}

function snapshotServiceWorker() {
  type Client = { url: string };
  type FetchEvent = {
    request: Request;
    clientId: string | null;
    respondWith(response: Promise<Response>): void;
  };
  type ServiceWorkerGlobalScope = {
    location: { origin: string };
    addEventListener(event: 'install' | 'activate', listener: (event: any) => void): void;
    addEventListener(event: 'fetch', listener: (event: FetchEvent) => void): void;
    clients: { claim(): Promise<void>; get(id: string): Promise<Client | undefined> };
    skipWaiting(): Promise<void>;
  };
  const sw = self as unknown as ServiceWorkerGlobalScope;

  sw.addEventListener('install', () => sw.skipWaiting());
  sw.addEventListener('activate', event => event.waitUntil(sw.clients.claim()));
  sw.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin === sw.location.origin)
      return;
    event.respondWith((async () => {
      const client = event.clientId ? await sw.clients.get(event.clientId) : null;
      if (!client)
        return new Response('No client', { status: 500 });
      const params = new URLSearchParams({
        frame: client.url,
        url: event.request.url,
        method: event.request.method,
      });
      return fetch('/__pwsnapshot/resource?' + params.toString());
    })());
  });
}

async function bootstrapSnapshotPage(swUrl: string, snapshotUrl: string) {
  await navigator.serviceWorker.register(swUrl, { scope: '/' });
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller)
    await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  location.replace(snapshotUrl);
}

async function runCommandOnSnapshot(server: { url: string, stop: () => Promise<void> }, browserArgs: string[]) {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.url);
  await page.waitForURL(url => new URL(url).pathname.startsWith('/snapshot/'));

  const backend = new BrowserBackend({
    snapshot: { mode: 'full' },
    skillMode: true,
  }, context, browserTools);
  await backend.initialize({ cwd: process.cwd(), clientName: 'playwright-cli' });

  try {
    if (!browserArgs.length)
      browserArgs = ['snapshot'];
    const args = minimist(browserArgs, { string: ['_'] });
    const command = commands[args._[0]];
    if (!command)
      throw new Error(`Unknown command: ${args._[0]}`);
    const { toolName, toolParams } = parseCommand(command, args as Record<string, string> & { _: string[] });
    const result = await backend.callTool(toolName, toolParams);
    const text = result.content[0]?.type === 'text' ? result.content[0].text : undefined;
    if (text)
      console.log(text);
    if (result.isError) {
      console.error('Command failed.');
      process.exitCode = 1;
    }
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
  } finally {
    await server.stop().catch(e => console.error(e));
    await gracefullyCloseAll();
  }
}
