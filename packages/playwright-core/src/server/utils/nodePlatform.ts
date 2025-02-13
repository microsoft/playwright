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

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

import { colors } from '../../utilsBundle';
import { debugLogger } from './debugLogger';
import { currentZone, emptyZone } from './zones';

import type { Platform, Zone } from '../../common/platform';
import type { Zone as ZoneImpl } from './zones';

class NodeZone implements Zone {
  private _zone: ZoneImpl;

  constructor(zone: ZoneImpl) {
    this._zone = zone;
  }

  push<T>(data: T) {
    return new NodeZone(this._zone.with('apiZone', data));
  }

  pop() {
    return new NodeZone(this._zone.without('apiZone'));
  }

  run<R>(func: () => R): R {
    return this._zone.run(func);
  }

  runIgnoreCurrent<R>(func: () => R): R {
    return emptyZone.run(func);
  }

  data<T>(): T | undefined {
    return this._zone.data('apiZone');
  }
}

export const nodePlatform: Platform = {
  calculateSha1: (text: string) => {
    const sha1 = crypto.createHash('sha1');
    sha1.update(text);
    return Promise.resolve(sha1.digest('hex'));
  },

  colors,

  createGuid: () => crypto.randomBytes(16).toString('hex'),

  fs: () => fs,

  inspectCustom: util.inspect.custom,

  isLogEnabled(name: 'api' | 'channel') {
    return debugLogger.isEnabled(name);
  },

  log(name: 'api' | 'channel', message: string | Error | object) {
    debugLogger.log(name, message);
  },

  path: () => path,

  pathSeparator: path.sep,

  zones: {
    current: () => new NodeZone(currentZone()),
    empty: new NodeZone(emptyZone),
  }
};
