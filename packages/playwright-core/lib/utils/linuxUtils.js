"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getLinuxDistributionInfo = getLinuxDistributionInfo;
exports.getLinuxDistributionInfoSync = getLinuxDistributionInfoSync;
var _fs = _interopRequireDefault(require("fs"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

let didFailToReadOSRelease = false;
let osRelease;
async function getLinuxDistributionInfo() {
  if (process.platform !== 'linux') return undefined;
  if (!osRelease && !didFailToReadOSRelease) {
    try {
      var _fields$get, _fields$get2;
      // List of /etc/os-release values for different distributions could be
      // found here: https://gist.github.com/aslushnikov/8ceddb8288e4cf9db3039c02e0f4fb75
      const osReleaseText = await _fs.default.promises.readFile('/etc/os-release', 'utf8');
      const fields = parseOSReleaseText(osReleaseText);
      osRelease = {
        id: (_fields$get = fields.get('id')) !== null && _fields$get !== void 0 ? _fields$get : '',
        version: (_fields$get2 = fields.get('version_id')) !== null && _fields$get2 !== void 0 ? _fields$get2 : ''
      };
    } catch (e) {
      didFailToReadOSRelease = true;
    }
  }
  return osRelease;
}
function getLinuxDistributionInfoSync() {
  if (process.platform !== 'linux') return undefined;
  if (!osRelease && !didFailToReadOSRelease) {
    try {
      var _fields$get3, _fields$get4;
      // List of /etc/os-release values for different distributions could be
      // found here: https://gist.github.com/aslushnikov/8ceddb8288e4cf9db3039c02e0f4fb75
      const osReleaseText = _fs.default.readFileSync('/etc/os-release', 'utf8');
      const fields = parseOSReleaseText(osReleaseText);
      osRelease = {
        id: (_fields$get3 = fields.get('id')) !== null && _fields$get3 !== void 0 ? _fields$get3 : '',
        version: (_fields$get4 = fields.get('version_id')) !== null && _fields$get4 !== void 0 ? _fields$get4 : ''
      };
    } catch (e) {
      didFailToReadOSRelease = true;
    }
  }
  return osRelease;
}
function parseOSReleaseText(osReleaseText) {
  const fields = new Map();
  for (const line of osReleaseText.split('\n')) {
    const tokens = line.split('=');
    const name = tokens.shift();
    let value = tokens.join('=').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
    if (!name) continue;
    fields.set(name.toLowerCase(), value);
  }
  return fields;
}