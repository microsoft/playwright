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
import { assert, getFromENV, getAsBooleanFromENV, calculateSha1, removeFolders, existsAsync, hostPlatform } from './utils';
import { installDependenciesLinux, installDependenciesWindows, validateDependenciesLinux, validateDependenciesWindows } from './dependencies';
import { downloadBrowserWithProgressBar, logPolitely } from './browserFetcher';

export type BrowserName = 'chromium'|'chromium-with-symbols'|'webkit'|'firefox'|'firefox-beta'|'ffmpeg';
export const allBrowserNames: Set<BrowserName> = new Set(['chromium', 'chromium-with-symbols', 'webkit', 'firefox', 'ffmpeg', 'firefox-beta']);

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
  'chromium-with-symbols': {
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
  'firefox-beta': {
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
  for (const browserName of allBrowserNames) {
    if (baseName.startsWith(browserName + '-'))
      return true;
  }
  return false;
}

type BrowserDescriptor = {
  name: BrowserName,
  revision: string,
  installByDefault: boolean,
  browserDirectory: string,
};

function readDescriptors(packagePath: string) {
  const browsersJSON = require(path.join(packagePath, 'browsers.json'));
  return (browsersJSON['browsers'] as any[]).map(obj => {
    const name = obj.name;
    const revisionOverride = (obj.revisionOverrides || {})[hostPlatform];
    const revision = revisionOverride || obj.revision;
    const browserDirectoryPrefix = revisionOverride ? `${name}_${hostPlatform}_special` : `${name}`;
    const descriptor: BrowserDescriptor = {
      name,
      revision,
      installByDefault: !!obj.installByDefault,
      // Method `isBrowserDirectory` determines directory to be browser iff
      // it starts with some browser name followed by '-'. Some browser names
      // are prefixes of others, e.g. 'webkit' is a prefix of `webkit-technology-preview`.
      // To avoid older registries erroneously removing 'webkit-technology-preview', we have to
      // ensure that browser folders to never include dashes inside.
      browserDirectory: browserDirectoryPrefix.replace(/-/g, '_') + '-' + revision,
    };
    return descriptor;
  });
}

export class Registry {
  private _descriptors: BrowserDescriptor[];

  constructor(packagePath: string) {
    this._descriptors = readDescriptors(packagePath);
  }

  browserDirectory(browserName: BrowserName): string {
    const browser = this._descriptors.find(browser => browser.name === browserName);
    assert(browser, `ERROR: Playwright does not support ${browserName}`);
    return path.join(registryDirectory, browser.browserDirectory);
  }

  private _revision(browserName: BrowserName): string {
    const browser = this._descriptors.find(browser => browser.name === browserName);
    assert(browser, `ERROR: Playwright does not support ${browserName}`);
    return browser.revision;
  }

  executablePath(browserName: BrowserName): string | undefined {
    const browserDirectory = this.browserDirectory(browserName);
    const tokens = EXECUTABLE_PATHS[browserName][hostPlatform];
    return tokens ? path.join(browserDirectory, ...tokens) : undefined;
  }

  private _downloadURL(browserName: BrowserName): string {
    const browser = this._descriptors.find(browser => browser.name === browserName);
    assert(browser, `ERROR: Playwright does not support ${browserName}`);
    const envDownloadHost: { [key: string]: string } = {
      'chromium': 'PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST',
      'chromium-with-symbols': 'PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST',
      'firefox': 'PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST',
      'firefox-beta': 'PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST',
      'webkit': 'PLAYWRIGHT_WEBKIT_DOWNLOAD_HOST',
      'ffmpeg': 'PLAYWRIGHT_FFMPEG_DOWNLOAD_HOST',
    };
    const downloadHost = getFromENV(envDownloadHost[browserName]) ||
                         getFromENV('PLAYWRIGHT_DOWNLOAD_HOST') ||
                         'https://playwright.azureedge.net';
    const urlTemplate = DOWNLOAD_URLS[browserName][hostPlatform];
    assert(urlTemplate, `ERROR: Playwright does not support ${browserName} on ${hostPlatform}`);
    return util.format(urlTemplate, downloadHost, browser.revision);
  }

  isSupportedBrowser(browserName: string): boolean {
    // We retain browsers if they are found in the descriptor.
    // Note, however, that there are older versions out in the wild that rely on
    // the "download" field in the browser descriptor and use its value
    // to retain and download browsers.
    // As of v1.10, we decided to abandon "download" field.
    return this._descriptors.some(browser => browser.name === browserName);
  }

  private _installByDefault(): BrowserName[] {
    return this._descriptors.filter(browser => browser.installByDefault).map(browser => browser.name);
  }

  async validateHostRequirements(browserName: BrowserName) {
    if (getAsBooleanFromENV('PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS')) {
      process.stdout.write('Skipping host requirements validation logic because `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS` env variable is set.\n');
      return;
    }
    const ubuntuVersion = await getUbuntuVersion();
    if ((browserName === 'firefox' || browserName === 'firefox-beta') && ubuntuVersion === '16.04')
      throw new Error(`Cannot launch ${browserName} on Ubuntu 16.04! Minimum required Ubuntu version for Firefox browser is 18.04`);
    const browserDirectory = this.browserDirectory(browserName);

    if (os.platform() === 'linux') {
      const dlOpenLibraries: string[] = [];
      const linuxLddDirectories: string[] = [];
      if (browserName === 'chromium' || browserName === 'chromium-with-symbols')
        linuxLddDirectories.push(path.join(browserDirectory, 'chrome-linux'));
      if (browserName === 'webkit') {
        linuxLddDirectories.push(
            path.join(browserDirectory, 'minibrowser-gtk'),
            path.join(browserDirectory, 'minibrowser-gtk', 'bin'),
            path.join(browserDirectory, 'minibrowser-gtk', 'lib'),
            path.join(browserDirectory, 'minibrowser-wpe'),
            path.join(browserDirectory, 'minibrowser-wpe', 'bin'),
            path.join(browserDirectory, 'minibrowser-wpe', 'lib'),
        );
        dlOpenLibraries.push('libGLESv2.so.2', 'libx264.so');
      }
      if (browserName === 'firefox' || browserName === 'firefox-beta')
        linuxLddDirectories.push(path.join(browserDirectory, 'firefox'));
      return await validateDependenciesLinux(linuxLddDirectories, dlOpenLibraries);
    }

    if (os.platform() === 'win32' && os.arch() === 'x64') {
      const windowsExeAndDllDirectories: string[] = [];
      if (browserName === 'chromium' || browserName === 'chromium-with-symbols')
        windowsExeAndDllDirectories.push(path.join(browserDirectory, 'chrome-win'));
      if (browserName === 'firefox' || browserName === 'firefox-beta')
        windowsExeAndDllDirectories.push(path.join(browserDirectory, 'firefox'));
      if (browserName === 'webkit')
        windowsExeAndDllDirectories.push(browserDirectory);
      return await validateDependenciesWindows(windowsExeAndDllDirectories);
    }
  }

  async installDeps(browserNames: BrowserName[]) {
    const targets = new Set<'chromium' | 'firefox' | 'webkit' | 'tools'>();
    if (!browserNames.length)
      browserNames = this._installByDefault();
    for (const browserName of browserNames) {
      if (browserName === 'chromium' || browserName === 'chromium-with-symbols')
        targets.add('chromium');
      if (browserName === 'firefox' || browserName === 'firefox-beta')
        targets.add('firefox');
      if (browserName === 'webkit')
        targets.add('webkit');
    }
    targets.add('tools');
    if (os.platform() === 'win32')
      return await installDependenciesWindows(targets);
    if (os.platform() === 'linux')
      return await installDependenciesLinux(targets);
  }

  async installBinaries(browserNames?: BrowserName[]) {
    if (!browserNames)
      browserNames = this._installByDefault();
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

      // Install missing browsers for this package.
      for (const browserName of browserNames) {
        const revision = this._revision(browserName);
        const browserDirectory = this.browserDirectory(browserName);
        const title = `${browserName} v${revision}`;
        const downloadFileName = `playwright-download-${browserName}-${hostPlatform}-${revision}.zip`;
        await downloadBrowserWithProgressBar(title, browserDirectory, this.executablePath(browserName)!, this._downloadURL(browserName), downloadFileName).catch(e => {
          throw new Error(`Failed to download ${title}, caused by\n${e.stack}`);
        });
        await fs.promises.writeFile(markerFilePath(browserDirectory), '');
      }
    } finally {
      await releaseLock();
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
        const descriptors = readDescriptors(linkTarget);
        for (const browserName of allBrowserNames) {
          const descriptor = descriptors.find(d => d.name === browserName);
          if (!descriptor)
            continue;
          const usedBrowserPath = path.join(registryDirectory, descriptor.browserDirectory);
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
  await registry.installBinaries();
}

export const registry = new Registry(PACKAGE_PATH);
