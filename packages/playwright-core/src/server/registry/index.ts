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

import fs from 'fs';
import os from 'os';
import path from 'path';
import * as util from 'util';

import { wrapInASCIIBox } from '@utils/ascii';
import { debugLogger } from '@utils/debugLogger';
import { shortPlatform, hostPlatform, isOfficiallySupportedPlatform } from '@utils/hostPlatform';
import { NET_DEFAULT_TIMEOUT } from '@utils/network';
import { spawnAsync } from '@utils/processLauncher';
import { canAccessFile, existsAsync, removeFolders } from '@utils/fileUtils';
import { calculateSha1 } from '@utils/crypto';
import { getAsBooleanFromENV, getFromENV, getPackageManagerExecCommand } from '@utils/env';
import { lock } from '@utils/third_party/lockfile';
import { fetchData } from '../utils';
import { getEmbedderName, getUserAgent } from '../userAgent';
import { installDependenciesLinux, installDependenciesWindows, validateDependenciesLinux, validateDependenciesWindows } from './dependencies';
import { dockerVersion, readDockerVersionSync, transformCommandsForRoot } from './dependencies';
import { downloadBrowserWithProgressBar, logPolitely } from './browserFetcher';
import { packageRoot, binPath, packageJSON } from '../../package';

import type { DependencyGroup } from './dependencies';
import type { HostPlatform } from '@utils/hostPlatform';

export { writeDockerVersion } from './dependencies';

const PACKAGE_PATH = packageRoot;
const BIN_PATH = binPath;

const PLAYWRIGHT_STORAGE_BUCKET = 'https://cdn.playwright.dev';

const PLAYWRIGHT_CDN_MIRRORS = [
  'https://cdn.playwright.dev/dbazure/download/playwright', // ESRP CDN
  'https://playwright.download.prss.microsoft.com/dbazure/download/playwright', // Directly hit ESRP CDN
  PLAYWRIGHT_STORAGE_BUCKET, // Hit the Storage Bucket directly
];

if (process.env.PW_TEST_CDN_THAT_SHOULD_WORK) {
  for (let i = 0; i < PLAYWRIGHT_CDN_MIRRORS.length; i++) {
    const cdn = PLAYWRIGHT_CDN_MIRRORS[i];
    if (cdn !== process.env.PW_TEST_CDN_THAT_SHOULD_WORK) {
      const parsedCDN = new URL(cdn);
      parsedCDN.hostname = parsedCDN.hostname + '.does-not-resolve.playwright.dev';
      PLAYWRIGHT_CDN_MIRRORS[i] = parsedCDN.toString();
    }
  }
}

const EXECUTABLE_PATHS = {
  'chromium': {
    '<unknown>': undefined,
    'linux-x64': ['chrome-linux64', 'chrome'],
    'linux-arm64': ['chrome-linux-arm64', 'chrome'],
    'mac-x64': ['chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'],
    'mac-arm64': ['chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'],
    'win-x64': ['chrome-win64', 'chrome.exe'],
  },
  'chromium-headless-shell': {
    '<unknown>': undefined,
    'linux-x64': ['chrome-headless-shell-linux64', 'chrome-headless-shell'],
    'linux-arm64': ['chrome-headless-shell-linux-arm64', 'chrome-headless-shell'],
    'mac-x64': ['chrome-headless-shell-mac-x64', 'chrome-headless-shell'],
    'mac-arm64': ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell'],
    'win-x64': ['chrome-headless-shell-win64', 'chrome-headless-shell.exe'],
  },
  'firefox': {
    '<unknown>': undefined,
    'linux-x64': ['firefox', 'firefox'],
    'linux-arm64': ['firefox', 'firefox'],
    'mac-x64': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
    'mac-arm64': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
    'win-x64': ['firefox', 'firefox.exe'],
  },
  'webkit': {
    '<unknown>': undefined,
    'linux-x64': ['pw_run.sh'],
    'linux-arm64': ['pw_run.sh'],
    'mac-x64': ['pw_run.sh'],
    'mac-arm64': ['pw_run.sh'],
    'win-x64': ['Playwright.exe'],
  },
  'ffmpeg': {
    '<unknown>': undefined,
    'linux-x64': ['ffmpeg-linux'],
    'linux-arm64': ['ffmpeg-linux'],
    'mac-x64': ['ffmpeg-mac'],
    'mac-arm64': ['ffmpeg-mac'],
    'win-x64': ['ffmpeg-win64.exe'],
  },
  'winldd': {
    '<unknown>': undefined,
    'linux-x64': undefined,
    'linux-arm64': undefined,
    'mac-x64': undefined,
    'mac-arm64': undefined,
    'win-x64': ['PrintDeps.exe'],
  },
};

type DownloadPathFunction = (params: BrowsersJSONDescriptor) => { path: string, mirrors: string[] };

function cftUrl(suffix: string): DownloadPathFunction {
  return ({ browserVersion }) => {
    return {
      path: `builds/cft/${browserVersion}/${suffix}`,
      mirrors: [
        'https://cdn.playwright.dev',
      ],
    };
  };
}

type DownloadPaths = Record<HostPlatform, string | DownloadPathFunction | undefined>;
const DOWNLOAD_PATHS: Record<string, DownloadPaths> = {
  'chromium': {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': undefined,
    'ubuntu22.04-x64': cftUrl('linux64/chrome-linux64.zip'),
    'ubuntu24.04-x64': cftUrl('linux64/chrome-linux64.zip'),
    'ubuntu26.04-x64': cftUrl('linux64/chrome-linux64.zip'),
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': undefined,
    'ubuntu22.04-arm64': cftUrl('linux-arm64/chrome-linux-arm64.zip'),
    'ubuntu24.04-arm64': cftUrl('linux-arm64/chrome-linux-arm64.zip'),
    'ubuntu26.04-arm64': cftUrl('linux-arm64/chrome-linux-arm64.zip'),
    'debian11-x64': undefined,
    'debian11-arm64': undefined,
    'debian12-x64': cftUrl('linux64/chrome-linux64.zip'),
    'debian12-arm64': cftUrl('linux-arm64/chrome-linux-arm64.zip'),
    'debian13-x64': cftUrl('linux64/chrome-linux64.zip'),
    'debian13-arm64': cftUrl('linux-arm64/chrome-linux-arm64.zip'),
    'mac10.13': undefined,
    'mac10.14': undefined,
    'mac10.15': undefined,
    'mac11': undefined,
    'mac11-arm64': undefined,
    'mac12': undefined,
    'mac12-arm64': undefined,
    'mac13': undefined,
    'mac13-arm64': undefined,
    'mac14': cftUrl('mac-x64/chrome-mac-x64.zip'),
    'mac14-arm64': cftUrl('mac-arm64/chrome-mac-arm64.zip'),
    'mac15': cftUrl('mac-x64/chrome-mac-x64.zip'),
    'mac15-arm64': cftUrl('mac-arm64/chrome-mac-arm64.zip'),
    'mac26': cftUrl('mac-x64/chrome-mac-x64.zip'),
    'mac26-arm64': cftUrl('mac-arm64/chrome-mac-arm64.zip'),
    'win64': cftUrl('win64/chrome-win64.zip'),
  },
  'chromium-headless-shell': {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': undefined,
    'ubuntu22.04-x64': cftUrl('linux64/chrome-headless-shell-linux64.zip'),
    'ubuntu24.04-x64': cftUrl('linux64/chrome-headless-shell-linux64.zip'),
    'ubuntu26.04-x64': cftUrl('linux64/chrome-headless-shell-linux64.zip'),
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': undefined,
    'ubuntu22.04-arm64': cftUrl('linux-arm64/chrome-headless-shell-linux-arm64.zip'),
    'ubuntu24.04-arm64': cftUrl('linux-arm64/chrome-headless-shell-linux-arm64.zip'),
    'ubuntu26.04-arm64': cftUrl('linux-arm64/chrome-headless-shell-linux-arm64.zip'),
    'debian11-x64': undefined,
    'debian11-arm64': undefined,
    'debian12-x64': cftUrl('linux64/chrome-headless-shell-linux64.zip'),
    'debian12-arm64': cftUrl('linux-arm64/chrome-headless-shell-linux-arm64.zip'),
    'debian13-x64': cftUrl('linux64/chrome-headless-shell-linux64.zip'),
    'debian13-arm64': cftUrl('linux-arm64/chrome-headless-shell-linux-arm64.zip'),
    'mac10.13': undefined,
    'mac10.14': undefined,
    'mac10.15': undefined,
    'mac11': undefined,
    'mac11-arm64': undefined,
    'mac12': undefined,
    'mac12-arm64': undefined,
    'mac13': undefined,
    'mac13-arm64': undefined,
    'mac14': cftUrl('mac-x64/chrome-headless-shell-mac-x64.zip'),
    'mac14-arm64': cftUrl('mac-arm64/chrome-headless-shell-mac-arm64.zip'),
    'mac15': cftUrl('mac-x64/chrome-headless-shell-mac-x64.zip'),
    'mac15-arm64': cftUrl('mac-arm64/chrome-headless-shell-mac-arm64.zip'),
    'mac26': cftUrl('mac-x64/chrome-headless-shell-mac-x64.zip'),
    'mac26-arm64': cftUrl('mac-arm64/chrome-headless-shell-mac-arm64.zip'),
    'win64': cftUrl('win64/chrome-headless-shell-win64.zip'),
  },
  'firefox': {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': undefined,
    'ubuntu22.04-x64': 'builds/firefox/%s/firefox-ubuntu-22.04.zip',
    'ubuntu24.04-x64': 'builds/firefox/%s/firefox-ubuntu-24.04.zip',
    'ubuntu26.04-x64': 'builds/firefox/%s/firefox-ubuntu-24.04.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': undefined,
    'ubuntu22.04-arm64': 'builds/firefox/%s/firefox-ubuntu-22.04-arm64.zip',
    'ubuntu24.04-arm64': 'builds/firefox/%s/firefox-ubuntu-24.04-arm64.zip',
    'ubuntu26.04-arm64': 'builds/firefox/%s/firefox-ubuntu-24.04-arm64.zip',
    'debian11-x64': undefined,
    'debian11-arm64': undefined,
    'debian12-x64': 'builds/firefox/%s/firefox-debian-12.zip',
    'debian12-arm64': 'builds/firefox/%s/firefox-debian-12-arm64.zip',
    'debian13-x64': 'builds/firefox/%s/firefox-debian-13.zip',
    'debian13-arm64': 'builds/firefox/%s/firefox-debian-13-arm64.zip',
    'mac10.13': undefined,
    'mac10.14': undefined,
    'mac10.15': undefined,
    'mac11': undefined,
    'mac11-arm64': undefined,
    'mac12': undefined,
    'mac12-arm64': undefined,
    'mac13': undefined,
    'mac13-arm64': undefined,
    'mac14': 'builds/firefox/%s/firefox-mac.zip',
    'mac14-arm64': 'builds/firefox/%s/firefox-mac-arm64.zip',
    'mac15': 'builds/firefox/%s/firefox-mac.zip',
    'mac15-arm64': 'builds/firefox/%s/firefox-mac-arm64.zip',
    'mac26': 'builds/firefox/%s/firefox-mac.zip',
    'mac26-arm64': 'builds/firefox/%s/firefox-mac-arm64.zip',
    'win64': 'builds/firefox/%s/firefox-win64.zip',
  },
  'webkit': {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': undefined,
    'ubuntu22.04-x64': 'builds/webkit/%s/webkit-ubuntu-22.04.zip',
    'ubuntu24.04-x64': 'builds/webkit/%s/webkit-ubuntu-24.04.zip',
    'ubuntu26.04-x64': 'builds/webkit/%s/webkit-ubuntu-26.04.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': undefined,
    'ubuntu22.04-arm64': 'builds/webkit/%s/webkit-ubuntu-22.04-arm64.zip',
    'ubuntu24.04-arm64': 'builds/webkit/%s/webkit-ubuntu-24.04-arm64.zip',
    'ubuntu26.04-arm64': 'builds/webkit/%s/webkit-ubuntu-26.04-arm64.zip',
    'debian11-x64': undefined,
    'debian11-arm64': undefined,
    'debian12-x64': 'builds/webkit/%s/webkit-debian-12.zip',
    'debian12-arm64': 'builds/webkit/%s/webkit-debian-12-arm64.zip',
    'debian13-x64': 'builds/webkit/%s/webkit-debian-13.zip',
    'debian13-arm64': 'builds/webkit/%s/webkit-debian-13-arm64.zip',
    'mac10.13': undefined,
    'mac10.14': undefined,
    'mac10.15': undefined,
    'mac11': undefined,
    'mac11-arm64': undefined,
    'mac12': undefined,
    'mac12-arm64': undefined,
    'mac13': undefined,
    'mac13-arm64': undefined,
    'mac14': 'builds/webkit/%s/webkit-mac-14.zip',
    'mac14-arm64': 'builds/webkit/%s/webkit-mac-14-arm64.zip',
    'mac15': 'builds/webkit/%s/webkit-mac-15.zip',
    'mac15-arm64': 'builds/webkit/%s/webkit-mac-15-arm64.zip',
    'mac26': 'builds/webkit/%s/webkit-mac-26.zip',
    'mac26-arm64': 'builds/webkit/%s/webkit-mac-26-arm64.zip',
    'win64': 'builds/webkit/%s/webkit-win64.zip',
  },
  'ffmpeg': {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': undefined,
    'ubuntu22.04-x64': 'builds/ffmpeg/%s/ffmpeg-linux.zip',
    'ubuntu24.04-x64': 'builds/ffmpeg/%s/ffmpeg-linux.zip',
    'ubuntu26.04-x64': 'builds/ffmpeg/%s/ffmpeg-linux.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': undefined,
    'ubuntu22.04-arm64': 'builds/ffmpeg/%s/ffmpeg-linux-arm64.zip',
    'ubuntu24.04-arm64': 'builds/ffmpeg/%s/ffmpeg-linux-arm64.zip',
    'ubuntu26.04-arm64': 'builds/ffmpeg/%s/ffmpeg-linux-arm64.zip',
    'debian11-x64': undefined,
    'debian11-arm64': undefined,
    'debian12-x64': 'builds/ffmpeg/%s/ffmpeg-linux.zip',
    'debian12-arm64': 'builds/ffmpeg/%s/ffmpeg-linux-arm64.zip',
    'debian13-x64': 'builds/ffmpeg/%s/ffmpeg-linux.zip',
    'debian13-arm64': 'builds/ffmpeg/%s/ffmpeg-linux-arm64.zip',
    'mac10.13': undefined,
    'mac10.14': undefined,
    'mac10.15': undefined,
    'mac11': undefined,
    'mac11-arm64': undefined,
    'mac12': undefined,
    'mac12-arm64': undefined,
    'mac13': undefined,
    'mac13-arm64': undefined,
    'mac14': 'builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac14-arm64': 'builds/ffmpeg/%s/ffmpeg-mac-arm64.zip',
    'mac15': 'builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac15-arm64': 'builds/ffmpeg/%s/ffmpeg-mac-arm64.zip',
    'mac26': 'builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac26-arm64': 'builds/ffmpeg/%s/ffmpeg-mac-arm64.zip',
    'win64': 'builds/ffmpeg/%s/ffmpeg-win64.zip',
  },
  'winldd': {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': undefined,
    'ubuntu22.04-x64': undefined,
    'ubuntu24.04-x64': undefined,
    'ubuntu26.04-x64': undefined,
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': undefined,
    'ubuntu22.04-arm64': undefined,
    'ubuntu24.04-arm64': undefined,
    'ubuntu26.04-arm64': undefined,
    'debian11-x64': undefined,
    'debian11-arm64': undefined,
    'debian12-x64': undefined,
    'debian12-arm64': undefined,
    'debian13-x64': undefined,
    'debian13-arm64': undefined,
    'mac10.13': undefined,
    'mac10.14': undefined,
    'mac10.15': undefined,
    'mac11': undefined,
    'mac11-arm64': undefined,
    'mac12': undefined,
    'mac12-arm64': undefined,
    'mac13': undefined,
    'mac13-arm64': undefined,
    'mac14': undefined,
    'mac14-arm64': undefined,
    'mac15': undefined,
    'mac15-arm64': undefined,
    'mac26': undefined,
    'mac26-arm64': undefined,
    'win64': 'builds/winldd/%s/winldd-win64.zip',
  },
  'android': {
    '<unknown>': 'builds/android/%s/android.zip',
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': undefined,
    'ubuntu22.04-x64': 'builds/android/%s/android.zip',
    'ubuntu24.04-x64': 'builds/android/%s/android.zip',
    'ubuntu26.04-x64': 'builds/android/%s/android.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': undefined,
    'ubuntu22.04-arm64': 'builds/android/%s/android.zip',
    'ubuntu24.04-arm64': 'builds/android/%s/android.zip',
    'ubuntu26.04-arm64': 'builds/android/%s/android.zip',
    'debian11-x64': undefined,
    'debian11-arm64': undefined,
    'debian12-x64': 'builds/android/%s/android.zip',
    'debian12-arm64': 'builds/android/%s/android.zip',
    'debian13-x64': 'builds/android/%s/android.zip',
    'debian13-arm64': 'builds/android/%s/android.zip',
    'mac10.13': undefined,
    'mac10.14': undefined,
    'mac10.15': undefined,
    'mac11': undefined,
    'mac11-arm64': undefined,
    'mac12': undefined,
    'mac12-arm64': undefined,
    'mac13': undefined,
    'mac13-arm64': undefined,
    'mac14': 'builds/android/%s/android.zip',
    'mac14-arm64': 'builds/android/%s/android.zip',
    'mac15': 'builds/android/%s/android.zip',
    'mac15-arm64': 'builds/android/%s/android.zip',
    'mac26': 'builds/android/%s/android.zip',
    'mac26-arm64': 'builds/android/%s/android.zip',
    'win64': 'builds/android/%s/android.zip',
  },
};

function computeDefaultCacheDirectory(): string {
  if (process.platform === 'linux')
    return process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  if (process.platform === 'darwin')
    return path.join(os.homedir(), 'Library', 'Caches');
  if (process.platform === 'win32')
    return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  throw new Error('Unsupported platform: ' + process.platform);
}

let _defaultCacheDirectory: string | undefined;

export function defaultCacheDirectory(): string {
  return _defaultCacheDirectory ??= computeDefaultCacheDirectory();
}

export function defaultRegistryDirectory(): string {
  return path.join(defaultCacheDirectory(), 'ms-playwright');
}

export const registryDirectory = (() => {
  let result: string;

  const envDefined = getFromENV('PLAYWRIGHT_BROWSERS_PATH');
  if (envDefined === '0')
    result = path.join(packageRoot, '.local-browsers');
  else if (envDefined)
    result = envDefined;
  else
    result = defaultRegistryDirectory();

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

function isBrowserDirectory(browserDirectory: string): boolean {
  const baseName = path.basename(browserDirectory);
  for (const browserName of allDownloadableDirectoriesThatEverExisted) {
    if (baseName.startsWith(browserName.replace(/-/g, '_') + '-'))
      return true;
  }
  return false;
}

type BrowsersJSONEntry = {
  name: string,
  revision: string,
  browserVersion?: string,
  title?: string,
  installByDefault?: boolean,
  revisionOverrides?: {[os: string]: string},
};

export type BrowsersJSON = {
  comment?: string,
  // Playwright version that the override file was created for.
  playwrightVersion?: string,
  browsers: BrowsersJSONEntry[],
};

// A "browsers.json" file that overrides revisions from the package "browsers.json".
// Lives in `<dir>/browsers.json`, and `dir` is recorded as a backlink in the registry.
type BrowsersJSONOverride = {
  dir: string,
  browsersJSON: BrowsersJSON,
};

type BrowsersJSONDescriptor = {
  name: string,
  revision: string,
  hasRevisionOverride: boolean
  browserVersion?: string,
  title?: string,
  installByDefault: boolean,
  dir: string,
  overrideDir?: string,
};

export type BrowserInfo = {
  browserName: string,
  browserVersion: number,
  browserPath: string
  referenceDir: string,
};

function readDescriptors(browsersJSON: BrowsersJSON, overrides: BrowsersJSONOverride[] = []): BrowsersJSONDescriptor[] {
  return (browsersJSON['browsers']).map(packageEntry => {
    const name = packageEntry.name;
    let obj = packageEntry;
    let overrideDir: string | undefined;
    for (const override of overrides) {
      const entry = override.browsersJSON.browsers.find(b => b.name === name);
      if (!entry)
        continue;
      obj = {
        name,
        revision: entry.revision,
        browserVersion: entry.browserVersion,
        revisionOverrides: entry.revisionOverrides,
        title: entry.title ?? packageEntry.title,
        installByDefault: packageEntry.installByDefault,
      };
      overrideDir = override.dir;
      break;
    }
    const revisionOverride = (obj.revisionOverrides || {})[hostPlatform];
    const revision = revisionOverride || obj.revision;
    const browserDirectoryPrefix = revisionOverride ? `${name}_${hostPlatform}_special` : `${name}`;
    const descriptor: BrowsersJSONDescriptor = {
      name,
      revision,
      hasRevisionOverride: !!revisionOverride,
      // We only put browser version for the supported operating systems.
      browserVersion: revisionOverride ? undefined : obj.browserVersion,
      title: obj['title'],
      installByDefault: !!obj.installByDefault,
      // Method `isBrowserDirectory` determines directory to be browser iff
      // it starts with some browser name followed by '-'. Some browser names
      // are prefixes of others, e.g. 'webkit' is a prefix of `webkit-technology-preview`.
      // To avoid older registries erroneously removing 'webkit-technology-preview', we have to
      // ensure that browser folders to never include dashes inside.
      dir: path.join(registryDirectory, browserDirectoryPrefix.replace(/-/g, '_') + '-' + revision),
      overrideDir,
    };
    return descriptor;
  });
}

const kBrowsersJSONFileName = 'browsers.json';

function computeLocalOverrideDirectory(): string {
  const cwd = process.cwd();
  let dir = cwd;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, '.playwright');
    if (fs.existsSync(candidate))
      return candidate;
    const parentDir = path.dirname(dir);
    if (parentDir === dir)
      break;
    dir = parentDir;
  }
  return path.join(cwd, '.playwright');
}

const localOverrideDirectory = computeLocalOverrideDirectory();

function minorVersion(version: string): string {
  const [major, minor] = version.split('.');
  return `${major}.${minor}`;
}

// Override files are specific to a Playwright version: browsers in them
// are known to work with that version, but not necessarily with another one.
function isCompatibleOverride(browsersJSON: BrowsersJSON): boolean {
  return !browsersJSON.playwrightVersion || minorVersion(browsersJSON.playwrightVersion) === minorVersion(packageJSON.version);
}

function incompatibleOverrideError(override: BrowsersJSONOverride): Error {
  const { embedderName } = getEmbedderName();
  const command = buildPlaywrightCLICommand(embedderName, 'install --latest');
  return new Error(`Browser versions in ${path.join(override.dir, kBrowsersJSONFileName)} were pinned for Playwright ${override.browsersJSON.playwrightVersion}, but the current version is ${packageJSON.version}. Run "${command}" to pin the latest browser versions for the current Playwright, or remove the file.`);
}

// Reads override files in the precedence order: local `.playwright/browsers.json` first,
// then user-wide `<registry>/browsers.json`. A malformed or incompatible file
// produces an error that is thrown when the registry is actually used.
function readOverrides(): { overrides: BrowsersJSONOverride[], error?: Error } {
  const overrides: BrowsersJSONOverride[] = [];
  let error: Error | undefined;
  for (const dir of [localOverrideDirectory, registryDirectory]) {
    try {
      const override = readBrowsersJSONOverride(dir);
      if (!override)
        continue;
      if (!isCompatibleOverride(override.browsersJSON))
        throw incompatibleOverrideError(override);
      overrides.push(override);
    } catch (e) {
      error ??= e;
    }
  }
  return { overrides, error };
}

function parseBrowsersJSON(file: string, content: string): BrowsersJSON {
  let json: any;
  try {
    json = JSON.parse(content);
  } catch (e) {
    throw new Error(`Failed to parse ${file}: ${e.message}`);
  }
  if (!json || typeof json !== 'object' || !Array.isArray(json.browsers))
    throw new Error(`Invalid ${file}: expected an object with a "browsers" array`);
  for (const entry of json.browsers) {
    if (!entry || typeof entry.name !== 'string' || typeof entry.revision !== 'string')
      throw new Error(`Invalid ${file}: each browser must have a "name" and a "revision" string`);
    if (entry.name.startsWith('chromium') && typeof entry.browserVersion !== 'string')
      throw new Error(`Invalid ${file}: "${entry.name}" must have a "browserVersion" string`);
  }
  return json;
}

function readBrowsersJSONOverride(dir: string): BrowsersJSONOverride | undefined {
  const file = path.join(dir, kBrowsersJSONFileName);
  let content: string;
  try {
    content = fs.readFileSync(file, 'utf-8');
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR')
      return undefined;
    throw e;
  }
  return { dir, browsersJSON: parseBrowsersJSON(file, content) };
}

function packageBrowsersJSON(): BrowsersJSON {
  return require(path.join(packageRoot, kBrowsersJSONFileName));
}

function downloadSocketTimeout(): number {
  const downloadSocketTimeoutEnv = getFromENV('PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT');
  return +(downloadSocketTimeoutEnv || '0') || NET_DEFAULT_TIMEOUT;
}

function stubLatestBrowsersJSON(): string {
  const browsersJSON: BrowsersJSON = {
    playwrightVersion: packageJSON.version,
    browsers: packageBrowsersJSON().browsers.map(({ name, revision, browserVersion, title, revisionOverrides }) => {
      return { name, revision, browserVersion, title, revisionOverrides };
    }),
  };
  return JSON.stringify(browsersJSON);
}

async function fetchLatestBrowsersJSON(): Promise<BrowsersJSON> {
  const host = getFromENV('PLAYWRIGHT_DOWNLOAD_HOST') || PLAYWRIGHT_STORAGE_BUCKET;
  const url = `${host}/builds/browser-updates/v${minorVersion(packageJSON.version)}/${kBrowsersJSONFileName}`;
  const retryCount = 5;
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= retryCount; ++attempt) {
    debugLogger.log('install', `fetching latest browser versions from ${url} - attempt #${attempt}`);
    try {
      const content = getAsBooleanFromENV('PWTEST_STUB_LATEST_BROWSERS') ? stubLatestBrowsersJSON() : await fetchData(undefined, {
        url,
        headers: { 'User-Agent': getUserAgent() },
        socketTimeout: downloadSocketTimeout(),
      }, async (params, response) => {
        const error = new Error(`server returned code ${response.statusCode}. URL: ${params.url}`);
        (error as any).statusCode = response.statusCode;
        return error;
      });
      return parseBrowsersJSON(url, content);
    } catch (e) {
      debugLogger.log('install', `attempt #${attempt} - ERROR: ${e.message}`);
      if (e.statusCode === 404)
        throw new Error(`No browser updates are available for Playwright ${packageJSON.version}. Update Playwright to the latest version instead.`);
      lastError = e;
    }
  }
  throw new Error(`Failed to fetch the latest browser versions from ${url}, caused by\n${lastError!.stack}`);
}

export async function pinLatestBrowsers(executableNames: string[]): Promise<string> {
  const latest = await fetchLatestBrowsersJSON();
  if (!isCompatibleOverride(latest))
    throw new Error(`Latest browser versions were published for Playwright ${latest.playwrightVersion}, but the current version is ${packageJSON.version}`);
  let existing: BrowsersJSONOverride | undefined;
  try {
    existing = readBrowsersJSONOverride(localOverrideDirectory);
  } catch {
    // Malformed file is replaced.
  }
  // Keep entries for other browsers, unless they were pinned for another Playwright version.
  const browsers = existing && isCompatibleOverride(existing.browsersJSON) ? [...existing.browsersJSON.browsers] : [];
  for (const name of executableNames) {
    const entry = latest.browsers.find(b => b.name === name);
    if (!entry)
      continue;
    const index = browsers.findIndex(b => b.name === name);
    if (index === -1)
      browsers.push(entry);
    else
      browsers[index] = entry;
  }
  const browsersJSON: BrowsersJSON = {
    comment: `Browser versions pinned by "playwright install --latest". Remove this file to use the default versions.`,
    playwrightVersion: packageJSON.version,
    browsers,
  };
  const file = path.join(localOverrideDirectory, kBrowsersJSONFileName);
  await fs.promises.mkdir(localOverrideDirectory, { recursive: true });
  await fs.promises.writeFile(file, JSON.stringify(browsersJSON, null, 2) + '\n');
  return file;
}

export type BrowserName = 'chromium' | 'firefox' | 'webkit';
const allDownloadableDirectoriesThatEverExisted = ['android', 'chromium', 'firefox', 'webkit', 'ffmpeg', 'firefox-beta', 'chromium-tip-of-tree', 'chromium-headless-shell', 'chromium-tip-of-tree-headless-shell', 'winldd'];
const chromiumAliases = ['chrome-for-testing'];

export interface Executable {
  name: string;
  browserName: BrowserName | undefined;
  installType: 'download-by-default' | 'download-on-demand' | 'install-script' | 'none';
  directory: string | undefined;
  downloadURLs?: string[],
  title?: string,
  revision?: string,
  browserVersion?: string,
  executablePathOrDie(sdkLanguage: string): string;
  executablePath(): string | undefined;
  _validateHostRequirements(sdkLanguage: string): Promise<void>;
  wslExecutablePath?: string
}

interface ExecutableImpl extends Executable {
  _install?: (force: boolean) => Promise<void>;
  _dependencyGroup?: DependencyGroup;
  _isHermeticInstallation?: boolean;
  _overrideDir?: string;
}

export class Registry {
  private _executables!: ExecutableImpl[];
  private _overrideError: Error | undefined;

  constructor() {
    this.reload();
  }

  // Re-reads the package "browsers.json" and all the override files.
  reload() {
    const { overrides, error } = readOverrides();
    this._overrideError = error;
    this._initialize(packageBrowsersJSON(), overrides);
  }

  private _initialize(browsersJSON: BrowsersJSON, overrides: BrowsersJSONOverride[]) {
    const descriptors = readDescriptors(browsersJSON, overrides);
    const findExecutablePath = (dir: string, name: keyof typeof EXECUTABLE_PATHS) => {
      const tokens = EXECUTABLE_PATHS[name][shortPlatform];
      return tokens ? path.join(dir, ...tokens) : undefined;
    };
    const executablePathOrDie = (name: string, e: string | undefined, installByDefault: boolean, sdkLanguage: string) => {
      if (this._overrideError)
        throw this._overrideError;
      if (!e)
        throw new Error(`${name} is not supported on ${hostPlatform}`);
      const installCommand = buildPlaywrightCLICommand(sdkLanguage, `install${installByDefault ? '' : ' ' + name}`);
      if (!canAccessFile(e)) {
        const currentDockerVersion = readDockerVersionSync();
        const preferredDockerVersion = currentDockerVersion ? dockerVersion(currentDockerVersion.dockerImageNameTemplate) : null;
        const isOutdatedDockerImage = currentDockerVersion && preferredDockerVersion && currentDockerVersion.dockerImageName !== preferredDockerVersion.dockerImageName;
        const isFfmpeg = name === 'ffmpeg';
        let prettyMessage;
        if (isOutdatedDockerImage) {
          prettyMessage = [
            `Looks like Playwright was just updated to ${preferredDockerVersion.driverVersion}.`,
            `Please update docker image as well.`,
            `-  current: ${currentDockerVersion.dockerImageName}`,
            `- required: ${preferredDockerVersion.dockerImageName}`,
            ``,
            `<3 Playwright Team`,
          ].join('\n');
        } else if (isFfmpeg) {
          prettyMessage = [
            `Video rendering requires ffmpeg binary.`,
            `Downloading it will not affect any of the system-wide settings.`,
            `Please run the following command:`,
            ``,
            `    ${buildPlaywrightCLICommand(sdkLanguage, 'install ffmpeg')}`,
            ``,
            `<3 Playwright Team`,
          ].join('\n');
        } else {
          prettyMessage = [
            `Looks like Playwright was just installed or updated.`,
            `Please run the following command to download new browser${installByDefault ? 's' : ''}:`,
            ``,
            `    ${installCommand}`,
            ``,
            `<3 Playwright Team`,
          ].join('\n');
        }
        throw new Error(`Executable doesn't exist at ${e}\n${wrapInASCIIBox(prettyMessage, 1)}`);
      }
      return e;
    };
    this._executables = [];

    const chromium = descriptors.find(d => d.name === 'chromium')!;
    const chromiumExecutable = findExecutablePath(chromium.dir, 'chromium');
    this._executables.push({
      name: 'chromium',
      browserName: 'chromium',
      directory: chromium.dir,
      executablePath: () => chromiumExecutable,
      executablePathOrDie: (sdkLanguage: string) => executablePathOrDie('chromium', chromiumExecutable, chromium.installByDefault, sdkLanguage),
      installType: chromium.installByDefault ? 'download-by-default' : 'download-on-demand',
      _validateHostRequirements: (sdkLanguage: string) => this._validateHostRequirements(sdkLanguage, chromium.dir, ['chrome-linux'], [], ['chrome-win']),
      downloadURLs: this._downloadURLs(chromium),
      title: chromium.title,
      revision: chromium.revision,
      browserVersion: chromium.browserVersion,
      _install: force => this._downloadExecutable(chromium, force, chromiumExecutable),
      _overrideDir: chromium.overrideDir,
      _dependencyGroup: 'chromium',
      _isHermeticInstallation: true,
    });

    const chromiumHeadlessShell = descriptors.find(d => d.name === 'chromium-headless-shell')!;
    const chromiumHeadlessShellExecutable = findExecutablePath(chromiumHeadlessShell.dir, 'chromium-headless-shell');
    this._executables.push({
      name: 'chromium-headless-shell',
      browserName: 'chromium',
      directory: chromiumHeadlessShell.dir,
      executablePath: () => chromiumHeadlessShellExecutable,
      executablePathOrDie: (sdkLanguage: string) => executablePathOrDie('chromium', chromiumHeadlessShellExecutable, chromiumHeadlessShell.installByDefault, sdkLanguage),
      installType: chromiumHeadlessShell.installByDefault ? 'download-by-default' : 'download-on-demand',
      _validateHostRequirements: (sdkLanguage: string) => this._validateHostRequirements(sdkLanguage, chromiumHeadlessShell.dir, ['chrome-linux'], [], ['chrome-win']),
      downloadURLs: this._downloadURLs(chromiumHeadlessShell),
      title: chromiumHeadlessShell.title,
      revision: chromiumHeadlessShell.revision,
      browserVersion: chromiumHeadlessShell.browserVersion,
      _install: force => this._downloadExecutable(chromiumHeadlessShell, force, chromiumHeadlessShellExecutable),
      _overrideDir: chromiumHeadlessShell.overrideDir,
      _dependencyGroup: 'chromium',
      _isHermeticInstallation: true,
    });

    this._executables.push(this._createChromiumChannel('chrome', {
      'linux': '/opt/google/chrome/chrome',
      'darwin': '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      'win32': `\\Google\\Chrome\\Application\\chrome.exe`,
    }, () => this._installChromiumChannel('chrome', {
      'linux': 'reinstall_chrome_stable_linux.sh',
      'darwin': 'reinstall_chrome_stable_mac.sh',
      'win32': 'reinstall_chrome_stable_win.ps1',
    })));

    this._executables.push(this._createChromiumChannel('chrome-beta', {
      'linux': '/opt/google/chrome-beta/chrome',
      'darwin': '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
      'win32': `\\Google\\Chrome Beta\\Application\\chrome.exe`,
    }, () => this._installChromiumChannel('chrome-beta', {
      'linux': 'reinstall_chrome_beta_linux.sh',
      'darwin': 'reinstall_chrome_beta_mac.sh',
      'win32': 'reinstall_chrome_beta_win.ps1',
    })));

    this._executables.push(this._createChromiumChannel('chrome-dev', {
      'linux': '/opt/google/chrome-unstable/chrome',
      'darwin': '/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev',
      'win32': `\\Google\\Chrome Dev\\Application\\chrome.exe`,
    }));

    this._executables.push(this._createChromiumChannel('chrome-canary', {
      'linux': '/opt/google/chrome-canary/chrome',
      'darwin': '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      'win32': `\\Google\\Chrome SxS\\Application\\chrome.exe`,
    }));

    this._executables.push(this._createChromiumChannel('msedge', {
      'linux': '/opt/microsoft/msedge/msedge',
      'darwin': '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      'win32': `\\Microsoft\\Edge\\Application\\msedge.exe`,
    }, () => this._installMSEdgeChannel('msedge', {
      'linux': 'reinstall_msedge_stable_linux.sh',
      'darwin': 'reinstall_msedge_stable_mac.sh',
      'win32': 'reinstall_msedge_stable_win.ps1',
    })));

    this._executables.push(this._createChromiumChannel('msedge-beta', {
      'linux': '/opt/microsoft/msedge-beta/msedge',
      'darwin': '/Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta',
      'win32': `\\Microsoft\\Edge Beta\\Application\\msedge.exe`,
    }, () => this._installMSEdgeChannel('msedge-beta', {
      'darwin': 'reinstall_msedge_beta_mac.sh',
      'linux': 'reinstall_msedge_beta_linux.sh',
      'win32': 'reinstall_msedge_beta_win.ps1',
    })));

    this._executables.push(this._createChromiumChannel('msedge-dev', {
      'linux': '/opt/microsoft/msedge-dev/msedge',
      'darwin': '/Applications/Microsoft Edge Dev.app/Contents/MacOS/Microsoft Edge Dev',
      'win32': `\\Microsoft\\Edge Dev\\Application\\msedge.exe`,
    }, () => this._installMSEdgeChannel('msedge-dev', {
      'darwin': 'reinstall_msedge_dev_mac.sh',
      'linux': 'reinstall_msedge_dev_linux.sh',
      'win32': 'reinstall_msedge_dev_win.ps1',
    })));

    this._executables.push(this._createChromiumChannel('msedge-canary', {
      'linux': '',
      'darwin': '/Applications/Microsoft Edge Canary.app/Contents/MacOS/Microsoft Edge Canary',
      'win32': `\\Microsoft\\Edge SxS\\Application\\msedge.exe`,
    }));

    this._executables.push(this._createBidiFirefoxChannel('moz-firefox', {
      'linux': '/snap/bin/firefox',
      'darwin': '/Applications/Firefox.app/Contents/MacOS/firefox',
      'win32': '\\Mozilla Firefox\\firefox.exe',
    }));
    this._executables.push(this._createBidiFirefoxChannel('moz-firefox-beta', {
      'linux': '/opt/firefox-beta/firefox',
      'darwin': '/Applications/Firefox.app/Contents/MacOS/firefox',
      'win32': '\\Mozilla Firefox\\firefox.exe',
    }));
    this._executables.push(this._createBidiFirefoxChannel('moz-firefox-nightly', {
      'linux': '/opt/firefox-nightly/firefox',
      'darwin': '/Applications/Firefox Nightly.app/Contents/MacOS/firefox',
      'win32': '\\Mozilla Firefox\\firefox.exe',
    }));

    const firefox = descriptors.find(d => d.name === 'firefox')!;
    const firefoxExecutable = findExecutablePath(firefox.dir, 'firefox');
    this._executables.push({
      name: 'firefox',
      browserName: 'firefox',
      directory: firefox.dir,
      executablePath: () => firefoxExecutable,
      executablePathOrDie: (sdkLanguage: string) => executablePathOrDie('firefox', firefoxExecutable, firefox.installByDefault, sdkLanguage),
      installType: firefox.installByDefault ? 'download-by-default' : 'download-on-demand',
      _validateHostRequirements: (sdkLanguage: string) => this._validateHostRequirements(sdkLanguage, firefox.dir, ['firefox'], [], ['firefox']),
      downloadURLs: this._downloadURLs(firefox),
      title: firefox.title,
      revision: firefox.revision,
      browserVersion: firefox.browserVersion,
      _install: force => this._downloadExecutable(firefox, force, firefoxExecutable),
      _overrideDir: firefox.overrideDir,
      _dependencyGroup: 'firefox',
      _isHermeticInstallation: true,
    });

    const webkit = descriptors.find(d => d.name === 'webkit')!;
    const webkitExecutable = findExecutablePath(webkit.dir, 'webkit');
    const webkitLinuxLddDirectories = [
      path.join('minibrowser-gtk'),
      path.join('minibrowser-gtk', 'bin'),
      path.join('minibrowser-gtk', 'lib'),
      path.join('minibrowser-gtk', 'sys', 'lib'),
      path.join('minibrowser-wpe'),
      path.join('minibrowser-wpe', 'bin'),
      path.join('minibrowser-wpe', 'lib'),
      path.join('minibrowser-wpe', 'sys', 'lib'),
    ];
    this._executables.push({
      name: 'webkit',
      browserName: 'webkit',
      directory: webkit.dir,
      executablePath: () => webkitExecutable,
      executablePathOrDie: (sdkLanguage: string) => executablePathOrDie('webkit', webkitExecutable, webkit.installByDefault, sdkLanguage),
      installType: webkit.installByDefault ? 'download-by-default' : 'download-on-demand',
      _validateHostRequirements: (sdkLanguage: string) => this._validateHostRequirements(sdkLanguage, webkit.dir, webkitLinuxLddDirectories, ['libGLESv2.so.2', 'libx264.so'], ['']),
      downloadURLs: this._downloadURLs(webkit),
      title: webkit.title,
      revision: webkit.revision,
      browserVersion: webkit.browserVersion,
      _install: force => this._downloadExecutable(webkit, force, webkitExecutable),
      _overrideDir: webkit.overrideDir,
      _dependencyGroup: 'webkit',
      _isHermeticInstallation: true,
    });
    const wslExecutable = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wsl.exe') : undefined;
    this._executables.push({
      name: 'webkit-wsl',
      browserName: 'webkit',
      directory: webkit.dir,
      executablePath: () => wslExecutable,
      executablePathOrDie: () => {
        if (!wslExecutable)
          throw new Error(`webkit-wsl is only supported on Windows`);
        return wslExecutable;
      },
      // WebKit is installed inside the WSL distribution by install_webkit_wsl.ps1.
      wslExecutablePath: `/home/pwuser/.cache/ms-playwright/webkit-${webkit.revision}/pw_run.sh`,
      installType: 'download-on-demand',
      title: 'Webkit in WSL',
      _validateHostRequirements: (sdkLanguage: string) => Promise.resolve(),
      _isHermeticInstallation: true,
      _install: async () => {
        if (process.platform !== 'win32')
          throw new Error(`WebKit via WSL is only supported on Windows`);
        const script = path.join(BIN_PATH, 'install_webkit_wsl.ps1');
        const { code } = await spawnAsync('powershell.exe', [
          '-ExecutionPolicy', 'Bypass',
          '-File', script,
        ], {
          stdio: 'inherit',
        });
        if (code !== 0)
          throw new Error(`Failed to install WebKit via WSL`);
      },
    });

    const ffmpeg = descriptors.find(d => d.name === 'ffmpeg')!;
    const ffmpegExecutable = findExecutablePath(ffmpeg.dir, 'ffmpeg');
    this._executables.push({
      name: 'ffmpeg',
      browserName: undefined,
      directory: ffmpeg.dir,
      executablePath: () => ffmpegExecutable,
      executablePathOrDie: (sdkLanguage: string) => executablePathOrDie('ffmpeg', ffmpegExecutable, ffmpeg.installByDefault, sdkLanguage),
      installType: ffmpeg.installByDefault ? 'download-by-default' : 'download-on-demand',
      _validateHostRequirements: () => Promise.resolve(),
      downloadURLs: this._downloadURLs(ffmpeg),
      title: ffmpeg.title,
      revision: ffmpeg.revision,
      _install: force => this._downloadExecutable(ffmpeg, force, ffmpegExecutable),
      _overrideDir: ffmpeg.overrideDir,
      _dependencyGroup: 'tools',
      _isHermeticInstallation: true,
    });
    const winldd = descriptors.find(d => d.name === 'winldd')!;
    const winlddExecutable = findExecutablePath(winldd.dir, 'winldd');
    this._executables.push({
      name: 'winldd',
      browserName: undefined,
      directory: winldd.dir,
      executablePath: () => winlddExecutable,
      executablePathOrDie: (sdkLanguage: string) => executablePathOrDie('winldd', winlddExecutable, winldd.installByDefault, sdkLanguage),
      installType: process.platform === 'win32' ? 'download-by-default' : 'none',
      _validateHostRequirements: () => Promise.resolve(),
      downloadURLs: this._downloadURLs(winldd),
      title: winldd.title,
      revision: winldd.revision,
      _install: force => this._downloadExecutable(winldd, force, winlddExecutable),
      _overrideDir: winldd.overrideDir,
      _dependencyGroup: 'tools',
      _isHermeticInstallation: true,
    });
    const android = descriptors.find(d => d.name === 'android')!;
    this._executables.push({
      name: 'android',
      browserName: undefined,
      directory: android.dir,
      executablePath: () => undefined,
      executablePathOrDie: () => '',
      installType: 'download-on-demand',
      _validateHostRequirements: () => Promise.resolve(),
      downloadURLs: this._downloadURLs(android),
      title: android.title,
      revision: android.revision,
      _install: force => this._downloadExecutable(android, force),
      _overrideDir: android.overrideDir,
      _dependencyGroup: 'tools',
      _isHermeticInstallation: true,
    });
  }

  private _createChromiumChannel(name: string, lookAt: Record<'linux' | 'darwin' | 'win32', string>, install?: () => Promise<void>): ExecutableImpl {
    const executablePath = (sdkLanguage: string, shouldThrow: boolean) => {
      const suffix = lookAt[process.platform as 'linux' | 'darwin' | 'win32'];
      if (!suffix) {
        if (shouldThrow)
          throw new Error(`Chromium distribution '${name}' is not supported on ${process.platform}`);
        return undefined;
      }
      const prefixes = (process.platform === 'win32' ? [
        process.env.LOCALAPPDATA,
        process.env.PROGRAMFILES,
        process.env['PROGRAMFILES(X86)'],
        // In some cases there is no PROGRAMFILES/(86) env var set but HOMEDRIVE is set.
        process.env.HOMEDRIVE + '\\Program Files',
        process.env.HOMEDRIVE + '\\Program Files (x86)',
      ].filter(Boolean) : ['']) as string[];

      for (const prefix of prefixes) {
        const executablePath = path.join(prefix, suffix);
        if (canAccessFile(executablePath))
          return executablePath;
      }
      if (!shouldThrow)
        return undefined;

      const location = prefixes.length ? ` at ${path.join(prefixes[0], suffix)}` : ``;
      const installation = install ? `\nRun "${buildPlaywrightCLICommand(sdkLanguage, 'install ' + name)}"` : '';
      throw new Error(`Chromium distribution '${name}' is not found${location}${installation}`);
    };
    return {
      name,
      browserName: 'chromium',
      directory: undefined,
      executablePath: () => executablePath('', false),
      executablePathOrDie: (sdkLanguage: string) => executablePath(sdkLanguage, true)!,
      installType: install ? 'install-script' : 'none',
      _validateHostRequirements: () => Promise.resolve(),
      _isHermeticInstallation: false,
      _install: install,
    };
  }

  private _createBidiFirefoxChannel(name: string, lookAt: Record<'linux' | 'darwin' | 'win32', string>, install?: () => Promise<void>): ExecutableImpl {
    const executablePath = (sdkLanguage: string, shouldThrow: boolean) => {
      const suffix = lookAt[process.platform as 'linux' | 'darwin' | 'win32'];
      if (!suffix) {
        if (shouldThrow)
          throw new Error(`Firefox distribution '${name}' is not supported on ${process.platform}`);
        return undefined;
      }
      const prefixes = (process.platform === 'win32' ? [
        process.env.LOCALAPPDATA,
        process.env.PROGRAMFILES,
        process.env['PROGRAMFILES(X86)'],
        // In some cases there is no PROGRAMFILES/(86) env var set but HOMEDRIVE is set.
        process.env.HOMEDRIVE + '\\Program Files',
        process.env.HOMEDRIVE + '\\Program Files (x86)',
      ].filter(Boolean) : ['']) as string[];

      for (const prefix of prefixes) {
        const executablePath = path.join(prefix, suffix);
        if (canAccessFile(executablePath))
          return executablePath;
      }
      if (shouldThrow)
        throw new Error(`Cannot find Firefox installation for channel '${name}' at the standard system paths. ${`Tried paths:\n  ${prefixes.map(p => path.join(p, suffix)).join('\n  ')}`}`);
      return undefined;
    };
    return {
      name,
      browserName: 'firefox',
      directory: undefined,
      executablePath: () => executablePath('', false),
      executablePathOrDie: (sdkLanguage: string) => executablePath(sdkLanguage, true)!,
      installType: 'none',
      _validateHostRequirements: () => Promise.resolve(),
      _isHermeticInstallation: true,
      _install: install,
    };
  }

  executables(): Executable[] {
    return this._executables;
  }

  findExecutable(name: BrowserName): Executable;
  findExecutable(name: string): Executable | undefined;
  findExecutable(name: string): Executable | undefined {
    return this._executables.find(b => b.name === name);
  }

  defaultExecutables(): Executable[] {
    return this._executables.filter(e => e.installType === 'download-by-default');
  }

  private _dedupe(executables: Executable[]): ExecutableImpl[] {
    return Array.from(new Set(executables as ExecutableImpl[]));
  }

  private _overrideDirectories(executables: ExecutableImpl[]): string[] {
    return [...new Set(executables.map(e => e._overrideDir).filter((dir): dir is string => !!dir))];
  }

  private async _validateHostRequirements(sdkLanguage: string, browserDirectory: string, linuxLddDirectories: string[], dlOpenLibraries: string[], windowsExeAndDllDirectories: string[]) {
    if (os.platform() === 'linux')
      return await validateDependenciesLinux(sdkLanguage, linuxLddDirectories.map(d => path.join(browserDirectory, d)), dlOpenLibraries);
    if (os.platform() === 'win32' && os.arch() === 'x64')
      return await validateDependenciesWindows(sdkLanguage, windowsExeAndDllDirectories.map(d => path.join(browserDirectory, d)));
  }

  async installDeps(executablesToInstallDeps: Executable[], dryRun: boolean) {
    const executables = this._dedupe(executablesToInstallDeps);
    const targets = new Set<DependencyGroup>();
    for (const executable of executables) {
      if (executable._dependencyGroup)
        targets.add(executable._dependencyGroup);
    }
    targets.add('tools');
    if (os.platform() === 'win32')
      return await installDependenciesWindows(targets, dryRun);
    if (os.platform() === 'linux')
      return await installDependenciesLinux(targets, dryRun);
  }

  async install(executablesToInstall: Executable[], options?: { force?: boolean, gc?: boolean }) {
    const executables = this._dedupe(executablesToInstall);
    if (this._overrideError)
      throw this._overrideError;
    await fs.promises.mkdir(registryDirectory, { recursive: true });
    const lockfilePath = path.join(registryDirectory, '__dirlock');
    const linksDir = path.join(registryDirectory, '.links');

    let releaseLock;
    try {
      releaseLock = await lock(registryDirectory, {
        retries: {
          // Retry 20 times during 10 minutes with
          // exponential back-off.
          // See documentation at: https://www.npmjs.com/package/retry#retrytimeoutsoptions
          retries: 20,
          factor: 1.27579,
        },
        onCompromised: (err: Error) => {
          throw new Error(`${err.message} Path: ${lockfilePath}`);
        },
        lockfilePath,
      });
      // Create a link first, so that cache validation does not remove our own browsers.
      await fs.promises.mkdir(linksDir, { recursive: true });
      await fs.promises.writeFile(path.join(linksDir, calculateSha1(PACKAGE_PATH)), PACKAGE_PATH);
      // Also link "browsers.json" overrides, so that their browsers are retained too.
      for (const overrideDir of this._overrideDirectories(executables)) {
        await fs.promises.writeFile(path.join(linksDir, calculateSha1(overrideDir)), overrideDir);
        const { embedderName } = getEmbedderName();
        const command = buildPlaywrightCLICommand(embedderName, 'install --latest');
        logPolitely(`Using browser versions from ${path.join(overrideDir, kBrowsersJSONFileName)}. Remove this file to use the default versions, or run "${command}" to update to the latest versions.`);
      }

      // Remove stale browsers.
      if (options?.gc !== false && !getAsBooleanFromENV('PLAYWRIGHT_SKIP_BROWSER_GC'))
        await this._validateInstallationCache(linksDir);

      // Install browsers for this package.
      for (const executable of executables) {
        if (!executable._install)
          throw new Error(`ERROR: Playwright does not support installing ${executable.name}`);

        if (!getAsBooleanFromENV('CI') && !executable._isHermeticInstallation && !options?.force && executable.executablePath()) {
          const { embedderName } = getEmbedderName();
          const command = buildPlaywrightCLICommand(embedderName, 'install --force ' + executable.name);
          // eslint-disable-next-line no-restricted-properties
          process.stderr.write('\n' + wrapInASCIIBox([
            `ATTENTION: "${executable.name}" is already installed on the system!`,
            ``,
            `"${executable.name}" installation is not hermetic; installing newer version`,
            `requires *removal* of a current installation first.`,
            ``,
            `To *uninstall* current version and re-install latest "${executable.name}":`,
            ``,
            `- Close all running instances of "${executable.name}", if any`,
            `- Use "--force" to install browser:`,
            ``,
            `    ${command}`,
            ``,
            `<3 Playwright Team`,
          ].join('\n'), 1) + '\n\n');
          return;
        }
        await executable._install(!!options?.force);
      }
    } catch (e) {
      if (e.code === 'ELOCKED') {
        const rmCommand = process.platform === 'win32' ? 'rm -R' : 'rm -rf';
        throw new Error('\n' + wrapInASCIIBox([
          `An active lockfile is found at:`,
          ``,
          `  ${lockfilePath}`,
          ``,
          `Either:`,
          `- wait a few minutes if other Playwright is installing browsers in parallel`,
          `- remove lock manually with:`,
          ``,
          `    ${rmCommand} ${lockfilePath}`,
          ``,
          `<3 Playwright Team`,
        ].join('\n'), 1));
      } else {
        if (!releaseLock && (e.code === 'EACCES' || e.code === 'EROFS'))
          e.message += '\nSet PLAYWRIGHT_BROWSERS_PATH to a writable directory.';
        throw e;
      }
    } finally {
      if (releaseLock)
        await releaseLock();
    }
  }

  async uninstall(all: boolean): Promise<{ numberOfBrowsersLeft: number }> {
    const linksDir = path.join(registryDirectory, '.links');
    if (all) {
      const links = await fs.promises.readdir(linksDir).catch(() => []);
      for (const link of links)
        await fs.promises.unlink(path.join(linksDir, link));
    } else {
      await fs.promises.unlink(path.join(linksDir, calculateSha1(PACKAGE_PATH))).catch(() => {});
      await fs.promises.unlink(path.join(linksDir, calculateSha1(localOverrideDirectory))).catch(() => {});
    }

    // Remove stale browsers.
    await this._validateInstallationCache(linksDir);

    return {
      numberOfBrowsersLeft: (await fs.promises.readdir(registryDirectory).catch(() => [])).filter(browserDirectory => isBrowserDirectory(browserDirectory)).length
    };
  }

  async validateHostRequirementsForExecutablesIfNeeded(executables: Executable[], sdkLanguage: string) {
    if (getAsBooleanFromENV('PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS')) {
      // eslint-disable-next-line no-restricted-properties
      process.stderr.write('Skipping host requirements validation logic because `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS` env variable is set.\n');
      return;
    }
    const errors: Error[] = [];
    for (const executable of executables) {
      try {
        await this._validateHostRequirementsForExecutableIfNeeded(executable, sdkLanguage);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1)
      throw errors[0];
    if (errors.length)
      throw new Error(errors.map(error => error.message).join('\n'));
  }

  private async _validateHostRequirementsForExecutableIfNeeded(executable: Executable, sdkLanguage: string) {
    const kMaximumReValidationPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days
    // Executable does not require validation.
    if (!executable.directory)
      return;
    const markerFile = path.join(executable.directory, 'DEPENDENCIES_VALIDATED');
    // Executable is already validated.
    if (await fs.promises.stat(markerFile).then(stat => (Date.now() - stat.mtime.getTime()) < kMaximumReValidationPeriod).catch(() => false))
      return;

    debugLogger.log('install', `validating host requirements for "${executable.name}"`);
    try {
      await executable._validateHostRequirements(sdkLanguage);
      debugLogger.log('install', `validation passed for ${executable.name}`);
    } catch (error) {
      debugLogger.log('install', `validation failed for ${executable.name}`);
      throw error;
    }

    await fs.promises.writeFile(markerFile, '').catch(() => {});
  }

  private _downloadURLs(descriptor: BrowsersJSONDescriptor): string[] {
    const paths = (DOWNLOAD_PATHS as any)[descriptor.name];
    const downloadPathTemplate: string|DownloadPathFunction|undefined = paths[hostPlatform] || paths['<unknown>'];
    if (!downloadPathTemplate)
      return [];
    let downloadPath: string;
    let mirrors: string[];
    if (typeof downloadPathTemplate === 'function') {
      const result = downloadPathTemplate(descriptor);
      downloadPath = result.path;
      mirrors = result.mirrors;
    } else {
      downloadPath = util.format(downloadPathTemplate, descriptor.revision);
      mirrors = PLAYWRIGHT_CDN_MIRRORS;
    }

    let downloadHostEnv;
    if (descriptor.name.startsWith('chromium'))
      downloadHostEnv = 'PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST';
    else if (descriptor.name.startsWith('firefox'))
      downloadHostEnv = 'PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST';
    else if (descriptor.name.startsWith('webkit'))
      downloadHostEnv = 'PLAYWRIGHT_WEBKIT_DOWNLOAD_HOST';

    const customHostOverride = (downloadHostEnv && getFromENV(downloadHostEnv)) || getFromENV('PLAYWRIGHT_DOWNLOAD_HOST');
    if (customHostOverride)
      mirrors = [customHostOverride];

    return mirrors.map(mirror => `${mirror}/${downloadPath}`);
  }

  private async _downloadExecutable(descriptor: BrowsersJSONDescriptor, force: boolean, executablePath?: string) {
    const downloadURLs = this._downloadURLs(descriptor);
    if (!downloadURLs.length)
      throw new Error(`ERROR: Playwright does not support ${descriptor.name} on ${hostPlatform}`);
    if (!isOfficiallySupportedPlatform)
      logPolitely(`BEWARE: your OS is not officially supported by Playwright; downloading fallback build for ${hostPlatform}.`);
    if (descriptor.hasRevisionOverride) {
      const message = `You are using a frozen ${descriptor.name} browser which does not receive updates anymore on ${hostPlatform}. Please update to the latest version of your operating system to test up-to-date browsers.`;
      if (process.env.GITHUB_ACTIONS)
        console.log(`::warning title=Playwright::${message}`);  // eslint-disable-line no-console
      else
        logPolitely(message);
    }

    const title = this.calculateDownloadTitle(descriptor);
    const downloadFileName = `playwright-download-${descriptor.name}-${hostPlatform}-${descriptor.revision}.zip`;
    await downloadBrowserWithProgressBar(title, descriptor.dir, executablePath, downloadURLs, downloadFileName, downloadSocketTimeout(), force).catch(e => {
      throw new Error(`Failed to download ${title}, caused by\n${e.stack}`);
    });
  }

  calculateDownloadTitle(descriptor: BrowsersJSONDescriptor | Executable) {
    const title = descriptor.title ?? descriptor.name.split('-').map(word => {
      return word === 'ffmpeg' ? 'FFmpeg' : word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
    const version = descriptor.browserVersion ? ' ' + descriptor.browserVersion : '';
    return `${title}${version} (playwright ${descriptor.name} v${descriptor.revision})`;
  }

  private async _installMSEdgeChannel(channel: 'msedge'|'msedge-beta'|'msedge-dev', scripts: Record<'linux' | 'darwin' | 'win32', string>) {
    const scriptArgs: string[] = [];
    if (process.platform !== 'linux') {
      const products = lowercaseAllKeys(JSON.parse(await fetchData(undefined, { url: 'https://edgeupdates.microsoft.com/api/products' })));

      const productName = {
        'msedge': 'Stable',
        'msedge-beta': 'Beta',
        'msedge-dev': 'Dev',
      }[channel];
      const product = products.find((product: any) => product.product === productName);
      const searchConfig = ({
        darwin: { platform: 'MacOS', arch: 'universal', artifact: 'pkg' },
        win32: { platform: 'Windows', arch: 'x64', artifact: 'msi' },
      } as any)[process.platform];
      const release = searchConfig ? product.releases.find((release: any) => release.platform === searchConfig.platform && release.architecture === searchConfig.arch && release.artifacts.length > 0) : null;
      const artifact = release ? release.artifacts.find((artifact: any) => artifact.artifactname === searchConfig.artifact) : null;
      if (artifact)
        scriptArgs.push(artifact.location /* url */);
      else
        throw new Error(`Cannot install ${channel} on ${process.platform}`);
    }
    await this._installChromiumChannel(channel, scripts, scriptArgs);
  }

  private async _installChromiumChannel(channel: string, scripts: Record<'linux' | 'darwin' | 'win32', string>, scriptArgs: string[] = []) {
    const scriptName = scripts[process.platform as 'linux' | 'darwin' | 'win32'];
    if (!scriptName)
      throw new Error(`Cannot install ${channel} on ${process.platform}`);
    const cwd = BIN_PATH;
    const isPowerShell = scriptName.endsWith('.ps1');
    if (isPowerShell) {
      const args = [
        '-ExecutionPolicy', 'Bypass', '-File',
        path.join(BIN_PATH, scriptName),
        ...scriptArgs
      ];
      const { code } = await spawnAsync('powershell.exe', args, { cwd, stdio: 'inherit' });
      if (code !== 0)
        throw new Error(`Failed to install ${channel}`);
    } else {
      const shellArgs = scriptArgs.map(a => `'${a.replace(/'/g, `'\\''`)}'`).join(' ');
      const { command, args, elevatedPermissions } = await transformCommandsForRoot([`bash "${path.join(BIN_PATH, scriptName)}" ${shellArgs}`]);
      if (elevatedPermissions)
        console.log('Switching to root user to install dependencies...'); // eslint-disable-line no-console
      const { code } = await spawnAsync(command, args, { cwd, stdio: 'inherit' });
      if (code !== 0)
        throw new Error(`Failed to install ${channel}`);
    }
  }

  async listInstalledBrowsers() {
    const linksDir = path.join(registryDirectory, '.links');
    const { browsers } = await this._traverseBrowserInstallations(linksDir);
    return browsers.filter(browser => fs.existsSync(browser.browserPath));
  }

  private async _validateInstallationCache(linksDir: string) {
    const { browsers, brokenLinks } = await this._traverseBrowserInstallations(linksDir);
    await this._deleteStaleBrowsers(browsers);
    await this._deleteBrokenInstallations(brokenLinks);
  }

  private async _traverseBrowserInstallations(linksDir: string): Promise<{ browsers: BrowserInfo[], brokenLinks: string[] }> {
    const browserList: BrowserInfo[] = [];
    const brokenLinks: string[] = [];
    for (const fileName of await fs.promises.readdir(linksDir)) {
      const linkPath = path.join(linksDir, fileName);
      let linkTarget = '';
      try {
        linkTarget = (await fs.promises.readFile(linkPath)).toString();
        const browsersJSON: BrowsersJSON = JSON.parse(await fs.promises.readFile(path.join(linkTarget, kBrowsersJSONFileName), 'utf-8'));
        const descriptors = readDescriptors(browsersJSON);
        for (const browserName of allDownloadableDirectoriesThatEverExisted) {
          // We retain browsers if they are found in the descriptor.
          // Note, however, that there are older versions out in the wild that rely on
          // the "download" field in the browser descriptor and use its value
          // to retain and download browsers.
          // As of v1.10, we decided to abandon "download" field.
          const descriptor = descriptors.find(d => d.name === browserName);
          if (!descriptor)
            continue;

          const browserPath = descriptor.dir;
          const browserVersion = parseInt(descriptor.revision, 10);
          browserList.push({
            browserName,
            browserVersion,
            browserPath,
            referenceDir: linkTarget,
          });
        }
      } catch (e) {
        brokenLinks.push(linkPath);
      }
    }

    return { browsers: browserList, brokenLinks };
  }

  private async _deleteStaleBrowsers(browserList: BrowserInfo[]) {
    const usedBrowserPaths: Set<string> = new Set();
    for (const browser of browserList) {
      const { browserName, browserVersion, browserPath } = browser;

      // Old browser installations don't have marker file.
      // We switched chromium from 999999 to 1000, 300000 is the new Y2K.
      const shouldHaveMarkerFile = (browserName === 'chromium' && (browserVersion >= 786218 || browserVersion < 300000)) ||
          (browserName === 'firefox' && browserVersion >= 1128) ||
          (browserName === 'webkit' && browserVersion >= 1307) ||
          // All new applications have a marker file right away.
          (browserName !== 'firefox' && browserName !== 'chromium' && browserName !== 'webkit');
      if (!shouldHaveMarkerFile || (await existsAsync(browserDirectoryToMarkerFilePath(browserPath))))
        usedBrowserPaths.add(browserPath);
    }

    let downloadedBrowsers = (await fs.promises.readdir(registryDirectory)).map(file => path.join(registryDirectory, file));
    downloadedBrowsers = downloadedBrowsers.filter(file => isBrowserDirectory(file));
    const directories = new Set<string>(downloadedBrowsers);
    for (const browserDirectory of usedBrowserPaths)
      directories.delete(browserDirectory);
    for (const directory of directories)
      logPolitely('Removing unused browser at ' + directory);
    await removeFolders([...directories]);
  }

  private async _deleteBrokenInstallations(brokenLinks: string[]) {
    for (const linkPath of brokenLinks)
      await fs.promises.unlink(linkPath).catch(e => {});
  }

  private _defaultBrowsersToInstall(options: { shell?: 'no' | 'only' }): Executable[] {
    let executables = this.defaultExecutables();
    if (options.shell === 'no')
      executables = executables.filter(e => e.name !== 'chromium-headless-shell');
    if (options.shell === 'only')
      executables = executables.filter(e => e.name !== 'chromium');
    return executables;
  }

  suggestedBrowsersToInstall(): string {
    const names: string[] = this.executables().filter(e => e.installType !== 'none').map(e => e.name);
    names.push(...chromiumAliases);
    return names.sort().join(', ');
  }

  isChromiumAlias(name: string): boolean {
    return chromiumAliases.includes(name);
  }

  resolveBrowsers(aliases: string[], options: { shell?: 'no' | 'only' }): Executable[] {
    if (aliases.length === 0)
      return this._defaultBrowsersToInstall(options);

    const faultyArguments: string[] = [];
    const executables: Executable[] = [];
    const handleArgument = (arg: string) => {
      const executable = this.findExecutable(arg);
      if (!executable || executable.installType === 'none')
        faultyArguments.push(arg);
      else
        executables.push(executable);
      if (executable?.browserName)
        executables.push(this.findExecutable('ffmpeg')!);
    };

    for (const alias of aliases) {
      if (alias === 'chromium' || chromiumAliases.includes(alias)) {
        if (options.shell !== 'only')
          handleArgument('chromium');
        if (options.shell !== 'no')
          handleArgument('chromium-headless-shell');
      } else {
        handleArgument(alias);
      }
    }

    if (process.platform === 'win32')
      executables.push(this.findExecutable('winldd')!);

    if (faultyArguments.length)
      throw new Error(`Invalid installation targets: ${faultyArguments.map(name => `'${name}'`).join(', ')}. Expecting one of: ${this.suggestedBrowsersToInstall()}`);
    return [...new Set(executables)];
  }
}

export function browserDirectoryToMarkerFilePath(browserDirectory: string): string {
  return path.join(browserDirectory, 'INSTALLATION_COMPLETE');
}

export function buildPlaywrightCLICommand(sdkLanguage: string, parameters: string): string {
  switch (sdkLanguage) {
    case 'python':
      return `playwright ${parameters}`;
    case 'java':
      return `mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="${parameters}"`;
    case 'csharp':
      return `pwsh bin/Debug/netX/playwright.ps1 ${parameters}`;
    default: {
      const packageManagerCommand = getPackageManagerExecCommand();
      return `${packageManagerCommand} playwright ${parameters}`;
    }
  }
}

export async function installBrowsersForNpmInstall(browsers: string[]) {
  // PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD should have a value of 0 or 1
  if (getAsBooleanFromENV('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD')) {
    logPolitely('Skipping browsers download because `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` env variable is set');
    return false;
  }
  const executables: Executable[] = [];
  if (process.platform === 'win32')
    executables.push(registry.findExecutable('winldd')!);
  for (const browserName of browsers) {
    const executable = registry.findExecutable(browserName);
    if (!executable || executable.installType === 'none')
      throw new Error(`Cannot install ${browserName}`);
    executables.push(executable);
  }

  await registry.install(executables);
}

// for launchApp -> UI Mode / Trace Viewer
export function findChromiumChannelBestEffort(sdkLanguage: string): string | undefined {
  // Fall back to the stable channels of popular vendors to work out of the box.
  // Null means no installation and no channels found.
  let channel = null;
  for (const name of ['chromium', 'chrome', 'msedge']) {
    try {
      registry.findExecutable(name)!.executablePathOrDie(sdkLanguage);
      channel = name === 'chromium' ? undefined : name;
      break;
    } catch (e) {
    }
  }

  if (channel === null) {
    const installCommand = buildPlaywrightCLICommand(sdkLanguage, `install chromium`);
    const prettyMessage = [
      `No chromium-based browser found on the system.`,
      `Please run the following command to download one:`,
      ``,
      `    ${installCommand}`,
      ``,
      `<3 Playwright Team`,
    ].join('\n');
    throw new Error('\n' + wrapInASCIIBox(prettyMessage, 1));
  }
  return channel;
}

function lowercaseAllKeys(json: any): any {
  if (typeof json !== 'object' || !json)
    return json;

  if (Array.isArray(json))
    return json.map(lowercaseAllKeys);

  const result: any = {};
  for (const [key, value] of Object.entries(json))
    result[key.toLowerCase()] = lowercaseAllKeys(value);
  return result;
}

export const registry = new Registry();

export { runOopDownloadBrowserMain } from './oopDownloadBrowserMain';
