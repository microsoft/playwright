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

import path from 'path';
import fs from 'fs';
import stream from 'stream';
import yauzl from '../externalDeps/yauzl';

export interface VirtualFileSystem {
  entries(): Promise<string[]>;
  read(entry: string): Promise<Buffer>;
  readStream(entryPath: string): Promise<stream.Readable>;
  close(): void;
}

abstract class BaseFileSystem {

  abstract readStream(entryPath: string): Promise<stream.Readable>;

  async read(entryPath: string): Promise<Buffer> {
    const readStream = await this.readStream(entryPath);
    const buffers: Buffer[] = [];
    return new Promise(f => {
      readStream.on('data', d => buffers.push(d));
      readStream.on('end', () => f(Buffer.concat(buffers)));
    });
  }

  close() {
  }
}

export class RealFileSystem extends BaseFileSystem implements VirtualFileSystem {
  private _folder: string;

  constructor(folder: string) {
    super();
    this._folder = folder;
  }

  async entries(): Promise<string[]> {
    const result: string[] = [];
    const visit = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        const fqn = path.join(dir, name);
        if (fs.statSync(fqn).isDirectory())
          visit(fqn);
        if (fs.statSync(fqn).isFile())
          result.push(fqn);
      }
    };
    visit(this._folder);
    return result;
  }

  async readStream(entry: string): Promise<stream.Readable> {
    return fs.createReadStream(path.join(this._folder, ...entry.split('/')));
  }
}

export class ZipFileSystem extends BaseFileSystem implements VirtualFileSystem {
  private _fileName: string;
  private _zipFile: yauzl.ZipFile | undefined;
  private _entries = new Map<string, yauzl.Entry>();
  private _openedPromise: Promise<void>;

  constructor(fileName: string) {
    super();
    this._fileName = fileName;
    this._openedPromise = this.open();
  }

  async open() {
    await new Promise<yauzl.ZipFile>((fulfill, reject) => {
      yauzl.open(this._fileName, { autoClose: false }, (e, z) => {
        if (e) {
          reject(e);
          return;
        }
        this._zipFile = z;
        this._zipFile!.on('entry', (entry: yauzl.Entry) => {
          this._entries.set(entry.fileName, entry);
        });
        this._zipFile!.on('end', fulfill);
      });
    });
  }

  async entries(): Promise<string[]> {
    await this._openedPromise;
    return [...this._entries.keys()];
  }

  async readStream(entryPath: string): Promise<stream.Readable> {
    await this._openedPromise;
    const entry = this._entries.get(entryPath)!;
    return new Promise((f, r) => {
      this._zipFile!.openReadStream(entry, (error, readStream) => {
        if (error || !readStream) {
          r(error || 'Entry not found');
          return;
        }
        f(readStream);
      });
    });
  }

  override close() {
    this._zipFile?.close();
  }
}
