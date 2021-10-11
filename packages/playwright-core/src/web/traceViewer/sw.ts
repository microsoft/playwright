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

import type { RenderedFrameSnapshot } from '../../server/snapshot/snapshotTypes';

// @ts-ignore
declare const self: ServiceWorkerGlobalScope;

const kBlobUrlPrefix = 'http://playwright.bloburl/#';
const snapshotIds = new Map<string, { frameId: string, index: number }>();

self.addEventListener('install', function(event: any) {
});

self.addEventListener('activate', function(event: any) {
  event.waitUntil(self.clients.claim());
});

function respondNotAvailable(): Response {
  return new Response('<body style="background: #ddd"></body>', { status: 200, headers: { 'Content-Type': 'text/html' } });
}

function removeHash(url: string) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch (e) {
    return url;
  }
}

async function doFetch(event: any /* FetchEvent */): Promise<Response> {
  const request = event.request;
  const pathname = new URL(request.url).pathname;
  const isSnapshotUrl = pathname !== '/snapshot/' && pathname.startsWith('/snapshot/');
  if (request.url.startsWith(self.location.origin) && !isSnapshotUrl)
    return fetch(event.request);

  const snapshotUrl = request.mode === 'navigate' ?
    request.url : (await self.clients.get(event.clientId))!.url;

  if (request.mode === 'navigate') {
    const htmlResponse = await fetch(request);
    const { html, frameId, index }: RenderedFrameSnapshot  = await htmlResponse.json();
    if (!html)
      return respondNotAvailable();
    snapshotIds.set(snapshotUrl, { frameId, index });
    const response = new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    return response;
  }

  const { frameId, index } = snapshotIds.get(snapshotUrl)!;
  const url = request.url.startsWith(kBlobUrlPrefix) ? request.url.substring(kBlobUrlPrefix.length) : removeHash(request.url);
  const complexUrl = btoa(JSON.stringify({ frameId, index, url }));
  const fetchUrl = `/resources/${complexUrl}`;
  const fetchedResponse = await fetch(fetchUrl);
  // We make a copy of the response, instead of just forwarding,
  // so that response url is not inherited as "/resources/...", but instead
  // as the original request url.

  // Response url turns into resource base uri that is used to resolve
  // relative links, e.g. url(/foo/bar) in style sheets.
  const headers = new Headers(fetchedResponse.headers);
  const response = new Response(fetchedResponse.body, {
    status: fetchedResponse.status,
    statusText: fetchedResponse.statusText,
    headers,
  });
  return response;
}

self.addEventListener('fetch', function(event: any) {
  event.respondWith(doFetch(event));
});
