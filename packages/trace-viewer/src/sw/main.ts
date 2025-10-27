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

import { Progress, splitProgress } from './progress';
import { SnapshotServer } from './snapshotServer';
import { TraceModel } from './traceModel';
import { FetchTraceModelBackend, traceFileURL, ZipTraceModelBackend } from './traceModelBackends';
import { TraceVersionError } from './traceModernizer';

type Client = {
  id: string;
  url: string;
  postMessage(message: any): void;
};

type ServiceWorkerGlobalScope = {
  addEventListener(event: 'install', listener: (event: any) => void): void;
  addEventListener(event: 'activate', listener: (event: any) => void): void;
  addEventListener(event: 'fetch', listener: (event: any) => void): void;
  registration: {
    scope: string;
  };
  clients: {
    claim(): Promise<void>;
    get(id: string): Promise<Client | undefined>;
    matchAll(): Promise<Client[]>;
  };
  skipWaiting(): Promise<void>;
};

type FetchEvent = {
  request: Request;
  clientId: string | null;
  resultingClientId: string | null;
  respondWith(response: Promise<Response>): void;
};

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', function(event: any) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event: any) {
  event.waitUntil(self.clients.claim());
});

type LoadedTrace = {
  traceModel: TraceModel;
  snapshotServer: SnapshotServer;
};

const scopePath = new URL(self.registration.scope).pathname;
const loadedTraces = new Map<string, Promise<LoadedTrace>>();
const clientIdToTraceUrls = new Map<string, string>();
const isDeployedAsHttps = self.registration.scope.startsWith('https://');

function simulateRestart() {
  loadedTraces.clear();
  clientIdToTraceUrls.clear();
}

async function loadTraceOrError(clientId: string, url: URL, isContextRequest: boolean, progress: Progress): Promise<{ loadedTrace?: LoadedTrace, errorResponse?: Response }> {
  try {
    const loadedTrace = await loadTrace(clientId, url, isContextRequest, progress);
    return { loadedTrace };
  } catch (error) {
    return {
      errorResponse: new Response(JSON.stringify({ error: error?.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    };
  }
}

function loadTrace(clientId: string, url: URL, isContextRequest: boolean, progress: Progress): Promise<LoadedTrace> {
  const traceUrl = url.searchParams.get('trace')!;
  if (!traceUrl)
    throw new Error('trace parameter is missing');

  clientIdToTraceUrls.set(clientId, traceUrl);
  const omitCache = isContextRequest && isLiveTrace(traceUrl);
  const loadedTrace = omitCache ? undefined : loadedTraces.get(traceUrl);
  if (loadedTrace)
    return loadedTrace;
  const promise = innerLoadTrace(traceUrl, progress);
  loadedTraces.set(traceUrl, promise);
  return promise;
}

async function innerLoadTrace(traceUrl: string, progress: Progress): Promise<LoadedTrace> {
  await gc();

  const traceModel = new TraceModel();
  try {
    // Allow 10% to hop from sw to page.
    const [fetchProgress, unzipProgress] = splitProgress(progress, [0.5, 0.4, 0.1]);
    const backend = isLiveTrace(traceUrl) || traceUrl.endsWith('traces.dir') ? new FetchTraceModelBackend(traceUrl) : new ZipTraceModelBackend(traceUrl, fetchProgress);
    await traceModel.load(backend, unzipProgress);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error(error);
    if (error?.message?.includes('Cannot find .trace file') && await traceModel.hasEntry('index.html'))
      throw new Error('Could not load trace. Did you upload a Playwright HTML report instead? Make sure to extract the archive first and then double-click the index.html file or put it on a web server.');
    if (error instanceof TraceVersionError)
      throw new Error(`Could not load trace from ${traceUrl}. ${error.message}`);
    throw new Error(`Could not load trace from ${traceUrl}. Make sure a valid Playwright Trace is accessible over this url.`);
  }
  const snapshotServer = new SnapshotServer(traceModel.storage(), sha1 => traceModel.resourceForSha1(sha1));
  return { traceModel, snapshotServer };
}

async function doFetch(event: FetchEvent): Promise<Response> {
  const request = event.request;

  // In order to make Accessibility Insights for Web work.
  if (request.url.startsWith('chrome-extension://'))
    return fetch(request);

  if (request.headers.get('x-pw-serviceworker') === 'forward') {
    const request = new Request(event.request);
    request.headers.delete('x-pw-serviceworker');
    return fetch(request);
  }

  const url = new URL(request.url);
  let relativePath: string | undefined;
  if (request.url.startsWith(self.registration.scope))
    relativePath = url.pathname.substring(scopePath.length - 1);

  if (relativePath === '/restartServiceWorker') {
    simulateRestart();
    return new Response(null, { status: 200 });
  }

  if (relativePath === '/ping')
    return new Response(null, { status: 200 });

  const isNavigation = !!event.resultingClientId;
  const client = event.clientId ? await self.clients.get(event.clientId) : undefined;

  if (isNavigation && !relativePath?.startsWith('/sha1/')) {
    // Navigation request. Download is a /sha1/ navigation, ignore them here.

    // Snapshot iframe navigation request.
    if (relativePath?.startsWith('/snapshot/')) {
      // It is Ok to pass noop progress as the trace is likely already loaded.
      const { errorResponse, loadedTrace } = await loadTraceOrError(event.resultingClientId!, url, false, noopProgress);
      if (errorResponse)
        return errorResponse;
      const pageOrFrameId = relativePath.substring('/snapshot/'.length);
      const response = loadedTrace!.snapshotServer.serveSnapshot(pageOrFrameId, url.searchParams, url.href);
      if (isDeployedAsHttps)
        response.headers.set('Content-Security-Policy', 'upgrade-insecure-requests');
      return response;
    }

    // Static content navigation request for trace viewer or popout.
    return fetch(event.request);
  }

  if (!relativePath) {
    // Out-of-scope sub-resource request => iframe snapshot sub-resources.
    if (!client)
      return new Response('Sub-resource without a client', { status: 500 });

    const { snapshotServer } = await loadTrace(client.id, new URL(client.url), false, clientProgress(client));
    if (!snapshotServer)
      return new Response(null, { status: 404 });

    // When trace viewer is deployed over https, we will force upgrade
    // insecure http sub-resources to https. Otherwise, these will fail
    // to load inside our https snapshots.
    // In this case, we also match http resources from the archive by
    // the https urls.
    const lookupUrls = [request.url];
    if (isDeployedAsHttps && request.url.startsWith('https://'))
      lookupUrls.push(request.url.replace(/^https/, 'http'));
    return snapshotServer.serveResource(lookupUrls, request.method, client.url);
  }

  // These commands all require a loaded trace.
  if (relativePath === '/contexts' || relativePath.startsWith('/snapshotInfo/') || relativePath.startsWith('/closest-screenshot/') || relativePath.startsWith('/sha1/')) {
    if (!client)
      return new Response('Sub-resource without a client', { status: 500 });

    const isContextRequest = relativePath === '/contexts';
    const { errorResponse, loadedTrace } = await loadTraceOrError(client.id, url, isContextRequest, clientProgress(client));
    if (errorResponse)
      return errorResponse;

    if (relativePath === '/contexts') {
      return new Response(JSON.stringify(loadedTrace!.traceModel.contextEntries), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (relativePath.startsWith('/snapshotInfo/')) {
      const pageOrFrameId = relativePath.substring('/snapshotInfo/'.length);
      return loadedTrace!.snapshotServer.serveSnapshotInfo(pageOrFrameId, url.searchParams);
    }

    if (relativePath.startsWith('/closest-screenshot/')) {
      const pageOrFrameId = relativePath.substring('/closest-screenshot/'.length);
      return loadedTrace!.snapshotServer.serveClosestScreenshot(pageOrFrameId, url.searchParams);
    }

    if (relativePath.startsWith('/sha1/')) {
      const blob = await loadedTrace!.traceModel.resourceForSha1(relativePath.slice('/sha1/'.length));
      if (blob)
        return new Response(blob, { status: 200, headers: downloadHeaders(url.searchParams) });
      return new Response(null, { status: 404 });
    }
  }

  // Pass through to the server for file requests.
  if (relativePath?.startsWith('/file/')) {
    const path = url.searchParams.get('path')!;
    return await fetch(traceFileURL(path));
  }

  // Static content for sub-resource.
  return fetch(event.request);
}

function downloadHeaders(searchParams: URLSearchParams): Headers | undefined {
  const name = searchParams.get('dn');
  const contentType = searchParams.get('dct');
  if (!name)
    return;
  const headers = new Headers();
  headers.set('Content-Disposition', `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(name)}`);
  if (contentType)
    headers.set('Content-Type', contentType);
  return headers;
}

async function gc() {
  const clients = await self.clients.matchAll();
  const usedTraces = new Set<string>();

  for (const [clientId, traceUrl] of clientIdToTraceUrls) {
    if (!clients.find(c => c.id === clientId)) {
      clientIdToTraceUrls.delete(clientId);
      continue;
    }
    usedTraces.add(traceUrl);
  }

  for (const traceUrl of loadedTraces.keys()) {
    if (!usedTraces.has(traceUrl))
      loadedTraces.delete(traceUrl);
  }
}

function clientProgress(client: Client): Progress {
  return (done: number, total: number) => {
    client.postMessage({ method: 'progress', params: { done, total } });
  };
}

function noopProgress(done: number, total: number): undefined { }

function isLiveTrace(traceUrl: string): boolean {
  return traceUrl.endsWith('.json');
}

self.addEventListener('fetch', function(event: FetchEvent) {
  event.respondWith(doFetch(event));
});
