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

const loadedTraces = new Map<string, { traceModel: TraceModel, snapshotServer: SnapshotServer, clientId: string }>();

async function loadTrace(trace: string, clientId: string): Promise<TraceModel> {
  const entry = loadedTraces.get(trace);
  if (entry)
    return entry.traceModel;
  const traceModel = new TraceModel();
  const url = trace.startsWith('http') || trace.startsWith('blob') ? trace : `/file?path=${trace}`;
  await traceModel.load(url);
  const snapshotServer = new SnapshotServer(traceModel.storage());
  loadedTraces.set(trace, { traceModel, snapshotServer, clientId });
  return traceModel;
}

// @ts-ignore
async function doFetch(event: FetchEvent): Promise<Response> {
  const request = event.request;
  const snapshotUrl = request.mode === 'navigate' ?
    request.url : (await self.clients.get(event.clientId))!.url;
  const traceUrl = new URL(snapshotUrl).searchParams.get('trace')!;
  const { snapshotServer } = loadedTraces.get(traceUrl) || {};

  if (request.url.startsWith(self.registration.scope)) {
    const url = new URL(request.url);

    const relativePath = url.pathname.substring(scopePath.length - 1);
    if (relativePath === '/context') {
      await gc();
      const traceModel = await loadTrace(traceUrl, event.clientId);
      return new Response(JSON.stringify(traceModel!.contextEntry), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (relativePath.startsWith('/snapshotSize/')) {
      if (!snapshotServer)
        return new Response(null, { status: 404 });
      return snapshotServer.serveSnapshotSize(relativePath, url.searchParams);
    }

    if (relativePath.startsWith('/snapshot/')) {
      if (!snapshotServer)
        return new Response(null, { status: 404 });
      return snapshotServer.serveSnapshot(relativePath, url.searchParams, snapshotUrl);
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

  if (!snapshotServer)
    return new Response(null, { status: 404 });
  return snapshotServer.serveResource(request.url, snapshotUrl);
}

async function gc() {
  const usedTraces = new Set<string>();
  for (const [traceUrl, entry] of loadedTraces) {
    const client = await self.clients.get(entry.clientId);
    if (client)
      usedTraces.add(traceUrl);
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
