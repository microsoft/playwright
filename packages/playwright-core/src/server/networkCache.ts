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

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { urlMatches } from '@isomorphic/urlMatch';

import { ProgressController } from './progress';

import type { Request, Route, RouteHandler } from './network';
import type { NameValue } from '@isomorphic/types';
import type { URLMatch } from '@isomorphic/urlMatch';

const CACHE_VERSION = 1;
const INLINE_THRESHOLD = 8 * 1024;
const FETCH_TIMEOUT = 30000;
const SKIP_HEADERS = new Set(['content-encoding', 'content-length', 'transfer-encoding']);

type CacheHeader = [string, string];   // [name, value]

// On-disk record. Keys are terse to keep the append-only index compact:
// method is omitted (always GET) and the body is inlined via c/f.
type CacheRecord = {
  k: string;                       // lookup key: sha1('GET\n' + url)
  u: string;                       // url, stored verbatim so the index stays greppable
  s: number;                       // status
  st: string;                      // statusText
  hh: CacheHeader[];               // headers
  ts: number;                      // record time, epoch seconds
  c?: string;                      // inline body content (base64), or...
  f?: string;                      // ...content-addressed blob file (sha1)
};

export class NetworkCache {
  private _dir: string;
  private _blobsDir: string;
  private _indexFile: string;
  private _metaFile: string;
  private _urlMatch: URLMatch | undefined;
  private _baseURL: string | undefined;
  private _index: Map<string, CacheRecord> = new Map();
  private _indexPromise: Promise<void> | undefined;
  private _writeChain: Promise<void> = Promise.resolve();
  private _writtenKeys = new Set<string>();
  private _metaWritten = false;
  private _tmpCounter = 0;

  constructor(dir: string, urlMatch: URLMatch | undefined, baseURL: string | undefined) {
    this._dir = path.resolve(dir);
    this._blobsDir = path.join(this._dir, 'blobs');
    this._indexFile = path.join(this._dir, 'index.ndjson');
    this._metaFile = path.join(this._dir, 'meta.json');
    this._urlMatch = urlMatch;
    this._baseURL = baseURL;
  }

  handler(): RouteHandler {
    return (route, request) => void this._handle(route, request).catch(() => {});
  }

  private async _handle(route: Route, request: Request) {
    const url = request.url();
    if (request.method() !== 'GET' || !url.startsWith('http') || !urlMatches(this._baseURL, url, this._urlMatch)) {
      await route.continue({ isFallback: true });
      return;
    }

    const key = keyHash('GET', url);
    const record = await this._lookup(key);
    if (record) {
      try {
        const body = await this._readBody(record);
        const headers = record.hh.map(([name, value]) => ({ name, value }));
        await route.fulfill({ status: record.s, headers, body: body.toString('base64'), isBase64: true });
        return;
      } catch {
      }
    }

    const fetchRequest = request._context.fetchRequest;
    let response;
    try {
      const controller = new ProgressController();
      response = await controller.run(progress => fetchRequest.fetch(progress, {
        url,
        method: 'GET',
        headers: request.headers(),
        timeout: 0,
        discardResponseBody: true,
      }), FETCH_TIMEOUT);
    } catch {
      await route.continue({ isFallback: true }).catch(() => {});
      return;
    }

    const body = response.body || Buffer.from('');
    const headers = cleanHeaders(response.headers);
    if (response.status >= 200 && response.status <= 299)
      await this._store(key, url, response.status, response.statusText, headers, body);
    await route.fulfill({ status: response.status, headers, body: body.toString('base64'), isBase64: true });
  }

  private _lookup(key: string): Promise<CacheRecord | undefined> {
    if (!this._indexPromise)
      this._indexPromise = this._loadIndex();
    return this._indexPromise.then(() => this._index.get(key));
  }

  private async _loadIndex() {
    let content: string;
    try {
      content = await fs.promises.readFile(this._indexFile, 'utf8');
    } catch {
      return; // No cache on disk yet.
    }
    for (const line of content.split('\n')) {
      if (!line.trim())
        continue;
      try {
        const record = JSON.parse(line) as CacheRecord;
        this._index.set(record.k, record);
      } catch {
      }
    }
  }

  private async _readBody(record: CacheRecord): Promise<Buffer> {
    if (record.c !== undefined)
      return Buffer.from(record.c, 'base64');
    return await fs.promises.readFile(this._blobPath(record.f!));
  }

  private async _store(key: string, url: string, status: number, statusText: string, headers: NameValue[], body: Buffer) {
    if (this._writtenKeys.has(key))
      return;
    this._writtenKeys.add(key);

    const record: CacheRecord = {
      k: key,
      u: url,
      s: status,
      st: statusText,
      hh: headers.map(({ name, value }): CacheHeader => [name, value]),
      ts: Math.floor(Date.now() / 1000),
    };
    if (body.length >= INLINE_THRESHOLD) {
      const hash = contentHash(body);
      await this._writeBlob(hash, body);
      record.f = hash;
    } else {
      record.c = body.toString('base64');
    }
    this._index.set(key, record);
    await this._appendIndex(record);
  }

  private _blobPath(hash: string): string {
    return path.join(this._blobsDir, hash.slice(0, 2), hash);
  }

  private async _writeBlob(hash: string, body: Buffer) {
    const dest = this._blobPath(hash);
    if (await exists(dest))
      return;
    const dir = path.dirname(dest);
    await fs.promises.mkdir(dir, { recursive: true });
    const tmp = `${dest}.tmp-${crypto.randomBytes(8).toString('hex')}-${this._tmpCounter++}`;
    await fs.promises.writeFile(tmp, body);
    try {
      await fs.promises.rename(tmp, dest);
    } catch {
      await fs.promises.rm(tmp, { force: true }).catch(() => {});
    }
  }

  private _appendIndex(record: CacheRecord): Promise<void> {
    const line = JSON.stringify(record) + '\n';
    const run = async () => {
      await fs.promises.mkdir(this._dir, { recursive: true });
      await this._ensureMeta();
      await fs.promises.appendFile(this._indexFile, line);
    };
    const result = this._writeChain.then(run, run);
    this._writeChain = result.catch(() => {});
    return result;
  }

  private async _ensureMeta() {
    if (this._metaWritten)
      return;
    this._metaWritten = true;
    if (await exists(this._metaFile))
      return;
    await fs.promises.writeFile(this._metaFile, JSON.stringify({ version: CACHE_VERSION }, null, 2));
  }
}

function keyHash(method: string, url: string): string {
  return crypto.createHash('sha1').update(`${method}\n${url}`).digest('hex');
}

function contentHash(body: Buffer): string {
  return crypto.createHash('sha1').update(body).digest('hex');
}

function cleanHeaders(headers: NameValue[]): NameValue[] {
  return headers.filter(({ name }) => !SKIP_HEADERS.has(name.toLowerCase()));
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.promises.access(file);
    return true;
  } catch {
    return false;
  }
}
