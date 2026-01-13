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

type StorageEnties = Record<string, unknown>;

export class Storage {
  private static _storages = new Map<string, Storage>();
  private static _serializeQueue: Promise<any> = Promise.resolve();

  private _fileName: string;
  private _lastSnapshotFileName: string | undefined;
  private _entriesPromise: Promise<StorageEnties> | undefined;

  static clone(storageFile: string, outputDir: string): Promise<string> {
    return Storage._withStorage(storageFile, storage => storage._clone(outputDir));
  }

  static upstream(storageFile: string, storageOutFile: string) {
    return Storage._withStorage(storageFile, storage => storage._upstream(storageOutFile));
  }

  private static _withStorage<T>(fileName: string, runnable: (storage: Storage) => Promise<T>) {
    this._serializeQueue = this._serializeQueue.then(() => {
      let storage = Storage._storages.get(fileName);
      if (!storage) {
        storage = new Storage(fileName);
        Storage._storages.set(fileName, storage);
      }
      return runnable(storage);
    });
    return this._serializeQueue;
  }

  private constructor(fileName: string) {
    this._fileName = fileName;
  }

  async _clone(outputDir: string): Promise<string> {
    const entries = await this._load();
    if (this._lastSnapshotFileName)
      return this._lastSnapshotFileName;
    const snapshotFile = path.join(outputDir, `pw-storage-${createGuid()}.json`);
    await fs.promises.writeFile(snapshotFile, JSON.stringify(entries, null, 2)).catch(() => {});
    this._lastSnapshotFileName = snapshotFile;
    return snapshotFile;
  }

  async _upstream(storageOutFile: string) {
    const entries = await this._load();
    const newEntries = await fs.promises.readFile(storageOutFile, 'utf8').then(JSON.parse).catch(() => ({})) as StorageEnties;
    for (const [key, newValue] of Object.entries(newEntries))
      entries[key] = newValue;
    this._lastSnapshotFileName = undefined;
    await fs.promises.writeFile(this._fileName, JSON.stringify(entries, null, 2));
  }

  private async _load(): Promise<StorageEnties> {
    if (!this._entriesPromise)
      this._entriesPromise = fs.promises.readFile(this._fileName, 'utf8').then(JSON.parse).catch(() => ({}));
    return this._entriesPromise;
  }
}
