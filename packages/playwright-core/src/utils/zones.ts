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

import type { RawStack } from './stackTrace';
import { captureRawStack } from './stackTrace';

export type ZoneType = 'apiZone' | 'expectZone' | 'stepZone';

class ZoneManager {
  lastZoneId = 0;
  readonly _zones = new Map<number, Zone<any>>();

  run<T, R>(type: ZoneType, data: T, func: (data: T) => R): R {
    return new Zone<T>(this, ++this.lastZoneId, type, data).run(func);
  }

  zoneData<T>(type: ZoneType, rawStack: RawStack): T | null {
    for (const line of rawStack) {
      for (const zoneId of zoneIds(line)) {
        const zone = this._zones.get(zoneId);
        if (zone && zone.type === type)
          return zone.data;
      }
    }
    return null;
  }

  preserve<T>(callback: () => Promise<T>): Promise<T> {
    const rawStack = captureRawStack();
    const refs: number[] = [];
    for (const line of rawStack)
      refs.push(...zoneIds(line));
    Object.defineProperty(callback, 'name', { value: `__PWZONE__[${refs.join(',')}]-refs` });
    return callback();
  }
}

function zoneIds(line: string): number[] {
  const index = line.indexOf('__PWZONE__[');
  if (index === -1)
    return [];
  return line.substring(index + '__PWZONE__['.length, line.indexOf(']', index)).split(',').map(s => +s);
}

class Zone<T> {
  private _manager: ZoneManager;
  readonly id: number;
  readonly type: ZoneType;
  data: T;
  readonly wallTime: number;

  constructor(manager: ZoneManager, id: number, type: ZoneType, data: T) {
    this._manager = manager;
    this.id = id;
    this.type = type;
    this.data = data;
    this.wallTime = Date.now();
  }

  run<R>(func: (data: T) => R): R {
    this._manager._zones.set(this.id, this);
    Object.defineProperty(func, 'name', { value: `__PWZONE__[${this.id}]-${this.type}` });
    return runWithFinally(() => func(this.data), () => {
      this._manager._zones.delete(this.id);
    });
  }
}

export function runWithFinally<R>(func: () => R, finallyFunc: Function): R {
  try {
    const result = func();
    if (result instanceof Promise) {
      return result.then(r => {
        finallyFunc();
        return r;
      }).catch(e => {
        finallyFunc();
        throw e;
      }) as any;
    }
    finallyFunc();
    return result;
  } catch (e) {
    finallyFunc();
    throw e;
  }
}

export const zones = new ZoneManager();
