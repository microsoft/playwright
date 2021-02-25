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
import querystring from 'querystring';
import { SnapshotRenderer } from './snapshotRenderer';
import { HttpServer } from '../../utils/httpServer';
import type { RenderedFrameSnapshot } from './snapshot';

export type NetworkResponse = {
  contentType: string;
  responseHeaders: { name: string, value: string }[];
  responseSha1: string;
};

export interface SnapshotStorage {
  resourceContent(sha1: string): Buffer | undefined;
  resourceById(resourceId: string): NetworkResponse | undefined;
  snapshotById(snapshotId: string): SnapshotRenderer | undefined;
}

export class SnapshotServer {
  private _urlPrefix: string;
  private _snapshotStorage: SnapshotStorage;

  constructor(server: HttpServer, snapshotStorage: SnapshotStorage) {
    this._urlPrefix = server.urlPrefix();
    this._snapshotStorage = snapshotStorage;

    server.routePath('/snapshot/', this._serveSnapshotRoot.bind(this), true);
    server.routePath('/snapshot/service-worker.js', this._serveServiceWorker.bind(this));
    server.routePath('/snapshot-data', this._serveSnapshot.bind(this));
    server.routePrefix('/resources/', this._serveResource.bind(this));
  }

  snapshotRootUrl() {
    return this._urlPrefix + '/snapshot/';
  }

  snapshotUrl(pageId: string, snapshotId?: string, timestamp?: number) {
    // Prefer snapshotId over timestamp.
    if (snapshotId)
      return this._urlPrefix + `/snapshot/pageId/${pageId}/snapshotId/${snapshotId}/main`;
    if (timestamp)
      return this._urlPrefix + `/snapshot/pageId/${pageId}/timestamp/${timestamp}/main`;
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
      const snapshotResources = new Map<string, { [key: string]: { resourceId?: string, sha1?: string } }>();

      self.addEventListener('install', function(event: any) {
      });

      self.addEventListener('activate', function(event: any) {
        event.waitUntil(self.clients.claim());
      });

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
        const request = event.request;
        const pathname = new URL(request.url).pathname;
        if (pathname === '/snapshot/service-worker.js' || pathname === '/snapshot/')
          return fetch(event.request);

        let snapshotId: string;
        if (request.mode === 'navigate') {
          snapshotId = pathname;
        } else {
          const client = (await self.clients.get(event.clientId))!;
          snapshotId = new URL(client.url).pathname;
        }
        if (request.mode === 'navigate') {
          const htmlResponse = await fetch(`/snapshot-data?snapshotName=${snapshotId}`);
          const { html, resources }: RenderedFrameSnapshot  = await htmlResponse.json();
          if (!html)
            return respondNotAvailable();
          snapshotResources.set(snapshotId, resources);
          const response = new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
          return response;
        }

        const resources = snapshotResources.get(snapshotId)!;
        const urlWithoutHash = removeHash(request.url);
        const resource = resources[urlWithoutHash];
        if (!resource)
          return respond404();

        const fetchUrl = resource.sha1 ?
          `/resources/${resource.resourceId}/override/${resource.sha1}` :
          `/resources/${resource.resourceId}`;
        const fetchedResponse = await fetch(fetchUrl);
        const headers = new Headers(fetchedResponse.headers);
        // We make a copy of the response, instead of just forwarding,
        // so that response url is not inherited as "/resources/...", but instead
        // as the original request url.
        // Response url turns into resource base uri that is used to resolve
        // relative links, e.g. url(/foo/bar) in style sheets.
        if (resource.sha1) {
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
    const snapshot = this._snapshotStorage.snapshotById(parsed.snapshotName);
    const snapshotData: any = snapshot ? snapshot.render() : { html: '' };
    response.end(JSON.stringify(snapshotData));
    return true;
  }

  private _serveResource(request: http.IncomingMessage, response: http.ServerResponse): boolean {
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

    const resource = this._snapshotStorage.resourceById(resourceId);
    if (!resource)
      return false;

    const sha1 = overrideSha1 || resource.responseSha1;
    try {
      const content = this._snapshotStorage.resourceContent(sha1);
      if (!content)
        return false;
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
