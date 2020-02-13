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

import { FFBrowser } from '../firefox/ffBrowser';
import { BrowserFetcher, OnProgressCallback, BrowserFetcherOptions } from './browserFetcher';
import { DeviceDescriptors } from '../deviceDescriptors';
import { launchProcess, waitForLine } from './processLauncher';
import * as types from '../types';
import * as platform from '../platform';
import { kBrowserCloseMessageId } from '../firefox/ffConnection';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import { TimeoutError } from '../errors';
import { assert, helper } from '../helper';
import { LaunchOptions, BrowserArgOptions, BrowserType } from './browserType';
import { ConnectOptions, LaunchType } from '../browser';
import { BrowserServer } from './browserServer';
import { Events } from '../events';
import { ConnectionTransport } from '../transport';
import { BrowserContext } from '../browserContext';

const mkdtempAsync = platform.promisify(fs.mkdtemp);

export class Firefox implements BrowserType {
  private _projectRoot: string;
  readonly _revision: string;

  constructor(projectRoot: string, preferredRevision: string) {
    this._projectRoot = projectRoot;
    this._revision = preferredRevision;
  }

  async downloadBrowserIfNeeded(onProgress?: OnProgressCallback) {
    const fetcher = this._createBrowserFetcher();
    const revisionInfo = fetcher.revisionInfo();
    // Do nothing if the revision is already downloaded.
    if (revisionInfo.local)
      return;
    await fetcher.download(revisionInfo.revision, onProgress);
  }

  name() {
    return 'firefox';
  }

  async launch(options?: LaunchOptions & { slowMo?: number }): Promise<FFBrowser> {
    if (options && (options as any).userDataDir)
      throw new Error('userDataDir option is not supported in `browserType.launch`. Use `browserType.launchPersistent` instead');
    const { browserServer, transport } = await this._launchServer(options, 'local');
    const browser = await FFBrowser.connect(transport!, options && options.slowMo);
    // Hack: for typical launch scenario, ensure that close waits for actual process termination.
    browser.close = () => browserServer.close();
    (browser as any)['__server__'] = browserServer;
    return browser;
  }

  async launchServer(options?: LaunchOptions & { port?: number }): Promise<BrowserServer> {
    return (await this._launchServer(options, 'server', undefined, options && options.port)).browserServer;
  }

  async launchPersistent(userDataDir: string, options?: LaunchOptions): Promise<BrowserContext> {
    const { timeout = 30000 } = options || {};
    const { browserServer, transport } = await this._launchServer(options, 'persistent', userDataDir);
    const browser = await FFBrowser.connect(transport!);
    await helper.waitWithTimeout(browser._waitForTarget(t => t.type() === 'page'), 'first page', timeout);
    // Hack: for typical launch scenario, ensure that close waits for actual process termination.
    const browserContext = browser._defaultContext;
    browserContext.close = () => browserServer.close();
    return browserContext;
  }

  private async _launchServer(options: LaunchOptions = {}, connectionType: LaunchType, userDataDir?: string, port?: number): Promise<{ browserServer: BrowserServer, transport?: ConnectionTransport }> {
    const {
      ignoreDefaultArgs = false,
      args = [],
      dumpio = false,
      executablePath = null,
      env = process.env,
      handleSIGHUP = true,
      handleSIGINT = true,
      handleSIGTERM = true,
      timeout = 30000,
    } = options;

    const firefoxArguments = [];

    let temporaryProfileDir = null;
    if (!userDataDir) {
      userDataDir = await mkdtempAsync(path.join(os.tmpdir(), 'playwright_dev_firefox_profile-'));
      temporaryProfileDir = userDataDir;
    }

    if (!ignoreDefaultArgs)
      firefoxArguments.push(...this._defaultArgs(options, userDataDir!, port || 0));
    else if (Array.isArray(ignoreDefaultArgs))
      firefoxArguments.push(...this._defaultArgs(options, userDataDir!, port || 0).filter(arg => !ignoreDefaultArgs.includes(arg)));
    else
      firefoxArguments.push(...args);

    let firefoxExecutable = executablePath;
    if (!firefoxExecutable) {
      const {missingText, executablePath} = this._resolveExecutablePath();
      if (missingText)
        throw new Error(missingText);
      firefoxExecutable = executablePath;
    }

    let browserServer: BrowserServer | undefined = undefined;
    const { launchedProcess, gracefullyClose } = await launchProcess({
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
      tempDir: temporaryProfileDir || undefined,
      attemptToGracefullyClose: async () => {
        if (!browserServer)
          return Promise.reject();
        // We try to gracefully close to prevent crash reporting and core dumps.
        // Note that it's fine to reuse the pipe transport, since
        // our connection ignores kBrowserCloseMessageId.
        const transport = new platform.WebSocketTransport(browserWSEndpoint);
        const message = { method: 'Browser.close', params: {}, id: kBrowserCloseMessageId };
        await transport.send(JSON.stringify(message));
      },
      onkill: (exitCode, signal) => {
        if (browserServer)
          browserServer.emit(Events.BrowserServer.Close, exitCode, signal);
      },
    });

    const timeoutError = new TimeoutError(`Timed out after ${timeout} ms while trying to connect to Firefox!`);
    const match = await waitForLine(launchedProcess, launchedProcess.stdout, /^Juggler listening on (ws:\/\/.*)$/, timeout, timeoutError);
    const browserWSEndpoint = match[1];
    browserServer = new BrowserServer(launchedProcess, gracefullyClose, connectionType === 'server' ? browserWSEndpoint : null);
    return { browserServer, transport: connectionType === 'server' ? undefined : new platform.WebSocketTransport(browserWSEndpoint) };
  }

  async connect(options: ConnectOptions): Promise<FFBrowser> {
    const transport = new platform.WebSocketTransport(options.wsEndpoint);
    return FFBrowser.connect(transport, options.slowMo);
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

  private _defaultArgs(options: BrowserArgOptions = {}, userDataDir: string, port: number): string[] {
    const {
      devtools = false,
      headless = !devtools,
      args = [],
    } = options;
    if (devtools)
      throw new Error('Option "devtools" is not supported by Firefox');
    const userDataDirArg = args.find(arg => arg.startsWith('-profile') || arg.startsWith('--profile'));
    if (userDataDirArg)
      throw new Error('Pass userDataDir parameter instead of specifying -profile argument');
    if (args.find(arg => arg.startsWith('-juggler')))
      throw new Error('Use the port parameter instead of -juggler argument');

    const firefoxArguments = ['-no-remote'];
    if (headless) {
      firefoxArguments.push('-headless');
    } else {
      firefoxArguments.push('-wait-for-browser');
      firefoxArguments.push('-foreground');
    }

    firefoxArguments.push(`-profile`, userDataDir);
    firefoxArguments.push('-juggler', String(port));
    firefoxArguments.push(...args);

    if (args.every(arg => arg.startsWith('-')))
      firefoxArguments.push('about:blank');
    return firefoxArguments;
  }

  _createBrowserFetcher(options: BrowserFetcherOptions = {}): BrowserFetcher {
    const downloadURLs = {
      linux: '%s/builds/firefox/%s/firefox-linux.zip',
      mac: '%s/builds/firefox/%s/firefox-mac.zip',
      win32: '%s/builds/firefox/%s/firefox-win32.zip',
      win64: '%s/builds/firefox/%s/firefox-win64.zip',
    };

    const defaultOptions = {
      path: path.join(this._projectRoot, '.local-firefox'),
      host: 'https://playwright.azureedge.net',
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
    assert(!!(downloadURLs as any)[options.platform!], 'Unsupported platform: ' + options.platform);

    return new BrowserFetcher(options.path!, options.platform!, this._revision, (platform: string, revision: string) => {
      let executablePath = '';
      if (platform === 'linux')
        executablePath = path.join('firefox', 'firefox');
      else if (platform === 'mac')
        executablePath = path.join('firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox');
      else if (platform === 'win32' || platform === 'win64')
        executablePath = path.join('firefox', 'firefox.exe');
      return {
        downloadUrl: util.format((downloadURLs as any)[platform], options.host, revision),
        executablePath
      };
    });
  }

  _resolveExecutablePath() {
    const browserFetcher = this._createBrowserFetcher();
    const revisionInfo = browserFetcher.revisionInfo();
    const missingText = !revisionInfo.local ? `Firefox revision is not downloaded. Run "npm install"` : null;
    return { executablePath: revisionInfo.executablePath, missingText };
  }
}

