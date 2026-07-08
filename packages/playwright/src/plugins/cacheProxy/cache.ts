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

import { calculateSha1, createGuid } from '@utils/crypto';
import { existsAsync } from '@utils/fileUtils';

import { computeVaryFields, varyMatches } from './cacheSemantics';

import type { ProxyHeaders } from './cacheSemantics';

const CACHE_VERSION = 1;
const INLINE_THRESHOLD = 8 * 1024;

export type CachedResponse = {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: Buffer;
};

type CacheRecord = {
  k: string;                       // key: sha1(method + '\n' + url)
  u: string;                       // url, verbatim so the index stays greppable
  s: number;                       // status
  st: string;                      // statusText
  hh: [string, string][];          // headers, verbatim (incl. content-encoding)
  ts: number;                      // record time, epoch seconds
  v?: [string, string][];          // Vary fields: request header values this variant is keyed on
  c?: string;                      // inline body (base64), or...
  f?: string;                      // ...content-addressed blob (sha1)
};

export class ResponseCache {
  private _dir: string;
  private _blobsDir: string;
  private _indexFile: string;
  private _metaFile: string;
  private _index = new Map<string, CacheRecord[]>();
  private _writeChain: Promise<void> = Promise.resolve();
  private _initialized = false;

  constructor(dir: string) {
    this._dir = path.resolve(dir);
    this._blobsDir = path.join(this._dir, 'blobs');
    this._indexFile = path.join(this._dir, 'index.jsonl');
    this._metaFile = path.join(this._dir, 'meta.json');
  }

  async load() {
    let content: string;
    try {
      content = await fs.promises.readFile(this._indexFile, 'utf8');
    } catch {
      return; // No cache yet.
    }
    // Discard an incompatible cache instead of mis-parsing it.
    if (await this._onDiskVersion() !== CACHE_VERSION) {
      await fs.promises.rm(this._indexFile, { force: true }).catch(() => {});
      await fs.promises.rm(this._blobsDir, { recursive: true, force: true }).catch(() => {});
      return;
    }
    for (const line of content.split('\n')) {
      if (!line.trim())
        continue;
      try {
        const record = JSON.parse(line) as CacheRecord;
        this._variants(record.k).push(record);
      } catch {
        // Ignore a malformed line rather than failing the whole cache.
      }
    }
  }

  static key(method: string, url: string, identity: string = ''): string {
    return calculateSha1(`${method}\n${url}\n${identity}`);
  }

  async get(key: string, requestHeaders: ProxyHeaders): Promise<CachedResponse | undefined> {
    const record = this._index.get(key)?.find(candidate => varyMatches(candidate.v, requestHeaders));
    if (!record)
      return undefined;
    try {
      const body = record.c !== undefined ? Buffer.from(record.c, 'base64') : await fs.promises.readFile(this._blobPath(record.f!));
      return { status: record.s, statusText: record.st, headers: record.hh, body };
    } catch {
      return undefined; // Corrupt/missing blob - treat as a miss.
    }
  }

  async set(key: string, url: string, requestHeaders: ProxyHeaders, response: CachedResponse) {
    const vary = computeVaryFields(response.headers, requestHeaders);
    const variants = this._variants(key);
    if (variants.some(existing => sameVary(existing.v, vary)))
      return;
    const record: CacheRecord = {
      k: key,
      u: url,
      s: response.status,
      st: response.statusText,
      hh: response.headers,
      ts: Math.floor(Date.now() / 1000),
    };
    if (vary)
      record.v = vary;
    if (response.body.length >= INLINE_THRESHOLD) {
      const hash = calculateSha1(response.body);
      await this._writeBlob(hash, response.body);
      record.f = hash;
    } else {
      record.c = response.body.toString('base64');
    }
    variants.push(record);
    await this._append(record);
  }

  async flush() {
    await this._writeChain;
  }

  private _variants(key: string): CacheRecord[] {
    let variants = this._index.get(key);
    if (!variants) {
      variants = [];
      this._index.set(key, variants);
    }
    return variants;
  }

  private _blobPath(hash: string): string {
    return path.join(this._blobsDir, hash.slice(0, 2), hash);
  }

  private async _writeBlob(hash: string, body: Buffer) {
    const dest = this._blobPath(hash);
    if (await existsAsync(dest))
      return;
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    const tmp = `${dest}.tmp-${createGuid()}`;
    await fs.promises.writeFile(tmp, body);
    try {
      await fs.promises.rename(tmp, dest);
    } catch {
      await fs.promises.rm(tmp, { force: true }).catch(() => {});
    }
  }

  private _append(record: CacheRecord): Promise<void> {
    const line = JSON.stringify(record) + '\n';
    const run = async () => {
      if (!this._initialized) {
        await fs.promises.mkdir(this._dir, { recursive: true });
        await fs.promises.writeFile(this._metaFile, JSON.stringify({ version: CACHE_VERSION }, null, 2), { flag: 'w' });
        this._initialized = true;
      }
      await fs.promises.appendFile(this._indexFile, line);
    };
    const result = this._writeChain.then(run, run);
    this._writeChain = result.catch(() => {});
    return result;
  }

  private async _onDiskVersion(): Promise<number | undefined> {
    try {
      const meta = JSON.parse(await fs.promises.readFile(this._metaFile, 'utf8'));
      return typeof meta.version === 'number' ? meta.version : undefined;
    } catch {
      return undefined;
    }
  }
}

function sameVary(a: [string, string][] | undefined, b: [string, string][] | undefined): boolean {
  if (!a || !b)
    return !a && !b;
  return a.length === b.length && a.every(([name, value], i) => b[i][0] === name && b[i][1] === value);
}
