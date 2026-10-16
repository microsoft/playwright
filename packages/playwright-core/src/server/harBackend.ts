/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import path from 'path';

import { createGuid } from '@utils/crypto';
import { isPathInside } from '@utils/fileUtils';
import { ZipFile } from '@utils/zipFile';

import type { HeadersArray } from '@isomorphic/types';
import type * as har from '@isomorphic/trace/versions/har';

const redirectStatus = [301, 302, 303, 307, 308];

type HarReplayOrder = 'any' | 'recorded';

type RankedEntry = { entry: har.Entry, matchingHeaders: number, conflictingHeaders: number };

export class HarBackend {
  readonly id: string;
  private _harFile: har.HARFile;
  private _zipFile: ZipFile | null;
  private _baseDir: string | null;
  private _replayOrder: HarReplayOrder;
  private _served = new Set<har.Entry>();
  private _pendingLookup: Promise<unknown> = Promise.resolve();

  constructor(harFile: har.HARFile, baseDir: string | null, zipFile: ZipFile | null, replayOrder: HarReplayOrder = 'any') {
    this.id = createGuid();
    this._harFile = harFile;
    this._baseDir = baseDir;
    this._zipFile = zipFile;
    this._replayOrder = replayOrder;
  }

  async lookup(url: string, method: string, headers: HeadersArray, postData: Buffer | undefined, isNavigationRequest: boolean): Promise<{
    action: 'error' | 'redirect' | 'fulfill' | 'noentry',
    message?: string,
    redirectURL?: string,
    status?: number,
    headers?: HeadersArray,
    body?: Buffer
  }> {
    let found;
    try {
      const find = () => this._harFindResponse(url, method, headers, postData, isNavigationRequest);
      // Two lookups in flight at once could take the same copy, so recorded order resolves them one at a time.
      found = this._replayOrder === 'recorded' ? await this._serialized(find) : await find();
    } catch (e) {
      return { action: 'error', message: 'HAR error: ' + e.message };
    }

    if (!found)
      return { action: 'noentry' };

    const { entry, restartsNavigation } = found;
    // If navigation is being redirected, restart it with the final url to ensure the document's url changes.
    if (restartsNavigation)
      return { action: 'redirect', redirectURL: entry.request.url };

    const response = entry.response;
    try {
      // A copy whose content fails to load stays served, so the next request still gets the next copy.
      const buffer = await this._loadContent(response.content);
      return {
        action: 'fulfill',
        status: response.status,
        headers: response.headers,
        body: buffer,
      };
    } catch (e) {
      return { action: 'error', message: e.message };
    }
  }

  private async _loadContent(content: { text?: string, encoding?: string, _file?: string }): Promise<Buffer> {
    const file = content._file;
    let buffer: Buffer;
    if (file) {
      if (this._zipFile) {
        buffer = await this._zipFile.read(file);
      } else {
        const resolved = path.resolve(this._baseDir!, file);
        if (!isPathInside(this._baseDir!, resolved))
          throw new Error(`HAR entry _file escapes base directory: ${file}`);
        buffer = await fs.promises.readFile(resolved);
      }
    } else {
      buffer = Buffer.from(content.text || '', content.encoding === 'base64' ? 'base64' : 'utf-8');
    }
    return buffer;
  }

  private _serialized<T>(task: () => Promise<T>): Promise<T> {
    const result = this._pendingLookup.then(task);
    this._pendingLookup = result.catch(() => {});
    return result;
  }

  private _markServed(entries: har.Entry[]) {
    for (const entry of entries)
      this._served.add(entry);
  }

  private async _harFindResponse(url: string, method: string, headers: HeadersArray, postData: Buffer | undefined, isNavigationRequest: boolean): Promise<{ entry: har.Entry, restartsNavigation: boolean } | undefined> {
    const harLog = this._harFile.log;
    const requestURL = url;
    const visited = new Set<har.Entry>();
    const redirects: har.Entry[] = [];
    while (true) {
      const entries: har.Entry[] = [];
      for (const candidate of harLog.entries) {
        if (candidate.request.url !== url || candidate.request.method !== method)
          continue;
        if (method === 'POST' && postData && candidate.request.postData) {
          const buffer = await this._loadContent(candidate.request.postData);
          if (!buffer.equals(postData)) {
            const boundary = multipartBoundary(headers);
            if (!boundary)
              continue;
            const candidataBoundary = multipartBoundary(candidate.request.headers);
            if (!candidataBoundary)
              continue;
            // Try to match multipart/form-data ignoring boundary as it changes between requests.
            if (postData.toString().replaceAll(boundary, '') !== buffer.toString().replaceAll(candidataBoundary, ''))
              continue;
          }
        }
        entries.push(candidate);
      }

      if (!entries.length)
        return;

      const entry = this._pickEntry(entries, headers, visited);

      if (visited.has(entry))
        throw new Error(`Found redirect cycle for ${url}`);

      visited.add(entry);

      // Follow redirects.
      const locationHeader = entry.response.headers.find(h => h.name.toLowerCase() === 'location');
      if (redirectStatus.includes(entry.response.status) && locationHeader) {
        redirects.push(entry);
        const locationURL = new URL(locationHeader.value, url);
        url = locationURL.toString();
        if ((entry.response.status === 301 || entry.response.status === 302) && method === 'POST' ||
          entry.response.status === 303 && !['GET', 'HEAD'].includes(method)) {
          // HTTP-redirect fetch step 13 (https://fetch.spec.whatwg.org/#http-redirect-fetch)
          method = 'GET';
        }
        continue;
      }

      // The restarted navigation looks the final url up again, so its entry is served then, not now.
      const restartsNavigation = isNavigationRequest && entry.request.url !== requestURL;
      this._markServed(restartsNavigation ? redirects : [...redirects, entry]);
      return { entry, restartsNavigation };
    }
  }

  private _pickEntry(entries: har.Entry[], headers: HeadersArray, visited: Set<har.Entry>): har.Entry {
    // A redirect chain moves on to a copy it has not followed yet; only when none is left is it a cycle.
    const unvisited = entries.filter(entry => !visited.has(entry));
    const candidates = unvisited.length ? unvisited : entries;
    if (candidates.length === 1)
      return candidates[0];
    const ranked: RankedEntry[] = candidates.map(entry => ({
      entry,
      matchingHeaders: countMatchingHeaders(entry.request.headers, headers),
      conflictingHeaders: countConflictingHeaders(entry.request.headers, headers),
    }));
    // Disambiguate using headers - the one with most matching headers wins.
    if (this._replayOrder !== 'recorded')
      return ranked.sort((a, b) => b.matchingHeaders - a.matchingHeaders)[0].entry;
    // In recorded order a copy whose header carries another value than the request belongs to a different
    // request, so it loses even to a served copy. Only such conflicts count: counting matches prefers a copy
    // for recording more headers (Firefox, behind a redirect), and counting absent headers penalizes a
    // cookie or referer the replay does not send.
    const fewestConflicts = Math.min(...ranked.map(r => r.conflictingHeaders));
    const best = ranked.filter(r => r.conflictingHeaders === fewestConflicts);
    const unserved = best.filter(r => !this._served.has(r.entry));
    if (unserved.length)
      return unserved[0].entry;
    // Every copy has been served: the last recorded one reflects the final server state.
    return best[best.length - 1].entry;
  }

  dispose() {
    this._zipFile?.close();
  }
}

function countMatchingHeaders(harHeaders: har.Header[], headers: HeadersArray): number {
  const set = new Set(headers.map(h => h.name.toLowerCase() + ':' + h.value));
  let matches = 0;
  for (const h of harHeaders) {
    if (set.has(h.name.toLowerCase() + ':' + h.value))
      ++matches;
  }
  return matches;
}

function countConflictingHeaders(harHeaders: har.Header[], headers: HeadersArray): number {
  const names = new Set(headers.map(h => h.name.toLowerCase()));
  const values = new Set(headers.map(h => h.name.toLowerCase() + ':' + h.value));
  let conflicts = 0;
  for (const h of harHeaders) {
    const name = h.name.toLowerCase();
    if (names.has(name) && !values.has(name + ':' + h.value))
      ++conflicts;
  }
  return conflicts;
}

function multipartBoundary(headers: HeadersArray) {
  const contentType = headers.find(h => h.name.toLowerCase() === 'content-type');
  if (!contentType?.value.includes('multipart/form-data'))
    return undefined;
  const boundary = contentType.value.match(/boundary=(\S+)/);
  if (boundary)
    return boundary[1];
  return undefined;
}
