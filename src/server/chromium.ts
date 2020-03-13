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
import { helper } from '../helper';
import { CRBrowser } from '../chromium/crBrowser';
import * as platform from '../platform';
import { TimeoutError } from '../errors';
import { launchProcess, waitForLine } from '../server/processLauncher';
import { kBrowserCloseMessageId } from '../chromium/crConnection';
import { PipeTransport } from './pipeTransport';
import { LaunchOptions, BrowserArgOptions, BrowserType } from './browserType';
import { ConnectOptions, LaunchType } from '../browser';
import { BrowserServer } from './browserServer';
import { Events } from '../events';
import { ConnectionTransport } from '../transport';
import { BrowserContext } from '../browserContext';

export class Chromium implements BrowserType {
  private _executablePath: (string|undefined);

  constructor() {
  }

  executablePath(): (string|null) {
    return this._executablePath || null;
  }

  setExecutablePath(executablePath: string) {
    this._executablePath = executablePath;
  }

  name() {
    return 'chromium';
  }

  async launch(options?: LaunchOptions & { slowMo?: number }): Promise<CRBrowser> {
    if (options && (options as any).userDataDir)
      throw new Error('userDataDir option is not supported in `browserType.launch`. Use `browserType.launchPersistentContext` instead');
    const { browserServer, transport } = await this._launchServer(options, 'local');
    const browser = await CRBrowser.connect(transport!, false, options && options.slowMo);
    (browser as any)['__server__'] = browserServer;
    return browser;
  }

  async launchServer(options?: LaunchOptions & { port?: number }): Promise<BrowserServer> {
    return (await this._launchServer(options, 'server', undefined, options && options.port)).browserServer;
  }

  async launchPersistentContext(userDataDir: string, options?: LaunchOptions): Promise<BrowserContext> {
    const { timeout = 30000 } = options || {};
    const { transport } = await this._launchServer(options, 'persistent', userDataDir);
    const browser = await CRBrowser.connect(transport!, true);
    await helper.waitWithTimeout(browser._firstPagePromise, 'first page', timeout);
    return browser._defaultContext;
  }

  private async _launchServer(options: LaunchOptions = {}, launchType: LaunchType, userDataDir?: string, port?: number): Promise<{ browserServer: BrowserServer, transport?: ConnectionTransport }> {
    const {
      ignoreDefaultArgs = false,
      args = [],
      dumpio = false,
      executablePath = null,
      env = process.env,
      handleSIGINT = true,
      handleSIGTERM = true,
      handleSIGHUP = true,
      timeout = 30000
    } = options;

    let temporaryUserDataDir: string | null = null;
    if (!userDataDir) {
      userDataDir = await mkdtempAsync(CHROMIUM_PROFILE_PATH);
      temporaryUserDataDir = userDataDir!;
    }

    const chromeArguments = [];
    if (!ignoreDefaultArgs)
      chromeArguments.push(...this._defaultArgs(options, launchType, userDataDir!, port || 0));
    else if (Array.isArray(ignoreDefaultArgs))
      chromeArguments.push(...this._defaultArgs(options, launchType, userDataDir!, port || 0).filter(arg => ignoreDefaultArgs.indexOf(arg) === -1));
    else
      chromeArguments.push(...args);

    const chromeExecutable = executablePath || this._executablePath;
    if (!chromeExecutable)
      throw new Error(`No executable path is specified. Either use "chromium.setExecutablePath()" to set one, or pass "executablePath" option directly.`);
    let browserServer: BrowserServer | undefined = undefined;
    const { launchedProcess, gracefullyClose } = await launchProcess({
      executablePath: chromeExecutable,
      args: chromeArguments,
      env,
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      dumpio,
      pipe: launchType !== 'server',
      tempDir: temporaryUserDataDir || undefined,
      attemptToGracefullyClose: async () => {
        if (!browserServer)
          return Promise.reject();
        // We try to gracefully close to prevent crash reporting and core dumps.
        // Note that it's fine to reuse the pipe transport, since
        // our connection ignores kBrowserCloseMessageId.
        const t = transport || await platform.connectToWebsocket(browserWSEndpoint!, async transport => transport);
        const message = { method: 'Browser.close', id: kBrowserCloseMessageId };
        await t.send(JSON.stringify(message));
      },
      onkill: (exitCode, signal) => {
        if (browserServer)
          browserServer.emit(Events.BrowserServer.Close, exitCode, signal);
      },
    });

    let transport: PipeTransport | undefined;
    let browserWSEndpoint: string | undefined;
    if (launchType === 'server') {
      const timeoutError = new TimeoutError(`Timed out after ${timeout} ms while trying to connect to Chromium!`);
      const match = await waitForLine(launchedProcess, launchedProcess.stderr, /^DevTools listening on (ws:\/\/.*)$/, timeout, timeoutError);
      browserWSEndpoint = match[1];
      browserServer = new BrowserServer(launchedProcess, gracefullyClose, browserWSEndpoint);
      return { browserServer };
    } else {
      // For local launch scenario close will terminate the browser process.
      transport = new PipeTransport(launchedProcess.stdio[3] as NodeJS.WritableStream, launchedProcess.stdio[4] as NodeJS.ReadableStream, () => browserServer!.close());
      browserServer = new BrowserServer(launchedProcess, gracefullyClose, null);
      return { browserServer, transport };
    }
  }

  async connect(options: ConnectOptions): Promise<CRBrowser> {
    return await platform.connectToWebsocket(options.wsEndpoint, transport => {
      return CRBrowser.connect(transport, false, options.slowMo);
    });
  }

  private _defaultArgs(options: BrowserArgOptions = {}, launchType: LaunchType, userDataDir: string, port: number): string[] {
    const {
      devtools = false,
      headless = !devtools,
      args = [],
    } = options;
    const userDataDirArg = args.find(arg => arg.startsWith('--user-data-dir'));
    if (userDataDirArg)
      throw new Error('Pass userDataDir parameter instead of specifying --user-data-dir argument');
    if (args.find(arg => arg.startsWith('--remote-debugging-')))
      throw new Error('Playwright manages remote debugging connection itself.');
    if (launchType !== 'persistent' && args.find(arg => !arg.startsWith('-')))
      throw new Error('Arguments can not specify page to be opened');

    const chromeArguments = [...DEFAULT_ARGS];
    chromeArguments.push(`--user-data-dir=${userDataDir}`);
    chromeArguments.push(launchType === 'server' ? `--remote-debugging-port=${port || 0}` : '--remote-debugging-pipe');
    if (devtools)
      chromeArguments.push('--auto-open-devtools-for-tabs');
    if (headless) {
      chromeArguments.push(
          '--headless',
          '--hide-scrollbars',
          '--mute-audio'
      );
    }
    chromeArguments.push(...args);
    if (launchType === 'persistent') {
      if (args.every(arg => arg.startsWith('-')))
        chromeArguments.push('about:blank');
    } else {
      chromeArguments.push('--no-startup-window');
    }

    return chromeArguments;
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
