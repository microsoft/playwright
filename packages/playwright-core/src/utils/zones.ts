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
  private readonly _asyncLocalStorage = new AsyncLocalStorage<Zone<unknown>|undefined>();

  run<T, R>(type: ZoneType, data: T, func: () => R): R {
    const previous = this._asyncLocalStorage.getStore();
    const zone = new Zone(previous, type, data);
    return this._asyncLocalStorage.run(zone, func);
  }

  zoneData<T>(type: ZoneType): T | undefined {
    for (let zone = this._asyncLocalStorage.getStore(); zone; zone = zone.previous) {
      if (zone.type === type)
        return zone.data as T;
    }
    return undefined;
  }

  exitZones<R>(func: () => R): R {
    return this._asyncLocalStorage.run(undefined, func);
  }

  printZones() {
    const zones = [];
    for (let zone = this._asyncLocalStorage.getStore(); zone; zone = zone.previous) {
      let str = zone.type;
      if (zone.type === 'apiZone')
        str += `(${(zone.data as any).apiName})`;
      zones.push(str);
      
    }
    console.log('zones: ', zones.join(' -> '));
  }
}

class Zone<T> {
  readonly type: ZoneType;
  readonly data: T;
  readonly previous: Zone<unknown> | undefined;

  constructor(previous: Zone<unknown> | undefined, type: ZoneType, data: T) {
    this.type = type;
    this.data = data;
    this.previous = previous;
  }
}

export const zones = new ZoneManager();
