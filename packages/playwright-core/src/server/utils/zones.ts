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

export type ZoneType = 'apiZone' | 'stepZone';

const asyncLocalStorage = new AsyncLocalStorage<Zone | undefined>();

export class Zone {
  private readonly _asyncLocalStorage: AsyncLocalStorage<Zone | undefined>;
  private readonly _data: ReadonlyMap<ZoneType, unknown>;

  constructor(asyncLocalStorage: AsyncLocalStorage<Zone | undefined>, store: Map<ZoneType, unknown>) {
    this._asyncLocalStorage = asyncLocalStorage;
    this._data = store;
  }

  with(type: ZoneType, data: unknown): Zone {
    return new Zone(this._asyncLocalStorage, new Map(this._data).set(type, data));
  }

  without(type?: ZoneType): Zone {
    const data = type ? new Map(this._data) : new Map();
    data.delete(type);
    return new Zone(this._asyncLocalStorage, data);
  }

  run<R>(func: () => R): R {
    return this._asyncLocalStorage.run(this, func);
  }

  data<T>(type: ZoneType): T | undefined {
    return this._data.get(type) as T | undefined;
  }
}

export const emptyZone = new Zone(asyncLocalStorage, new Map());

export function currentZone(): Zone {
  return asyncLocalStorage.getStore() ?? emptyZone;
}
