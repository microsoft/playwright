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
import { WKBrowser } from '../webkit/wkBrowser';
import { WKConnectOptions } from '../webkit/wkBrowser';
import { execSync, ChildProcess } from 'child_process';
import { PipeTransport } from './pipeTransport';
import { launchProcess } from './processLauncher';
import * as fs from 'fs';
import * as path from 'path';
import * as platform from '../platform';
import * as util from 'util';
import * as os from 'os';
import { assert } from '../helper';
import { kBrowserCloseMessageId } from '../webkit/wkConnection';
import { Playwright } from './playwright';
import { ConnectionTransport } from '../transport';
import * as ws from 'ws';
import * as uuidv4 from 'uuid/v4';

export type SlowMoOptions = {
  slowMo?: number,
};

export type WebKitArgOptions = {
  headless?: boolean,
  args?: string[],
  userDataDir?: string,
};

export type LaunchOptions = WebKitArgOptions & SlowMoOptions & {
  executablePath?: string,
  ignoreDefaultArgs?: boolean | string[],
  handleSIGINT?: boolean,
  handleSIGTERM?: boolean,
  handleSIGHUP?: boolean,
  timeout?: number,
  dumpio?: boolean,
  env?: {[key: string]: string} | undefined,
  pipe?: boolean,
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

  process(): ChildProcess {
    return this._process;
  }

  wsEndpoint(): string | null {
    return this._connectOptions.browserWSEndpoint || null;
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
    const browser = await WKBrowser.connect(server.connectOptions());
    // Hack: for typical launch scenario, ensure that close waits for actual process termination.
    browser.close = () => server.close();
    return browser;
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
      pipe = false,
    } = options;

    const webkitArguments = [];
    if (!ignoreDefaultArgs)
      webkitArguments.push(...this.defaultArgs(options));
    else if (Array.isArray(ignoreDefaultArgs))
      webkitArguments.push(...this.defaultArgs(options).filter(arg => ignoreDefaultArgs.indexOf(arg) === -1));
    else
      webkitArguments.push(...args);

    let userDataDir: string;
    let temporaryUserDataDir: string | null = null;
    const userDataDirArg = webkitArguments.find(arg => arg.startsWith('--user-data-dir'));
    if (userDataDirArg) {
      userDataDir = userDataDirArg.substr('--user-data-dir'.length).trim();
    } else {
      userDataDir = await mkdtempAsync(WEBKIT_PROFILE_PATH);
      temporaryUserDataDir = userDataDir;
      webkitArguments.push(`--user-data-dir=${temporaryUserDataDir}`);
    }

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

    let transport: PipeTransport | undefined = undefined;

    const { launchedProcess, gracefullyClose } = await launchProcess({
      executablePath: webkitExecutable!,
      args: webkitArguments,
      env: { ...env, CURL_COOKIE_JAR_PATH: path.join(userDataDir, 'cookiejar.db') },
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      dumpio,
      pipe: true,
      tempDir: temporaryUserDataDir || undefined,
      attemptToGracefullyClose: async () => {
        if (!transport)
          return Promise.reject();
        // We try to gracefully close to prevent crash reporting and core dumps.
        const message = JSON.stringify({method: 'Browser.close', params: {}, id: kBrowserCloseMessageId});
        transport.send(message);
      },
    });

    transport = new PipeTransport(launchedProcess.stdio[3] as NodeJS.WritableStream, launchedProcess.stdio[4] as NodeJS.ReadableStream);

    let connectOptions: WKConnectOptions;
    if (!pipe) {
      const browserWSEndpoint = wrapTransportWithWebSocket(transport);
      connectOptions = { browserWSEndpoint, slowMo };
    } else {
      connectOptions = { transport, slowMo };
    }
    return new WKBrowserServer(launchedProcess, gracefullyClose, connectOptions);
  }

  async connect(options: WKConnectOptions): Promise<WKBrowser> {
    return WKBrowser.connect(options);
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

  defaultArgs(options: WebKitArgOptions = {}): string[] {
    const {
      args = [],
      userDataDir = null
    } = options;
    const webkitArguments = [...DEFAULT_ARGS];
    if (userDataDir)
      webkitArguments.push(`--user-data-dir=${userDataDir}`);
    webkitArguments.push(...args);
    return webkitArguments;
  }

  _createBrowserFetcher(options?: BrowserFetcherOptions): BrowserFetcher {
    const downloadURLs = {
      linux: '%s/builds/webkit/%s/minibrowser-gtk-wpe.zip',
      mac: '%s/builds/webkit/%s/minibrowser-mac-%s.zip',
      win64: '%s/builds/webkit/%s/minibrowser-win64.zip',
    };

    const defaultOptions = {
      path: path.join(this._projectRoot, '.local-webkit'),
      host: 'https://playwright2.blob.core.windows.net',
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

const mkdtempAsync = platform.promisify(fs.mkdtemp);

const WEBKIT_PROFILE_PATH = path.join(os.tmpdir(), 'playwright_dev_profile-');
const DEFAULT_ARGS: string[] = [];

let cachedMacVersion: string | undefined = undefined;
function getMacVersion() {
  if (!cachedMacVersion) {
    const [major, minor] = execSync('sw_vers -productVersion').toString('utf8').trim().split('.');
    cachedMacVersion = major + '.' + minor;
  }
  return cachedMacVersion;
}

function wrapTransportWithWebSocket(transport: ConnectionTransport) {
  const server = new ws.Server({ port: 0 });
  let socket: ws | undefined;
  const guid = uuidv4();

  server.on('connection', (s, req) => {
    if (req.url !== '/' + guid) {
      s.close();
      return;
    }
    if (socket) {
      s.close(undefined, 'Multiple connections are not supported');
      return;
    }
    socket = s;
    s.on('message', message => transport.send(Buffer.from(message).toString()));
    transport.onmessage = message => s.send(message);
    s.on('close', () => {
      socket = undefined;
      transport.onmessage = undefined;
    });
  });

  transport.onclose = () => {
    if (socket)
      socket.close(undefined, 'Browser disconnected');
    server.close();
    transport.onmessage = undefined;
    transport.onclose = undefined;
  };

  const address = server.address();
  if (typeof address === 'string')
    return address + '/' + guid;
  return 'ws://127.0.0.1:' + address.port + '/' + guid;
}
