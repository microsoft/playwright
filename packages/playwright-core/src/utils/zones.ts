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
    const current = this._asyncLocalStorage.getStore();
    const zone = Zone.createWithData(current, type, data);
    return this.runInZone(zone, func);
  }

  runInZone<R>(zone: Zone | undefined, func: () => R): R {
    return this._asyncLocalStorage.run(zone, func);
  }

  zoneData<T>(type: ZoneType): T | undefined {
    const zone = this._asyncLocalStorage.getStore();
    return zone?.get(type);
  }

  currentZone(): Zone | undefined {
    return this._asyncLocalStorage.getStore();
  }

  exitZones<R>(func: () => R): R {
    return this._asyncLocalStorage.run(undefined, func);
  }
}

export class Zone {
  private readonly store: Map<ZoneType, unknown>;

  static createWithData(currentZone: Zone | undefined, type: ZoneType, data: unknown) {
    const store = new Map(currentZone?.store.entries() ?? []);
    store.set(type, data);
    return new Zone(store);
  }

  private constructor(store: Map<ZoneType, unknown>) {
    this.store = store;
  }

  copyWithoutTypes(types: ZoneType[]): Zone {
    const store = new Map(this.store.entries().filter(([type]) => !types.includes(type)));
    return new Zone(store);
  }

  get<T>(type: ZoneType): T | undefined {
    return this.store.get(type) as T | undefined;
  }
}

export const zones = new ZoneManager();
