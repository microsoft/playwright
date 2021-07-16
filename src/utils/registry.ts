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
import lockfile from 'proper-lockfile';
import { getUbuntuVersion } from './ubuntuVersion';
import { getFromENV, getAsBooleanFromENV, calculateSha1, removeFolders, existsAsync, hostPlatform, canAccessFile, spawnAsync, fetchData, wrapInASCIIBox } from './utils';
import { DependencyGroup, installDependenciesLinux, installDependenciesWindows, validateDependenciesLinux, validateDependenciesWindows } from './dependencies';
import { downloadBrowserWithProgressBar, logPolitely } from './browserFetcher';

const PACKAGE_PATH = path.join(__dirname, '..', '..');
const BIN_PATH = path.join(__dirname, '..', '..', 'bin');

const EXECUTABLE_PATHS = {
  'chromium': {
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
  'firefox': {
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
  'webkit': {
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
  'ffmpeg': {
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
  'chromium': {
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
  'chromium-with-symbols': {
    'ubuntu18.04': '%s/builds/chromium/%s/chromium-with-symbols-linux.zip',
    'ubuntu20.04': '%s/builds/chromium/%s/chromium-with-symbols-linux.zip',
    'mac10.13': '%s/builds/chromium/%s/chromium-with-symbols-mac.zip',
    'mac10.14': '%s/builds/chromium/%s/chromium-with-symbols-mac.zip',
    'mac10.15': '%s/builds/chromium/%s/chromium-with-symbols-mac.zip',
    'mac11': '%s/builds/chromium/%s/chromium-with-symbols-mac.zip',
    'mac11-arm64': '%s/builds/chromium/%s/chromium-with-symbols-mac-arm64.zip',
    'win32': '%s/builds/chromium/%s/chromium-with-symbols-win32.zip',
    'win64': '%s/builds/chromium/%s/chromium-with-symbols-win64.zip',
  },
  'firefox': {
    'ubuntu18.04': '%s/builds/firefox/%s/firefox-ubuntu-18.04.zip',
    'ubuntu20.04': '%s/builds/firefox/%s/firefox-ubuntu-20.04.zip',
    'mac10.13': '%s/builds/firefox/%s/firefox-mac-10.14.zip',
    'mac10.14': '%s/builds/firefox/%s/firefox-mac-10.14.zip',
    'mac10.15': '%s/builds/firefox/%s/firefox-mac-10.14.zip',
    'mac11': '%s/builds/firefox/%s/firefox-mac-10.14.zip',
    'mac11-arm64': '%s/builds/firefox/%s/firefox-mac-11.0-arm64.zip',
    'win32': '%s/builds/firefox/%s/firefox-win32.zip',
    'win64': '%s/builds/firefox/%s/firefox-win64.zip',
  },
  'firefox-beta': {
    'ubuntu18.04': '%s/builds/firefox-beta/%s/firefox-beta-ubuntu-18.04.zip',
    'ubuntu20.04': '%s/builds/firefox-beta/%s/firefox-beta-ubuntu-20.04.zip',
    'mac10.13': '%s/builds/firefox-beta/%s/firefox-beta-mac-10.14.zip',
    'mac10.14': '%s/builds/firefox-beta/%s/firefox-beta-mac-10.14.zip',
    'mac10.15': '%s/builds/firefox-beta/%s/firefox-beta-mac-10.14.zip',
    'mac11': '%s/builds/firefox-beta/%s/firefox-beta-mac-10.14.zip',
    'mac11-arm64': '%s/builds/firefox-beta/%s/firefox-beta-mac-11.0-arm64.zip',
    'win32': '%s/builds/firefox-beta/%s/firefox-beta-win32.zip',
    'win64': '%s/builds/firefox-beta/%s/firefox-beta-win64.zip',
  },
  'webkit': {
    'ubuntu18.04': '%s/builds/webkit/%s/webkit-ubuntu-18.04.zip',
    'ubuntu20.04': '%s/builds/webkit/%s/webkit-ubuntu-20.04.zip',
    'mac10.13': undefined,
    'mac10.14': '%s/builds/deprecated-webkit-mac-10.14/%s/deprecated-webkit-mac-10.14.zip',
    'mac10.15': '%s/builds/webkit/%s/webkit-mac-10.15.zip',
    'mac11': '%s/builds/webkit/%s/webkit-mac-10.15.zip',
    'mac11-arm64': '%s/builds/webkit/%s/webkit-mac-11.0-arm64.zip',
    'win32': '%s/builds/webkit/%s/webkit-win64.zip',
    'win64': '%s/builds/webkit/%s/webkit-win64.zip',
  },
  'ffmpeg': {
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

function isBrowserDirectory(browserDirectory: string): boolean {
  const baseName = path.basename(browserDirectory);
  for (const browserName of allDownloadable) {
    if (baseName.startsWith(browserName + '-'))
      return true;
  }
  return false;
}

type BrowsersJSONDescriptor = {
  name: string,
  revision: string,
  installByDefault: boolean,
  dir: string,
};

function readDescriptors(packagePath: string) {
  const browsersJSON = require(path.join(packagePath, 'browsers.json'));
  return (browsersJSON['browsers'] as any[]).map(obj => {
    const name = obj.name;
    const revisionOverride = (obj.revisionOverrides || {})[hostPlatform];
    const revision = revisionOverride || obj.revision;
    const browserDirectoryPrefix = revisionOverride ? `${name}_${hostPlatform}_special` : `${name}`;
    const descriptor: BrowsersJSONDescriptor = {
      name,
      revision,
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
type InternalTool = 'ffmpeg' | 'firefox-beta' | 'chromium-with-symbols';
type ChromiumChannel = 'chrome' | 'chrome-beta' | 'chrome-dev' | 'chrome-canary' | 'msedge' | 'msedge-beta' | 'msedge-dev' | 'msedge-canary';
const allDownloadable = ['chromium', 'firefox', 'webkit', 'ffmpeg', 'firefox-beta', 'chromium-with-symbols'];

export interface Executable {
  type: 'browser' | 'tool' | 'channel';
  name: BrowserName | InternalTool | ChromiumChannel;
  browserName: BrowserName | undefined;
  installType: 'download-by-default' | 'download-on-demand' | 'install-script' | 'none';
  directory: string | undefined;
  executablePathOrDie(): string;
  executablePath(): string | undefined;
  validateHostRequirements(): Promise<void>;
}

interface ExecutableImpl extends Executable {
  _install?: () => Promise<void>;
  _dependencyGroup?: DependencyGroup;
}

export class Registry {
  private _executables: ExecutableImpl[];

  constructor(packagePath: string) {
    const descriptors = readDescriptors(packagePath);
    const findExecutablePath = (dir: string, name: keyof typeof EXECUTABLE_PATHS) => {
      const tokens = EXECUTABLE_PATHS[name][hostPlatform];
      return tokens ? path.join(dir, ...tokens) : undefined;
    };
    const executablePathOrDie = (name: string, e: string | undefined, installByDefault: boolean) => {
      if (!e)
        throw new Error(`${name} is not supported on ${hostPlatform}`);
      // TODO: language-specific error message
      if (!canAccessFile(e)) {
        const prettyMessage = [
          `Looks like Playwright Test or Playwright was just installed or updated.`,
          `Please run the following command to download new browser${installByDefault ? 's' : ''}:`,
          ``,
          `    npx playwright install${installByDefault ? '' : ' ' + name}`,
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
      executablePathOrDie: () => executablePathOrDie('chromium', chromiumExecutable, chromium.installByDefault),
      installType: chromium.installByDefault ? 'download-by-default' : 'download-on-demand',
      validateHostRequirements: () => this._validateHostRequirements('chromium', chromium.dir, ['chrome-linux'], [], ['chrome-win']),
      _install: () => this._downloadExecutable(chromium, chromiumExecutable, DOWNLOAD_URLS['chromium'][hostPlatform], 'PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST'),
      _dependencyGroup: 'chromium',
    });

    const chromiumWithSymbols = descriptors.find(d => d.name === 'chromium-with-symbols')!;
    const chromiumWithSymbolsExecutable = findExecutablePath(chromiumWithSymbols.dir, 'chromium');
    this._executables.push({
      type: 'tool',
      name: 'chromium-with-symbols',
      browserName: 'chromium',
      directory: chromiumWithSymbols.dir,
      executablePath: () => chromiumWithSymbolsExecutable,
      executablePathOrDie: () => executablePathOrDie('chromium-with-symbols', chromiumWithSymbolsExecutable, chromiumWithSymbols.installByDefault),
      installType: chromiumWithSymbols.installByDefault ? 'download-by-default' : 'download-on-demand',
      validateHostRequirements: () => this._validateHostRequirements('chromium', chromiumWithSymbols.dir, ['chrome-linux'], [], ['chrome-win']),
      _install: () => this._downloadExecutable(chromiumWithSymbols, chromiumWithSymbolsExecutable, DOWNLOAD_URLS['chromium-with-symbols'][hostPlatform], 'PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST'),
      _dependencyGroup: 'chromium',
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
      'linux': '',
      'darwin': '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      'win32': `\\Microsoft\\Edge\\Application\\msedge.exe`,
    }, () => this._installMSEdgeChannel('msedge', {
      'linux': '',
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
      executablePathOrDie: () => executablePathOrDie('firefox', firefoxExecutable, firefox.installByDefault),
      installType: firefox.installByDefault ? 'download-by-default' : 'download-on-demand',
      validateHostRequirements: () => this._validateHostRequirements('firefox', firefox.dir, ['firefox'], [], ['firefox']),
      _install: () => this._downloadExecutable(firefox, firefoxExecutable, DOWNLOAD_URLS['firefox'][hostPlatform], 'PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST'),
      _dependencyGroup: 'firefox',
    });

    const firefoxBeta = descriptors.find(d => d.name === 'firefox-beta')!;
    const firefoxBetaExecutable = findExecutablePath(firefoxBeta.dir, 'firefox');
    this._executables.push({
      type: 'tool',
      name: 'firefox-beta',
      browserName: 'firefox',
      directory: firefoxBeta.dir,
      executablePath: () => firefoxBetaExecutable,
      executablePathOrDie: () => executablePathOrDie('firefox-beta', firefoxBetaExecutable, firefoxBeta.installByDefault),
      installType: firefoxBeta.installByDefault ? 'download-by-default' : 'download-on-demand',
      validateHostRequirements: () => this._validateHostRequirements('firefox', firefoxBeta.dir, ['firefox'], [], ['firefox']),
      _install: () => this._downloadExecutable(firefoxBeta, firefoxBetaExecutable, DOWNLOAD_URLS['firefox-beta'][hostPlatform], 'PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST'),
      _dependencyGroup: 'firefox',
    });

    const webkit = descriptors.find(d => d.name === 'webkit')!;
    const webkitExecutable = findExecutablePath(webkit.dir, 'webkit');
    const webkitLinuxLddDirectories = [
      path.join('minibrowser-gtk'),
      path.join('minibrowser-gtk', 'bin'),
      path.join('minibrowser-gtk', 'lib'),
      path.join('minibrowser-wpe'),
      path.join('minibrowser-wpe', 'bin'),
      path.join('minibrowser-wpe', 'lib'),
    ];
    this._executables.push({
      type: 'browser',
      name: 'webkit',
      browserName: 'webkit',
      directory: webkit.dir,
      executablePath: () => webkitExecutable,
      executablePathOrDie: () => executablePathOrDie('webkit', webkitExecutable, webkit.installByDefault),
      installType: webkit.installByDefault ? 'download-by-default' : 'download-on-demand',
      validateHostRequirements: () => this._validateHostRequirements('webkit', webkit.dir, webkitLinuxLddDirectories, ['libGLESv2.so.2', 'libx264.so'], ['']),
      _install: () => this._downloadExecutable(webkit, webkitExecutable, DOWNLOAD_URLS['webkit'][hostPlatform], 'PLAYWRIGHT_WEBKIT_DOWNLOAD_HOST'),
      _dependencyGroup: 'webkit',
    });

    const ffmpeg = descriptors.find(d => d.name === 'ffmpeg')!;
    const ffmpegExecutable = findExecutablePath(ffmpeg.dir, 'ffmpeg');
    this._executables.push({
      type: 'tool',
      name: 'ffmpeg',
      browserName: undefined,
      directory: ffmpeg.dir,
      executablePath: () => ffmpegExecutable,
      executablePathOrDie: () => executablePathOrDie('ffmpeg', ffmpegExecutable, ffmpeg.installByDefault),
      installType: ffmpeg.installByDefault ? 'download-by-default' : 'download-on-demand',
      validateHostRequirements: () => Promise.resolve(),
      _install: () => this._downloadExecutable(ffmpeg, ffmpegExecutable, DOWNLOAD_URLS['ffmpeg'][hostPlatform], 'PLAYWRIGHT_FFMPEG_DOWNLOAD_HOST'),
      _dependencyGroup: 'tools',
    });
  }

  private _createChromiumChannel(name: ChromiumChannel, lookAt: Record<'linux' | 'darwin' | 'win32', string>, install?: () => Promise<void>): ExecutableImpl {
    const executablePath = (shouldThrow: boolean) => {
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
      // TODO: language-specific error message
      const installation = install ? `\nRun "npx playwright install ${name}"` : '';
      throw new Error(`Chromium distribution '${name}' is not found${location}${installation}`);
    };
    return {
      type: 'channel',
      name,
      browserName: 'chromium',
      directory: undefined,
      executablePath: () => executablePath(false),
      executablePathOrDie: () => executablePath(true)!,
      installType: install ? 'install-script' : 'none',
      validateHostRequirements: () => Promise.resolve(),
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

  private _addRequirementsAndDedupe(executables: Executable[] | undefined): ExecutableImpl[] {
    const set = new Set<ExecutableImpl>();
    if (!executables)
      executables = this._executables.filter(executable => executable.installType === 'download-by-default');
    for (const executable of executables as ExecutableImpl[]) {
      set.add(executable);
      if (executable.browserName === 'chromium')
        set.add(this.findExecutable('ffmpeg')!);
    }
    return Array.from(set);
  }

  private async _validateHostRequirements(browserName: BrowserName, browserDirectory: string, linuxLddDirectories: string[], dlOpenLibraries: string[], windowsExeAndDllDirectories: string[]) {
    if (getAsBooleanFromENV('PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS')) {
      process.stdout.write('Skipping host requirements validation logic because `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS` env variable is set.\n');
      return;
    }
    const ubuntuVersion = await getUbuntuVersion();
    if (browserName === 'firefox' && ubuntuVersion === '16.04')
      throw new Error(`Cannot launch Firefox on Ubuntu 16.04! Minimum required Ubuntu version for Firefox browser is 18.04`);

    if (os.platform() === 'linux')
      return await validateDependenciesLinux(linuxLddDirectories.map(d => path.join(browserDirectory, d)), dlOpenLibraries);
    if (os.platform() === 'win32' && os.arch() === 'x64')
      return await validateDependenciesWindows(windowsExeAndDllDirectories.map(d => path.join(browserDirectory, d)));
  }

  async installDeps(executablesToInstallDeps?: Executable[]) {
    const executables = this._addRequirementsAndDedupe(executablesToInstallDeps);
    const targets = new Set<DependencyGroup>();
    for (const executable of executables) {
      if (executable._dependencyGroup)
        targets.add(executable._dependencyGroup);
    }
    targets.add('tools');
    if (os.platform() === 'win32')
      return await installDependenciesWindows(targets);
    if (os.platform() === 'linux')
      return await installDependenciesLinux(targets);
  }

  async install(executablesToInstall?: Executable[]) {
    const executables = this._addRequirementsAndDedupe(executablesToInstall);
    await fs.promises.mkdir(registryDirectory, { recursive: true });
    const lockfilePath = path.join(registryDirectory, '__dirlock');
    const releaseLock = await lockfile.lock(registryDirectory, {
      retries: {
        retries: 10,
        // Retry 20 times during 10 minutes with
        // exponential back-off.
        // See documentation at: https://www.npmjs.com/package/retry#retrytimeoutsoptions
        factor: 1.27579,
      },
      onCompromised: (err: Error) => {
        throw new Error(`${err.message} Path: ${lockfilePath}`);
      },
      lockfilePath,
    });
    const linksDir = path.join(registryDirectory, '.links');

    try {
      // Create a link first, so that cache validation does not remove our own browsers.
      await fs.promises.mkdir(linksDir, { recursive: true });
      await fs.promises.writeFile(path.join(linksDir, calculateSha1(PACKAGE_PATH)), PACKAGE_PATH);

      // Remove stale browsers.
      await this._validateInstallationCache(linksDir);

      // Install browsers for this package.
      for (const executable of executables) {
        if (executable._install)
          await executable._install();
        else
          throw new Error(`ERROR: Playwright does not support installing ${executable.name}`);
      }
    } finally {
      await releaseLock();
    }
  }

  private async _downloadExecutable(descriptor: BrowsersJSONDescriptor, executablePath: string | undefined, downloadURLTemplate: string | undefined, downloadHostEnv: string) {
    if (!downloadURLTemplate || !executablePath)
      throw new Error(`ERROR: Playwright does not support ${descriptor.name} on ${hostPlatform}`);
    const downloadHost =
        (downloadHostEnv && getFromENV(downloadHostEnv)) ||
        getFromENV('PLAYWRIGHT_DOWNLOAD_HOST') ||
        'https://playwright.azureedge.net';
    const downloadURL = util.format(downloadURLTemplate, downloadHost, descriptor.revision);
    const title = `${descriptor.name} v${descriptor.revision}`;
    const downloadFileName = `playwright-download-${descriptor.name}-${hostPlatform}-${descriptor.revision}.zip`;
    await downloadBrowserWithProgressBar(title, descriptor.dir, executablePath, downloadURL, downloadFileName).catch(e => {
      throw new Error(`Failed to download ${title}, caused by\n${e.stack}`);
    });
    await fs.promises.writeFile(markerFilePath(descriptor.dir), '');
  }

  private async _installMSEdgeChannel(channel: 'msedge'|'msedge-beta'|'msedge-dev', scripts: Record<'linux' | 'darwin' | 'win32', string>) {
    const scriptArgs: string[] = [];
    if (process.platform !== 'linux') {
      const products = JSON.parse(await fetchData('https://edgeupdates.microsoft.com/api/products'));
      const productName = {
        'msedge': 'Stable',
        'msedge-beta': 'Beta',
        'msedge-dev': 'Dev',
      }[channel];
      const product = products.find((product: any) => product.Product === productName);
      const searchConfig = ({
        darwin: {platform: 'MacOS', arch: 'universal', artifact: 'pkg'},
        win32: {platform: 'Windows', arch: os.arch() === 'x64' ? 'x64' : 'x86', artifact: 'msi'},
      } as any)[process.platform];
      const release = searchConfig ? product.Releases.find((release: any) => release.Platform === searchConfig.platform && release.Architecture === searchConfig.arch) : null;
      const artifact = release ? release.Artifacts.find((artifact: any) => artifact.ArtifactName === searchConfig.artifact) : null;
      if (artifact)
        scriptArgs.push(artifact.Location /* url */);
      else
        throw new Error(`Cannot install ${channel} on ${process.platform}`);
    }
    await this._installChromiumChannel(channel, scripts, scriptArgs);
  }

  private async _installChromiumChannel(channel: string, scripts: Record<'linux' | 'darwin' | 'win32', string>, scriptArgs: string[] = []) {
    const scriptName = scripts[process.platform as 'linux' | 'darwin' | 'win32'];
    if (!scriptName)
      throw new Error(`Cannot install ${channel} on ${process.platform}`);
    const shell = scriptName.endsWith('.ps1') ? 'powershell.exe' : 'bash';
    const { code } = await spawnAsync(shell, [path.join(BIN_PATH, scriptName), ...scriptArgs], { cwd: BIN_PATH, stdio: 'inherit' });
    if (code !== 0)
      throw new Error(`Failed to install ${channel}`);
  }

  private async _validateInstallationCache(linksDir: string) {
    // 1. Collect used downloads and package descriptors.
    const usedBrowserPaths: Set<string> = new Set();
    for (const fileName of await fs.promises.readdir(linksDir)) {
      const linkPath = path.join(linksDir, fileName);
      let linkTarget = '';
      try {
        linkTarget = (await fs.promises.readFile(linkPath)).toString();
        const descriptors = readDescriptors(linkTarget);
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
          const shouldHaveMarkerFile = (browserName === 'chromium' && browserRevision >= 786218) ||
              (browserName === 'firefox' && browserRevision >= 1128) ||
              (browserName === 'webkit' && browserRevision >= 1307) ||
              // All new applications have a marker file right away.
              (browserName !== 'firefox' && browserName !== 'chromium' && browserName !== 'webkit');
          if (!shouldHaveMarkerFile || (await existsAsync(markerFilePath(usedBrowserPath))))
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

function markerFilePath(browserDirectory: string): string {
  return path.join(browserDirectory, 'INSTALLATION_COMPLETE');
}

export async function installDefaultBrowsersForNpmInstall() {
  // PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD should have a value of 0 or 1
  if (getAsBooleanFromENV('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD')) {
    logPolitely('Skipping browsers download because `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` env variable is set');
    return false;
  }
  await registry.install();
}

export const registry = new Registry(PACKAGE_PATH);
