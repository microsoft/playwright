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

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import { BrowserFetcher, BrowserFetcherOptions } from '../server/browserFetcher';
import { DeviceDescriptors } from '../deviceDescriptors';
import * as types from '../types';
import { assert } from '../helper';
import { CRBrowser } from '../chromium/crBrowser';
import * as platform from '../platform';
import { TimeoutError } from '../errors';
import { launchProcess, waitForLine } from '../server/processLauncher';
import { kBrowserCloseMessageId } from '../chromium/crConnection';
import { PipeTransport } from './pipeTransport';
import { LaunchOptions, BrowserArgOptions, BrowserType } from './browserType';
import { createTransport, ConnectOptions } from '../browser';
import { BrowserApp } from './browserApp';

export class Chromium implements BrowserType {
  private _projectRoot: string;
  readonly _revision: string;

  constructor(projectRoot: string, preferredRevision: string) {
    this._projectRoot = projectRoot;
    this._revision = preferredRevision;
  }

  async launch(options?: LaunchOptions): Promise<CRBrowser> {
    const app = await this.launchBrowserApp(options);
    const browser = await CRBrowser.connect(app.connectOptions());
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
      webSocket = false,
      env = process.env,
      handleSIGINT = true,
      handleSIGTERM = true,
      handleSIGHUP = true,
      slowMo = 0,
      timeout = 30000
    } = options;

    const chromeArguments = [];
    if (!ignoreDefaultArgs)
      chromeArguments.push(...this.defaultArgs(options));
    else if (Array.isArray(ignoreDefaultArgs))
      chromeArguments.push(...this.defaultArgs(options).filter(arg => ignoreDefaultArgs.indexOf(arg) === -1));
    else
      chromeArguments.push(...args);

    let temporaryUserDataDir: string | null = null;

    if (!chromeArguments.some(argument => argument.startsWith('--remote-debugging-')))
      chromeArguments.push(webSocket ? '--remote-debugging-port=0' : '--remote-debugging-pipe');
    if (!chromeArguments.some(arg => arg.startsWith('--user-data-dir'))) {
      temporaryUserDataDir = await mkdtempAsync(CHROMIUM_PROFILE_PATH);
      chromeArguments.push(`--user-data-dir=${temporaryUserDataDir}`);
    }

    let chromeExecutable = executablePath;
    if (!executablePath) {
      const {missingText, executablePath} = this._resolveExecutablePath();
      if (missingText)
        throw new Error(missingText);
      chromeExecutable = executablePath;
    }

    const usePipe = chromeArguments.includes('--remote-debugging-pipe');
    if (usePipe && webSocket)
      throw new Error(`Argument "--remote-debugging-pipe" is not compatible with "webSocket" launch option.`);

    const { launchedProcess, gracefullyClose } = await launchProcess({
      executablePath: chromeExecutable!,
      args: chromeArguments,
      env,
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      dumpio,
      pipe: usePipe,
      tempDir: temporaryUserDataDir || undefined,
      attemptToGracefullyClose: async () => {
        if (!connectOptions)
          return Promise.reject();

        // We try to gracefully close to prevent crash reporting and core dumps.
        // Note that it's fine to reuse the pipe transport, since
        // our connection ignores kBrowserCloseMessageId.
        const transport = await createTransport(connectOptions);
        const message = { method: 'Browser.close', id: kBrowserCloseMessageId };
        transport.send(JSON.stringify(message));
      },
    });

    let connectOptions: ConnectOptions | undefined;
    if (!usePipe) {
      const timeoutError = new TimeoutError(`Timed out after ${timeout} ms while trying to connect to Chromium! The only Chromium revision guaranteed to work is r${this._revision}`);
      const match = await waitForLine(launchedProcess, launchedProcess.stderr, /^DevTools listening on (ws:\/\/.*)$/, timeout, timeoutError);
      const browserWSEndpoint = match[1];
      connectOptions = { browserWSEndpoint, slowMo };
    } else {
      const transport = new PipeTransport(launchedProcess.stdio[3] as NodeJS.WritableStream, launchedProcess.stdio[4] as NodeJS.ReadableStream);
      connectOptions = { slowMo, transport };
    }
    return new BrowserApp(launchedProcess, gracefullyClose, connectOptions);
  }

  async connect(options: ConnectOptions & { browserURL?: string }): Promise<CRBrowser> {
    if (options.transport && options.transport.onmessage)
      throw new Error('Transport is already in use');
    if (options.browserURL) {
      assert(!options.browserWSEndpoint && !options.transport, 'Exactly one of browserWSEndpoint, browserURL or transport must be passed to connect');
      let connectionURL: string;
      try {
        const data = await platform.fetchUrl(new URL('/json/version', options.browserURL).href);
        connectionURL = JSON.parse(data).webSocketDebuggerUrl;
      } catch (e) {
        e.message = `Failed to fetch browser webSocket url from ${options.browserURL}: ` + e.message;
        throw e;
      }
      const transport = await platform.createWebSocketTransport(connectionURL);
      options = { ...options, transport };
    }
    return CRBrowser.connect(options);
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
    const chromeArguments = [...DEFAULT_ARGS];
    if (userDataDir)
      chromeArguments.push(`--user-data-dir=${userDataDir}`);
    if (devtools)
      chromeArguments.push('--auto-open-devtools-for-tabs');
    if (headless) {
      chromeArguments.push(
          '--headless',
          '--hide-scrollbars',
          '--mute-audio'
      );
    }
    if (args.every(arg => arg.startsWith('-')))
      chromeArguments.push('about:blank');
    chromeArguments.push(...args);
    return chromeArguments;
  }

  _createBrowserFetcher(options: BrowserFetcherOptions = {}): BrowserFetcher {
    const downloadURLs = {
      linux: '%s/chromium-browser-snapshots/Linux_x64/%d/%s.zip',
      mac: '%s/chromium-browser-snapshots/Mac/%d/%s.zip',
      win32: '%s/chromium-browser-snapshots/Win/%d/%s.zip',
      win64: '%s/chromium-browser-snapshots/Win_x64/%d/%s.zip',
    };

    const defaultOptions = {
      path: path.join(this._projectRoot, '.local-chromium'),
      host: 'https://storage.googleapis.com',
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
      let archiveName = '';
      let executablePath = '';
      if (platform === 'linux') {
        archiveName = 'chrome-linux';
        executablePath = path.join(archiveName, 'chrome');
      } else if (platform === 'mac') {
        archiveName = 'chrome-mac';
        executablePath = path.join(archiveName, 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
      } else if (platform === 'win32' || platform === 'win64') {
        // Windows archive name changed at r591479.
        archiveName = parseInt(revision, 10) > 591479 ? 'chrome-win' : 'chrome-win32';
        executablePath = path.join(archiveName, 'chrome.exe');
      }
      return {
        downloadUrl: util.format((downloadURLs as any)[platform], options.host, revision, archiveName),
        executablePath
      };
    });
  }

  _resolveExecutablePath(): { executablePath: string; missingText: string | null; } {
    const browserFetcher = this._createBrowserFetcher();
    const revisionInfo = browserFetcher.revisionInfo();
    const missingText = !revisionInfo.local ? `Chromium revision is not downloaded. Run "npm install" or "yarn install"` : null;
    return { executablePath: revisionInfo.executablePath, missingText };
  }
}

const mkdtempAsync = platform.promisify(fs.mkdtemp);

const CHROMIUM_PROFILE_PATH = path.join(os.tmpdir(), 'playwright_dev_profile-');

const DEFAULT_ARGS = [
  '--disable-background-networking',
  '--enable-features=NetworkService,NetworkServiceInProcess',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-breakpad',
  '--disable-client-side-phishing-detection',
  '--disable-component-extensions-with-background-pages',
  '--disable-default-apps',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  // BlinkGenPropertyTrees disabled due to crbug.com/937609
  '--disable-features=TranslateUI,BlinkGenPropertyTrees',
  '--disable-hang-monitor',
  '--disable-ipc-flooding-protection',
  '--disable-popup-blocking',
  '--disable-prompt-on-repost',
  '--disable-renderer-backgrounding',
  '--disable-sync',
  '--force-color-profile=srgb',
  '--metrics-recording-only',
  '--no-first-run',
  '--enable-automation',
  '--password-store=basic',
  '--use-mock-keychain',
];
