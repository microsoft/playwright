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

import { BrowserFetcher, BrowserFetcherOptions, OnProgressCallback, BrowserFetcherRevisionInfo } from './browserFetcher';
import { DeviceDescriptors } from '../deviceDescriptors';
import * as Errors from '../errors';
import * as types from '../types';
import { WKBrowser, createTransport } from '../webkit/wkBrowser';
import { WKConnectOptions } from '../webkit/wkBrowser';
import { execSync, ChildProcess } from 'child_process';
import { PipeTransport } from './pipeTransport';
import { launchProcess } from './processLauncher';
import * as path from 'path';
import * as util from 'util';
import * as os from 'os';
import { assert } from '../helper';
import { kBrowserCloseMessageId } from '../webkit/wkConnection';

export type LaunchOptions = {
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

export class WKBrowserServer {
  private _process: ChildProcess;
  private _gracefullyClose: () => Promise<void>;
  private _connectOptions: WKConnectOptions;

  constructor(process: ChildProcess, gracefullyClose: () => Promise<void>, connectOptions: WKConnectOptions) {
    this._process = process;
    this._gracefullyClose = gracefullyClose;
    this._connectOptions = connectOptions;
  }

  async connect(): Promise<WKBrowser> {
    return WKBrowser.connect(this._connectOptions);
  }

  process(): ChildProcess {
    return this._process;
  }

  connectOptions(): WKConnectOptions {
    return this._connectOptions;
  }

  async close(): Promise<void> {
    await this._gracefullyClose();
  }
}

export class WKPlaywright {
  private _projectRoot: string;
  readonly _revision: string;

  constructor(projectRoot: string, preferredRevision: string) {
    this._projectRoot = projectRoot;
    this._revision = preferredRevision;
  }

  async downloadBrowser(options?: BrowserFetcherOptions & { onProgress?: OnProgressCallback }): Promise<BrowserFetcherRevisionInfo> {
    const fetcher = this.createBrowserFetcher(options);
    const revisionInfo = fetcher.revisionInfo(this._revision);
    await fetcher.download(this._revision, options ? options.onProgress : undefined);
    return revisionInfo;
  }

  async launch(options?: LaunchOptions): Promise<WKBrowser> {
    const server = await this.launchServer(options);
    return server.connect();
  }

  async launchServer(options: LaunchOptions = {}): Promise<WKBrowserServer> {
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

    let connectOptions: WKConnectOptions | undefined = undefined;

    const { launchedProcess, gracefullyClose } = await launchProcess({
      executablePath: webkitExecutable,
      args: webkitArguments,
      env,
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      dumpio,
      pipe: true,
      tempDir: null,
      attemptToGracefullyClose: async () => {
        if (!connectOptions)
          return Promise.reject();
        // We try to gracefully close to prevent crash reporting and core dumps.
        const transport = await createTransport(connectOptions);
        const message = JSON.stringify({method: 'Browser.close', params: {}, id: kBrowserCloseMessageId});
        transport.send(message);
      },
    });

    const transport = new PipeTransport(launchedProcess.stdio[3] as NodeJS.WritableStream, launchedProcess.stdio[4] as NodeJS.ReadableStream);
    connectOptions = { transport, slowMo };
    return new WKBrowserServer(launchedProcess, gracefullyClose, connectOptions);
  }

  executablePath(): string {
    return this._resolveExecutablePath().executablePath;
  }

  get devices(): types.Devices {
    return DeviceDescriptors;
  }

  get errors(): any {
    return Errors;
  }

  defaultArgs(options: any = {}): string[] {
    const {
      args = [],
    } = options;
    const webkitArguments = [...DEFAULT_ARGS];
    webkitArguments.push(...args);
    return webkitArguments;
  }

  createBrowserFetcher(options?: BrowserFetcherOptions): BrowserFetcher {
    const downloadURLs = {
      linux: '%s/builds/webkit/%s/minibrowser-linux.zip',
      mac: '%s/builds/webkit/%s/minibrowser-mac-%s.zip',
    };

    const defaultOptions = {
      path: path.join(this._projectRoot, '.local-webkit'),
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

  _resolveExecutablePath(): { executablePath: string; missingText: string | null; } {
    const browserFetcher = this.createBrowserFetcher();
    const revisionInfo = browserFetcher.revisionInfo(this._revision);
    const missingText = !revisionInfo.local ? `WebKit revision is not downloaded. Run "npm install" or "yarn install"` : null;
    return { executablePath: revisionInfo.executablePath, missingText };
  }
}

const DEFAULT_ARGS = [];

let cachedMacVersion = undefined;
function getMacVersion() {
  if (!cachedMacVersion) {
    const [major, minor] = execSync('sw_vers -productVersion').toString('utf8').trim().split('.');
    cachedMacVersion = major + '.' + minor;
  }
  return cachedMacVersion;
}

