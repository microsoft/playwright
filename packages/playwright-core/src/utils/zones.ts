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

import { AsyncLocalStorage } from 'async_hooks';

export type ZoneType = 'apiZone' | 'expectZone' | 'stepZone';

class ZoneManager {
  private readonly _asyncLocalStorage = new AsyncLocalStorage<Zone|undefined>();

  run<T, R>(type: ZoneType, data: T, func: () => R): R {
    const zone = Zone._createWithData(this._asyncLocalStorage, type, data);
    return this._asyncLocalStorage.run(zone, func);
  }

  zoneData<T>(type: ZoneType): T | undefined {
    const zone = this._asyncLocalStorage.getStore();
    return zone?.get(type);
  }

  currentZone(): Zone {
    return this._asyncLocalStorage.getStore() ?? Zone._createEmpty(this._asyncLocalStorage);
  }

  exitZones<R>(func: () => R): R {
    return this._asyncLocalStorage.run(undefined, func);
  }
}

export class Zone {
  private readonly _asyncLocalStorage: AsyncLocalStorage<Zone | undefined>;
  private readonly _data: Map<ZoneType, unknown>;

  static _createWithData(asyncLocalStorage: AsyncLocalStorage<Zone|undefined>, type: ZoneType, data: unknown) {
    const store = new Map(asyncLocalStorage.getStore()?._data);
    store.set(type, data);
    return new Zone(asyncLocalStorage, store);
  }

  static _createEmpty(asyncLocalStorage: AsyncLocalStorage<Zone|undefined>) {
    return new Zone(asyncLocalStorage, new Map());
  }

  private constructor(asyncLocalStorage: AsyncLocalStorage<Zone|undefined>, store: Map<ZoneType, unknown>) {
    this._asyncLocalStorage = asyncLocalStorage;
    this._data = store;
  }

  run<R>(func: () => R): R {
    // Reset apiZone and expectZone, but restore stepZone.
    const entries = [...this._data.entries()].filter(([type]) => (type !== 'apiZone' && type !== 'expectZone'));
    const resetZone = new Zone(this._asyncLocalStorage, new Map(entries));
    return this._asyncLocalStorage.run(resetZone, func);
  }

  get<T>(type: ZoneType): T | undefined {
    return this._data.get(type) as T | undefined;
  }
}

export const zones = new ZoneManager();
