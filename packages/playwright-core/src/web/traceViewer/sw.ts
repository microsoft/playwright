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

let traceModel: TraceModel | undefined;
let snapshotServer: SnapshotServer | undefined;
const scopePath = new URL(self.registration.scope).pathname;

async function loadTrace(trace: string): Promise<TraceModel> {
  const traceModel = new TraceModel();
  const url = trace.startsWith('http') || trace.startsWith('blob') ? trace : `/file?path=${trace}`;
  await traceModel.load(url);
  return traceModel;
}

// @ts-ignore
async function doFetch(event: FetchEvent): Promise<Response> {
  const request = event.request;
  const url = new URL(request.url);
  const snapshotUrl = request.mode === 'navigate' ?
    request.url : (await self.clients.get(event.clientId))!.url;

  if (request.url.startsWith(self.registration.scope)) {
    const relativePath = url.pathname.substring(scopePath.length - 1);
    if (relativePath === '/context') {
      const trace = url.searchParams.get('trace')!;
      traceModel = await loadTrace(trace);
      snapshotServer = new SnapshotServer(traceModel.storage());
      return new Response(JSON.stringify(traceModel!.contextEntry), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (relativePath.startsWith('/snapshotSize/'))
      return snapshotServer!.serveSnapshotSize(relativePath, url.searchParams);
    if (relativePath.startsWith('/snapshot/'))
      return snapshotServer!.serveSnapshot(relativePath, url.searchParams, snapshotUrl);
    if (relativePath.startsWith('/sha1/')) {
      const blob = await traceModel!.resourceForSha1(relativePath.slice('/sha1/'.length));
      if (blob)
        return new Response(blob, { status: 200 });
      else
        return new Response(null, { status: 404 });
    }
    return fetch(event.request);
  }


  if (!snapshotServer)
    return new Response(null, { status: 404 });
  return snapshotServer!.serveResource(request.url, snapshotUrl);
}

// @ts-ignore
self.addEventListener('fetch', function(event: FetchEvent) {
  event.respondWith(doFetch(event));
});
