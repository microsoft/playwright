/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import fs from 'fs';
import path from 'path';

import { createGuid } from 'playwright-core/lib/utils';

type StorageEnties = Record<string, { timestamp: number, value: any }>;

export class Storage {
  private static _storages = new Map<string, Storage>();
  private static _workerFiles = new Map<string, {
    storageFile: string;
    lastModified: number;
  }>();

  private _fileName: string;
  private _entriesPromise: Promise<StorageEnties> | undefined;
  private _writeChain: Promise<void> = Promise.resolve();

  static async clone(storageFile: string, artifactsDir: string): Promise<string> {
    const workerFile = await this._storage(storageFile)._clone(artifactsDir);
    const stat = await fs.promises.stat(workerFile);
    const lastModified = stat.mtime.getTime();
    Storage._workerFiles.set(workerFile, { storageFile, lastModified });
    return workerFile;
  }

  static async upstream(workerFile: string) {
    const entry = Storage._workerFiles.get(workerFile);
    if (!entry)
      return;
    const { storageFile, lastModified } = entry;
    const stat = await fs.promises.stat(workerFile);
    const newLastModified = stat.mtime.getTime();
    if (lastModified !== newLastModified)
      await this._storage(storageFile)._upstream(workerFile);
    Storage._workerFiles.delete(workerFile);
  }

  private static _storage(fileName: string) {
    if (!Storage._storages.has(fileName))
      Storage._storages.set(fileName, new Storage(fileName));
    return Storage._storages.get(fileName)!;
  }

  private constructor(fileName: string) {
    this._fileName = fileName;
  }

  async _clone(artifactsDir: string): Promise<string> {
    const entries = await this._load();
    const workerFile = path.join(artifactsDir, `pw-storage-${createGuid()}.json`);
    await fs.promises.writeFile(workerFile, JSON.stringify(entries, null, 2)).catch(() => {});
    return workerFile;
  }

  async _upstream(workerFile: string) {
    const entries = await this._load();
    const newEntries = await fs.promises.readFile(workerFile, 'utf8').then(JSON.parse).catch(() => ({})) as StorageEnties;
    for (const [key, newValue] of Object.entries(newEntries)) {
      const existing = entries[key];
      if (!existing || existing.timestamp < newValue.timestamp)
        entries[key] = newValue;
    }
    await this._writeFile(entries);
  }

  private async _load(): Promise<StorageEnties> {
    if (!this._entriesPromise)
      this._entriesPromise = fs.promises.readFile(this._fileName, 'utf8').then(JSON.parse).catch(() => ({}));
    return this._entriesPromise;
  }

  private _writeFile(entries: Record<string, any>) {
    this._writeChain = this._writeChain.then(() => fs.promises.writeFile(this._fileName, JSON.stringify(entries, null, 2))).catch(() => {});
    return this._writeChain;
  }

  async flush() {
    await this._writeChain;
  }
}
