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
import { getFromENV, getAsBooleanFromENV, calculateSha1, removeFolders, existsAsync, hostPlatform, canAccessFile } from './utils';
import { installDependenciesLinux, installDependenciesWindows, validateDependenciesLinux, validateDependenciesWindows } from './dependencies';
import { downloadBrowserWithProgressBar, logPolitely } from './browserFetcher';

const PACKAGE_PATH = path.join(__dirname, '..', '..');

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

const registryDirectory = (() => {
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
const allDownloadable = ['chromium', 'firefox', 'webkit', 'ffmpeg', 'firefox-beta', 'chromium-with-symbols'];

export interface Executable {
  type: 'browser' | 'tool';
  name: BrowserName | InternalTool;
  browserName: BrowserName | undefined;
  installType: 'download-by-default' | 'download-on-demand';
  maybeExecutablePath(): string | undefined;
  executablePathIfExists(): string | undefined;
  directoryIfExists(): string | undefined;
  validateHostRequirements(): Promise<void>;
}

interface ExecutableImpl extends Executable {
  _download?: () => Promise<void>;
}

export class Registry {
  private _executables: ExecutableImpl[];

  constructor(packagePath: string) {
    const descriptors = readDescriptors(packagePath);
    const executablePath = (dir: string, name: keyof typeof EXECUTABLE_PATHS) => {
      const tokens = EXECUTABLE_PATHS[name][hostPlatform];
      return tokens ? path.join(dir, ...tokens) : undefined;
    };
    const directoryIfExists = (d: string) => fs.existsSync(d) ? d : undefined;
    const executablePathIfExists = (e: string | undefined) => e && canAccessFile(e) ? e : undefined;
    this._executables = [];

    const chromium = descriptors.find(d => d.name === 'chromium')!;
    const chromiumExecutable = executablePath(chromium.dir, 'chromium');
    this._executables.push({
      type: 'browser',
      name: 'chromium',
      browserName: 'chromium',
      directoryIfExists: () => directoryIfExists(chromium.dir),
      maybeExecutablePath: () => chromiumExecutable,
      executablePathIfExists: () => executablePathIfExists(chromiumExecutable),
      installType: chromium.installByDefault ? 'download-by-default' : 'download-on-demand',
      validateHostRequirements: () => this._validateHostRequirements('chromium', chromium.dir, ['chrome-linux'], [], ['chrome-win']),
      _download: () => this._downloadExecutable(chromium, chromiumExecutable, DOWNLOAD_URLS['chromium'][hostPlatform], 'PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST'),
    });

    const chromiumWithSymbols = descriptors.find(d => d.name === 'chromium-with-symbols')!;
    const chromiumWithSymbolsExecutable = executablePath(chromiumWithSymbols.dir, 'chromium');
    this._executables.push({
      type: 'tool',
      name: 'chromium-with-symbols',
      browserName: 'chromium',
      directoryIfExists: () => directoryIfExists(chromiumWithSymbols.dir),
      maybeExecutablePath: () => chromiumWithSymbolsExecutable,
      executablePathIfExists: () => executablePathIfExists(chromiumWithSymbolsExecutable),
      installType: chromiumWithSymbols.installByDefault ? 'download-by-default' : 'download-on-demand',
      validateHostRequirements: () => this._validateHostRequirements('chromium', chromiumWithSymbols.dir, ['chrome-linux'], [], ['chrome-win']),
      _download: () => this._downloadExecutable(chromiumWithSymbols, chromiumWithSymbolsExecutable, DOWNLOAD_URLS['chromium-with-symbols'][hostPlatform], 'PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST'),
    });

    const firefox = descriptors.find(d => d.name === 'firefox')!;
    const firefoxExecutable = executablePath(firefox.dir, 'firefox');
    this._executables.push({
      type: 'browser',
      name: 'firefox',
      browserName: 'firefox',
      directoryIfExists: () => directoryIfExists(firefox.dir),
      maybeExecutablePath: () => firefoxExecutable,
      executablePathIfExists: () => executablePathIfExists(firefoxExecutable),
      installType: firefox.installByDefault ? 'download-by-default' : 'download-on-demand',
      validateHostRequirements: () => this._validateHostRequirements('firefox', firefox.dir, ['firefox'], [], ['firefox']),
      _download: () => this._downloadExecutable(firefox, firefoxExecutable, DOWNLOAD_URLS['firefox'][hostPlatform], 'PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST'),
    });

    const firefoxBeta = descriptors.find(d => d.name === 'firefox-beta')!;
    const firefoxBetaExecutable = executablePath(firefoxBeta.dir, 'firefox');
    this._executables.push({
      type: 'tool',
      name: 'firefox-beta',
      browserName: 'firefox',
      directoryIfExists: () => directoryIfExists(firefoxBeta.dir),
      maybeExecutablePath: () => firefoxBetaExecutable,
      executablePathIfExists: () => executablePathIfExists(firefoxBetaExecutable),
      installType: firefoxBeta.installByDefault ? 'download-by-default' : 'download-on-demand',
      validateHostRequirements: () => this._validateHostRequirements('firefox', firefoxBeta.dir, ['firefox'], [], ['firefox']),
      _download: () => this._downloadExecutable(firefoxBeta, firefoxBetaExecutable, DOWNLOAD_URLS['firefox-beta'][hostPlatform], 'PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST'),
    });

    const webkit = descriptors.find(d => d.name === 'webkit')!;
    const webkitExecutable = executablePath(webkit.dir, 'webkit');
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
      directoryIfExists: () => directoryIfExists(webkit.dir),
      maybeExecutablePath: () => webkitExecutable,
      executablePathIfExists: () => executablePathIfExists(webkitExecutable),
      installType: webkit.installByDefault ? 'download-by-default' : 'download-on-demand',
      validateHostRequirements: () => this._validateHostRequirements('webkit', webkit.dir, webkitLinuxLddDirectories, ['libGLESv2.so.2', 'libx264.so'], ['']),
      _download: () => this._downloadExecutable(webkit, webkitExecutable, DOWNLOAD_URLS['webkit'][hostPlatform], 'PLAYWRIGHT_WEBKIT_DOWNLOAD_HOST'),
    });

    const ffmpeg = descriptors.find(d => d.name === 'ffmpeg')!;
    const ffmpegExecutable = executablePath(ffmpeg.dir, 'ffmpeg');
    this._executables.push({
      type: 'tool',
      name: 'ffmpeg',
      browserName: undefined,
      directoryIfExists: () => directoryIfExists(ffmpeg.dir),
      maybeExecutablePath: () => ffmpegExecutable,
      executablePathIfExists: () => executablePathIfExists(ffmpegExecutable),
      installType: ffmpeg.installByDefault ? 'download-by-default' : 'download-on-demand',
      validateHostRequirements: () => Promise.resolve(),
      _download: () => this._downloadExecutable(ffmpeg, ffmpegExecutable, DOWNLOAD_URLS['ffmpeg'][hostPlatform], 'PLAYWRIGHT_FFMPEG_DOWNLOAD_HOST'),
    });
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
    const targets = new Set<'chromium' | 'firefox' | 'webkit' | 'tools'>();
    for (const executable of executables) {
      if (executable.browserName)
        targets.add(executable.browserName);
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
        if (executable._download)
          await executable._download();
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
