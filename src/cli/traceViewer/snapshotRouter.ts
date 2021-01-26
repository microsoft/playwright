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
import type { Frame, Route } from '../../..';
import { parsedURL } from '../../client/clientHelper';
import { ContextEntry, PageEntry, trace } from './traceModel';

const fsReadFileAsync = util.promisify(fs.readFile.bind(fs));

export class SnapshotRouter {
  private _contextEntry: ContextEntry | undefined;
  private _unknownUrls = new Set<string>();
  private _resourcesDir: string;
  private _snapshotFrameIdToSnapshot = new Map<string, trace.FrameSnapshot>();
  private _pageUrl = '';
  private _frameToSnapshotFrameId = new Map<Frame, string>();

  constructor(resourcesDir: string) {
    this._resourcesDir = resourcesDir;
  }

  // Returns the url to navigate to.
  async selectSnapshot(contextEntry: ContextEntry, pageEntry: PageEntry, snapshotId?: string, timestamp?: number): Promise<string> {
    this._contextEntry = contextEntry;
    if (!snapshotId && !timestamp)
      return 'data:text/html,Snapshot is not available';

    const lastSnapshotEvent = new Map<string, trace.FrameSnapshotTraceEvent>();
    for (const [frameId, snapshots] of pageEntry.snapshotsByFrameId) {
      for (const snapshot of snapshots) {
        const current = lastSnapshotEvent.get(frameId);
        // Prefer snapshot with exact id.
        const exactMatch = snapshotId && snapshot.snapshotId === snapshotId;
        const currentExactMatch = current && snapshotId && current.snapshotId === snapshotId;
        // If not available, prefer the latest snapshot before the timestamp.
        const timestampMatch = timestamp && snapshot.timestamp <= timestamp;
        if (exactMatch || (timestampMatch && !currentExactMatch))
          lastSnapshotEvent.set(frameId, snapshot);
      }
    }

    this._snapshotFrameIdToSnapshot.clear();
    for (const [frameId, event] of lastSnapshotEvent) {
      const buffer = await this._readSha1(event.sha1);
      if (!buffer)
        continue;
      try {
        const snapshot = JSON.parse(buffer.toString('utf8')) as trace.FrameSnapshot;
        // Request url could come lower case, so we always normalize to lower case.
        this._snapshotFrameIdToSnapshot.set(frameId.toLowerCase(), snapshot);
      } catch (e) {
      }
    }

    const mainFrameSnapshot = lastSnapshotEvent.get('');
    if (!mainFrameSnapshot)
      return 'data:text/html,Snapshot is not available';

    if (!mainFrameSnapshot.frameUrl.startsWith('http'))
      this._pageUrl = 'http://playwright.snapshot/';
    else
      this._pageUrl = mainFrameSnapshot.frameUrl;
    return this._pageUrl;
  }

  async route(route: Route) {
    const url = route.request().url();
    const frame = route.request().frame();

    if (route.request().isNavigationRequest()) {
      let snapshotFrameId: string | undefined;
      if (url === this._pageUrl) {
        snapshotFrameId = '';
      } else {
        snapshotFrameId = url.substring(url.indexOf('://') + 3);
        if (snapshotFrameId.endsWith('/'))
          snapshotFrameId = snapshotFrameId.substring(0, snapshotFrameId.length - 1);
        // Request url could come lower case, so we always normalize to lower case.
        snapshotFrameId = snapshotFrameId.toLowerCase();
      }

      const snapshot = this._snapshotFrameIdToSnapshot.get(snapshotFrameId);
      if (!snapshot) {
        route.fulfill({
          contentType: 'text/html',
          body: 'data:text/html,Snapshot is not available',
        });
        return;
      }

      this._frameToSnapshotFrameId.set(frame, snapshotFrameId);
      route.fulfill({
        contentType: 'text/html',
        body: snapshot.html,
      });
      return;
    }

    const snapshotFrameId = this._frameToSnapshotFrameId.get(frame);
    if (snapshotFrameId === undefined)
      return this._routeUnknown(route);
    const snapshot = this._snapshotFrameIdToSnapshot.get(snapshotFrameId);
    if (!snapshot)
      return this._routeUnknown(route);

    // Find a matching resource from the same context, preferrably from the same frame.
    // Note: resources are stored without hash, but page may reference them with hash.
    let resource: trace.NetworkResourceTraceEvent | null = null;
    const resourcesWithUrl = this._contextEntry!.resourcesByUrl.get(removeHash(url)) || [];
    for (const resourceEvent of resourcesWithUrl) {
      if (resource && resourceEvent.frameId !== snapshotFrameId)
        continue;
      resource = resourceEvent;
      if (resourceEvent.frameId === snapshotFrameId)
        break;
    }
    if (!resource)
      return this._routeUnknown(route);

    // This particular frame might have a resource content override, for example when
    // stylesheet is modified using CSSOM.
    const resourceOverride = snapshot.resourceOverrides.find(o => o.url === url);
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

  private async _readSha1(sha1: string) {
    try {
      return await fsReadFileAsync(path.join(this._resourcesDir, sha1));
    } catch (e) {
      return undefined;
    }
  }

  private async _readResource(event: trace.NetworkResourceTraceEvent, overrideSha1: string | undefined) {
    const body = await this._readSha1(overrideSha1 || event.responseSha1);
    if (!body)
      return;
    return {
      contentType: event.contentType,
      body,
      headers: event.responseHeaders,
    };
  }
}

function removeHash(url: string) {
  const u = parsedURL(url);
  if (!u)
    return url;
  u.hash = '';
  return u.toString();
}
