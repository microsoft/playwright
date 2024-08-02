"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getEmbedderName = getEmbedderName;
exports.getPlaywrightVersion = getPlaywrightVersion;
exports.getUserAgent = getUserAgent;
exports.userAgentVersionMatchesErrorMessage = userAgentVersionMatchesErrorMessage;
var _child_process = require("child_process");
var _os = _interopRequireDefault(require("os"));
var _linuxUtils = require("../utils/linuxUtils");
var _ascii = require("./ascii");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
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

let cachedUserAgent;
function getUserAgent() {
  if (cachedUserAgent) return cachedUserAgent;
  try {
    cachedUserAgent = determineUserAgent();
  } catch (e) {
    cachedUserAgent = 'Playwright/unknown';
  }
  return cachedUserAgent;
}
function determineUserAgent() {
  let osIdentifier = 'unknown';
  let osVersion = 'unknown';
  if (process.platform === 'win32') {
    const version = _os.default.release().split('.');
    osIdentifier = 'windows';
    osVersion = `${version[0]}.${version[1]}`;
  } else if (process.platform === 'darwin') {
    const version = (0, _child_process.execSync)('sw_vers -productVersion', {
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString().trim().split('.');
    osIdentifier = 'macOS';
    osVersion = `${version[0]}.${version[1]}`;
  } else if (process.platform === 'linux') {
    const distroInfo = (0, _linuxUtils.getLinuxDistributionInfoSync)();
    if (distroInfo) {
      osIdentifier = distroInfo.id || 'linux';
      osVersion = distroInfo.version || 'unknown';
    } else {
      // Linux distribution without /etc/os-release.
      // Default to linux/unknown.
      osIdentifier = 'linux';
    }
  }
  const additionalTokens = [];
  if (process.env.CI) additionalTokens.push('CI/1');
  const serializedTokens = additionalTokens.length ? ' ' + additionalTokens.join(' ') : '';
  const {
    embedderName,
    embedderVersion
  } = getEmbedderName();
  return `Playwright/${getPlaywrightVersion()} (${_os.default.arch()}; ${osIdentifier} ${osVersion}) ${embedderName}/${embedderVersion}${serializedTokens}`;
}
function getEmbedderName() {
  let embedderName = 'unknown';
  let embedderVersion = 'unknown';
  if (!process.env.PW_LANG_NAME) {
    embedderName = 'node';
    embedderVersion = process.version.substring(1).split('.').slice(0, 2).join('.');
  } else if (['node', 'python', 'java', 'csharp'].includes(process.env.PW_LANG_NAME)) {
    var _process$env$PW_LANG_;
    embedderName = process.env.PW_LANG_NAME;
    embedderVersion = (_process$env$PW_LANG_ = process.env.PW_LANG_NAME_VERSION) !== null && _process$env$PW_LANG_ !== void 0 ? _process$env$PW_LANG_ : 'unknown';
  }
  return {
    embedderName,
    embedderVersion
  };
}
function getPlaywrightVersion(majorMinorOnly = false) {
  const version = process.env.PW_VERSION_OVERRIDE || require('./../../package.json').version;
  return majorMinorOnly ? version.split('.').slice(0, 2).join('.') : version;
}
function userAgentVersionMatchesErrorMessage(userAgent) {
  const match = userAgent.match(/^Playwright\/(\d+\.\d+\.\d+)/);
  if (!match) {
    // Cannot parse user agent - be lax.
    return;
  }
  const received = match[1].split('.').slice(0, 2).join('.');
  const expected = getPlaywrightVersion(true);
  if (received !== expected) {
    return (0, _ascii.wrapInASCIIBox)([`Playwright version mismatch:`, `  - server version: v${expected}`, `  - client version: v${received}`, ``, `If you are using VSCode extension, restart VSCode.`, ``, `If you are connecting to a remote service,`, `keep your local Playwright version in sync`, `with the remote service version.`, ``, `<3 Playwright Team`].join('\n'), 1);
  }
}