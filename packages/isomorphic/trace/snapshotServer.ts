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
import type { ActionPhase, ResourceSnapshot } from './trace';

export class SnapshotServer {
  private _snapshotStorage: SnapshotStorage;
  private _resourceLoader: (file: string) => Promise<Blob | undefined>;
  private _snapshotIds = new Map<string, SnapshotRenderer>();

  constructor(snapshotStorage: SnapshotStorage, resourceLoader: (file: string) => Promise<Blob | undefined>) {
    this._snapshotStorage = snapshotStorage;
    this._resourceLoader = resourceLoader;
  }

  serveSnapshot(callId: string, searchParams: URLSearchParams, snapshotUrl: string): Response {
    const snapshot = this._snapshot(callId, searchParams);
    if (!snapshot)
      return new Response(null, { status: 404 });

    const renderedSnapshot = snapshot.render();
    this._snapshotIds.set(snapshotUrl, snapshot);
    return new Response(renderedSnapshot.html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  async serveClosestScreenshot(callId: string, searchParams: URLSearchParams): Promise<Response> {
    const snapshot = this._snapshot(callId, searchParams);
    const file = snapshot?.closestScreenshot();
    if (!file)
      return new Response(null, { status: 404 });
    return new Response(await this._resourceLoader(file));
  }

  serveSnapshotInfo(callId: string, searchParams: URLSearchParams): Response {
    const snapshot = this._snapshot(callId, searchParams);
    return this._respondWithJson(snapshot ? {
      viewport: snapshot.viewport(),
      url: snapshot.snapshot().frameUrl,
      timestamp: snapshot.snapshot().timestamp,
      wallTime: snapshot.snapshot().wallTime,
    } : {
      error: 'No snapshot found'
    });
  }

  private _snapshot(callId: string, params: URLSearchParams) {
    return this._snapshotStorage.snapshotForCall(callId, params.get('phase') as ActionPhase, params.get('frameId') || undefined);
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

    const file = resource.response.content._file;
    const content = file ? await this._resourceLoader(file) || new Blob([]) : new Blob([]);

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
    if (this._snapshotStorage.hasResourceOverride(resource.request.url))
      headers.set('Cache-Control', 'no-store, no-cache, max-age=0');
    else
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

function removeHash(url: string) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch (e) {
    return url;
  }
}
