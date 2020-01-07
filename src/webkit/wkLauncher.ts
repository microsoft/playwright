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

import { assert } from '../helper';
import { WKBrowser } from './wkBrowser';
import { BrowserFetcher, BrowserFetcherOptions } from '../browserFetcher';
import { PipeTransport, SlowMoTransport } from '../transport';
import { execSync } from 'child_process';
import * as path from 'path';
import * as util from 'util';
import * as os from 'os';
import { launchProcess } from '../processLauncher';
import { BrowserServer } from '../browser';

const DEFAULT_ARGS = [
];

export class WKLauncher {
  private _projectRoot: string;
  private _preferredRevision: string;

  constructor(projectRoot: string, preferredRevision: string) {
    this._projectRoot = projectRoot;
    this._preferredRevision = preferredRevision;
  }

  defaultArgs(options: any = {}) {
    const {
      args = [],
    } = options;
    const webkitArguments = [...DEFAULT_ARGS];
    webkitArguments.push(...args);
    return webkitArguments;
  }

  async launch(options: LauncherLaunchOptions = {}): Promise<BrowserServer<WKBrowser>> {
    const {
      ignoreDefaultArgs = false,
      args = [],
      dumpio = false,
      executablePath = null,
      env = process.env,
      handleSIGINT = true,
      handleSIGTERM = true,
      handleSIGHUP = true,
      slowMo = 0,
      timeout = 30000
    } = options;

    const webkitArguments = [];
    if (!ignoreDefaultArgs)
      webkitArguments.push(...this.defaultArgs(options));
    else
      webkitArguments.push(...args);

    let webkitExecutable = executablePath;
    if (!executablePath) {
      const {missingText, executablePath} = this._resolveExecutablePath();
      if (missingText)
        throw new Error(missingText);
      webkitExecutable = executablePath;
    }
    webkitArguments.push('--inspector-pipe');
    // Headless options is only implemented on Mac at the moment.
    if (process.platform === 'darwin' && options.headless !== false)
      webkitArguments.push('--headless');

    const launchedProcess = await launchProcess({
      executablePath: webkitExecutable,
      args: webkitArguments,
      env,
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      dumpio,
      pipe: true,
      tempDir: null
    }, () => {
      if (!browser)
        return Promise.reject();
      browser.close();
    });

    let browser: WKBrowser | undefined;
    try {
      const transport = new PipeTransport(launchedProcess.stdio[3] as NodeJS.WritableStream, launchedProcess.stdio[4] as NodeJS.ReadableStream);
      browser = new WKBrowser(SlowMoTransport.wrap(transport, slowMo));
      await browser._waitForFirstPageTarget(timeout);
      return new BrowserServer(browser, launchedProcess, '');
    } catch (e) {
      if (browser)
        await browser.close();
      throw e;
    }
  }

  executablePath(): string {
    return this._resolveExecutablePath().executablePath;
  }

  _resolveExecutablePath(): { executablePath: string; missingText: string | null; } {
    const browserFetcher = createBrowserFetcher(this._projectRoot);
    const revisionInfo = browserFetcher.revisionInfo(this._preferredRevision);
    const missingText = !revisionInfo.local ? `WebKit revision is not downloaded. Run "npm install" or "yarn install"` : null;
    return {executablePath: revisionInfo.executablePath, missingText};
  }

}

export type LauncherLaunchOptions = {
  ignoreDefaultArgs?: boolean,
  args?: string[],
  executablePath?: string,
  handleSIGINT?: boolean,
  handleSIGTERM?: boolean,
  handleSIGHUP?: boolean,
  headless?: boolean,
  timeout?: number,
  dumpio?: boolean,
  env?: {[key: string]: string} | undefined,
  slowMo?: number,
};

let cachedMacVersion = undefined;
function getMacVersion() {
  if (!cachedMacVersion) {
    const [major, minor] = execSync('sw_vers -productVersion').toString('utf8').trim().split('.');
    cachedMacVersion = major + '.' + minor;
  }
  return cachedMacVersion;
}

export function createBrowserFetcher(projectRoot: string, options: BrowserFetcherOptions = {}): BrowserFetcher {
  const downloadURLs = {
    linux: '%s/builds/webkit/%s/minibrowser-linux.zip',
    mac: '%s/builds/webkit/%s/minibrowser-mac-%s.zip',
  };

  const defaultOptions = {
    path: path.join(projectRoot, '.local-webkit'),
    host: 'https://playwrightaccount.blob.core.windows.net',
    platform: (() => {
      const platform = os.platform();
      if (platform === 'darwin')
        return 'mac';
      if (platform === 'linux')
        return 'linux';
      if (platform === 'win32')
        return 'linux';  // Windows gets linux binaries and uses WSL
      return platform;
    })()
  };
  options = {
    ...defaultOptions,
    ...options,
  };
  assert(!!downloadURLs[options.platform], 'Unsupported platform: ' + options.platform);

  return new BrowserFetcher(options.path, options.platform, (platform: string, revision: string) => {
    return {
      downloadUrl: (platform === 'mac') ?
        util.format(downloadURLs[platform], options.host, revision, getMacVersion()) :
        util.format(downloadURLs[platform], options.host, revision),
      executablePath: 'pw_run.sh',
    };
  });
}
