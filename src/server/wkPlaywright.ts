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

import { BrowserFetcher, BrowserFetcherOptions } from './browserFetcher';
import { DeviceDescriptors } from '../deviceDescriptors';
import { TimeoutError } from '../errors';
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
import { Playwright } from './playwright';

export type LaunchOptions = {
  ignoreDefaultArgs?: boolean | string[],
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
    const browser = await WKBrowser.connect(this._connectOptions);
    // Hack: for typical launch scenario, ensure that close waits for actual process termination.
    browser.close = this._gracefullyClose;
    return browser;
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

export class WKPlaywright implements Playwright {
  private _projectRoot: string;
  readonly _revision: string;

  constructor(projectRoot: string, preferredRevision: string) {
    this._projectRoot = projectRoot;
    this._revision = preferredRevision;
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
    else if (Array.isArray(ignoreDefaultArgs))
      webkitArguments.push(...this.defaultArgs(options).filter(arg => ignoreDefaultArgs.indexOf(arg) === -1));
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
    if (options.headless !== false)
      webkitArguments.push('--headless');

    let connectOptions: WKConnectOptions | undefined = undefined;

    const { launchedProcess, gracefullyClose } = await launchProcess({
      executablePath: webkitExecutable!,
      args: webkitArguments,
      env,
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      dumpio,
      pipe: true,
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

  get errors(): { TimeoutError: typeof TimeoutError } {
    return { TimeoutError };
  }

  defaultArgs(options: { args?: string[] } = {}): string[] {
    const {
      args = [],
    } = options;
    const webkitArguments = [...DEFAULT_ARGS];
    webkitArguments.push(...args);
    return webkitArguments;
  }

  _createBrowserFetcher(options?: BrowserFetcherOptions): BrowserFetcher {
    const downloadURLs = {
      linux: '%s/builds/webkit/%s/minibrowser-linux.zip',
      mac: '%s/builds/webkit/%s/minibrowser-mac-%s.zip',
      win64: '%s/builds/webkit/%s/minibrowser-win64.zip',
    };

    const defaultOptions = {
      path: path.join(this._projectRoot, '.local-webkit'),
      host: 'https://playwright.blob.core.windows.net',
      platform: (() => {
        const platform = os.platform();
        if (platform === 'darwin')
          return 'mac';
        if (platform === 'linux')
          return 'linux';
        if (platform === 'win32')
          return 'win64';
        return platform;
      })()
    };
    options = {
      ...defaultOptions,
      ...options,
    };
    assert(!!(downloadURLs as any)[options.platform!], 'Unsupported platform: ' + options.platform);

    return new BrowserFetcher(options.path!, options.platform!, this._revision, (platform: string, revision: string) => {
      return {
        downloadUrl: (platform === 'mac') ?
          util.format(downloadURLs[platform], options!.host, revision, getMacVersion()) :
          util.format((downloadURLs as any)[platform], options!.host, revision),
        executablePath: platform.startsWith('win') ? 'MiniBrowser.exe' : 'pw_run.sh',
      };
    });
  }

  _resolveExecutablePath(): { executablePath: string; missingText: string | null; } {
    const browserFetcher = this._createBrowserFetcher();
    const revisionInfo = browserFetcher.revisionInfo();
    const missingText = !revisionInfo.local ? `WebKit revision is not downloaded. Run "npm install" or "yarn install"` : null;
    return { executablePath: revisionInfo.executablePath, missingText };
  }
}

const DEFAULT_ARGS: string[] = [];

let cachedMacVersion: string | undefined = undefined;
function getMacVersion() {
  if (!cachedMacVersion) {
    const [major, minor] = execSync('sw_vers -productVersion').toString('utf8').trim().split('.');
    cachedMacVersion = major + '.' + minor;
  }
  return cachedMacVersion;
}

