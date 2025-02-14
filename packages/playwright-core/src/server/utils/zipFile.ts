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

import { yauzl } from '../../zipBundle';

import type { Entry, UnzipFile } from '../../zipBundle';

export class ZipFile {
  private _fileName: string;
  private _zipFile: UnzipFile | undefined;
  private _entries = new Map<string, Entry>();
  private _openedPromise: Promise<void>;

  constructor(fileName: string) {
    this._fileName = fileName;
    this._openedPromise = this._open();
  }

  private async _open() {
    await new Promise<UnzipFile>((fulfill, reject) => {
      yauzl.open(this._fileName, { autoClose: false }, (e, z) => {
        if (e) {
          reject(e);
          return;
        }
        this._zipFile = z;
        this._zipFile!.on('entry', (entry: Entry) => {
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

  async read(entryPath: string): Promise<Buffer> {
    await this._openedPromise;
    const entry = this._entries.get(entryPath)!;
    if (!entry)
      throw new Error(`${entryPath} not found in file ${this._fileName}`);

    return new Promise((resolve, reject) => {
      this._zipFile!.openReadStream(entry, (error, readStream) => {
        if (error || !readStream) {
          reject(error || 'Entry not found');
          return;
        }

        const buffers: Buffer[] = [];
        readStream.on('data', data => buffers.push(data));
        readStream.on('end', () => resolve(Buffer.concat(buffers)));
      });
    });
  }

  close() {
    this._zipFile?.close();
  }
}
