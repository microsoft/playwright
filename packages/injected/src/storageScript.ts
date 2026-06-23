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

import { parseEvaluationResultValue, serializeAsCallArgument, serializeFile  } from '@isomorphic/utilityScriptSerializers';
import type { SerializedValue } from '@isomorphic/utilityScriptSerializers';

type NameValue = { name: string, value: string };

type IndexedDBDatabase = {
  name: string,
  version: number,
  stores: {
    name: string,
    autoIncrement: boolean,
    keyPath?: string,
    keyPathArray?: string[],
    records: {
      key?: any,
      keyEncoded?: any,
      value?: any,
      valueEncoded?: any,
    }[],
    indexes: {
      name: string,
      keyPath?: string,
      keyPathArray?: string[],
      multiEntry: boolean,
      unique: boolean,
    }[],
  }[],
};

type OPFSTree = Array<
  [name: string, contents: Extract<SerializedValue, {f: any}> | OPFSTree]
>;

type SetOriginStorage = {
  origin: string,
  localStorage: NameValue[],
  indexedDB?: IndexedDBDatabase[],
  opfs?: OPFSTree
};

export type SerializedStorage = {
  localStorage: NameValue[],
  indexedDB?: IndexedDBDatabase[],
  opfs?: OPFSTree
};

export class StorageScript {
  private _isFirefox: boolean;
  private _global;

  constructor(isFirefox: boolean) {
    this._isFirefox = isFirefox;
    // eslint-disable-next-line no-restricted-globals
    this._global = globalThis;
  }

  private _idbRequestToPromise<T extends IDBOpenDBRequest | IDBRequest>(request: T) {
    return new Promise<T['result']>((resolve, reject) => {
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error));
    });
  }

  private _isPlainObject(v: any) {
    const ctor = v?.constructor;
    if (this._isFirefox) {
      const constructorImpl = ctor?.toString() as string | undefined;
      if (constructorImpl?.startsWith('function Object() {') && constructorImpl?.includes('[native code]'))
        return true;
    }
    return ctor === Object;
  }

  private _trySerialize(value: any): { trivial?: any, encoded?: any } {
    let trivial = true;
    const encoded = serializeAsCallArgument(value, v => {
      const isTrivial = (
        this._isPlainObject(v)
        || Array.isArray(v)
        || typeof v === 'string'
        || typeof v === 'number'
        || typeof v === 'boolean'
        || Object.is(v, null)
      );

      if (!isTrivial)
        trivial = false;

      return { fallThrough: v };
    });
    if (trivial)
      return { trivial: value };
    return { encoded };
  }

  private async _collectDB(dbInfo: IDBDatabaseInfo) {
    if (!dbInfo.name)
      throw new Error('Database name is empty');
    if (!dbInfo.version)
      throw new Error('Database version is unset');

    const db = await this._idbRequestToPromise(indexedDB.open(dbInfo.name));
    if (db.objectStoreNames.length === 0)
      return { name: dbInfo.name, version: dbInfo.version, stores: [] };

    const transaction = db.transaction(db.objectStoreNames, 'readonly');
    const stores = await Promise.all([...db.objectStoreNames].map(async storeName => {
      const objectStore = transaction.objectStore(storeName);

      const keys = await this._idbRequestToPromise(objectStore.getAllKeys());
      const records = await Promise.all(keys.map(async key => {
        const record: IndexedDBDatabase['stores'][0]['records'][0] = {};

        if (objectStore.keyPath === null) {
          const { encoded, trivial } = this._trySerialize(key);
          if (trivial)
            record.key = trivial;
          else
            record.keyEncoded = encoded;
        }

        const value = await this._idbRequestToPromise(objectStore.get(key));
        const { encoded, trivial } = this._trySerialize(value);
        if (trivial)
          record.value = trivial;
        else
          record.valueEncoded = encoded;

        return record;
      }));

      const indexes = [...objectStore.indexNames].map(indexName => {
        const index = objectStore.index(indexName);
        return {
          name: index.name,
          keyPath: typeof index.keyPath === 'string' ? index.keyPath : undefined,
          keyPathArray: Array.isArray(index.keyPath) ? index.keyPath : undefined,
          multiEntry: index.multiEntry,
          unique: index.unique,
        };
      });

      return {
        name: storeName,
        records: records,
        indexes,
        autoIncrement: objectStore.autoIncrement,
        keyPath: typeof objectStore.keyPath === 'string' ? objectStore.keyPath : undefined,
        keyPathArray: Array.isArray(objectStore.keyPath) ? objectStore.keyPath : undefined,
      };
    }));

    return {
      name: dbInfo.name,
      version: dbInfo.version,
      stores,
    };
  }

  private async _collectOPFS(root: FileSystemDirectoryHandle) {
    async function walk(base: FileSystemDirectoryHandle){
      const tree: OPFSTree = [];

      for await (const [name, entry] of base) {
        if (entry instanceof FileSystemFileHandle)
          tree.push([name, await serializeFile(await entry.getFile())]);
        else
          tree.push([name, await walk(entry)]);

      }

      return tree;
    }

    return walk(root);
  }

  async collect(record: {indexedDB: boolean, opfs: boolean}): Promise<SerializedStorage> {
    const localStorage = Object.keys(this._global.localStorage).map(name => ({ name, value: this._global.localStorage.getItem(name)! }));

    const collected: SerializedStorage = { localStorage };

    if (record.indexedDB) {
      try {
        const databases = await this._global.indexedDB.databases();
        collected.indexedDB = await Promise.all(databases.map(db => this._collectDB(db)));
      } catch (e) {
        throw new Error('Unable to serialize IndexedDB: ' + e.message);
      }
    }

    if (record.opfs) {
      try {
        collected.opfs = await this._collectOPFS(await this._global.navigator.storage.getDirectory());
      } catch (e) {
        throw new Error('Unable to serialize OPFS: '  + e.message);
      }
    }

    return collected;
  }

  private async _restoreDB(dbInfo: IndexedDBDatabase) {
    const openRequest = this._global.indexedDB.open(dbInfo.name, dbInfo.version);
    openRequest.addEventListener('upgradeneeded', () => {
      const db = openRequest.result;
      for (const store of dbInfo.stores) {
        const objectStore = db.createObjectStore(store.name, { autoIncrement: store.autoIncrement, keyPath: store.keyPathArray ?? store.keyPath });
        for (const index of store.indexes)
          objectStore.createIndex(index.name, index.keyPathArray ?? index.keyPath!, { unique: index.unique, multiEntry: index.multiEntry });
      }
    });

    // after `upgradeneeded` finishes, `success` event is fired.
    const db = await this._idbRequestToPromise(openRequest);

    if (db.objectStoreNames.length === 0)
      return;
    const transaction = db.transaction(db.objectStoreNames, 'readwrite');
    await Promise.all(dbInfo.stores.map(async store => {
      const objectStore = transaction.objectStore(store.name);
      await Promise.all(store.records.map(async record => {
        await this._idbRequestToPromise(
            objectStore.add(
                record.value ?? parseEvaluationResultValue(record.valueEncoded),
                record.key ?? parseEvaluationResultValue(record.keyEncoded),
            )
        );
      }));
    }));
  }

  private async _restoreOPFS(tree: OPFSTree) {
    async function walk(base: FileSystemDirectoryHandle, tree: OPFSTree) {

      for (const [name, entry] of tree) {
        if (!Array.isArray(entry)) {
          const handle = await base.getFileHandle(name, { create: true });
          const writable = await handle.createWritable();
          const writer = writable.getWriter();
          await writer.write(parseEvaluationResultValue(entry));
        } else {
          const directory = await base.getDirectoryHandle(name, { create: true });
          for (const [filename, subentry] of tree)
            await walk(directory, [[filename, subentry]]);

        }
      }
    }

    const root = await this._global.navigator.storage.getDirectory();
    await walk(root, tree);
  }

  async restore(originState: SetOriginStorage | undefined) {
    // Clean Service Workers.
    const registrations = this._global.navigator.serviceWorker ? await this._global.navigator.serviceWorker.getRegistrations() : [];
    await Promise.all(registrations.map(async r => {
      // Heuristic for service workers that stalled during main script fetch or importScripts:
      // Waiting for them to finish unregistering takes ages so we do not await.
      // However, they will unregister immediately after fetch finishes and should not affect next page load.
      // Unfortunately, loading next page in Chromium still takes 5 seconds waiting for
      // some operation on this bogus service worker to finish.
      if (!r.installing && !r.waiting && !r.active)
        r.unregister().catch(() => {});
      else
        await r.unregister().catch(() => {});
    }));

    try {
      for (const db of await this._global.indexedDB.databases?.() || []) {
        // Do not wait for the callback - it is called on timer in Chromium (slow).
        if (db.name)
          this._global.indexedDB.deleteDatabase(db.name!);
      }
      await Promise.all((originState?.indexedDB ?? []).map(dbInfo => this._restoreDB(dbInfo)));
    } catch (e) {
      throw new Error('Unable to restore IndexedDB: ' + e.message);
    }

    this._global.sessionStorage.clear();
    this._global.localStorage.clear();
    for (const { name, value } of (originState?.localStorage || []))
      this._global.localStorage.setItem(name, value);

    try {
      // Clear everything
      const root = await this._global.navigator.storage.getDirectory();
      for await (const name of root.keys())
        await root.removeEntry(name, { recursive: true });


      await this._restoreOPFS(originState?.opfs ?? []);

    } catch (e) {
      throw new Error('Unable to restore OPFS: ' + e.message);
    }
  }
}
