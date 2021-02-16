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
import fs from 'fs';
import * as os from 'os';
import path from 'path';
import * as util from 'util';
import { getUbuntuVersionSync } from './ubuntuVersion';
import { assert, getFromENV } from './utils';

export type BrowserName = 'chromium'|'webkit'|'firefox'|'ffmpeg';
export const allBrowserNames: BrowserName[] = ['chromium', 'webkit', 'firefox', 'ffmpeg'];

type BrowserPlatform = 'win32'|'win64'|'mac10.13'|'mac10.14'|'mac10.15'|'mac11'|'mac11-arm64'|'ubuntu18.04'|'ubuntu20.04';
type BrowserDescriptor = {
  name: BrowserName,
  revision: string,
  download: boolean,
};

const EXECUTABLE_PATHS = {
  chromium: {
    'ubuntu18.04': ['chrome-linux', 'chrome'],
    'ubuntu20.04': ['chrome-linux', 'chrome'],
    'mac10.13': ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
    'mac10.14': ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
    'mac10.15': ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
    'mac11': ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
    'mac11-arm64': ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
    'win32': ['chrome-win', 'chrome.exe'],
    'win64': ['chrome-win', 'chrome.exe'],
  },
  firefox: {
    'ubuntu18.04': ['firefox', 'firefox'],
    'ubuntu20.04': ['firefox', 'firefox'],
    'mac10.13': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
    'mac10.14': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
    'mac10.15': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
    'mac11': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
    'mac11-arm64': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
    'win32': ['firefox', 'firefox.exe'],
    'win64': ['firefox', 'firefox.exe'],
  },
  webkit: {
    'ubuntu18.04': ['pw_run.sh'],
    'ubuntu20.04': ['pw_run.sh'],
    'mac10.13': undefined,
    'mac10.14': ['pw_run.sh'],
    'mac10.15': ['pw_run.sh'],
    'mac11': ['pw_run.sh'],
    'mac11-arm64': ['pw_run.sh'],
    'win32': ['Playwright.exe'],
    'win64': ['Playwright.exe'],
  },
  ffmpeg: {
    'ubuntu18.04': ['ffmpeg-linux'],
    'ubuntu20.04': ['ffmpeg-linux'],
    'mac10.13': ['ffmpeg-mac'],
    'mac10.14': ['ffmpeg-mac'],
    'mac10.15': ['ffmpeg-mac'],
    'mac11': ['ffmpeg-mac'],
    'mac11-arm64': ['ffmpeg-mac'],
    'win32': ['ffmpeg-win32.exe'],
    'win64': ['ffmpeg-win64.exe'],
  },
};

const DOWNLOAD_URLS = {
  chromium: {
    'ubuntu18.04': '%s/builds/chromium/%s/chromium-linux.zip',
    'ubuntu20.04': '%s/builds/chromium/%s/chromium-linux.zip',
    'mac10.13': '%s/builds/chromium/%s/chromium-mac.zip',
    'mac10.14': '%s/builds/chromium/%s/chromium-mac.zip',
    'mac10.15': '%s/builds/chromium/%s/chromium-mac.zip',
    'mac11': '%s/builds/chromium/%s/chromium-mac.zip',
    'mac11-arm64': '%s/builds/chromium/%s/chromium-mac-arm64.zip',
    'win32': '%s/builds/chromium/%s/chromium-win32.zip',
    'win64': '%s/builds/chromium/%s/chromium-win64.zip',
  },
  firefox: {
    'ubuntu18.04': '%s/builds/firefox/%s/firefox-ubuntu-18.04.zip',
    'ubuntu20.04': '%s/builds/firefox/%s/firefox-ubuntu-18.04.zip',
    'mac10.13': '%s/builds/firefox/%s/firefox-mac-10.14.zip',
    'mac10.14': '%s/builds/firefox/%s/firefox-mac-10.14.zip',
    'mac10.15': '%s/builds/firefox/%s/firefox-mac-10.14.zip',
    'mac11': '%s/builds/firefox/%s/firefox-mac-10.14.zip',
    'mac11-arm64': '%s/builds/firefox/%s/firefox-mac-11.0-arm64.zip',
    'win32': '%s/builds/firefox/%s/firefox-win32.zip',
    'win64': '%s/builds/firefox/%s/firefox-win64.zip',
  },
  webkit: {
    'ubuntu18.04': '%s/builds/webkit/%s/webkit-ubuntu-18.04.zip',
    'ubuntu20.04': '%s/builds/webkit/%s/webkit-ubuntu-20.04.zip',
    'mac10.13': undefined,
    'mac10.14': '%s/builds/webkit/%s/webkit-mac-10.14.zip',
    'mac10.15': '%s/builds/webkit/%s/webkit-mac-10.15.zip',
    'mac11': '%s/builds/webkit/%s/webkit-mac-10.15.zip',
    'mac11-arm64': '%s/builds/webkit/%s/webkit-mac-11.0-arm64.zip',
    'win32': '%s/builds/webkit/%s/webkit-win64.zip',
    'win64': '%s/builds/webkit/%s/webkit-win64.zip',
  },
  ffmpeg: {
    'ubuntu18.04': '%s/builds/ffmpeg/%s/ffmpeg-linux.zip',
    'ubuntu20.04': '%s/builds/ffmpeg/%s/ffmpeg-linux.zip',
    'mac10.13': '%s/builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac10.14': '%s/builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac10.15': '%s/builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac11': '%s/builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac11-arm64': '%s/builds/ffmpeg/%s/ffmpeg-mac.zip',
    'win32': '%s/builds/ffmpeg/%s/ffmpeg-win32.zip',
    'win64': '%s/builds/ffmpeg/%s/ffmpeg-win64.zip',
  },
};

export const hostPlatform = ((): BrowserPlatform => {
  const platform = os.platform();
  if (platform === 'darwin') {
    const [major, minor] = execSync('sw_vers -productVersion', {
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString('utf8').trim().split('.').map(x => parseInt(x, 10));
    let arm64 = false;
    // BigSur is the first version that might run on Apple Silicon.
    if (major >= 11) {
      arm64 = execSync('/usr/sbin/sysctl -in hw.optional.arm64', {
        stdio: ['ignore', 'pipe', 'ignore']
      }).toString().trim() === '1';
    }
    // We do not want to differentiate between minor big sur releases
    // since they don't change core APIs so far.
    const macVersion = major === 10 ? `${major}.${minor}` : `${major}`;
    const archSuffix = arm64 ? '-arm64' : '';
    return `mac${macVersion}${archSuffix}` as BrowserPlatform;
  }
  if (platform === 'linux') {
    const ubuntuVersion = getUbuntuVersionSync();
    if (parseInt(ubuntuVersion, 10) <= 19)
      return 'ubuntu18.04';
    return 'ubuntu20.04';
  }
  if (platform === 'win32')
    return os.arch() === 'x64' ? 'win64' : 'win32';
  return platform as BrowserPlatform;
})();

export const registryDirectory = (() => {
  let result: string;

  const envDefined = getFromENV('PLAYWRIGHT_BROWSERS_PATH');
  if (envDefined === '0') {
    result = path.join(__dirname, '..', '..', '.local-browsers');
  } else if (envDefined) {
    result = envDefined;
  } else {
    let cacheDirectory: string;
    if (process.platform === 'linux')
      cacheDirectory = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
    else if (process.platform === 'darwin')
      cacheDirectory = path.join(os.homedir(), 'Library', 'Caches');
    else if (process.platform === 'win32')
      cacheDirectory = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    else
      throw new Error('Unsupported platform: ' + process.platform);
    result = path.join(cacheDirectory, 'ms-playwright');
  }

  if (!path.isAbsolute(result)) {
    // It is important to resolve to the absolute path:
    //   - for unzipping to work correctly;
    //   - so that registry directory matches between installation and execution.
    // INIT_CWD points to the root of `npm/yarn install` and is probably what
    // the user meant when typing the relative path.
    result = path.resolve(getFromENV('INIT_CWD') || process.cwd(), result);
  }
  return result;
})();

export function isBrowserDirectory(browserDirectory: string): boolean {
  const baseName = path.basename(browserDirectory);
  for (const browserName of allBrowserNames) {
    if (baseName.startsWith(browserName + '-'))
      return true;
  }
  return false;
}

export class Registry {
  private _descriptors: BrowserDescriptor[];

  constructor(packagePath: string) {
    const browsersJSON = JSON.parse(fs.readFileSync(path.join(packagePath, 'browsers.json'), 'utf8'));
    this._descriptors = browsersJSON['browsers'];
  }

  browserDirectory(browserName: BrowserName): string {
    const browser = this._descriptors.find(browser => browser.name === browserName);
    assert(browser, `ERROR: Playwright does not support ${browserName}`);
    return path.join(registryDirectory, `${browser.name}-${browser.revision}`);
  }

  revision(browserName: BrowserName): number {
    const browser = this._descriptors.find(browser => browser.name === browserName);
    assert(browser, `ERROR: Playwright does not support ${browserName}`);
    return parseInt(browser.revision, 10);
  }

  linuxLddDirectories(browserName: BrowserName): string[] {
    const browserDirectory = this.browserDirectory(browserName);
    if (browserName === 'chromium')
      return [path.join(browserDirectory, 'chrome-linux')];
    if (browserName === 'firefox')
      return [path.join(browserDirectory, 'firefox')];
    if (browserName === 'webkit') {
      return [
        path.join(browserDirectory, 'minibrowser-gtk'),
        path.join(browserDirectory, 'minibrowser-gtk', 'bin'),
        path.join(browserDirectory, 'minibrowser-gtk', 'lib'),
        path.join(browserDirectory, 'minibrowser-wpe'),
        path.join(browserDirectory, 'minibrowser-wpe', 'bin'),
        path.join(browserDirectory, 'minibrowser-wpe', 'lib'),
      ];
    }
    return [];
  }

  windowsExeAndDllDirectories(browserName: BrowserName): string[] {
    const browserDirectory = this.browserDirectory(browserName);
    if (browserName === 'chromium')
      return [path.join(browserDirectory, 'chrome-win')];
    if (browserName === 'firefox')
      return [path.join(browserDirectory, 'firefox')];
    if (browserName === 'webkit')
      return [browserDirectory];
    return [];
  }

  executablePath(browserName: BrowserName): string | undefined {
    const browserDirectory = this.browserDirectory(browserName);
    const tokens = EXECUTABLE_PATHS[browserName][hostPlatform];
    return tokens ? path.join(browserDirectory, ...tokens) : undefined;
  }

  downloadURL(browserName: BrowserName): string {
    const browser = this._descriptors.find(browser => browser.name === browserName);
    assert(browser, `ERROR: Playwright does not support ${browserName}`);
    const envDownloadHost: { [key: string]: string } = {
      chromium: 'PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST',
      firefox: 'PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST',
      webkit: 'PLAYWRIGHT_WEBKIT_DOWNLOAD_HOST',
      ffmpeg: 'PLAYWRIGHT_FFMPEG_DOWNLOAD_HOST',
    };
    const downloadHost = getFromENV(envDownloadHost[browserName]) ||
                         getFromENV('PLAYWRIGHT_DOWNLOAD_HOST') ||
                         'https://playwright.azureedge.net';
    const urlTemplate = DOWNLOAD_URLS[browserName][hostPlatform];
    assert(urlTemplate, `ERROR: Playwright does not support ${browserName} on ${hostPlatform}`);
    return util.format(urlTemplate, downloadHost, browser.revision);
  }

  shouldDownload(browserName: BrowserName): boolean {
    // Older versions do not have "download" field. We assume they need all browsers
    // from the list. So we want to skip all browsers that are explicitly marked as "download: false".
    const browser = this._descriptors.find(browser => browser.name === browserName);
    return !!browser && browser.download !== false;
  }
}
