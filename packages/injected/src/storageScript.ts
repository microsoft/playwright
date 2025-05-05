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

import { parseEvaluationResultValue, serializeAsCallArgument } from '@isomorphic/utilityScriptSerializers';

import type * as channels from '@protocol/channels';

export type SerializedStorage = Omit<channels.OriginStorage, 'origin'>;

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
        const record: channels.IndexedDBDatabase['stores'][0]['records'][0] = {};

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

  async collect(recordIndexedDB: boolean): Promise<SerializedStorage> {
    const localStorage = Object.keys(this._global.localStorage).map(name => ({ name, value: this._global.localStorage.getItem(name)! }));
    if (!recordIndexedDB)
      return { localStorage };
    try {
      const databases = await this._global.indexedDB.databases();
      const indexedDB = await Promise.all(databases.map(db => this._collectDB(db)));
      return { localStorage, indexedDB };
    } catch (e) {
      throw new Error('Unable to serialize IndexedDB: ' + e.message);
    }
  }

  private async _restoreDB(dbInfo: channels.IndexedDBDatabase) {
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

  async restore(originState: channels.SetOriginStorage) {
    try {
      await Promise.all((originState.indexedDB ?? []).map(dbInfo => this._restoreDB(dbInfo)));
    } catch (e) {
      throw new Error('Unable to restore IndexedDB: ' + e.message);
    }
    for (const { name, value } of (originState.localStorage || []))
      this._global.localStorage.setItem(name, value);
  }
}
