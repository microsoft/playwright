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
import { Writable } from 'stream';
import path from 'path';

function parseHeader(buffer: Buffer) {
  if (buffer.length < 512)
    return null;

  let name = buffer.toString('utf8', 0, 100).replace(/\0/g, '');
  const prefixField = buffer.toString('utf8', 345, 500).replace(/\0/g, '');
  if (prefixField)
    name = path.join(prefixField, name);


  const size = parseInt(buffer.toString('utf8', 124, 136).trim(), 8);
  const typeFlag = buffer[156];
  const mode = parseInt(buffer.toString('utf8', 100, 108).trim(), 8);
  const linkname = buffer.toString('utf8', 157, 257).replace(/\0/g, '');

  // Parse user and group IDs
  const uid = parseInt(buffer.toString('utf8', 108, 116).trim(), 8);
  const gid = parseInt(buffer.toString('utf8', 116, 124).trim(), 8);

  let type = 'file';
  if (typeFlag === 53) // ASCII '5'
    type = 'directory';
  else if (typeFlag === 50) // ASCII '2'
    type = 'symlink';
  else if (typeFlag === 0 || typeFlag === 48) // ASCII '0'
    type = 'file';

  return {
    name: name.replace(/^\/+/, ''),
    size,
    type,
    mode: mode || 0o644,
    linkname,
    uid,
    gid
  };
}

type TarHeader = NonNullable<ReturnType<typeof parseHeader>>;

export class TarExtractor extends Writable {
  private buffer = Buffer.alloc(0);
  private currentHeader: TarHeader | null = null;
  private remainingBytes = 0;
  private currentFileStream: fs.WriteStream | null = null;

  constructor(private outputPath: (path: string) => string) {
    super();
  }

  async mkdir(dir: string) {
    try {
      await fs.promises.mkdir(dir, { recursive: true });
      // Set proper permissions for directories
      await fs.promises.chmod(dir, 0o755);
    } catch (err) {
      if (err.code !== 'EEXIST')
        throw err;
    }
  }

  async processHeader(header: TarHeader) {
    const fullPath = this.outputPath(header.name);
    await this.mkdir(path.dirname(fullPath));

    if (header.type === 'directory') {
      await this.mkdir(fullPath);
      return null;
    }

    if (header.type === 'symlink') {
      await this.createSymlink(fullPath, header.linkname);
      return null;
    }

    // TODO: track chmod maybe

    return fs.createWriteStream(fullPath, { mode: header.mode });
  }

  async createSymlink(symlinkPath: string, targetPath: string) {
    try {
      await fs.promises.unlink(symlinkPath);
    } catch (err) {
      if (err.code !== 'ENOENT')
        throw err;
    }

    await fs.promises.symlink(targetPath, symlinkPath);
  }

  override async _write(chunk: Buffer, _encoding: string, callback: (err?: Error) => void) {
    try {
      this.buffer = Buffer.concat([this.buffer, chunk]);

      while (this.buffer.length >= 512) {
        if (!this.currentHeader) {
          // Check for end of archive (two consecutive zero blocks)
          if (this.buffer.subarray(0, 512).every(byte => byte === 0)) {
            this.buffer = this.buffer.subarray(512);
            continue;
          }

          const header = parseHeader(this.buffer);
          if (!header)
            break;

          this.currentHeader = header;
          this.remainingBytes = header.size;
          this.buffer = this.buffer.subarray(512);

          if (header.size > 0)
            this.currentFileStream = await this.processHeader(header);
          else
            await this.processHeader(header); // For symlinks and directories

          continue;
        }

        const blockSize = Math.min(this.remainingBytes, this.buffer.length);
        if (blockSize === 0) {
          this.currentHeader = null;
          this.currentFileStream = null;
          continue;
        }

        const dataChunk = this.buffer.subarray(0, blockSize);
        this.buffer = this.buffer.subarray(blockSize);
        this.remainingBytes -= blockSize;

        if (this.currentFileStream)
          await new Promise<void>((resolve, reject) => this.currentFileStream!.write(dataChunk, err => err ? reject(err) : resolve()));

        // Handle padding
        if (this.remainingBytes === 0) {
          const padding = 512 - (this.currentHeader.size % 512);
          if (padding < 512)
            this.buffer = this.buffer.subarray(padding);

          this.currentHeader = null;
          if (this.currentFileStream) {
            await new Promise(resolve => this.currentFileStream!.end(resolve));
            this.currentFileStream = null;
          }
        }
      }
      callback();
    } catch (err) {
      callback(err);
    }
  }
}
