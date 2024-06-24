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

import * as os from 'os';
import path from 'path';
import * as util from 'util';
import * as fs from 'fs';
import { lockfile } from '../../utilsBundle';
import { fetchData } from '../../utils/network';
import { getEmbedderName } from '../../utils/userAgent';
import { getFromENV, getAsBooleanFromENV, calculateSha1, wrapInASCIIBox, getPackageManagerExecCommand } from '../../utils';
import { removeFolders, existsAsync, canAccessFile } from '../../utils/fileUtils';
import { type HostPlatform, hostPlatform, isOfficiallySupportedPlatform } from '../../utils/hostPlatform';
import { spawnAsync } from '../../utils/spawnAsync';
import type { DependencyGroup } from './dependencies';
import { transformCommandsForRoot, dockerVersion, readDockerVersionSync } from './dependencies';
import { installDependenciesLinux, installDependenciesWindows, validateDependenciesLinux, validateDependenciesWindows } from './dependencies';
import { downloadBrowserWithProgressBar, logPolitely } from './browserFetcher';
export { writeDockerVersion } from './dependencies';
import { debugLogger } from '../../utils/debugLogger';

const PACKAGE_PATH = path.join(__dirname, '..', '..', '..');
const BIN_PATH = path.join(__dirname, '..', '..', '..', 'bin');

const PLAYWRIGHT_CDN_MIRRORS = [
  'https://playwright.azureedge.net',
  'https://playwright-akamai.azureedge.net',
  'https://playwright-verizon.azureedge.net',
];

if (process.env.PW_TEST_CDN_THAT_SHOULD_WORK) {
  for (let i = 0; i < PLAYWRIGHT_CDN_MIRRORS.length; i++) {
    const cdn = PLAYWRIGHT_CDN_MIRRORS[i];
    if (cdn !== process.env.PW_TEST_CDN_THAT_SHOULD_WORK)
      PLAYWRIGHT_CDN_MIRRORS[i] = cdn + '.does-not-resolve.playwright.dev';
  }
}

const EXECUTABLE_PATHS = {
  'chromium': {
    'linux': ['chrome-linux', 'chrome'],
    'mac': ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
    'win': ['chrome-win', 'chrome.exe'],
  },
  'firefox': {
    'linux': ['firefox', 'firefox'],
    'mac': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
    'win': ['firefox', 'firefox.exe'],
  },
  'webkit': {
    'linux': ['pw_run.sh'],
    'mac': ['pw_run.sh'],
    'win': ['Playwright.exe'],
  },
  'ffmpeg': {
    'linux': ['ffmpeg-linux'],
    'mac': ['ffmpeg-mac'],
    'win': ['ffmpeg-win64.exe'],
  },
};

type DownloadPaths = Record<HostPlatform, string | undefined>;
const DOWNLOAD_PATHS: Record<BrowserName | InternalTool, DownloadPaths> = {
  'chromium': {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': 'builds/chromium/%s/chromium-linux.zip',
    'ubuntu22.04-x64': 'builds/chromium/%s/chromium-linux.zip',
    'ubuntu24.04-x64': 'builds/chromium/%s/chromium-linux.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': 'builds/chromium/%s/chromium-linux-arm64.zip',
    'ubuntu22.04-arm64': 'builds/chromium/%s/chromium-linux-arm64.zip',
    'ubuntu24.04-arm64': 'builds/chromium/%s/chromium-linux-arm64.zip',
    'debian11-x64': 'builds/chromium/%s/chromium-linux.zip',
    'debian11-arm64': 'builds/chromium/%s/chromium-linux-arm64.zip',
    'debian12-x64': 'builds/chromium/%s/chromium-linux.zip',
    'debian12-arm64': 'builds/chromium/%s/chromium-linux-arm64.zip',
    'mac10.13': 'builds/chromium/%s/chromium-mac.zip',
    'mac10.14': 'builds/chromium/%s/chromium-mac.zip',
    'mac10.15': 'builds/chromium/%s/chromium-mac.zip',
    'mac11': 'builds/chromium/%s/chromium-mac.zip',
    'mac11-arm64': 'builds/chromium/%s/chromium-mac-arm64.zip',
    'mac12': 'builds/chromium/%s/chromium-mac.zip',
    'mac12-arm64': 'builds/chromium/%s/chromium-mac-arm64.zip',
    'mac13': 'builds/chromium/%s/chromium-mac.zip',
    'mac13-arm64': 'builds/chromium/%s/chromium-mac-arm64.zip',
    'mac14': 'builds/chromium/%s/chromium-mac.zip',
    'mac14-arm64': 'builds/chromium/%s/chromium-mac-arm64.zip',
    'win64': 'builds/chromium/%s/chromium-win64.zip',
  },
  'chromium-tip-of-tree': {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux.zip',
    'ubuntu22.04-x64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux.zip',
    'ubuntu24.04-x64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux-arm64.zip',
    'ubuntu22.04-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux-arm64.zip',
    'ubuntu24.04-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux-arm64.zip',
    'debian11-x64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux.zip',
    'debian11-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux-arm64.zip',
    'debian12-x64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux.zip',
    'debian12-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux-arm64.zip',
    'mac10.13': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac.zip',
    'mac10.14': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac.zip',
    'mac10.15': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac.zip',
    'mac11': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac.zip',
    'mac11-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac-arm64.zip',
    'mac12': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac.zip',
    'mac12-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac-arm64.zip',
    'mac13': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac.zip',
    'mac13-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac-arm64.zip',
    'mac14': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac.zip',
    'mac14-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac-arm64.zip',
    'win64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-win64.zip',
  },
  'firefox': {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': 'builds/firefox/%s/firefox-ubuntu-20.04.zip',
    'ubuntu22.04-x64': 'builds/firefox/%s/firefox-ubuntu-22.04.zip',
    'ubuntu24.04-x64': 'builds/firefox/%s/firefox-ubuntu-24.04.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': 'builds/firefox/%s/firefox-ubuntu-20.04-arm64.zip',
    'ubuntu22.04-arm64': 'builds/firefox/%s/firefox-ubuntu-22.04-arm64.zip',
    'ubuntu24.04-arm64': 'builds/firefox/%s/firefox-ubuntu-24.04-arm64.zip',
    'debian11-x64': 'builds/firefox/%s/firefox-debian-11.zip',
    'debian11-arm64': 'builds/firefox/%s/firefox-debian-11-arm64.zip',
    'debian12-x64': 'builds/firefox/%s/firefox-debian-12.zip',
    'debian12-arm64': 'builds/firefox/%s/firefox-debian-12-arm64.zip',
    'mac10.13': 'builds/firefox/%s/firefox-mac.zip',
    'mac10.14': 'builds/firefox/%s/firefox-mac.zip',
    'mac10.15': 'builds/firefox/%s/firefox-mac.zip',
    'mac11': 'builds/firefox/%s/firefox-mac.zip',
    'mac11-arm64': 'builds/firefox/%s/firefox-mac-arm64.zip',
    'mac12': 'builds/firefox/%s/firefox-mac.zip',
    'mac12-arm64': 'builds/firefox/%s/firefox-mac-arm64.zip',
    'mac13': 'builds/firefox/%s/firefox-mac.zip',
    'mac13-arm64': 'builds/firefox/%s/firefox-mac-arm64.zip',
    'mac14': 'builds/firefox/%s/firefox-mac.zip',
    'mac14-arm64': 'builds/firefox/%s/firefox-mac-arm64.zip',
    'win64': 'builds/firefox/%s/firefox-win64.zip',
  },
  'firefox-beta': {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': 'builds/firefox-beta/%s/firefox-beta-ubuntu-20.04.zip',
    'ubuntu22.04-x64': 'builds/firefox-beta/%s/firefox-beta-ubuntu-22.04.zip',
    'ubuntu24.04-x64': 'builds/firefox-beta/%s/firefox-beta-ubuntu-24.04.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': undefined,
    'ubuntu22.04-arm64': 'builds/firefox-beta/%s/firefox-beta-ubuntu-22.04-arm64.zip',
    'ubuntu24.04-arm64': 'builds/firefox-beta/%s/firefox-beta-ubuntu-24.04-arm64.zip',
    'debian11-x64': 'builds/firefox-beta/%s/firefox-beta-debian-11.zip',
    'debian11-arm64': 'builds/firefox-beta/%s/firefox-beta-debian-11-arm64.zip',
    'debian12-x64': 'builds/firefox-beta/%s/firefox-beta-debian-12.zip',
    'debian12-arm64': 'builds/firefox-beta/%s/firefox-beta-debian-12-arm64.zip',
    'mac10.13': 'builds/firefox-beta/%s/firefox-beta-mac.zip',
    'mac10.14': 'builds/firefox-beta/%s/firefox-beta-mac.zip',
    'mac10.15': 'builds/firefox-beta/%s/firefox-beta-mac.zip',
    'mac11': 'builds/firefox-beta/%s/firefox-beta-mac.zip',
    'mac11-arm64': 'builds/firefox-beta/%s/firefox-beta-mac-arm64.zip',
    'mac12': 'builds/firefox-beta/%s/firefox-beta-mac.zip',
    'mac12-arm64': 'builds/firefox-beta/%s/firefox-beta-mac-arm64.zip',
    'mac13': 'builds/firefox-beta/%s/firefox-beta-mac.zip',
    'mac13-arm64': 'builds/firefox-beta/%s/firefox-beta-mac-arm64.zip',
    'mac14': 'builds/firefox-beta/%s/firefox-beta-mac.zip',
    'mac14-arm64': 'builds/firefox-beta/%s/firefox-beta-mac-arm64.zip',
    'win64': 'builds/firefox-beta/%s/firefox-beta-win64.zip',
  },
  'webkit': {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': 'builds/webkit/%s/webkit-ubuntu-20.04.zip',
    'ubuntu22.04-x64': 'builds/webkit/%s/webkit-ubuntu-22.04.zip',
    'ubuntu24.04-x64': 'builds/webkit/%s/webkit-ubuntu-24.04.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': 'builds/webkit/%s/webkit-ubuntu-20.04-arm64.zip',
    'ubuntu22.04-arm64': 'builds/webkit/%s/webkit-ubuntu-22.04-arm64.zip',
    'ubuntu24.04-arm64': 'builds/webkit/%s/webkit-ubuntu-24.04-arm64.zip',
    'debian11-x64': 'builds/webkit/%s/webkit-debian-11.zip',
    'debian11-arm64': 'builds/webkit/%s/webkit-debian-11-arm64.zip',
    'debian12-x64': 'builds/webkit/%s/webkit-debian-12.zip',
    'debian12-arm64': 'builds/webkit/%s/webkit-debian-12-arm64.zip',
    'mac10.13': undefined,
    'mac10.14': 'builds/deprecated-webkit-mac-10.14/%s/deprecated-webkit-mac-10.14.zip',
    'mac10.15': 'builds/deprecated-webkit-mac-10.15/%s/deprecated-webkit-mac-10.15.zip',
    'mac11': 'builds/webkit/%s/webkit-mac-11.zip',
    'mac11-arm64': 'builds/webkit/%s/webkit-mac-11-arm64.zip',
    'mac12': 'builds/webkit/%s/webkit-mac-12.zip',
    'mac12-arm64': 'builds/webkit/%s/webkit-mac-12-arm64.zip',
    'mac13': 'builds/webkit/%s/webkit-mac-13.zip',
    'mac13-arm64': 'builds/webkit/%s/webkit-mac-13-arm64.zip',
    'mac14': 'builds/webkit/%s/webkit-mac-14.zip',
    'mac14-arm64': 'builds/webkit/%s/webkit-mac-14-arm64.zip',
    'win64': 'builds/webkit/%s/webkit-win64.zip',
  },
  'ffmpeg': {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': 'builds/ffmpeg/%s/ffmpeg-linux.zip',
    'ubuntu22.04-x64': 'builds/ffmpeg/%s/ffmpeg-linux.zip',
    'ubuntu24.04-x64': 'builds/ffmpeg/%s/ffmpeg-linux.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': 'builds/ffmpeg/%s/ffmpeg-linux-arm64.zip',
    'ubuntu22.04-arm64': 'builds/ffmpeg/%s/ffmpeg-linux-arm64.zip',
    'ubuntu24.04-arm64': 'builds/ffmpeg/%s/ffmpeg-linux-arm64.zip',
    'debian11-x64': 'builds/ffmpeg/%s/ffmpeg-linux.zip',
    'debian11-arm64': 'builds/ffmpeg/%s/ffmpeg-linux-arm64.zip',
    'debian12-x64': 'builds/ffmpeg/%s/ffmpeg-linux.zip',
    'debian12-arm64': 'builds/ffmpeg/%s/ffmpeg-linux-arm64.zip',
    'mac10.13': 'builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac10.14': 'builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac10.15': 'builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac11': 'builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac11-arm64': 'builds/ffmpeg/%s/ffmpeg-mac-arm64.zip',
    'mac12': 'builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac12-arm64': 'builds/ffmpeg/%s/ffmpeg-mac-arm64.zip',
    'mac13': 'builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac13-arm64': 'builds/ffmpeg/%s/ffmpeg-mac-arm64.zip',
    'mac14': 'builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac14-arm64': 'builds/ffmpeg/%s/ffmpeg-mac-arm64.zip',
    'win64': 'builds/ffmpeg/%s/ffmpeg-win64.zip',
  },
  'android': {
    '<unknown>': 'builds/android/%s/android.zip',
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': 'builds/android/%s/android.zip',
    'ubuntu22.04-x64': 'builds/android/%s/android.zip',
    'ubuntu24.04-x64': 'builds/android/%s/android.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': 'builds/android/%s/android.zip',
    'ubuntu22.04-arm64': 'builds/android/%s/android.zip',
    'ubuntu24.04-arm64': 'builds/android/%s/android.zip',
    'debian11-x64': 'builds/android/%s/android.zip',
    'debian11-arm64': 'builds/android/%s/android.zip',
    'debian12-x64': 'builds/android/%s/android.zip',
    'debian12-arm64': 'builds/android/%s/android.zip',
    'mac10.13': 'builds/android/%s/android.zip',
    'mac10.14': 'builds/android/%s/android.zip',
    'mac10.15': 'builds/android/%s/android.zip',
    'mac11': 'builds/android/%s/android.zip',
    'mac11-arm64': 'builds/android/%s/android.zip',
    'mac12': 'builds/android/%s/android.zip',
    'mac12-arm64': 'builds/android/%s/android.zip',
    'mac13': 'builds/android/%s/android.zip',
    'mac13-arm64': 'builds/android/%s/android.zip',
    'mac14': 'builds/android/%s/android.zip',
    'mac14-arm64': 'builds/android/%s/android.zip',
    'win64': 'builds/android/%s/android.zip',
  },
};

export const registryDirectory = (() => {
  let result: string;

  const envDefined = getFromENV('PLAYWRIGHT_BROWSERS_PATH');
  if (envDefined === '0') {
    result = path.join(__dirname, '..', '..', '..', '.local-browsers');
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

function isBrowserDirectory(browserDirectory: string): boolean {
  const baseName = path.basename(browserDirectory);
  for (const browserName of allDownloadable) {
    if (baseName.startsWith(browserName + '-'))
      return true;
  }
  return false;
}

type BrowsersJSON = {
  comment: string
  browsers: {
    name: string,
    revision: string,
    browserVersion?: string,
    installByDefault: boolean,
    revisionOverrides?: {[os: string]: string},
  }[]
};

type BrowsersJSONDescriptor = {
  name: string,
  revision: string,
  browserVersion?: string,
  installByDefault: boolean,
  dir: string,
};

function readDescriptors(browsersJSON: BrowsersJSON) {
  return (browsersJSON['browsers']).map(obj => {
    const name = obj.name;
    const revisionOverride = (obj.revisionOverrides || {})[hostPlatform];
    const revision = revisionOverride || obj.revision;
    const browserDirectoryPrefix = revisionOverride ? `${name}_${hostPlatform}_special` : `${name}`;
    const descriptor: BrowsersJSONDescriptor = {
      name,
      revision,
      // We only put browser version for the supported operating systems.
      browserVersion: revisionOverride ? undefined : obj.browserVersion,
      installByDefault: !!obj.installByDefault,
      // Method `isBrowserDirectory` determines directory to be browser iff
      // it starts with some browser name followed by '-'. Some browser names
      // are prefixes of others, e.g. 'webkit' is a prefix of `webkit-technology-preview`.
      // To avoid older registries erroneously removing 'webkit-technology-preview', we have to
      // ensure that browser folders to never include dashes inside.
      dir: path.join(registryDirectory, browserDirectoryPrefix.replace(/-/g, '_') + '-' + revision),
    };
    return descriptor;
  });
}

export type BrowserName = 'chromium' | 'firefox' | 'webkit';
type InternalTool = 'ffmpeg' | 'firefox-beta' | 'chromium-tip-of-tree' | 'android';
type ChromiumChannel = 'chrome' | 'chrome-beta' | 'chrome-dev' | 'chrome-canary' | 'msedge' | 'msedge-beta' | 'msedge-dev' | 'msedge-canary';
const allDownloadable = ['chromium', 'firefox', 'webkit', 'ffmpeg', 'firefox-beta', 'chromium-tip-of-tree'];

export interface Executable {
  type: 'browser' | 'tool' | 'channel';
  name: BrowserName | InternalTool | ChromiumChannel;
  browserName: BrowserName | undefined;
  installType: 'download-by-default' | 'download-on-demand' | 'install-script' | 'none';
  directory: string | undefined;
  downloadURLs?: string[],
  browserVersion?: string,
  executablePathOrDie(sdkLanguage: string): string;
  executablePath(sdkLanguage: string): string | undefined;
  _validateHostRequirements(sdkLanguage: string): Promise<void>;
}

interface ExecutableImpl extends Executable {
  _install?: () => Promise<void>;
  _dependencyGroup?: DependencyGroup;
  _isHermeticInstallation?: boolean;
}

export class Registry {
  private _executables: ExecutableImpl[];

  constructor(browsersJSON: BrowsersJSON) {
    const descriptors = readDescriptors(browsersJSON);
    const findExecutablePath = (dir: string, name: keyof typeof EXECUTABLE_PATHS) => {
      let tokens = undefined;
      if (process.platform === 'linux')
        tokens = EXECUTABLE_PATHS[name]['linux'];
      else if (process.platform === 'darwin')
        tokens = EXECUTABLE_PATHS[name]['mac'];
      else if (process.platform === 'win32')
        tokens = EXECUTABLE_PATHS[name]['win'];
      return tokens ? path.join(dir, ...tokens) : undefined;
    };
    const executablePathOrDie = (name: string, e: string | undefined, installByDefault: boolean, sdkLanguage: string) => {
      if (!e)
        throw new Error(`${name} is not supported on ${hostPlatform}`);
      const installCommand = buildPlaywrightCLICommand(sdkLanguage, `install${installByDefault ? '' : ' ' + name}`);
      if (!canAccessFile(e)) {
        const currentDockerVersion = readDockerVersionSync();
        const preferredDockerVersion = currentDockerVersion ? dockerVersion(currentDockerVersion.dockerImageNameTemplate) : null;
        const isOutdatedDockerImage = currentDockerVersion && preferredDockerVersion && currentDockerVersion.dockerImageName !== preferredDockerVersion.dockerImageName;
        const prettyMessage = isOutdatedDockerImage ? [
          `Looks like ${sdkLanguage === 'javascript' ? 'Playwright Test or ' : ''}Playwright was just updated to ${preferredDockerVersion.driverVersion}.`,
          `Please update docker image as well.`,
          `-  current: ${currentDockerVersion.dockerImageName}`,
          `- required: ${preferredDockerVersion.dockerImageName}`,
          ``,
          `<3 Playwright Team`,
        ].join('\n') : [
          `Looks like ${sdkLanguage === 'javascript' ? 'Playwright Test or ' : ''}Playwright was just installed or updated.`,
          `Please run the following command to download new browser${installByDefault ? 's' : ''}:`,
          ``,
          `    ${installCommand}`,
          ``,
          `<3 Playwright Team`,
        ].join('\n');
        throw new Error(`Executable doesn't exist at ${e}\n${wrapInASCIIBox(prettyMessage, 1)}`);
      }
      return e;
    };
    this._executables = [];

    const chromium = descriptors.find(d => d.name === 'chromium')!;
    const chromiumExecutable = findExecutablePath(chromium.dir, 'chromium');
    this._executables.push({
      type: 'browser',
      name: 'chromium',
      browserName: 'chromium',
      directory: chromium.dir,
      executablePath: () => chromiumExecutable,
      executablePathOrDie: (sdkLanguage: string) => executablePathOrDie('chromium', chromiumExecutable, chromium.installByDefault, sdkLanguage),
      installType: chromium.installByDefault ? 'download-by-default' : 'download-on-demand',
      _validateHostRequirements: (sdkLanguage: string) => this._validateHostRequirements(sdkLanguage, 'chromium', chromium.dir, ['chrome-linux'], [], ['chrome-win']),
      downloadURLs: this._downloadURLs(chromium),
      browserVersion: chromium.browserVersion,
      _install: () => this._downloadExecutable(chromium, chromiumExecutable),
      _dependencyGroup: 'chromium',
      _isHermeticInstallation: true,
    });

    const chromiumTipOfTree = descriptors.find(d => d.name === 'chromium-tip-of-tree')!;
    const chromiumTipOfTreeExecutable = findExecutablePath(chromiumTipOfTree.dir, 'chromium');
    this._executables.push({
      type: 'tool',
      name: 'chromium-tip-of-tree',
      browserName: 'chromium',
      directory: chromiumTipOfTree.dir,
      executablePath: () => chromiumTipOfTreeExecutable,
      executablePathOrDie: (sdkLanguage: string) => executablePathOrDie('chromium-tip-of-tree', chromiumTipOfTreeExecutable, chromiumTipOfTree.installByDefault, sdkLanguage),
      installType: chromiumTipOfTree.installByDefault ? 'download-by-default' : 'download-on-demand',
      _validateHostRequirements: (sdkLanguage: string) => this._validateHostRequirements(sdkLanguage, 'chromium', chromiumTipOfTree.dir, ['chrome-linux'], [], ['chrome-win']),
      downloadURLs: this._downloadURLs(chromiumTipOfTree),
      browserVersion: chromiumTipOfTree.browserVersion,
      _install: () => this._downloadExecutable(chromiumTipOfTree, chromiumTipOfTreeExecutable),
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
      'linux': '',
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

    const firefox = descriptors.find(d => d.name === 'firefox')!;
    const firefoxExecutable = findExecutablePath(firefox.dir, 'firefox');
    this._executables.push({
      type: 'browser',
      name: 'firefox',
      browserName: 'firefox',
      directory: firefox.dir,
      executablePath: () => firefoxExecutable,
      executablePathOrDie: (sdkLanguage: string) => executablePathOrDie('firefox', firefoxExecutable, firefox.installByDefault, sdkLanguage),
      installType: firefox.installByDefault ? 'download-by-default' : 'download-on-demand',
      _validateHostRequirements: (sdkLanguage: string) => this._validateHostRequirements(sdkLanguage, 'firefox', firefox.dir, ['firefox'], [], ['firefox']),
      downloadURLs: this._downloadURLs(firefox),
      browserVersion: firefox.browserVersion,
      _install: () => this._downloadExecutable(firefox, firefoxExecutable),
      _dependencyGroup: 'firefox',
      _isHermeticInstallation: true,
    });

    const firefoxBeta = descriptors.find(d => d.name === 'firefox-beta')!;
    const firefoxBetaExecutable = findExecutablePath(firefoxBeta.dir, 'firefox');
    this._executables.push({
      type: 'tool',
      name: 'firefox-beta',
      browserName: 'firefox',
      directory: firefoxBeta.dir,
      executablePath: () => firefoxBetaExecutable,
      executablePathOrDie: (sdkLanguage: string) => executablePathOrDie('firefox-beta', firefoxBetaExecutable, firefoxBeta.installByDefault, sdkLanguage),
      installType: firefoxBeta.installByDefault ? 'download-by-default' : 'download-on-demand',
      _validateHostRequirements: (sdkLanguage: string) => this._validateHostRequirements(sdkLanguage, 'firefox', firefoxBeta.dir, ['firefox'], [], ['firefox']),
      downloadURLs: this._downloadURLs(firefoxBeta),
      browserVersion: firefoxBeta.browserVersion,
      _install: () => this._downloadExecutable(firefoxBeta, firefoxBetaExecutable),
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
      type: 'browser',
      name: 'webkit',
      browserName: 'webkit',
      directory: webkit.dir,
      executablePath: () => webkitExecutable,
      executablePathOrDie: (sdkLanguage: string) => executablePathOrDie('webkit', webkitExecutable, webkit.installByDefault, sdkLanguage),
      installType: webkit.installByDefault ? 'download-by-default' : 'download-on-demand',
      _validateHostRequirements: (sdkLanguage: string) => this._validateHostRequirements(sdkLanguage, 'webkit', webkit.dir, webkitLinuxLddDirectories, ['libGLESv2.so.2', 'libx264.so'], ['']),
      downloadURLs: this._downloadURLs(webkit),
      browserVersion: webkit.browserVersion,
      _install: () => this._downloadExecutable(webkit, webkitExecutable),
      _dependencyGroup: 'webkit',
      _isHermeticInstallation: true,
    });

    const ffmpeg = descriptors.find(d => d.name === 'ffmpeg')!;
    const ffmpegExecutable = findExecutablePath(ffmpeg.dir, 'ffmpeg');
    this._executables.push({
      type: 'tool',
      name: 'ffmpeg',
      browserName: undefined,
      directory: ffmpeg.dir,
      executablePath: () => ffmpegExecutable,
      executablePathOrDie: (sdkLanguage: string) => executablePathOrDie('ffmpeg', ffmpegExecutable, ffmpeg.installByDefault, sdkLanguage),
      installType: ffmpeg.installByDefault ? 'download-by-default' : 'download-on-demand',
      _validateHostRequirements: () => Promise.resolve(),
      downloadURLs: this._downloadURLs(ffmpeg),
      _install: () => this._downloadExecutable(ffmpeg, ffmpegExecutable),
      _dependencyGroup: 'tools',
      _isHermeticInstallation: true,
    });
    const android = descriptors.find(d => d.name === 'android')!;
    this._executables.push({
      type: 'tool',
      name: 'android',
      browserName: undefined,
      directory: android.dir,
      executablePath: () => undefined,
      executablePathOrDie: () => '',
      installType: 'download-on-demand',
      _validateHostRequirements: () => Promise.resolve(),
      downloadURLs: this._downloadURLs(android),
      _install: () => this._downloadExecutable(android),
      _dependencyGroup: 'tools',
      _isHermeticInstallation: true,
    });
  }

  private _createChromiumChannel(name: ChromiumChannel, lookAt: Record<'linux' | 'darwin' | 'win32', string>, install?: () => Promise<void>): ExecutableImpl {
    const executablePath = (sdkLanguage: string, shouldThrow: boolean) => {
      const suffix = lookAt[process.platform as 'linux' | 'darwin' | 'win32'];
      if (!suffix) {
        if (shouldThrow)
          throw new Error(`Chromium distribution '${name}' is not supported on ${process.platform}`);
        return undefined;
      }
      const prefixes = (process.platform === 'win32' ? [
        process.env.LOCALAPPDATA, process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)']
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
      type: 'channel',
      name,
      browserName: 'chromium',
      directory: undefined,
      executablePath: (sdkLanguage: string) => executablePath(sdkLanguage, false),
      executablePathOrDie: (sdkLanguage: string) => executablePath(sdkLanguage, true)!,
      installType: install ? 'install-script' : 'none',
      _validateHostRequirements: () => Promise.resolve(),
      _isHermeticInstallation: false,
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

  private _addRequirementsAndDedupe(executables: Executable[]): ExecutableImpl[] {
    const set = new Set<ExecutableImpl>();
    for (const executable of executables as ExecutableImpl[]) {
      set.add(executable);
      if (executable.browserName === 'chromium')
        set.add(this.findExecutable('ffmpeg')!);
    }
    return Array.from(set);
  }

  private async _validateHostRequirements(sdkLanguage: string, browserName: BrowserName, browserDirectory: string, linuxLddDirectories: string[], dlOpenLibraries: string[], windowsExeAndDllDirectories: string[]) {
    if (os.platform() === 'linux')
      return await validateDependenciesLinux(sdkLanguage, linuxLddDirectories.map(d => path.join(browserDirectory, d)), dlOpenLibraries);
    if (os.platform() === 'win32' && os.arch() === 'x64')
      return await validateDependenciesWindows(windowsExeAndDllDirectories.map(d => path.join(browserDirectory, d)));
  }

  async installDeps(executablesToInstallDeps: Executable[], dryRun: boolean) {
    const executables = this._addRequirementsAndDedupe(executablesToInstallDeps);
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

  async install(executablesToInstall: Executable[], forceReinstall: boolean) {
    const executables = this._addRequirementsAndDedupe(executablesToInstall);
    await fs.promises.mkdir(registryDirectory, { recursive: true });
    const lockfilePath = path.join(registryDirectory, '__dirlock');
    const linksDir = path.join(registryDirectory, '.links');

    let releaseLock;
    try {
      releaseLock = await lockfile.lock(registryDirectory, {
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

      // Remove stale browsers.
      await this._validateInstallationCache(linksDir);

      // Install browsers for this package.
      for (const executable of executables) {
        if (!executable._install)
          throw new Error(`ERROR: Playwright does not support installing ${executable.name}`);

        const { embedderName } = getEmbedderName();
        if (!getAsBooleanFromENV('CI') && !executable._isHermeticInstallation && !forceReinstall && executable.executablePath(embedderName)) {
          const command = buildPlaywrightCLICommand(embedderName, 'install --force ' + executable.name);
          throw new Error('\n' + wrapInASCIIBox([
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
          ].join('\n'), 1));
        }
        await executable._install();
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
    }

    // Remove stale browsers.
    await this._validateInstallationCache(linksDir);
    return {
      numberOfBrowsersLeft: (await fs.promises.readdir(registryDirectory).catch(() => [])).filter(browserDirectory => isBrowserDirectory(browserDirectory)).length
    };
  }

  async validateHostRequirementsForExecutablesIfNeeded(executables: Executable[], sdkLanguage: string) {
    if (getAsBooleanFromENV('PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS')) {
      process.stderr.write('Skipping host requirements validation logic because `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS` env variable is set.\n');
      return;
    }
    for (const executable of executables)
      await this._validateHostRequirementsForExecutableIfNeeded(executable, sdkLanguage);
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
    const downloadPathTemplate: string|undefined = paths[hostPlatform] || paths['<unknown>'];
    if (!downloadPathTemplate)
      return [];
    const downloadPath = util.format(downloadPathTemplate, descriptor.revision);

    let downloadURLs = PLAYWRIGHT_CDN_MIRRORS.map(mirror => `${mirror}/${downloadPath}`) ;
    let downloadHostEnv;
    if (descriptor.name.startsWith('chromium'))
      downloadHostEnv = 'PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST';
    else if (descriptor.name.startsWith('firefox'))
      downloadHostEnv = 'PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST';
    else if (descriptor.name.startsWith('webkit'))
      downloadHostEnv = 'PLAYWRIGHT_WEBKIT_DOWNLOAD_HOST';

    const customHostOverride = (downloadHostEnv && getFromENV(downloadHostEnv)) || getFromENV('PLAYWRIGHT_DOWNLOAD_HOST');
    if (customHostOverride)
      downloadURLs = [`${customHostOverride}/${downloadPath}`];
    return downloadURLs;
  }

  private async _downloadExecutable(descriptor: BrowsersJSONDescriptor, executablePath?: string) {
    const downloadURLs = this._downloadURLs(descriptor);
    if (!downloadURLs.length)
      throw new Error(`ERROR: Playwright does not support ${descriptor.name} on ${hostPlatform}`);
    if (!isOfficiallySupportedPlatform)
      logPolitely(`BEWARE: your OS is not officially supported by Playwright; downloading fallback build for ${hostPlatform}.`);

    const displayName = descriptor.name.split('-').map(word => {
      return word === 'ffmpeg' ? 'FFMPEG' : word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
    const title = descriptor.browserVersion
      ? `${displayName} ${descriptor.browserVersion} (playwright build v${descriptor.revision})`
      : `${displayName} playwright build v${descriptor.revision}`;

    const downloadFileName = `playwright-download-${descriptor.name}-${hostPlatform}-${descriptor.revision}.zip`;
    const downloadConnectionTimeoutEnv = getFromENV('PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT');
    const downloadConnectionTimeout = +(downloadConnectionTimeoutEnv || '0') || 30_000;
    await downloadBrowserWithProgressBar(title, descriptor.dir, executablePath, downloadURLs, downloadFileName, downloadConnectionTimeout).catch(e => {
      throw new Error(`Failed to download ${title}, caused by\n${e.stack}`);
    });
  }

  private async _installMSEdgeChannel(channel: 'msedge'|'msedge-beta'|'msedge-dev', scripts: Record<'linux' | 'darwin' | 'win32', string>) {
    const scriptArgs: string[] = [];
    if (process.platform !== 'linux') {
      const products = lowercaseAllKeys(JSON.parse(await fetchData({ url: 'https://edgeupdates.microsoft.com/api/products' })));

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
      const { command, args, elevatedPermissions } = await transformCommandsForRoot([`bash "${path.join(BIN_PATH, scriptName)}" ${scriptArgs.join('')}`]);
      if (elevatedPermissions)
        console.log('Switching to root user to install dependencies...'); // eslint-disable-line no-console
      const { code } = await spawnAsync(command, args, { cwd, stdio: 'inherit' });
      if (code !== 0)
        throw new Error(`Failed to install ${channel}`);
    }
  }

  private async _validateInstallationCache(linksDir: string) {
    // 1. Collect used downloads and package descriptors.
    const usedBrowserPaths: Set<string> = new Set();
    for (const fileName of await fs.promises.readdir(linksDir)) {
      const linkPath = path.join(linksDir, fileName);
      let linkTarget = '';
      try {
        linkTarget = (await fs.promises.readFile(linkPath)).toString();
        const browsersJSON = require(path.join(linkTarget, 'browsers.json'));
        const descriptors = readDescriptors(browsersJSON);
        for (const browserName of allDownloadable) {
          // We retain browsers if they are found in the descriptor.
          // Note, however, that there are older versions out in the wild that rely on
          // the "download" field in the browser descriptor and use its value
          // to retain and download browsers.
          // As of v1.10, we decided to abandon "download" field.
          const descriptor = descriptors.find(d => d.name === browserName);
          if (!descriptor)
            continue;
          const usedBrowserPath = descriptor.dir;
          const browserRevision = parseInt(descriptor.revision, 10);
          // Old browser installations don't have marker file.
          // We switched chromium from 999999 to 1000, 300000 is the new Y2K.
          const shouldHaveMarkerFile = (browserName === 'chromium' && (browserRevision >= 786218 || browserRevision < 300000)) ||
              (browserName === 'firefox' && browserRevision >= 1128) ||
              (browserName === 'webkit' && browserRevision >= 1307) ||
              // All new applications have a marker file right away.
              (browserName !== 'firefox' && browserName !== 'chromium' && browserName !== 'webkit');
          if (!shouldHaveMarkerFile || (await existsAsync(browserDirectoryToMarkerFilePath(usedBrowserPath))))
            usedBrowserPaths.add(usedBrowserPath);
        }
      } catch (e) {
        await fs.promises.unlink(linkPath).catch(e => {});
      }
    }

    // 2. Delete all unused browsers.
    if (!getAsBooleanFromENV('PLAYWRIGHT_SKIP_BROWSER_GC')) {
      let downloadedBrowsers = (await fs.promises.readdir(registryDirectory)).map(file => path.join(registryDirectory, file));
      downloadedBrowsers = downloadedBrowsers.filter(file => isBrowserDirectory(file));
      const directories = new Set<string>(downloadedBrowsers);
      for (const browserDirectory of usedBrowserPaths)
        directories.delete(browserDirectory);
      for (const directory of directories)
        logPolitely('Removing unused browser at ' + directory);
      await removeFolders([...directories]);
    }
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

export async function installDefaultBrowsersForNpmInstall() {
  const defaultBrowserNames = registry.defaultExecutables().map(e => e.name);
  return installBrowsersForNpmInstall(defaultBrowserNames);
}

export async function installBrowsersForNpmInstall(browsers: string[]) {
  // PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD should have a value of 0 or 1
  if (getAsBooleanFromENV('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD')) {
    logPolitely('Skipping browsers download because `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` env variable is set');
    return false;
  }
  const executables: Executable[] = [];
  for (const browserName of browsers) {
    const executable = registry.findExecutable(browserName);
    if (!executable || executable.installType === 'none')
      throw new Error(`Cannot install ${browserName}`);
    executables.push(executable);
  }

  await registry.install(executables, false /* forceReinstall */);
}

export function findChromiumChannel(sdkLanguage: string): string | undefined {
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

export const registry = new Registry(require('../../../browsers.json'));
