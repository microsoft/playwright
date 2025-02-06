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

import type { URLSearchParams } from 'url';
import type { SnapshotRenderer } from './snapshotRenderer';
import type { SnapshotStorage } from './snapshotStorage';
import type { ResourceSnapshot } from '@trace/snapshot';

type Point = { x: number, y: number };

export class SnapshotServer {
  private _snapshotStorage: SnapshotStorage;
  private _resourceLoader: (sha1: string) => Promise<Blob | undefined>;
  private _snapshotIds = new Map<string, SnapshotRenderer>();

  constructor(snapshotStorage: SnapshotStorage, resourceLoader: (sha1: string) => Promise<Blob | undefined>) {
    this._snapshotStorage = snapshotStorage;
    this._resourceLoader = resourceLoader;
  }

  serveSnapshot(pageOrFrameId: string, searchParams: URLSearchParams, snapshotUrl: string): Response {
    const snapshot = this._snapshot(pageOrFrameId, searchParams);
    if (!snapshot)
      return new Response(null, { status: 404 });

    const renderedSnapshot = snapshot.render();
    this._snapshotIds.set(snapshotUrl, snapshot);
    return new Response(renderedSnapshot.html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  async serveClosestScreenshot(pageOrFrameId: string, searchParams: URLSearchParams): Promise<Response> {
    const snapshot = this._snapshot(pageOrFrameId, searchParams);
    const sha1 = snapshot?.closestScreenshot();
    if (!sha1)
      return new Response(null, { status: 404 });
    return new Response(await this._resourceLoader(sha1));
  }

  serveSnapshotInfo(pageOrFrameId: string, searchParams: URLSearchParams): Response {
    const snapshot = this._snapshot(pageOrFrameId, searchParams);
    return this._respondWithJson(snapshot ? {
      viewport: snapshot.viewport(),
      url: snapshot.snapshot().frameUrl,
      timestamp: snapshot.snapshot().timestamp,
      wallTime: snapshot.snapshot().wallTime,
    } : {
      error: 'No snapshot found'
    });
  }

  private _snapshot(pageOrFrameId: string, params: URLSearchParams) {
    const name = params.get('name')!;
    return this._snapshotStorage.snapshotByName(pageOrFrameId, name);
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

  async serveResource(requestUrlAlternatives: string[], method: string, snapshotUrl: string): Promise<Response> {
    let resource: ResourceSnapshot | undefined;
    const snapshot = this._snapshotIds.get(snapshotUrl)!;
    for (const requestUrl of requestUrlAlternatives) {
      resource = snapshot?.resourceByUrl(removeHash(requestUrl), method);
      if (resource)
        break;
    }
    if (!resource)
      return new Response(null, { status: 404 });

    const sha1 = resource.response.content._sha1;
    const content = sha1 ? await this._resourceLoader(sha1) || new Blob([]) : new Blob([]);

    let contentType = resource.response.content.mimeType;
    const isTextEncoding = /^text\/|^application\/(javascript|json)/.test(contentType);
    if (isTextEncoding && !contentType.includes('charset'))
      contentType = `${contentType}; charset=utf-8`;

    const headers = new Headers();
    // "x-unknown" in the har means "no content type".
    if (contentType !== 'x-unknown')
      headers.set('Content-Type', contentType);
    for (const { name, value } of resource.response.headers)
      headers.set(name, value);
    headers.delete('Content-Encoding');
    headers.delete('Access-Control-Allow-Origin');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.delete('Content-Length');
    headers.set('Content-Length', String(content.size));
    headers.set('Cache-Control', 'public, max-age=31536000');
    const { status } = resource.response;
    const isNullBodyStatus = status === 101 || status === 204 || status === 205 || status === 304;
    return new Response(isNullBodyStatus ? null : content, {
      headers,
      status: resource.response.status,
      statusText: resource.response.statusText,
    });
  }
}

declare global {
  interface Window {
    showSnapshot: (url: string, point?: Point) => Promise<void>;
  }
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
