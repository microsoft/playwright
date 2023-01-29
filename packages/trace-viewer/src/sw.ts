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

import { MultiMap } from './multimap';
import { unwrapPopoutUrl } from './snapshotRenderer';
import { SnapshotServer } from './snapshotServer';
import { TraceModel } from './traceModel';

// @ts-ignore
declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', function(event: any) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event: any) {
  event.waitUntil(self.clients.claim());
});

const scopePath = new URL(self.registration.scope).pathname;

const loadedTraces = new Map<string, { traceModel: TraceModel, snapshotServer: SnapshotServer }>();

const clientIdToTraceUrls = new MultiMap<string, string>();

async function loadTrace(traceUrl: string, traceFileName: string | null, clientId: string, progress: (done: number, total: number) => void): Promise<TraceModel> {
  const entry = loadedTraces.get(traceUrl);
  clientIdToTraceUrls.set(clientId, traceUrl);
  if (entry)
    return entry.traceModel;
  const traceModel = new TraceModel();
  try {
    await traceModel.load(traceUrl, progress);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error(error);

    if (error?.message?.includes('Cannot find .trace file') && await traceModel.hasEntry('index.html'))
      throw new Error('Could not load trace. Did you upload a Playwright HTML report instead? Make sure to extract the archive first and then double-click the index.html file or put it on a web server.');
    else if (traceFileName)
      throw new Error(`Could not load trace from ${traceFileName}. Make sure to upload a valid Playwright trace.`);
    else
      throw new Error(`Could not load trace from ${traceUrl}. Make sure a valid Playwright Trace is accessible over this url.`);
  }
  const snapshotServer = new SnapshotServer(traceModel.storage());
  loadedTraces.set(traceUrl, { traceModel, snapshotServer });
  return traceModel;
}

// @ts-ignore
async function doFetch(event: FetchEvent): Promise<Response> {
  const request = event.request;
  const client = await self.clients.get(event.clientId);

  if (request.url.startsWith(self.registration.scope)) {
    const url = new URL(unwrapPopoutUrl(request.url));
    const relativePath = url.pathname.substring(scopePath.length - 1);
    if (relativePath === '/ping') {
      await gc();
      return new Response(null, { status: 200 });
    }

    const traceUrl = url.searchParams.get('trace')!;
    const { snapshotServer } = loadedTraces.get(traceUrl) || {};

    if (relativePath === '/context') {
      try {
        const traceModel = await loadTrace(traceUrl, url.searchParams.get('traceFileName'), event.clientId, (done: number, total: number) => {
          client.postMessage({ method: 'progress', params: { done, total } });
        });
        return new Response(JSON.stringify(traceModel!.contextEntry), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error?.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (relativePath.startsWith('/snapshotInfo/')) {
      if (!snapshotServer)
        return new Response(null, { status: 404 });
      return snapshotServer.serveSnapshotInfo(relativePath, url.searchParams);
    }

    if (relativePath.startsWith('/snapshot/')) {
      if (!snapshotServer)
        return new Response(null, { status: 404 });
      return snapshotServer.serveSnapshot(relativePath, url.searchParams, url.href);
    }

    if (relativePath.startsWith('/sha1/')) {
      // Sha1 is unique, load it from either of the models for simplicity.
      for (const { traceModel } of loadedTraces.values()) {
        const blob = await traceModel!.resourceForSha1(relativePath.slice('/sha1/'.length));
        if (blob)
          return new Response(blob, { status: 200 });
      }
      return new Response(null, { status: 404 });
    }

    // Fallback to network.
    return fetch(event.request);
  }

  const snapshotUrl = unwrapPopoutUrl(client!.url);
  const traceUrl = new URL(snapshotUrl).searchParams.get('trace')!;
  const { snapshotServer } = loadedTraces.get(traceUrl) || {};
  if (!snapshotServer)
    return new Response(null, { status: 404 });
  return snapshotServer.serveResource(request.url, snapshotUrl);
}

async function gc() {
  const clients = await self.clients.matchAll();
  const usedTraces = new Set<string>();

  for (const [clientId, traceUrls] of clientIdToTraceUrls) {
    // @ts-ignore
    if (!clients.find(c => c.id === clientId))
      clientIdToTraceUrls.deleteAll(clientId);
    else
      traceUrls.forEach(url => usedTraces.add(url));
  }

  for (const traceUrl of loadedTraces.keys()) {
    if (!usedTraces.has(traceUrl))
      loadedTraces.delete(traceUrl);
  }
}

// @ts-ignore
self.addEventListener('fetch', function(event: FetchEvent) {
  event.respondWith(doFetch(event));
});
