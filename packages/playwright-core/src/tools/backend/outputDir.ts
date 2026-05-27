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

import debug from 'debug';

const fileDebug = debug('pw:mcp:file');

type Entry = {
  path: string;
  size: number;
  addedAt: number;
  evictable: boolean;
};

export class OutputDir {
  readonly path: string;
  private readonly _maxSize: number | undefined;
  private readonly _files = new Map<string, OutputFile>();
  private readonly _entries = new Map<string, Entry>();
  private _totalSize = 0;
  private _seq = 0;

  constructor(absolutePath: string, maxSize: number | undefined) {
    this.path = absolutePath;
    this._maxSize = maxSize && maxSize > 0 ? maxSize : undefined;
  }

  resolve(pathInOrAbsolute: string, opts?: { evictable?: boolean }): OutputFile {
    const absolute = path.isAbsolute(pathInOrAbsolute)
      ? path.resolve(pathInOrAbsolute)
      : path.resolve(this.path, pathInOrAbsolute);
    const existing = this._files.get(absolute);
    if (existing)
      return existing;
    const evictable = opts?.evictable ?? true;
    const file = new OutputFile(this, absolute, evictable);
    this._files.set(absolute, file);
    return file;
  }

  get hasCap(): boolean {
    return this._maxSize !== undefined;
  }

  // Frees evictable entries until `additionalBytes` (the net increase to
  // totalSize implied by an upcoming upsert/append) fits within the cap.
  // `excludePath` is the file about to be written and must not be evicted.
  _evictForBytes(additionalBytes: number, excludePath: string | undefined): void {
    if (this._maxSize === undefined)
      return;
    while (this._totalSize + additionalBytes > this._maxSize) {
      const oldest = this._oldestEvictable(excludePath);
      if (!oldest)
        return;
      this._removeEntry(oldest);
      void fs.promises.unlink(oldest.path).catch(() => {});
    }
  }

  private _oldestEvictable(excludePath: string | undefined): Entry | undefined {
    let oldest: Entry | undefined;
    for (const entry of this._entries.values()) {
      if (!entry.evictable)
        continue;
      if (excludePath && entry.path === excludePath)
        continue;
      if (!oldest || entry.addedAt < oldest.addedAt)
        oldest = entry;
    }
    return oldest;
  }

  private _removeEntry(entry: Entry) {
    if (this._entries.delete(entry.path))
      this._totalSize -= entry.size;
  }

  _upsert(absPath: string, size: number, evictable: boolean): void {
    if (this._maxSize === undefined)
      return;
    const existing = this._entries.get(absPath);
    if (existing) {
      this._totalSize -= existing.size;
      existing.size = size;
      existing.addedAt = ++this._seq;
      this._totalSize += size;
      return;
    }
    this._entries.set(absPath, {
      path: absPath,
      size,
      addedAt: ++this._seq,
      evictable,
    });
    this._totalSize += size;
  }

  _addToEntry(absPath: string, delta: number, evictable: boolean): void {
    if (this._maxSize === undefined)
      return;
    const existing = this._entries.get(absPath);
    if (existing) {
      existing.size += delta;
      this._totalSize += delta;
      return;
    }
    this._entries.set(absPath, {
      path: absPath,
      size: delta,
      addedAt: ++this._seq,
      evictable,
    });
    this._totalSize += delta;
  }

  _entrySize(absPath: string): number | undefined {
    return this._entries.get(absPath)?.size;
  }

  // For tests/diagnostics.
  totalTrackedSize(): number {
    return this._totalSize;
  }
}

export class OutputFile {
  readonly path: string;
  readonly evictable: boolean;
  private readonly _dir: OutputDir;

  constructor(dir: OutputDir, absolutePath: string, evictable: boolean) {
    this._dir = dir;
    this.path = absolutePath;
    this.evictable = evictable;
  }

  async write(data: Buffer | string): Promise<void> {
    const size = Buffer.byteLength(data);
    const additional = size - (this._dir._entrySize(this.path) ?? 0);
    this._dir._evictForBytes(additional, this.path);
    await fs.promises.mkdir(path.dirname(this.path), { recursive: true });
    await fs.promises.writeFile(this.path, data);
    fileDebug(this.path);
    this._dir._upsert(this.path, size, this.evictable);
  }

  async append(data: Buffer | string): Promise<void> {
    const delta = Buffer.byteLength(data);
    this._dir._evictForBytes(delta, this.path);
    await fs.promises.mkdir(path.dirname(this.path), { recursive: true });
    await fs.promises.appendFile(this.path, data);
    fileDebug(this.path);
    this._dir._addToEntry(this.path, delta, this.evictable);
  }

  async trackSize(size?: number): Promise<void> {
    if (!this._dir.hasCap)
      return;
    let resolvedSize = size;
    if (resolvedSize === undefined) {
      try {
        const stat = await fs.promises.stat(this.path);
        resolvedSize = stat.size;
      } catch {
        resolvedSize = 0;
      }
    }
    const additional = resolvedSize - (this._dir._entrySize(this.path) ?? 0);
    this._dir._evictForBytes(additional, this.path);
    this._dir._upsert(this.path, resolvedSize, this.evictable);
  }
}
