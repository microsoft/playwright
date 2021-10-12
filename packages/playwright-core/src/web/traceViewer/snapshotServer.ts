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

import type { ResourceSnapshot } from '../../server/trace/common/snapshotTypes';
import { SnapshotStorage } from './snapshotStorage';
import type { Point } from '../../common/types';
import { URLSearchParams } from 'url';
import { SnapshotRenderer } from './snapshotRenderer';

const kBlobUrlPrefix = 'http://playwright.bloburl/#';

export class SnapshotServer {
  private _snapshotStorage: SnapshotStorage;
  private _snapshotIds = new Map<string, SnapshotRenderer>();

  constructor(snapshotStorage: SnapshotStorage) {
    this._snapshotStorage = snapshotStorage;
  }

  static serveSnapshotRoot(): Response {
    return new Response(`
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
    `, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=31536000',
        'Content-Type': 'text/html'
      }
    });
  }

  serveSnapshot(pathname: string, searchParams: URLSearchParams, snapshotUrl: string): Response {
    const snapshot = this._snapshot(pathname.substring('/snapshot'.length), searchParams);
    if (!snapshot)
      return new Response(null, { status: 404 });
    const renderedSnapshot = snapshot.render();
    this._snapshotIds.set(snapshotUrl, snapshot);
    return new Response(renderedSnapshot.html, { status: 200, headers: { 'Content-Type': 'text/html' } });
  }

  serveSnapshotSize(pathname: string, searchParams: URLSearchParams): Response {
    const snapshot = this._snapshot(pathname.substring('/snapshotSize'.length), searchParams);
    return this._respondWithJson(snapshot ? snapshot.viewport() : {});
  }

  private _snapshot(pathname: string, params: URLSearchParams) {
    const name = params.get('name')!;
    return this._snapshotStorage.snapshotByName(pathname.slice(1), name);
  }

  private _respondWithJson(object: any): Response {
    return new Response(JSON.stringify(object), {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=31536000',
        'Content-Type': 'application/json'
      }
    });
  }

  async serveResource(requestUrl: string, snapshotUrl: string): Promise<Response> {
    const snapshot = this._snapshotIds.get(snapshotUrl)!;
    const url = requestUrl.startsWith(kBlobUrlPrefix) ? requestUrl.substring(kBlobUrlPrefix.length) : removeHash(requestUrl);
    const resource = snapshot?.resourceByUrl(url);
    if (!resource)
      return new Response(null, { status: 404 });

    const sha1 = resource.response.content._sha1;
    if (!sha1)
      return new Response(null, { status: 404 });
    return this._innerServeResource(sha1, resource);
  }

  private async _innerServeResource(sha1: string, resource: ResourceSnapshot): Promise<Response> {
    const content = await this._snapshotStorage.resourceContent(sha1);
    if (!content)
      return new Response(null, { status: 404 });

    let contentType = resource.response.content.mimeType;
    const isTextEncoding = /^text\/|^application\/(javascript|json)/.test(contentType);
    if (isTextEncoding && !contentType.includes('charset'))
      contentType = `${contentType}; charset=utf-8`;

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    for (const { name, value } of resource.response.headers)
      headers.set(name, value);
    headers.delete('Content-Encoding');
    headers.delete('Access-Control-Allow-Origin');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.delete('Content-Length');
    headers.set('Content-Length', String(content.size));
    headers.set('Cache-Control', 'public, max-age=31536000');
    return new Response(content, { headers });
  }
}

declare global {
  interface Window {
    showSnapshot: (url: string, point?: Point) => Promise<void>;
  }
}

function rootScript() {
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

function removeHash(url: string) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch (e) {
    return url;
  }
}
