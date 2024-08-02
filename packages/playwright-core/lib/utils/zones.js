"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.zones = void 0;
var _async_hooks = require("async_hooks");
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

class ZoneManager {
  constructor() {
    this._asyncLocalStorage = new _async_hooks.AsyncLocalStorage();
  }
  run(type, data, func) {
    const previous = this._asyncLocalStorage.getStore();
    const zone = new Zone(previous, type, data);
    return this._asyncLocalStorage.run(zone, func);
  }
  zoneData(type) {
    for (let zone = this._asyncLocalStorage.getStore(); zone; zone = zone.previous) {
      if (zone.type === type) return zone.data;
    }
    return undefined;
  }
  exitZones(func) {
    return this._asyncLocalStorage.run(undefined, func);
  }
  printZones() {
    const zones = [];
    for (let zone = this._asyncLocalStorage.getStore(); zone; zone = zone.previous) {
      let str = zone.type;
      if (zone.type === 'apiZone') str += `(${zone.data.apiName})`;
      zones.push(str);
    }
    console.log('zones: ', zones.join(' -> '));
  }
}
class Zone {
  constructor(previous, type, data) {
    this.type = void 0;
    this.data = void 0;
    this.previous = void 0;
    this.type = type;
    this.data = data;
    this.previous = previous;
  }
}
const zones = exports.zones = new ZoneManager();