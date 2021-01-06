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

import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import type { Route } from '../../..';
import type { FrameSnapshot, NetworkResourceTraceEvent, PageSnapshot } from '../../trace/traceTypes';
import { ContextEntry } from './traceModel';

const fsReadFileAsync = util.promisify(fs.readFile.bind(fs));

export class SnapshotRouter {
  private _contextEntry: ContextEntry | undefined;
  private _unknownUrls = new Set<string>();
  private _traceStorageDir: string;
  private _frameBySrc = new Map<string, FrameSnapshot>();

  constructor(traceStorageDir: string) {
    this._traceStorageDir = traceStorageDir;
  }

  selectSnapshot(snapshot: PageSnapshot, contextEntry: ContextEntry) {
    this._frameBySrc.clear();
    this._contextEntry = contextEntry;
    for (const frameSnapshot of snapshot.frames)
      this._frameBySrc.set(frameSnapshot.url, frameSnapshot);
  }

  async route(route: Route) {
    const url = route.request().url();
    if (this._frameBySrc.has(url)) {
      const frameSnapshot = this._frameBySrc.get(url)!;
      route.fulfill({
        contentType: 'text/html',
        body: Buffer.from(frameSnapshot.html),
      });
      return;
    }

    const frameSrc = route.request().frame().url();
    const frameSnapshot = this._frameBySrc.get(frameSrc);
    if (!frameSnapshot)
      return this._routeUnknown(route);

    // Find a matching resource from the same context, preferrably from the same frame.
    // Note: resources are stored without hash, but page may reference them with hash.
    let resource: NetworkResourceTraceEvent | null = null;
    const resourcesWithUrl = this._contextEntry!.resourcesByUrl.get(removeHash(url)) || [];
    for (const resourceEvent of resourcesWithUrl) {
      if (resource && resourceEvent.frameId !== frameSnapshot.frameId)
        continue;
      resource = resourceEvent;
      if (resourceEvent.frameId === frameSnapshot.frameId)
        break;
    }
    if (!resource)
      return this._routeUnknown(route);

    // This particular frame might have a resource content override, for example when
    // stylesheet is modified using CSSOM.
    const resourceOverride = frameSnapshot.resourceOverrides.find(o => o.url === url);
    const overrideSha1 = resourceOverride ? resourceOverride.sha1 : undefined;
    const resourceData = await this._readResource(resource, overrideSha1);
    if (!resourceData)
      return this._routeUnknown(route);
    const headers: { [key: string]: string } = {};
    for (const { name, value } of resourceData.headers)
      headers[name] = value;
    headers['Access-Control-Allow-Origin'] = '*';
    route.fulfill({
      contentType: resourceData.contentType,
      body: resourceData.body,
      headers,
    });
  }

  private _routeUnknown(route: Route) {
    const url = route.request().url();
    if (!this._unknownUrls.has(url)) {
      console.log(`Request to unknown url: ${url}`);  /* eslint-disable-line no-console */
      this._unknownUrls.add(url);
    }
    route.abort();
  }

  private async _readResource(event: NetworkResourceTraceEvent, overrideSha1: string | undefined) {
    try {
      const body = await fsReadFileAsync(path.join(this._traceStorageDir, overrideSha1 || event.sha1));
      return {
        contentType: event.contentType,
        body,
        headers: event.responseHeaders,
      };
    } catch (e) {
      return undefined;
    }
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
