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
import * as fs from 'fs';
import * as path from 'path';
import type { TraceModel, trace } from './traceModel';

export class SnapshotServer {
  static async create(traceViewerDir: string, resourcesDir: string | undefined, traceModel: TraceModel): Promise<SnapshotServer> {
    const server = new SnapshotServer(traceViewerDir, resourcesDir, traceModel);
    await new Promise(cb => server._server.once('listening', cb));
    return server;
  }

  private _traceViewerDir: string;
  private _resourcesDir: string | undefined;
  private _traceModel: TraceModel;
  private _server: http.Server;
  private _resourceById: Map<string, trace.NetworkResourceTraceEvent>;

  constructor(traceViewerDir: string, resourcesDir: string | undefined, traceModel: TraceModel) {
    this._traceViewerDir = traceViewerDir;
    this._resourcesDir = resourcesDir;
    this._traceModel = traceModel;
    this._server = http.createServer(this._onRequest.bind(this));
    this._server.listen();

    this._resourceById = new Map();
    for (const contextEntry of traceModel.contexts) {
      for (const pageEntry of contextEntry.pages) {
        for (const action of pageEntry.actions)
          action.resources.forEach(r => this._resourceById.set(r.resourceId, r));
        pageEntry.resources.forEach(r => this._resourceById.set(r.resourceId, r));
      }
    }
  }

  private _urlPrefix() {
    const address = this._server.address();
    return typeof address === 'string' ? address : `http://127.0.0.1:${address.port}`;
  }

  traceViewerUrl(relative: string) {
    return this._urlPrefix() + '/traceviewer/' + relative;
  }

  private _onRequest(request: http.IncomingMessage, response: http.ServerResponse) {
    request.on('error', () => response.end());
    if (!request.url)
      return response.end();

    const url = new URL('http://localhost' + request.url);
    if (url.pathname.startsWith('/traceviewer/') && this._serveTraceViewer(request, response, url.pathname))
      return;

    const hasReferrer = request.headers['referer'] && request.headers['referer'].startsWith(this._urlPrefix());
    if (!hasReferrer)
      return response.end();
    if (url.pathname.startsWith('/resources/') && this._serveResource(request, response, url.pathname))
      return;
    if (url.pathname.startsWith('/sha1/') && this._serveSha1(request, response, url.pathname))
      return;
    if (url.pathname === '/file' && this._serveFile(request, response, url.search))
      return;
    if (url.pathname === '/snapshot/' && this._serveSnapshotRoot(request, response))
      return;
    if (url.pathname === '/service-worker.js' && this._serveServiceWorker(request, response))
      return;
    if (url.pathname === '/tracemodel' && this._serveTraceModel(request, response))
      return;

    response.statusCode = 404;
    response.end();
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
          let current = document.createElement('iframe');
          document.body.appendChild(current);
          let next = document.createElement('iframe');
          document.body.appendChild(next);
          next.style.visibility = 'hidden';

          let showPromise = Promise.resolve();
          let nextUrl;
          window.showSnapshot = url => {
            if (!nextUrl) {
              showPromise = showPromise.then(async () => {
                const url = nextUrl;
                nextUrl = undefined;
                const loaded = new Promise(f => next.onload = f);
                next.src = url;
                await loaded;
                let temp = current;
                current = next;
                next = temp;
                current.style.visibility = 'visible';
                next.style.visibility = 'hidden';
              });
            }
            nextUrl = url;
          };
        </script>
      </body>
    `);
    return true;
  }

  private _serveServiceWorker(request: http.IncomingMessage, response: http.ServerResponse): boolean {
    function serviceWorkerMain(self: any /* ServiceWorkerGlobalScope */, urlPrefix: string) {
      let traceModel: TraceModel;

      function preprocessModel() {
        for (const contextEntry of traceModel.contexts) {
          contextEntry.resourcesByUrl = new Map();
          const appendResource = (event: trace.NetworkResourceTraceEvent) => {
            let responseEvents = contextEntry.resourcesByUrl.get(event.url);
            if (!responseEvents) {
              responseEvents = [];
              contextEntry.resourcesByUrl.set(event.url, responseEvents);
            }
            responseEvents.push(event);
          };
          for (const pageEntry of contextEntry.pages) {
            for (const action of pageEntry.actions)
              action.resources.forEach(appendResource);
            pageEntry.resources.forEach(appendResource);
          }
        }
      }

      self.addEventListener('install', function(event: any) {
        event.waitUntil(fetch('./tracemodel').then(async response => {
          traceModel = await response.json();
          preprocessModel();
        }));
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
        // snapshot/pageId/<pageId>/snapshotId/<snapshotId>/<frameId>
        // snapshot/pageId/<pageId>/timestamp/<timestamp>/<frameId>
        if (parts.length !== 6 || parts[0] !== 'snapshot' || parts[1] !== 'pageId' || (parts[3] !== 'snapshotId' && parts[3] !== 'timestamp'))
          throw new Error(`Unexpected url "${urlString}"`);
        return {
          pageId: parts[2],
          frameId: parts[5] === 'main' ? '' : parts[5],
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
        for (const prefix of ['/traceviewer/', '/sha1/', '/resources/', '/file?']) {
          if (event.request.url.startsWith(urlPrefix + prefix))
            return fetch(event.request);
        }
        for (const exact of ['/tracemodel', '/service-worker.js', '/snapshot/']) {
          if (event.request.url === urlPrefix + exact)
            return fetch(event.request);
        }

        const request = event.request;
        let parsed;
        if (request.mode === 'navigate') {
          parsed = parseUrl(request.url);
        } else {
          const client = (await self.clients.get(event.clientId))!;
          parsed = parseUrl(client.url);
        }

        let contextEntry;
        let pageEntry;
        for (const c of traceModel.contexts) {
          for (const p of c.pages) {
            if (p.created.pageId === parsed.pageId) {
              contextEntry = c;
              pageEntry = p;
            }
          }
        }
        if (!contextEntry || !pageEntry)
          return request.mode === 'navigate' ? respondNotAvailable() : respond404();

        const lastSnapshotEvent = new Map<string, trace.FrameSnapshotTraceEvent>();
        for (const [frameId, snapshots] of Object.entries(pageEntry.snapshotsByFrameId)) {
          for (const snapshot of snapshots) {
            const current = lastSnapshotEvent.get(frameId);
            // Prefer snapshot with exact id.
            const exactMatch = parsed.snapshotId && snapshot.snapshotId === parsed.snapshotId;
            const currentExactMatch = current && parsed.snapshotId && current.snapshotId === parsed.snapshotId;
            // If not available, prefer the latest snapshot before the timestamp.
            const timestampMatch = parsed.timestamp && snapshot.timestamp <= parsed.timestamp;
            if (exactMatch || (timestampMatch && !currentExactMatch))
              lastSnapshotEvent.set(frameId, snapshot);
          }
        }

        const snapshotEvent = lastSnapshotEvent.get(parsed.frameId);
        if (!snapshotEvent)
          return request.mode === 'navigate' ? respondNotAvailable() : respond404();

        if (request.mode === 'navigate')
          return new Response(snapshotEvent.snapshot.html, { status: 200, headers: { 'Content-Type': 'text/html' } });

        let resource: trace.NetworkResourceTraceEvent | null = null;
        const resourcesWithUrl = contextEntry.resourcesByUrl.get(removeHash(request.url)) || [];
        for (const resourceEvent of resourcesWithUrl) {
          if (resource && resourceEvent.frameId !== parsed.frameId)
            continue;
          resource = resourceEvent;
          if (resourceEvent.frameId === parsed.frameId)
            break;
        }
        if (!resource)
          return respond404();
        const resourceOverride = snapshotEvent.snapshot.resourceOverrides.find(o => o.url === request.url);
        const overrideSha1 = resourceOverride ? resourceOverride.sha1 : undefined;
        if (overrideSha1)
          return fetch(`/resources/${resource.resourceId}/override/${overrideSha1}`);
        return fetch(`/resources/${resource.resourceId}`);
      }

      self.addEventListener('fetch', function(event: any) {
        event.respondWith(doFetch(event));
      });
    }

    response.statusCode = 200;
    response.setHeader('Cache-Control', 'public, max-age=31536000');
    response.setHeader('Content-Type', 'application/javascript');
    response.end(`(${serviceWorkerMain.toString()})(self, '${this._urlPrefix()}')`);
    return true;
  }

  private _serveTraceModel(request: http.IncomingMessage, response: http.ServerResponse): boolean {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(this._traceModel));
    return true;
  }

  private _serveResource(request: http.IncomingMessage, response: http.ServerResponse, pathname: string): boolean {
    if (!this._resourcesDir)
      return false;

    const parts = pathname.split('/');
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

    const resource = this._resourceById.get(resourceId);
    if (!resource)
      return false;
    const sha1 = overrideSha1 || resource.responseSha1;
    try {
      // console.log(`reading ${sha1} as ${resource.contentType}...`);
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
      response.end(content);
      // console.log(`done`);
      return true;
    } catch (e) {
      return false;
    }
  }

  private _serveSha1(request: http.IncomingMessage, response: http.ServerResponse, pathname: string): boolean {
    if (!this._resourcesDir)
      return false;
    const parts = pathname.split('/');
    if (!parts[0])
      parts.shift();
    if (!parts[parts.length - 1])
      parts.pop();
    if (parts.length !== 2 || parts[0] !== 'sha1')
      return false;
    const sha1 = parts[1];
    return this._serveStaticFile(response, path.join(this._resourcesDir, sha1));
  }

  private _serveFile(request: http.IncomingMessage, response: http.ServerResponse, search: string): boolean {
    if (search[0] !== '?')
      return false;
    return this._serveStaticFile(response, search.substring(1));
  }

  private _serveTraceViewer(request: http.IncomingMessage, response: http.ServerResponse, pathname: string): boolean {
    const relativePath = pathname.substring('/traceviewer/'.length);
    const absolutePath = path.join(this._traceViewerDir, ...relativePath.split('/'));
    return this._serveStaticFile(response, absolutePath, { 'Service-Worker-Allowed': '/' });
  }

  private _serveStaticFile(response: http.ServerResponse, absoluteFilePath: string, headers?: { [name: string]: string }): boolean {
    try {
      const content = fs.readFileSync(absoluteFilePath);
      response.statusCode = 200;
      const contentType = extensionToMime[path.extname(absoluteFilePath).substring(1)] || 'application/octet-stream';
      response.setHeader('Content-Type', contentType);
      response.setHeader('Content-Length', content.byteLength);
      for (const [name, value] of Object.entries(headers || {}))
        response.setHeader(name, value);
      response.end(content);
      return true;
    } catch (e) {
      return false;
    }
  }
}

const extensionToMime: { [key: string]: string } = {
  'css': 'text/css',
  'html': 'text/html',
  'jpeg': 'image/jpeg',
  'jpg': 'image/jpeg',
  'js': 'application/javascript',
  'png': 'image/png',
  'ttf': 'font/ttf',
  'svg': 'image/svg+xml',
  'webp': 'image/webp',
  'woff': 'font/woff',
  'woff2': 'font/woff2',
};
