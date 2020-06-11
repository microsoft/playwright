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

import { execSync } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import { getFromENV } from '../helper';

export type BrowserName = 'chromium'|'webkit'|'firefox';
export type BrowserPlatform = 'win32'|'win64'|'mac10.13'|'mac10.14'|'mac10.15'|'linux';
export type BrowserDescriptor = {
	name: BrowserName,
	revision: string
};

export const hostPlatform = ((): BrowserPlatform => {
  const platform = os.platform();
  if (platform === 'darwin') {
    const macVersion = execSync('sw_vers -productVersion').toString('utf8').trim().split('.').slice(0, 2).join('.');
    return `mac${macVersion}` as BrowserPlatform;
  }
  if (platform === 'linux')
    return 'linux';
  if (platform === 'win32')
    return os.arch() === 'x64' ? 'win64' : 'win32';
  return platform as BrowserPlatform;
})();

export function executablePath(browserPath: string, browser: BrowserDescriptor): string | undefined {
  let tokens: string[] | undefined;
  if (browser.name === 'chromium') {
    tokens = new Map<BrowserPlatform, string[]>([
      ['linux', ['chrome-linux', 'chrome']],
      ['mac10.13', ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium']],
      ['mac10.14', ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium']],
      ['mac10.15', ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium']],
      ['win32', ['chrome-win', 'chrome.exe']],
      ['win64', ['chrome-win', 'chrome.exe']],
    ]).get(hostPlatform);
  }

  if (browser.name === 'firefox') {
    tokens = new Map<BrowserPlatform, string[]>([
      ['linux', ['firefox', 'firefox']],
      ['mac10.13', ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox']],
      ['mac10.14', ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox']],
      ['mac10.15', ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox']],
      ['win32', ['firefox', 'firefox.exe']],
      ['win64', ['firefox', 'firefox.exe']],
    ]).get(hostPlatform);
  }

  if (browser.name === 'webkit') {
    tokens = new Map<BrowserPlatform, string[] | undefined>([
      ['linux', ['pw_run.sh']],
      ['mac10.13', undefined],
      ['mac10.14', ['pw_run.sh']],
      ['mac10.15', ['pw_run.sh']],
      ['win32', ['Playwright.exe']],
      ['win64', ['Playwright.exe']],
    ]).get(hostPlatform);
  }
  return tokens ? path.join(browserPath, ...tokens) : undefined;
}

function cacheDirectory() {
  if (process.platform === 'linux')
    return process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');

  if (process.platform === 'darwin')
    return path.join(os.homedir(), 'Library', 'Caches');

  if (process.platform === 'win32')
    return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  throw new Error('Unsupported platform: ' + process.platform);
}

const defaultBrowsersPath = ((): string | undefined => {
  const envDefined = getFromENV('PLAYWRIGHT_BROWSERS_PATH');
  if (envDefined === '0')
    return undefined;
  return envDefined || path.join(cacheDirectory(), 'ms-playwright');
})();

export function browsersPath(packagePath: string): string {
  return defaultBrowsersPath || path.join(packagePath, '.local-browsers');
}

export function browserDirectory(browsersPath: string, browser: BrowserDescriptor): string {
  return path.join(browsersPath, `${browser.name}-${browser.revision}`);
}

export function isBrowserDirectory(browserPath: string): boolean {
  const baseName = path.basename(browserPath);
  return baseName.startsWith('chromium-') || baseName.startsWith('firefox-') || baseName.startsWith('webkit-');
}
