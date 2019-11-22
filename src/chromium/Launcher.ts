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
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
import * as removeFolder from 'rimraf';
import * as URL from 'url';
import { Browser } from './Browser';
import { BrowserFetcher } from './BrowserFetcher';
import { Connection } from './Connection';
import { TimeoutError } from '../Errors';
import { assert, debugError, helper } from '../helper';
import { Viewport } from './Page';
import { PipeTransport } from './PipeTransport';
import { WebSocketTransport } from './WebSocketTransport';
import { ConnectionTransport } from '../ConnectionTransport';

const mkdtempAsync = helper.promisify(fs.mkdtemp);
const removeFolderAsync = helper.promisify(removeFolder);

const CHROME_PROFILE_PATH = path.join(os.tmpdir(), 'playwright_dev_profile-');

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

export class Launcher {
  private _projectRoot: string;
  private _preferredRevision: string;

  constructor(projectRoot: string, preferredRevision: string) {
    this._projectRoot = projectRoot;
    this._preferredRevision = preferredRevision;
  }

  async launch(options: (LauncherLaunchOptions & LauncherChromeArgOptions & LauncherBrowserOptions) = {}): Promise<Browser> {
    const {
      ignoreDefaultArgs = false,
      args = [],
      dumpio = false,
      executablePath = null,
      pipe = false,
      env = process.env,
      handleSIGINT = true,
      handleSIGTERM = true,
      handleSIGHUP = true,
      ignoreHTTPSErrors = false,
      defaultViewport = {width: 800, height: 600},
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

    let temporaryUserDataDir = null;

    if (!chromeArguments.some(argument => argument.startsWith('--remote-debugging-')))
      chromeArguments.push(pipe ? '--remote-debugging-pipe' : '--remote-debugging-port=0');
    if (!chromeArguments.some(arg => arg.startsWith('--user-data-dir'))) {
      temporaryUserDataDir = await mkdtempAsync(CHROME_PROFILE_PATH);
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
    let stdio: ('ignore' | 'pipe')[] = ['pipe', 'pipe', 'pipe'];
    if (usePipe) {
      if (dumpio)
        stdio = ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'];
      else
        stdio = ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'];
    }
    const chromeProcess = childProcess.spawn(
        chromeExecutable,
        chromeArguments,
        {
          // On non-windows platforms, `detached: true` makes child process a leader of a new
          // process group, making it possible to kill child process tree with `.kill(-pid)` command.
          // @see https://nodejs.org/api/child_process.html#child_process_options_detached
          detached: process.platform !== 'win32',
          env,
          stdio
        }
    );

    if (dumpio) {
      chromeProcess.stderr.pipe(process.stderr);
      chromeProcess.stdout.pipe(process.stdout);
    }

    let chromeClosed = false;
    const waitForChromeToClose = new Promise((fulfill, reject) => {
      chromeProcess.once('exit', () => {
        chromeClosed = true;
        // Cleanup as processes exit.
        if (temporaryUserDataDir) {
          removeFolderAsync(temporaryUserDataDir)
              .then(() => fulfill())
              .catch(err => console.error(err));
        } else {
          fulfill();
        }
      });
    });

    const listeners = [ helper.addEventListener(process, 'exit', killChrome) ];
    if (handleSIGINT)
      listeners.push(helper.addEventListener(process, 'SIGINT', () => { killChrome(); process.exit(130); }));
    if (handleSIGTERM)
      listeners.push(helper.addEventListener(process, 'SIGTERM', gracefullyCloseChrome));
    if (handleSIGHUP)
      listeners.push(helper.addEventListener(process, 'SIGHUP', gracefullyCloseChrome));
    let connection: Connection | null = null;
    try {
      if (!usePipe) {
        const browserWSEndpoint = await waitForWSEndpoint(chromeProcess, timeout, this._preferredRevision);
        const transport = await WebSocketTransport.create(browserWSEndpoint);
        connection = new Connection(browserWSEndpoint, transport, slowMo);
      } else {
        const transport = new PipeTransport(chromeProcess.stdio[3] as NodeJS.WritableStream, chromeProcess.stdio[4] as NodeJS.ReadableStream);
        connection = new Connection('', transport, slowMo);
      }
      const browser = await Browser.create(connection, [], ignoreHTTPSErrors, defaultViewport, chromeProcess, gracefullyCloseChrome);
      await browser.waitForTarget(t => t.type() === 'page');
      return browser;
    } catch (e) {
      killChrome();
      throw e;
    }

    function gracefullyCloseChrome(): Promise<any> {
      helper.removeEventListeners(listeners);
      if (temporaryUserDataDir) {
        killChrome();
      } else if (connection) {
        // Attempt to close chrome gracefully
        connection.send('Browser.close').catch(error => {
          debugError(error);
          killChrome();
        });
      }
      return waitForChromeToClose;
    }

    // This method has to be sync to be used as 'exit' event handler.
    function killChrome() {
      helper.removeEventListeners(listeners);
      if (chromeProcess.pid && !chromeProcess.killed && !chromeClosed) {
        // Force kill chrome.
        try {
          if (process.platform === 'win32')
            childProcess.execSync(`taskkill /pid ${chromeProcess.pid} /T /F`);
          else
            process.kill(-chromeProcess.pid, 'SIGKILL');
        } catch (e) {
          // the process might have already stopped
        }
      }
      // Attempt to remove temporary profile directory to avoid littering.
      try {
        removeFolder.sync(temporaryUserDataDir);
      } catch (e) { }
    }
  }

  defaultArgs(options: LauncherChromeArgOptions = {}): string[] {
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

  executablePath(): string {
    return this._resolveExecutablePath().executablePath;
  }

  async connect(options: (LauncherBrowserOptions & {
      browserWSEndpoint?: string;
      browserURL?: string;
      transport?: ConnectionTransport; })): Promise<Browser> {
    const {
      browserWSEndpoint,
      browserURL,
      ignoreHTTPSErrors = false,
      defaultViewport = {width: 800, height: 600},
      transport,
      slowMo = 0,
    } = options;

    assert(Number(!!browserWSEndpoint) + Number(!!browserURL) + Number(!!transport) === 1, 'Exactly one of browserWSEndpoint, browserURL or transport must be passed to playwright.connect');

    let connection = null;
    if (transport) {
      connection = new Connection('', transport, slowMo);
    } else if (browserWSEndpoint) {
      const connectionTransport = await WebSocketTransport.create(browserWSEndpoint);
      connection = new Connection(browserWSEndpoint, connectionTransport, slowMo);
    } else if (browserURL) {
      const connectionURL = await getWSEndpoint(browserURL);
      const connectionTransport = await WebSocketTransport.create(connectionURL);
      connection = new Connection(connectionURL, connectionTransport, slowMo);
    }

    const {browserContextIds} = await connection.send('Target.getBrowserContexts');
    return Browser.create(connection, browserContextIds, ignoreHTTPSErrors, defaultViewport, null, () => connection.send('Browser.close').catch(debugError));
  }

  _resolveExecutablePath(): { executablePath: string; missingText: string | null; } {
    const browserFetcher = new BrowserFetcher(this._projectRoot);
    const revisionInfo = browserFetcher.revisionInfo(this._preferredRevision);
    const missingText = !revisionInfo.local ? `Chromium revision is not downloaded. Run "npm install" or "yarn install"` : null;
    return {executablePath: revisionInfo.executablePath, missingText};
  }

}

function waitForWSEndpoint(chromeProcess: childProcess.ChildProcess, timeout: number, preferredRevision: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: chromeProcess.stderr });
    let stderr = '';
    const listeners = [
      helper.addEventListener(rl, 'line', onLine),
      helper.addEventListener(rl, 'close', () => onClose()),
      helper.addEventListener(chromeProcess, 'exit', () => onClose()),
      helper.addEventListener(chromeProcess, 'error', error => onClose(error))
    ];
    const timeoutId = timeout ? setTimeout(onTimeout, timeout) : 0;

    function onClose(error?: Error) {
      cleanup();
      reject(new Error([
        'Failed to launch chrome!' + (error ? ' ' + error.message : ''),
        stderr,
        '',
        'TROUBLESHOOTING: https://github.com/Microsoft/playwright/blob/master/docs/troubleshooting.md',
        '',
      ].join('\n')));
    }

    function onTimeout() {
      cleanup();
      reject(new TimeoutError(`Timed out after ${timeout} ms while trying to connect to Chrome! The only Chrome revision guaranteed to work is r${preferredRevision}`));
    }

    function onLine(line: string) {
      stderr += line + '\n';
      const match = line.match(/^DevTools listening on (ws:\/\/.*)$/);
      if (!match)
        return;
      cleanup();
      resolve(match[1]);
    }

    function cleanup() {
      if (timeoutId)
        clearTimeout(timeoutId);
      helper.removeEventListeners(listeners);
    }
  });
}

function getWSEndpoint(browserURL: string): Promise<string> {
  let resolve, reject;
  const promise = new Promise<string>((res, rej) => { resolve = res; reject = rej; });

  const endpointURL = URL.resolve(browserURL, '/json/version');
  const protocol = endpointURL.startsWith('https') ? https : http;
  const requestOptions = Object.assign(URL.parse(endpointURL), { method: 'GET' });
  const request = protocol.request(requestOptions, res => {
    let data = '';
    if (res.statusCode !== 200) {
      // Consume response data to free up memory.
      res.resume();
      reject(new Error('HTTP ' + res.statusCode));
      return;
    }
    res.setEncoding('utf8');
    res.on('data', chunk => data += chunk);
    res.on('end', () => resolve(JSON.parse(data).webSocketDebuggerUrl));
  });

  request.on('error', reject);
  request.end();

  return promise.catch(e => {
    e.message = `Failed to fetch browser webSocket url from ${endpointURL}: ` + e.message;
    throw e;
  });
}

export type LauncherChromeArgOptions = {
   headless?: boolean,
   args?: string[],
   userDataDir?: string,
   devtools?: boolean,
};

export type LauncherLaunchOptions = {
   executablePath?: string,
   ignoreDefaultArgs?: boolean|string[],
   handleSIGINT?: boolean,
   handleSIGTERM?: boolean,
   handleSIGHUP?: boolean,
   timeout?: number,
   dumpio?: boolean,
   env?: {[key: string]: string} | undefined,
   pipe?: boolean,
};

export type LauncherBrowserOptions = {
   ignoreHTTPSErrors?: boolean,
   defaultViewport?: Viewport | null,
   slowMo?: number,
};
