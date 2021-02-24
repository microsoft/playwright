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

import * as http from 'http';
import fs from 'fs';
import path from 'path';
import querystring from 'querystring';
import type { TraceModel } from './traceModel';
import { TraceServer } from './traceServer';

export class SnapshotServer {
  private _resourcesDir: string | undefined;
  private _server: TraceServer;
  private _traceModel: TraceModel;

  constructor(server: TraceServer, traceModel: TraceModel, resourcesDir: string | undefined) {
    this._resourcesDir = resourcesDir;
    this._server = server;

    this._traceModel = traceModel;
    server.routePath('/snapshot/', this._serveSnapshotRoot.bind(this), true);
    server.routePath('/snapshot/service-worker.js', this._serveServiceWorker.bind(this));
    server.routePath('/snapshot-data', this._serveSnapshot.bind(this));
    server.routePrefix('/resources/', this._serveResource.bind(this));
  }

  snapshotRootUrl() {
    return this._server.urlPrefix() + '/snapshot/';
  }

  snapshotUrl(pageId: string, snapshotId?: string, timestamp?: number) {
    // Prefer snapshotId over timestamp.
    if (snapshotId)
      return this._server.urlPrefix() + `/snapshot/pageId/${pageId}/snapshotId/${snapshotId}/main`;
    if (timestamp)
      return this._server.urlPrefix() + `/snapshot/pageId/${pageId}/timestamp/${timestamp}/main`;
    return 'data:text/html,Snapshot is not available';
  }

  private _serveSnapshotRoot(request: http.IncomingMessage, response: http.ServerResponse): boolean {
    response.statusCode = 200;
    response.setHeader('Cache-Control', 'public, max-age=31536000');
    response.setHeader('Content-Type', 'text/html');
    response.end(`
      <style>
        html, body {
          margin: 0;
          padding: 0;
        }
        iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
        }
      </style>
      <body>
        <script>
          navigator.serviceWorker.register('./service-worker.js');

          let showPromise = Promise.resolve();
          if (!navigator.serviceWorker.controller)
            showPromise = new Promise(resolve => navigator.serviceWorker.oncontrollerchange = resolve);

          let current = document.createElement('iframe');
          document.body.appendChild(current);
          let next = document.createElement('iframe');
          document.body.appendChild(next);
          next.style.visibility = 'hidden';
          const onload = () => {
            let temp = current;
            current = next;
            next = temp;
            current.style.visibility = 'visible';
            next.style.visibility = 'hidden';
          };
          current.onload = onload;
          next.onload = onload;

          window.showSnapshot = async url => {
            await showPromise;
            next.src = url;
          };
        </script>
      </body>
    `);
    return true;
  }

  private _serveServiceWorker(request: http.IncomingMessage, response: http.ServerResponse): boolean {
    function serviceWorkerMain(self: any /* ServiceWorkerGlobalScope */) {
      const pageToResourcesByUrl = new Map<string, { [key: string]: { resourceId: string, frameId: string }[] }>();
      const pageToOverriddenUrls = new Map<string, { [key: string]: boolean }>();
      const snapshotToResourceOverrides = new Map<string, { [key: string]: string | undefined }>();

      self.addEventListener('install', function(event: any) {
      });

      self.addEventListener('activate', function(event: any) {
        event.waitUntil(self.clients.claim());
      });

      function parseUrl(urlString: string): { pageId: string, frameId: string, timestamp?: number, snapshotId?: string } {
        const url = new URL(urlString);
        const parts = url.pathname.split('/');
        if (!parts[0])
          parts.shift();
        if (!parts[parts.length - 1])
          parts.pop();
        // - /snapshot/pageId/<pageId>/snapshotId/<snapshotId>/<frameId>
        // - /snapshot/pageId/<pageId>/timestamp/<timestamp>/<frameId>
        if (parts.length !== 6 || parts[0] !== 'snapshot' || parts[1] !== 'pageId' || (parts[3] !== 'snapshotId' && parts[3] !== 'timestamp'))
          throw new Error(`Unexpected url "${urlString}"`);
        return {
          pageId: parts[2],
          frameId: parts[5] === 'main' ? parts[2] : parts[5],
          snapshotId: (parts[3] === 'snapshotId' ? parts[4] : undefined),
          timestamp: (parts[3] === 'timestamp' ? +parts[4] : undefined),
        };
      }

      function respond404(): Response {
        return new Response(null, { status: 404 });
      }

      function respondNotAvailable(): Response {
        return new Response('<body>Snapshot is not available</body>', { status: 200, headers: { 'Content-Type': 'text/html' } });
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
        try {
          const pathname = new URL(event.request.url).pathname;
          if (pathname === '/snapshot/service-worker.js' || pathname === '/snapshot/')
            return fetch(event.request);
        } catch (e) {
        }

        const request = event.request;
        let parsed: { pageId: string, frameId: string, timestamp?: number, snapshotId?: string };
        if (request.mode === 'navigate') {
          parsed = parseUrl(request.url);
        } else {
          const client = (await self.clients.get(event.clientId))!;
          parsed = parseUrl(client.url);
        }

        if (request.mode === 'navigate') {
          const htmlResponse = await fetch(`/snapshot-data?pageId=${parsed.pageId}&snapshotId=${parsed.snapshotId || ''}&timestamp=${parsed.timestamp || ''}&frameId=${parsed.frameId || ''}`);
          const { html, resourcesByUrl, overriddenUrls, resourceOverrides } = await htmlResponse.json();
          if (!html)
            return respondNotAvailable();
          pageToResourcesByUrl.set(parsed.pageId, resourcesByUrl);
          pageToOverriddenUrls.set(parsed.pageId, overriddenUrls);
          snapshotToResourceOverrides.set(parsed.snapshotId + '@' + parsed.timestamp, resourceOverrides);
          const response = new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
          return response;
        }

        const resourcesByUrl = pageToResourcesByUrl.get(parsed.pageId);
        const overriddenUrls = pageToOverriddenUrls.get(parsed.pageId);
        const resourceOverrides = snapshotToResourceOverrides.get(parsed.snapshotId + '@' + parsed.timestamp);
        const urlWithoutHash = removeHash(request.url);
        const resourcesWithUrl = resourcesByUrl?.[urlWithoutHash] || [];
        const resource = resourcesWithUrl.find(r => r.frameId === parsed.frameId) || resourcesWithUrl[0];
        if (!resource)
          return respond404();

        const overrideSha1 = resourceOverrides?.[urlWithoutHash];
        const fetchUrl = overrideSha1 ?
          `/resources/${resource.resourceId}/override/${overrideSha1}` :
          `/resources/${resource.resourceId}`;
        const fetchedResponse = await fetch(fetchUrl);
        const headers = new Headers(fetchedResponse.headers);
        // We make a copy of the response, instead of just forwarding,
        // so that response url is not inherited as "/resources/...", but instead
        // as the original request url.
        // Response url turns into resource base uri that is used to resolve
        // relative links, e.g. url(/foo/bar) in style sheets.
        if (overriddenUrls?.[urlWithoutHash]) {
          // No cache, so that we refetch overridden resources.
          headers.set('Cache-Control', 'no-cache');
        }
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
    }

    response.statusCode = 200;
    response.setHeader('Cache-Control', 'public, max-age=31536000');
    response.setHeader('Content-Type', 'application/javascript');
    response.end(`(${serviceWorkerMain.toString()})(self)`);
    return true;
  }

  private _serveSnapshot(request: http.IncomingMessage, response: http.ServerResponse): boolean {
    response.statusCode = 200;
    response.setHeader('Cache-Control', 'public, max-age=31536000');
    response.setHeader('Content-Type', 'application/json');
    const parsed: any = querystring.parse(request.url!.substring(request.url!.indexOf('?') + 1));
    const snapshot = parsed.snapshotId ?
      this._traceModel.findSnapshotById(parsed.pageId, parsed.frameId, parsed.snapshotId) :
      this._traceModel.findSnapshotByTime(parsed.pageId, parsed.frameId, parsed.timestamp!);
    const snapshotData: any = snapshot ? snapshot.serialize() : { html: '' };
    response.end(JSON.stringify(snapshotData));
    return true;
  }

  private _serveResource(request: http.IncomingMessage, response: http.ServerResponse): boolean {
    if (!this._resourcesDir)
      return false;

    // - /resources/<resourceId>
    // - /resources/<resourceId>/override/<overrideSha1>
    const parts = request.url!.split('/');
    if (!parts[0])
      parts.shift();
    if (!parts[parts.length - 1])
      parts.pop();
    if (parts[0] !== 'resources')
      return false;

    let resourceId;
    let overrideSha1;
    if (parts.length === 2) {
      resourceId = parts[1];
    } else if (parts.length === 4 && parts[2] === 'override') {
      resourceId = parts[1];
      overrideSha1 = parts[3];
    } else {
      return false;
    }

    const resource = this._traceModel.resourceById.get(resourceId);
    if (!resource)
      return false;
    const sha1 = overrideSha1 || resource.responseSha1;
    try {
      const content = fs.readFileSync(path.join(this._resourcesDir, sha1));
      response.statusCode = 200;
      let contentType = resource.contentType;
      const isTextEncoding = /^text\/|^application\/(javascript|json)/.test(contentType);
      if (isTextEncoding && !contentType.includes('charset'))
        contentType = `${contentType}; charset=utf-8`;
      response.setHeader('Content-Type', contentType);
      for (const { name, value } of resource.responseHeaders)
        response.setHeader(name, value);

      response.removeHeader('Content-Encoding');
      response.removeHeader('Access-Control-Allow-Origin');
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.removeHeader('Content-Length');
      response.setHeader('Content-Length', content.byteLength);
      response.setHeader('Cache-Control', 'public, max-age=31536000');
      response.end(content);
      return true;
    } catch (e) {
      return false;
    }
  }
}
