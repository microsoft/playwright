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
import type { TraceModel, trace, ContextEntry } from './traceModel';
import { TraceServer } from './traceServer';
import { NodeSnapshot } from '../../trace/traceTypes';

export class SnapshotServer {
  private _resourcesDir: string | undefined;
  private _server: TraceServer;
  private _resourceById: Map<string, trace.NetworkResourceTraceEvent>;

  constructor(server: TraceServer, traceModel: TraceModel, resourcesDir: string | undefined) {
    this._resourcesDir = resourcesDir;
    this._server = server;

    this._resourceById = new Map();
    for (const contextEntry of traceModel.contexts) {
      for (const pageEntry of contextEntry.pages) {
        for (const action of pageEntry.actions)
          action.resources.forEach(r => this._resourceById.set(r.resourceId, r));
        pageEntry.resources.forEach(r => this._resourceById.set(r.resourceId, r));
      }
    }

    server.routePath('/snapshot/', this._serveSnapshotRoot.bind(this), true);
    server.routePath('/snapshot/service-worker.js', this._serveServiceWorker.bind(this));
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
      let traceModel: TraceModel;

      type ContextData = {
        resourcesByUrl: Map<string, trace.NetworkResourceTraceEvent[]>,
        overridenUrls: Set<string>
      };
      const contextToData = new Map<ContextEntry, ContextData>();

      function preprocessModel() {
        for (const contextEntry of traceModel.contexts) {
          const contextData: ContextData = {
            resourcesByUrl: new Map(),
            overridenUrls: new Set(),
          };
          const appendResource = (event: trace.NetworkResourceTraceEvent) => {
            let responseEvents = contextData.resourcesByUrl.get(event.url);
            if (!responseEvents) {
              responseEvents = [];
              contextData.resourcesByUrl.set(event.url, responseEvents);
            }
            responseEvents.push(event);
          };
          for (const pageEntry of contextEntry.pages) {
            for (const action of pageEntry.actions)
              action.resources.forEach(appendResource);
            pageEntry.resources.forEach(appendResource);
            for (const snapshots of Object.values(pageEntry.snapshotsByFrameId)) {
              for (const snapshot of snapshots) {
                for (const { url } of snapshot.snapshot.resourceOverrides)
                  contextData.overridenUrls.add(url);
              }
            }
          }
          contextToData.set(contextEntry, contextData);
        }
      }

      self.addEventListener('install', function(event: any) {
        event.waitUntil(fetch('/tracemodel').then(async response => {
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
        // - /snapshot/pageId/<pageId>/snapshotId/<snapshotId>/<frameId>
        // - /snapshot/pageId/<pageId>/timestamp/<timestamp>/<frameId>
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

      const autoClosing = new Set(['AREA', 'BASE', 'BR', 'COL', 'COMMAND', 'EMBED', 'HR', 'IMG', 'INPUT', 'KEYGEN', 'LINK', 'MENUITEM', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR']);
      const escaped = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' };
      function escapeAttribute(s: string): string {
        return s.replace(/[&<>"']/ug, char => (escaped as any)[char]);
      }
      function escapeText(s: string): string {
        return s.replace(/[&<]/ug, char => (escaped as any)[char]);
      }

      function snapshotNodes(snapshot: trace.FrameSnapshot): NodeSnapshot[] {
        if (!(snapshot as any)._nodes) {
          const nodes: NodeSnapshot[] = [];
          const visit = (n: trace.NodeSnapshot) => {
            if (typeof n === 'string') {
              nodes.push(n);
            } else if (typeof n[0] === 'string') {
              for (let i = 2; i < n.length; i++)
                visit(n[i]);
              nodes.push(n);
            }
          };
          visit(snapshot.html);
          (snapshot as any)._nodes = nodes;
        }
        return (snapshot as any)._nodes;
      }

      function serializeSnapshot(snapshots: trace.FrameSnapshotTraceEvent[], initialSnapshotIndex: number): string {
        const visit = (n: trace.NodeSnapshot, snapshotIndex: number): string => {
          // Text node.
          if (typeof n === 'string')
            return escapeText(n);

          if (!(n as any)._string) {
            if (Array.isArray(n[0])) {
              // Node reference.
              const referenceIndex = snapshotIndex - n[0][0];
              if (referenceIndex >= 0 && referenceIndex < snapshotIndex) {
                const nodes = snapshotNodes(snapshots[referenceIndex].snapshot);
                const nodeIndex = n[0][1];
                if (nodeIndex >= 0 && nodeIndex < nodes.length)
                  (n as any)._string = visit(nodes[nodeIndex], referenceIndex);
              }
            } else if (typeof n[0] === 'string') {
              // Element node.
              const builder: string[] = [];
              builder.push('<', n[0]);
              for (const [attr, value] of Object.entries(n[1] || {}))
                builder.push(' ', attr, '="', escapeAttribute(value), '"');
              builder.push('>');
              for (let i = 2; i < n.length; i++)
                builder.push(visit(n[i], snapshotIndex));
              if (!autoClosing.has(n[0]))
                builder.push('</', n[0], '>');
              (n as any)._string = builder.join('');
            } else {
              // Why are we here? Let's not throw, just in case.
              (n as any)._string = '';
            }
          }
          return (n as any)._string;
        };

        const snapshot = snapshots[initialSnapshotIndex].snapshot;
        let html = visit(snapshot.html, initialSnapshotIndex);
        if (snapshot.doctype)
          html = `<!DOCTYPE ${snapshot.doctype}>` + html;
        return html;
      }

      function findResourceOverride(snapshots: trace.FrameSnapshotTraceEvent[], snapshotIndex: number, url: string): string | undefined {
        while (true) {
          const snapshot = snapshots[snapshotIndex].snapshot;
          const override = snapshot.resourceOverrides.find(o => o.url === url);
          if (!override)
            return;
          if (override.sha1 !== undefined)
            return override.sha1;
          if (override.ref === undefined)
            return;
          const referenceIndex = snapshotIndex - override.ref!;
          if (referenceIndex < 0 || referenceIndex >= snapshotIndex)
            return;
          snapshotIndex = referenceIndex;
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
        const contextData = contextToData.get(contextEntry)!;

        const frameSnapshots = pageEntry.snapshotsByFrameId[parsed.frameId] || [];
        let snapshotIndex = -1;
        for (let index = 0; index < frameSnapshots.length; index++) {
          const current = snapshotIndex === -1 ? undefined : frameSnapshots[snapshotIndex];
          const snapshot = frameSnapshots[index];
          // Prefer snapshot with exact id.
          const exactMatch = parsed.snapshotId && snapshot.snapshotId === parsed.snapshotId;
          const currentExactMatch = current && parsed.snapshotId && current.snapshotId === parsed.snapshotId;
          // If not available, prefer the latest snapshot before the timestamp.
          const timestampMatch = parsed.timestamp && snapshot.timestamp <= parsed.timestamp;
          if (exactMatch || (timestampMatch && !currentExactMatch))
            snapshotIndex = index;
        }
        const snapshotEvent = snapshotIndex === -1 ? undefined : frameSnapshots[snapshotIndex];
        if (!snapshotEvent)
          return request.mode === 'navigate' ? respondNotAvailable() : respond404();

        if (request.mode === 'navigate') {
          let html = serializeSnapshot(frameSnapshots, snapshotIndex);
          html += `<script>${contextEntry.created.snapshotScript}</script>`;
          const response = new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
          return response;
        }

        let resource: trace.NetworkResourceTraceEvent | null = null;
        const urlWithoutHash = removeHash(request.url);
        const resourcesWithUrl = contextData.resourcesByUrl.get(urlWithoutHash) || [];
        for (const resourceEvent of resourcesWithUrl) {
          if (resource && resourceEvent.frameId !== parsed.frameId)
            continue;
          resource = resourceEvent;
          if (resourceEvent.frameId === parsed.frameId)
            break;
        }
        if (!resource)
          return respond404();

        const overrideSha1 = findResourceOverride(frameSnapshots, snapshotIndex, urlWithoutHash);
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
        if (contextData.overridenUrls.has(urlWithoutHash)) {
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

    const resource = this._resourceById.get(resourceId);
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
