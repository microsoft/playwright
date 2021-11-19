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

import { captureRawStack } from './stackTrace';

class ZoneManager {
  lastZoneId = 0;
  readonly _zones = new Map<number, Zone>();

  constructor() {
  }

  async run<T, R>(type: string, data: T, func: () => Promise<R>): Promise<R> {
    const zone = new Zone(this, ++this.lastZoneId, type, data);
    this._zones.set(zone.id, zone);
    return zone.run(func);
  }

  zoneData<T>(type: string, rawStack?: string): T | null {
    const stack = rawStack || captureRawStack();

    for (const line of stack.split('\n')) {
      const index = line.indexOf('__PWZONE__[');
      if (index !== -1) {
        const zoneId = + line.substring(index + '__PWZONE__['.length, line.indexOf(']', index));
        const zone = this._zones.get(zoneId);
        if (zone && zone.type === type)
          return zone.data;
      }
    }
    return null;
  }
}

class Zone {
  private _manager: ZoneManager;
  readonly id: number;
  readonly type: string;
  readonly data: any = {};

  constructor(manager: ZoneManager, id: number, type: string, data: any) {
    this._manager = manager;
    this.id = id;
    this.type = type;
    this.data = data;
  }

  async run<R>(func: () => Promise<R>): Promise<R> {
    Object.defineProperty(func, 'name', { value: `__PWZONE__[${this.id}]` });
    try {
      return await func();
    } finally {
      this._manager._zones.delete(this.id);
    }
  }
}

export const zones = new ZoneManager();
