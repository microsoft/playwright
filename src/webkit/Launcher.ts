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
import * as path from 'path';
import { Browser } from './Browser';
import { BrowserFetcher } from './BrowserFetcher';
import { Connection } from './Connection';
import { debugError, helper } from '../helper';
import { Viewport } from './Page';
import { PipeTransport } from './PipeTransport';
import * as os from 'os';


export class Launcher {
  private _projectRoot: string;
  private _preferredRevision: string;

  constructor(projectRoot: string, preferredRevision: string) {
    this._projectRoot = projectRoot;
    this._preferredRevision = preferredRevision;
  }

  async launch(options: LauncherLaunchOptions = {}): Promise<Browser> {
    const {
      args = [],
      dumpio = false,
      executablePath = null,
      env = process.env,
      handleSIGINT = true,
      handleSIGTERM = true,
      handleSIGHUP = true,
      headless = true,
      defaultViewport = {width: 800, height: 600},
      slowMo = 0
    } = options;

    const webkitArguments = args.slice();
    let webkitExecutable = executablePath;
    if (!executablePath) {
      const {missingText, executablePath} = this._resolveExecutablePath();
      if (missingText)
        throw new Error(missingText);
      webkitExecutable = executablePath;
    }
    
    let stdio: ('ignore' | 'pipe')[] = ['pipe', 'pipe', 'pipe'];
    if (dumpio)
      stdio = ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'];
    else
      stdio = ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'];
    webkitArguments.push('--inspector-pipe');
    const webkitProcess = childProcess.spawn(
        webkitExecutable,
        webkitArguments,
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
      webkitProcess.stderr.pipe(process.stderr);
      webkitProcess.stdout.pipe(process.stdout);
    }

    let webkitClosed = false;
    const waitForChromeToClose = new Promise((fulfill, reject) => {
      webkitProcess.once('exit', () => {
        webkitClosed = true;
        fulfill();
      });
    });

    const listeners = [ helper.addEventListener(process, 'exit', killWebKit) ];
    if (handleSIGINT)
      listeners.push(helper.addEventListener(process, 'SIGINT', () => { killWebKit(); process.exit(130); }));
    if (handleSIGTERM)
      listeners.push(helper.addEventListener(process, 'SIGTERM', gracefullyCloseWebkit));
    if (handleSIGHUP)
      listeners.push(helper.addEventListener(process, 'SIGHUP', gracefullyCloseWebkit));
    let connection: Connection | null = null;
    try {
      const transport = new PipeTransport(webkitProcess.stdio[3] as NodeJS.WritableStream, webkitProcess.stdio[4] as NodeJS.ReadableStream);
      connection = new Connection('', transport, slowMo);
      const browser = new Browser(connection, defaultViewport, webkitProcess
        , gracefullyCloseWebkit);
      return browser;
    } catch (e) {
      killWebKit();
      throw e;
    }

    function gracefullyCloseWebkit(): Promise<any> {
      helper.removeEventListeners(listeners);
      if (connection) {
        // Attempt to close chrome gracefully
        connection.send('Browser.close').catch(error => {
          debugError(error);
          killWebKit();
        });
      }
      return waitForChromeToClose;
    }

    // This method has to be sync to be used as 'exit' event handler.
    function killWebKit() {
      helper.removeEventListeners(listeners);
      if (webkitProcess.pid && !webkitProcess.killed && !webkitClosed) {
        // Force kill chrome.
        try {
          if (process.platform === 'win32')
            childProcess.execSync(`taskkill /pid ${webkitProcess.pid} /T /F`);
          else
            process.kill(-webkitProcess.pid, 'SIGKILL');
        } catch (e) {
          // the process might have already stopped
        }
      }
    }
  }

  executablePath(): string {
    return this._resolveExecutablePath().executablePath;
  }

  _resolveExecutablePath(): { executablePath: string; missingText: string | null; } {
    const browserFetcher = new BrowserFetcher(this._projectRoot);
    const revision = process.env['PLAYWRIGHT_WEBKIT_REVISION'];
    if (revision) {
      const revisionInfo = browserFetcher.revisionInfo(revision);
      const missingText = !revisionInfo.local ? 'Tried to use PLAYWRIGHT_WEBKIT_REVISION env variable to launch browser but did not find executable at: ' + revisionInfo.executablePath : null;
      return {executablePath: revisionInfo.executablePath, missingText};
    }
    const revisionInfo = browserFetcher.revisionInfo(this._preferredRevision);
    const missingText = !revisionInfo.local ? `WebKit revision is not downloaded. Run "npm install" or "yarn install"` : null;
    return {executablePath: revisionInfo.executablePath, missingText};
  }

}

export type LauncherLaunchOptions = {
  args?: string[],
  executablePath?: string,
  handleSIGINT?: boolean,
  handleSIGTERM?: boolean,
  handleSIGHUP?: boolean,
  headless?: boolean,
  dumpio?: boolean,
  env?: {[key: string]: string} | undefined,
  defaultViewport?: Viewport | null,
  slowMo?: number,
};
