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
import { Writable, once } from 'stream';
import assert from 'assert';

enum TarType {
  REGTYPE,
  LNKTYPE,
  SYMTYPE,
  CHRTYPE,
  BLKTYPE,
  DIRTYPE,
  FIFOTYPE,
  CONTTYPE
}

class TarEntry {
  name: string;
  size: number;
  type: TarType;
  mode: number;
  linkname: string;
  uid: number;
  gid: number;

  fileStream: fs.WriteStream | null = null;
  remainingBytes = 0;

  constructor(header: Buffer) {
    if (header.length < 512)
      throw new Error('Invalid header: ' + header.toString('utf8'));

    this.name = header.toString('utf8', 0, 100).replace(/\0/g, '').replace(/^\/+/, '');

    this.size = parseInt(header.toString('ascii', 124, 136).trim(), 8);
    this.type = parseInt(header.toString('ascii', 156, 157), 10) as TarType;
    this.mode = parseInt(header.toString('ascii', 100, 108).trim(), 8) || 0o644;
    this.linkname = header.toString('utf8', 157, 257).replace(/\0/g, '');

    this.uid = parseInt(header.toString('ascii', 108, 116).trim(), 8);
    this.gid = parseInt(header.toString('ascii', 116, 124).trim(), 8);
  }

  async writeToDisk(outputPath: (path: string) => string) {
    const fullPath = outputPath(this.name);
    switch (this.type) {
      case TarType.DIRTYPE:
        await fs.promises.mkdir(fullPath, { recursive: true, mode: 0o755 });
        break;
      case TarType.SYMTYPE:
        await fs.promises.symlink(this.linkname, fullPath);
        break;
      case TarType.REGTYPE:
        this.fileStream = fs.createWriteStream(fullPath, { mode: this.mode });
        await once(this.fileStream, 'ready');
        this.remainingBytes = this.size;
        break;
      default:
        throw new Error(`Unsupported type ${this.type} for '${this.name}'`);
    }
  }

  chunk(chunk: Buffer) {
    assert(this.fileStream);
    this.fileStream.write(chunk);
    this.remainingBytes -= chunk.length;
    if (this.remainingBytes === 0) {
      this.fileStream.end();
      return true;
    }
    return false;
  }
}


export class TarExtractor extends Writable {
  private queue = Promise.resolve();
  private buffer = Buffer.alloc(0);
  private currentEntry: TarEntry | null = null;

  constructor(private outputPath: (path: string) => string) {
    super();
  }

  override async _write(chunk: Buffer, _encoding: string, callback: (err?: Error) => void) {
    this.queue = this.queue.then(() => this._writeImpl(chunk)).then(callback).catch(callback);
  }

  private async _writeImpl(chunk: Buffer): Promise<undefined> {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 512) {
      if (!this.currentEntry) {
        // two consecutive zero blocks mark end of archive, skip them
        if (this.buffer.subarray(0, 512).every(byte => byte === 0)) {
          this.buffer = this.buffer.subarray(512);
          continue;
        }

        const entry = new TarEntry(this.buffer);
        this.buffer = this.buffer.subarray(512);
        await entry.writeToDisk(this.outputPath);
        if (entry.type === TarType.REGTYPE)
          this.currentEntry = entry;
      } else if (this.currentEntry.remainingBytes > 0) {
        const chunk = this.buffer.subarray(0, this.currentEntry.remainingBytes);
        this.buffer = this.buffer.subarray(chunk.length);
        const finished = this.currentEntry.chunk(chunk);
        if (finished) {
          const padding = 512 - (this.currentEntry.size % 512);
          if (padding < 512)
            this.buffer = this.buffer.subarray(padding);
          this.currentEntry = null;
        }
      }
    }
  }
}
