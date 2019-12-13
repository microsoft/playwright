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
import * as path from 'path';
import { Connection } from './Connection';
import { Browser } from './Browser';
import { BrowserFetcher, BrowserFetcherOptions } from '../browserFetcher';
import * as fs from 'fs';
import * as util from 'util';
import { debugError, assert } from '../helper';
import { TimeoutError } from '../errors';
import { SerializingTransport, WebSocketTransport } from '../transport';
import { launchProcess, waitForLine } from '../processLauncher';

const mkdtempAsync = util.promisify(fs.mkdtemp);

const FIREFOX_PROFILE_PATH = path.join(os.tmpdir(), 'playwright_firefox_profile-');

const DEFAULT_ARGS = [
  '-no-remote',
  '-foreground',
];

export class Launcher {
  private _projectRoot: string;
  private _preferredRevision: string;
  constructor(projectRoot, preferredRevision) {
    this._projectRoot = projectRoot;
    this._preferredRevision = preferredRevision;
  }

  defaultArgs(options: any = {}) {
    const {
      headless = true,
      args = [],
      userDataDir = null,
    } = options;
    const firefoxArguments = [...DEFAULT_ARGS];
    if (userDataDir)
      firefoxArguments.push('-profile', userDataDir);
    if (headless)
      firefoxArguments.push('-headless');
    firefoxArguments.push(...args);
    if (args.every(arg => arg.startsWith('-')))
      firefoxArguments.push('about:blank');
    return firefoxArguments;
  }

  async launch(options: any = {}): Promise<Browser> {
    const {
      ignoreDefaultArgs = false,
      args = [],
      dumpio = false,
      executablePath = null,
      env = process.env,
      handleSIGHUP = true,
      handleSIGINT = true,
      handleSIGTERM = true,
      ignoreHTTPSErrors = false,
      defaultViewport = {width: 800, height: 600},
      slowMo = 0,
      timeout = 30000,
    } = options;

    const firefoxArguments = [];
    if (!ignoreDefaultArgs)
      firefoxArguments.push(...this.defaultArgs(options));
    else if (Array.isArray(ignoreDefaultArgs))
      firefoxArguments.push(...this.defaultArgs(options).filter(arg => !ignoreDefaultArgs.includes(arg)));
    else
      firefoxArguments.push(...args);

    if (!firefoxArguments.includes('-juggler'))
      firefoxArguments.push('-juggler', '0');

    let temporaryProfileDir = null;
    if (!firefoxArguments.includes('-profile') && !firefoxArguments.includes('--profile')) {
      temporaryProfileDir = await mkdtempAsync(FIREFOX_PROFILE_PATH);
      firefoxArguments.push(`-profile`, temporaryProfileDir);
    }

    let firefoxExecutable = executablePath;
    if (!firefoxExecutable) {
      const {missingText, executablePath} = this._resolveExecutablePath();
      if (missingText)
        throw new Error(missingText);
      firefoxExecutable = executablePath;
    }
    const launched = await launchProcess({
      executablePath: firefoxExecutable,
      args: firefoxArguments,
      env: os.platform() === 'linux' ? {
        ...env,
        // On linux Juggler ships the libstdc++ it was linked against.
        LD_LIBRARY_PATH: `${path.dirname(firefoxExecutable)}:${process.env.LD_LIBRARY_PATH}`,
      } : env,
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      dumpio,
      pipe: false,
      tempDir: temporaryProfileDir
    }, () => {
      if (temporaryProfileDir || !connection)
        return Promise.reject();
      return connection.send('Browser.close').catch(error => {
        debugError(error);
        throw error;
      });
    });

    let connection: Connection | null = null;
    try {
      const timeoutError = new TimeoutError(`Timed out after ${timeout} ms while trying to connect to Firefox!`);
      const match = await waitForLine(launched.process, launched.process.stdout, /^Juggler listening on (ws:\/\/.*)$/, timeout, timeoutError);
      const url = match[1];
      const transport = new SerializingTransport(await WebSocketTransport.create(url));
      connection = new Connection(url, transport, slowMo);
      const browser = await Browser.create(connection, defaultViewport, launched.process, launched.gracefullyClose);
      if (ignoreHTTPSErrors)
        await connection.send('Browser.setIgnoreHTTPSErrors', {enabled: true});
      await browser._waitForTarget(t => t.type() === 'page');
      return browser;
    } catch (e) {
      await launched.gracefullyClose;
      throw e;
    }
  }

  async connect(options: any = {}): Promise<Browser> {
    const {
      browserWSEndpoint,
      slowMo = 0,
      defaultViewport = {width: 800, height: 600},
      ignoreHTTPSErrors = false,
    } = options;
    let connection = null;
    const transport = await WebSocketTransport.create(browserWSEndpoint);
    connection = new Connection(browserWSEndpoint, transport, slowMo);
    const browser = await Browser.create(connection, defaultViewport, null, () => connection.send('Browser.close').catch(debugError));
    if (ignoreHTTPSErrors)
      await connection.send('Browser.setIgnoreHTTPSErrors', {enabled: true});
    return browser;
  }

  executablePath(): string {
    return this._resolveExecutablePath().executablePath;
  }

  _resolveExecutablePath() {
    const browserFetcher = createBrowserFetcher(this._projectRoot);
    const revisionInfo = browserFetcher.revisionInfo(this._preferredRevision);
    const missingText = !revisionInfo.local ? `Firefox revision is not downloaded. Run "npm install" or "yarn install"` : null;
    return {executablePath: revisionInfo.executablePath, missingText};
  }
}

export function createBrowserFetcher(projectRoot: string, options: BrowserFetcherOptions = {}): BrowserFetcher {
  const downloadURLs = {
    linux: '%s/builds/firefox/%s/firefox-linux.zip',
    mac: '%s/builds/firefox/%s/firefox-mac.zip',
    win32: '%s/builds/firefox/%s/firefox-win32.zip',
    win64: '%s/builds/firefox/%s/firefox-win64.zip',
  };

  const defaultOptions = {
    path: path.join(projectRoot, '.local-firefox'),
    host: 'https://playwrightaccount.blob.core.windows.net',
    platform: (() => {
      const platform = os.platform();
      if (platform === 'darwin')
        return 'mac';
      if (platform === 'linux')
        return 'linux';
      if (platform === 'win32')
        return os.arch() === 'x64' ? 'win64' : 'win32';
      return platform;
    })()
  };
  options = {
    ...defaultOptions,
    ...options,
  };
  assert(!!downloadURLs[options.platform], 'Unsupported platform: ' + options.platform);

  return new BrowserFetcher(options.path, options.platform, (platform: string, revision: string) => {
    let executablePath = '';
    if (platform === 'linux')
      executablePath = path.join('firefox', 'firefox');
    else if (platform === 'mac')
      executablePath = path.join('firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox');
    else if (platform === 'win32' || platform === 'win64')
      executablePath = path.join('firefox', 'firefox.exe');
    return {
      downloadUrl: util.format(downloadURLs[platform], options.host, revision),
      executablePath
    };
  });
}
