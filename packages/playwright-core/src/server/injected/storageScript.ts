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

import type * as channels from '@protocol/channels';

export type Storage = Omit<channels.OriginStorage, 'origin'>;

export async function collect(): Promise<Storage> {
  const idbResult = await Promise.all((await indexedDB.databases()).map(async dbInfo => {
    if (!dbInfo.name)
      throw new Error('Database name is empty');
    if (!dbInfo.version)
      throw new Error('Database version is unset');

    function idbRequestToPromise<T extends IDBOpenDBRequest | IDBRequest>(request: T) {
      return new Promise<T['result']>((resolve, reject) => {
        request.addEventListener('success', () => resolve(request.result));
        request.addEventListener('error', () => reject(request.error));
      });
    }

    const db = await idbRequestToPromise(indexedDB.open(dbInfo.name));
    const transaction = db.transaction(db.objectStoreNames, 'readonly');
    const stores = await Promise.all([...db.objectStoreNames].map(async storeName => {
      const objectStore = transaction.objectStore(storeName);

      const keys = await idbRequestToPromise(objectStore.getAllKeys());
      const records = await Promise.all(keys.map(async key => {
        return {
          key: objectStore.keyPath === null ? key : undefined,
          value: await idbRequestToPromise(objectStore.get(key))
        };
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
  })).catch(e => {
    throw new Error('Unable to serialize IndexedDB: ' + e.message);
  });

  return {
    localStorage: Object.keys(localStorage).map(name => ({ name, value: localStorage.getItem(name)! })),
    indexedDB: idbResult,
  };
}

export async function restore(originState: channels.SetOriginStorage) {
  for (const { name, value } of (originState.localStorage || []))
    localStorage.setItem(name, value);

  await Promise.all((originState.indexedDB ?? []).map(async dbInfo => {
    const openRequest = indexedDB.open(dbInfo.name, dbInfo.version);
    openRequest.addEventListener('upgradeneeded', () => {
      const db = openRequest.result;
      for (const store of dbInfo.stores) {
        const objectStore = db.createObjectStore(store.name, { autoIncrement: store.autoIncrement, keyPath: store.keyPathArray ?? store.keyPath });
        for (const index of store.indexes)
          objectStore.createIndex(index.name, index.keyPathArray ?? index.keyPath!, { unique: index.unique, multiEntry: index.multiEntry });
      }
    });

    function idbRequestToPromise<T extends IDBOpenDBRequest | IDBRequest>(request: T) {
      return new Promise<T['result']>((resolve, reject) => {
        request.addEventListener('success', () => resolve(request.result));
        request.addEventListener('error', () => reject(request.error));
      });
    }

    // after `upgradeneeded` finishes, `success` event is fired.
    const db = await idbRequestToPromise(openRequest);
    const transaction = db.transaction(db.objectStoreNames, 'readwrite');
    await Promise.all(dbInfo.stores.map(async store => {
      const objectStore = transaction.objectStore(store.name);
      await Promise.all(store.records.map(async record => {
        await idbRequestToPromise(
            objectStore.add(
                record.value,
                objectStore.keyPath === null ? record.key : undefined
            )
        );
      }));
    }));
  })).catch(e => {
    throw new Error('Unable to restore IndexedDB: ' + e.message);
  });
}
