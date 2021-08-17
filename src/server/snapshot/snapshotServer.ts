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
import { HttpServer } from '../../utils/httpServer';
import type { RenderedFrameSnapshot } from './snapshotTypes';
import { SnapshotStorage } from './snapshotStorage';
import type { Point } from '../../common/types';

export class SnapshotServer {
  private _snapshotStorage: SnapshotStorage;

  constructor(server: HttpServer, snapshotStorage: SnapshotStorage) {
    this._snapshotStorage = snapshotStorage;

    server.routePrefix('/snapshot/', this._serveSnapshot.bind(this));
    server.routePrefix('/snapshotSize/', this._serveSnapshotSize.bind(this));
    server.routePrefix('/resources/', this._serveResource.bind(this));
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
        (${rootScript})();
        </script>
      </body>
    `);
    return true;
  }

  private _serveServiceWorker(request: http.IncomingMessage, response: http.ServerResponse): boolean {
    function serviceWorkerMain(self: any /* ServiceWorkerGlobalScope */) {
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
        if (pathname === '/snapshot/service-worker.js' || pathname === '/snapshot/')
          return fetch(event.request);

        const snapshotUrl = request.mode === 'navigate' ?
          request.url : (await self.clients.get(event.clientId))!.url;

        if (request.mode === 'navigate') {
          const htmlResponse = await fetch(event.request);
          const { html, frameId, index }: RenderedFrameSnapshot  = await htmlResponse.json();
          if (!html)
            return respondNotAvailable();
          snapshotIds.set(snapshotUrl, { frameId, index });
          const response = new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
          return response;
        }

        const { frameId, index } = snapshotIds.get(snapshotUrl)!;
        const url = removeHash(request.url);
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
    }

    response.statusCode = 200;
    response.setHeader('Cache-Control', 'public, max-age=31536000');
    response.setHeader('Content-Type', 'application/javascript');
    response.end(`(${serviceWorkerMain.toString()})(self)`);
    return true;
  }

  private _serveSnapshot(request: http.IncomingMessage, response: http.ServerResponse): boolean {
    if (request.url!.endsWith('/snapshot/'))
      return this._serveSnapshotRoot(request, response);
    if (request.url!.endsWith('/snapshot/service-worker.js'))
      return this._serveServiceWorker(request, response);
    const snapshot = this._snapshot(request.url!.substring('/snapshot/'.length));
    this._respondWithJson(response, snapshot ? snapshot.render() : { html: '' });
    return true;
  }

  private _serveSnapshotSize(request: http.IncomingMessage, response: http.ServerResponse): boolean {
    const snapshot = this._snapshot(request.url!.substring('/snapshotSize/'.length));
    this._respondWithJson(response, snapshot ? snapshot.viewport() : {});
    return true;
  }

  private _snapshot(uri: string) {
    const [ pageOrFrameId, query ] = uri.split('?');
    const parsed: any = querystring.parse(query);
    return this._snapshotStorage.snapshotByName(pageOrFrameId, parsed.name);
  }

  private _respondWithJson(response: http.ServerResponse, object: any) {
    response.statusCode = 200;
    response.setHeader('Cache-Control', 'public, max-age=31536000');
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(object));
  }

  private _serveResource(request: http.IncomingMessage, response: http.ServerResponse): boolean {
    const { frameId, index, url } = JSON.parse(Buffer.from(request.url!.substring('/resources/'.length), 'base64').toString());
    const snapshot = this._snapshotStorage.snapshotByIndex(frameId, index);
    const resource = snapshot?.resourceByUrl(url);
    if (!resource)
      return false;

    const sha1 = resource.responseSha1;
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
      for (const { name, value } of resource.responseHeaders) {
        try {
          response.setHeader(name, value.split('\n'));
        } catch (e) {
          // Browser is able to handle the header, but Node is not.
          // Swallow the error since we cannot do anything meaningful.
        }
      }

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

declare global {
  interface Window {
    showSnapshot: (url: string, point?: Point) => Promise<void>;
  }
}
function rootScript() {
  if (!navigator.serviceWorker)
    return;
  navigator.serviceWorker.register('./service-worker.js');
  let showPromise = Promise.resolve();
  if (!navigator.serviceWorker.controller) {
    showPromise = new Promise(resolve => {
      navigator.serviceWorker.oncontrollerchange = () => resolve();
    });
  }

  const pointElement = document.createElement('div');
  pointElement.style.position = 'fixed';
  pointElement.style.backgroundColor = 'red';
  pointElement.style.width = '20px';
  pointElement.style.height = '20px';
  pointElement.style.borderRadius = '10px';
  pointElement.style.margin = '-10px 0 0 -10px';
  pointElement.style.zIndex = '2147483647';

  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  (window as any).showSnapshot = async (url: string, options: { point?: Point } = {}) => {
    await showPromise;
    iframe.src = url;
    if (options.point) {
      pointElement.style.left = options.point.x + 'px';
      pointElement.style.top = options.point.y + 'px';
      document.documentElement.appendChild(pointElement);
    } else {
      pointElement.remove();
    }
  };
  window.addEventListener('message', event => {
    window.showSnapshot(window.location.href + event.data.snapshotUrl);
  }, false);
}
