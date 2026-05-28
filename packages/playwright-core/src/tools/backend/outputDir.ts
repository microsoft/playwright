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
import { isPathInside } from '@utils/index';

const fileDebug = debug('pw:mcp:file');

// Not safe against concurrent writes to the same path or against another
// writer's file being evicted mid-flight. Current callers serialize their
// writes (SessionLog queues, LogFile is single-writer, screenshots/downloads
// use unique paths), so this is acceptable for now.
export class OutputDir {
  readonly path: string;
  readonly maxSize: number;
  // Insertion order encodes age: oldest first, newest last.
  readonly _files = new Map<string, OutputFile>();

  constructor(path: string, maxSize: number | undefined) {
    this.path = path;
    this.maxSize = maxSize ?? 0;
    if (this.maxSize < 0)
      throw new Error(`outputMaxSize must be non-negative, got ${this.maxSize}`);
  }

  async resolve(p: string, opts?: { evictable?: boolean }): Promise<OutputFile> {
    const absolute = path.resolve(this.path, p);
    let file = this._files.get(absolute);
    if (!file) {
      file = new OutputFile(this, absolute, opts?.evictable ?? isPathInside(this.path, absolute));
      this._files.set(absolute, file);
      fileDebug('resolve %s', absolute);
    }
    await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
    return file;
  }

  _evict(budget: number, keep: OutputFile): void {
    if (this.maxSize === 0)
      return;
    let total = 0;
    for (const file of this._files.values())
      total += file.size;
    if (total <= budget)
      return;
    for (const file of this._files.values()) {
      if (file === keep || !file.evictable || file.size === 0)
        continue;
      total -= file.size;
      fileDebug('evict %s (%d bytes)', file.path, file.size);
      file._unlink();
      if (total <= budget)
        return;
    }
  }

}

export class OutputFile {
  readonly path: string;
  readonly evictable: boolean;
  size = 0;
  private readonly _dir: OutputDir;

  constructor(dir: OutputDir, absolutePath: string, evictable: boolean) {
    this._dir = dir;
    this.path = absolutePath;
    this.evictable = evictable;
  }

  async write(data: Buffer | string): Promise<void> {
    const nextSize = Buffer.byteLength(data);
    if (nextSize > this.size)
      this._dir._evict(this._dir.maxSize - nextSize + this.size, this);
    await fs.promises.writeFile(this.path, data);
    fileDebug('write %s (%d bytes)', this.path, nextSize);
    this.size = nextSize;
    this._touch();
  }

  async append(data: Buffer | string): Promise<void> {
    const delta = Buffer.byteLength(data);
    this._dir._evict(this._dir.maxSize - delta, this);
    await fs.promises.appendFile(this.path, data);
    fileDebug('append %s (+%d bytes, total %d)', this.path, delta, this.size + delta);
    this.size += delta;
    this._touch();
  }

  async trackSize(size?: number): Promise<void> {
    if (this._dir.maxSize === 0)
      return;
    let nextSize = size;
    if (nextSize === undefined) {
      try {
        nextSize = (await fs.promises.stat(this.path)).size;
      } catch {
        nextSize = 0;
      }
    }
    if (nextSize > this.size)
      this._dir._evict(this._dir.maxSize - nextSize + this.size, this);
    this.size = nextSize;
    this._touch();
  }

  _unlink(): void {
    this._dir._files.delete(this.path);
    void fs.promises.rm(this.path, { recursive: true, force: true }).catch(error => fileDebug('unlink failed %s: %s', this.path, error));
  }

  // Re-insert at the tail so this file becomes the "newest" for LRU/FIFO eviction.
  private _touch(): void {
    this._dir._files.delete(this.path);
    this._dir._files.set(this.path, this);
  }
}
