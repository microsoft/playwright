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
import { execSync } from 'child_process';
import { PipeTransport } from './pipeTransport';
import { launchProcess } from './processLauncher';
import * as fs from 'fs';
import * as path from 'path';
import * as platform from '../platform';
import * as util from 'util';
import * as os from 'os';
import { assert } from '../helper';
import { kBrowserCloseMessageId } from '../webkit/wkConnection';
import { Playwright, BrowserArgOptions, LaunchOptions } from './playwright';
import { ConnectionTransport } from '../transport';
import * as ws from 'ws';
import * as uuidv4 from 'uuid/v4';
import { ConnectOptions } from '../browser';
import { BrowserApp } from './browserApp';

export class WKPlaywright implements Playwright {
  private _projectRoot: string;
  readonly _revision: string;

  constructor(projectRoot: string, preferredRevision: string) {
    this._projectRoot = projectRoot;
    this._revision = preferredRevision;
  }

  async launch(options?: LaunchOptions): Promise<WKBrowser> {
    const app = await this.launchBrowserApp(options);
    const browser = await WKBrowser.connect(app.connectOptions());
    // Hack: for typical launch scenario, ensure that close waits for actual process termination.
    browser.close = () => app.close();
    return browser;
  }

  async launchBrowserApp(options: LaunchOptions = {}): Promise<BrowserApp> {
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
      webSocket = false,
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
        // Note that it's fine to reuse the pipe transport, since
        // our connection ignores kBrowserCloseMessageId.
        const message = JSON.stringify({method: 'Browser.close', params: {}, id: kBrowserCloseMessageId});
        transport.send(message);
      },
    });

    transport = new PipeTransport(launchedProcess.stdio[3] as NodeJS.WritableStream, launchedProcess.stdio[4] as NodeJS.ReadableStream);

    let connectOptions: ConnectOptions;
    if (webSocket) {
      const browserWSEndpoint = wrapTransportWithWebSocket(transport);
      connectOptions = { browserWSEndpoint, slowMo };
    } else {
      connectOptions = { transport, slowMo };
    }
    return new BrowserApp(launchedProcess, gracefullyClose, connectOptions);
  }

  async connect(options: ConnectOptions & { browserURL?: string }): Promise<WKBrowser> {
    if (options.browserURL)
      throw new Error('Option "browserURL" is not supported by Firefox');
    if (options.transport && options.transport.onmessage)
      throw new Error('Transport is already in use');
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

  defaultArgs(options: BrowserArgOptions = {}): string[] {
    const {
      devtools = false,
      headless = !devtools,
      args = [],
      userDataDir = null
    } = options;
    if (devtools)
      throw new Error('Option "devtools" is not supported by WebKit');
    const webkitArguments = ['--inspector-pipe'];
    if (userDataDir)
      webkitArguments.push(`--user-data-dir=${userDataDir}`);
    if (headless)
      webkitArguments.push('--headless');
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
      host: 'https://playwright.azureedge.net',
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
    transport.onmessage = message => {
      // We are not notified when socket starts closing, and sending messages to a closing
      // socket throws an error.
      if (s.readyState !== ws.CLOSING)
        s.send(message);
    };
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
