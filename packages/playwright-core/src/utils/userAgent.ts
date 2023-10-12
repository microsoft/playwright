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

import { execSync } from 'child_process';
import os from 'os';
import { getLinuxDistributionInfoSync } from '../utils/linuxUtils';
import { wrapInASCIIBox } from './ascii';

let cachedUserAgent: string | undefined;

export function getUserAgent(): string {
  if (cachedUserAgent)
    return cachedUserAgent;
  try {
    cachedUserAgent = determineUserAgent();
  } catch (e) {
    cachedUserAgent = 'Playwright/unknown';
  }
  return cachedUserAgent;
}

function determineUserAgent(): string {
  let osIdentifier = 'unknown';
  let osVersion = 'unknown';
  if (process.platform === 'win32') {
    const version = os.release().split('.');
    osIdentifier = 'windows';
    osVersion = `${version[0]}.${version[1]}`;
  } else if (process.platform === 'darwin') {
    const version = execSync('sw_vers -productVersion', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('.');
    osIdentifier = 'macOS';
    osVersion = `${version[0]}.${version[1]}`;
  } else if (process.platform === 'linux') {
    const distroInfo = getLinuxDistributionInfoSync();
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
  if (process.env.CI)
    additionalTokens.push('CI/1');
  const serializedTokens = additionalTokens.length ? ' ' + additionalTokens.join(' ') : '';

  const { embedderName, embedderVersion } = getEmbedderName();
  return `Playwright/${getPlaywrightVersion()} (${os.arch()}; ${osIdentifier} ${osVersion}) ${embedderName}/${embedderVersion}${serializedTokens}`;
}

export function getEmbedderName(): { embedderName: string, embedderVersion: string } {
  let embedderName = 'unknown';
  let embedderVersion = 'unknown';
  if (!process.env.PW_LANG_NAME) {
    embedderName = 'node';
    embedderVersion = process.version.substring(1).split('.').slice(0, 2).join('.');
  } else if (['node', 'python', 'java', 'csharp'].includes(process.env.PW_LANG_NAME)) {
    embedderName = process.env.PW_LANG_NAME;
    embedderVersion = process.env.PW_LANG_NAME_VERSION ?? 'unknown';
  }
  return { embedderName, embedderVersion };
}

export function getPlaywrightVersion(majorMinorOnly = false): string {
  const version = process.env.PW_VERSION_OVERRIDE || require('./../../package.json').version;
  return majorMinorOnly ? version.split('.').slice(0, 2).join('.') : version;
}

export function userAgentVersionMatchesErrorMessage(userAgent: string) {
  const match = userAgent.match(/^Playwright\/(\d+\.\d+\.\d+)/);
  if (!match) {
    // Cannot parse user agent - be lax.
    return;
  }
  const received = match[1].split('.').slice(0, 2).join('.');
  const expected = getPlaywrightVersion(true);
  if (received !== expected) {
    return wrapInASCIIBox([
      `Playwright version mismatch:`,
      `  - server version: v${expected}`,
      `  - client version: v${received}`,
      ``,
      `If you are using VSCode extension, restart VSCode.`,
      ``,
      `If you are connecting to a remote service,`,
      `keep your local Playwright version in sync`,
      `with the remote service version.`,
      ``,
      `<3 Playwright Team`
    ].join('\n'), 1);
  }
}
