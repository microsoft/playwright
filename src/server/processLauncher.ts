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
import { Log, InnerLogger } from '../logger';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
import * as removeFolder from 'rimraf';
import * as stream from 'stream';
import * as util from 'util';
import { TimeoutError } from '../errors';
import { helper } from '../helper';

const removeFolderAsync = util.promisify(removeFolder);
const mkdtempAsync = util.promisify(fs.mkdtemp);
const DOWNLOADS_FOLDER = path.join(os.tmpdir(), 'playwright_downloads-');

const browserLog: Log = {
  name: 'browser',
};

const browserStdOutLog: Log = {
  name: 'browser:out',
};

const browserStdErrLog: Log = {
  name: 'browser:err',
  severity: 'warning'
};


export type LaunchProcessOptions = {
  executablePath: string,
  args: string[],
  env?: {[key: string]: string | number | boolean | undefined},

  handleSIGINT?: boolean,
  handleSIGTERM?: boolean,
  handleSIGHUP?: boolean,
  pipe?: boolean,
  tempDir?: string,

  // Note: attemptToGracefullyClose should reject if it does not close the browser.
  attemptToGracefullyClose: () => Promise<any>,
  onkill: (exitCode: number | null, signal: string | null) => void,
  logger: InnerLogger,
};

type LaunchResult = {
  launchedProcess: childProcess.ChildProcess,
  gracefullyClose: () => Promise<void>,
  downloadsPath: string
};

export async function launchProcess(options: LaunchProcessOptions): Promise<LaunchResult> {
  const logger = options.logger;
  const stdio: ('ignore' | 'pipe')[] = options.pipe ? ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'];
  logger._log(browserLog, `<launching> ${options.executablePath} ${options.args.join(' ')}`);
  const spawnedProcess = childProcess.spawn(
      options.executablePath,
      options.args,
      {
        // On non-windows platforms, `detached: true` makes child process a leader of a new
        // process group, making it possible to kill child process tree with `.kill(-pid)` command.
        // @see https://nodejs.org/api/child_process.html#child_process_options_detached
        detached: process.platform !== 'win32',
        env: (options.env as {[key: string]: string}),
        stdio
      }
  );
  if (!spawnedProcess.pid) {
    let reject: (e: Error) => void;
    const result = new Promise<LaunchResult>((f, r) => reject = r);
    spawnedProcess.once('error', error => {
      reject(new Error('Failed to launch browser: ' + error));
    });
    return result;
  }
  logger._log(browserLog, `<launched> pid=${spawnedProcess.pid}`);

  const stdout = readline.createInterface({ input: spawnedProcess.stdout });
  stdout.on('line', (data: string) => {
    logger._log(browserStdOutLog, data);
  });

  const stderr = readline.createInterface({ input: spawnedProcess.stderr });
  stderr.on('line', (data: string) => {
    logger._log(browserStdErrLog, data);
  });

  const downloadsPath = await mkdtempAsync(DOWNLOADS_FOLDER);

  let processClosed = false;
  const waitForProcessToClose = new Promise((fulfill, reject) => {
    spawnedProcess.once('exit', (exitCode, signal) => {
      logger._log(browserLog, `<process did exit ${exitCode}, ${signal}>`);
      processClosed = true;
      helper.removeEventListeners(listeners);
      options.onkill(exitCode, signal);
      // Cleanup as processes exit.
      Promise.all([
        removeFolderAsync(downloadsPath),
        options.tempDir ? removeFolderAsync(options.tempDir) : Promise.resolve()
      ]).catch((err: Error) => console.error(err)).then(fulfill);
    });
  });

  const listeners = [ helper.addEventListener(process, 'exit', killProcess) ];
  if (options.handleSIGINT) {
    listeners.push(helper.addEventListener(process, 'SIGINT', () => {
      gracefullyClose().then(() => process.exit(130));
    }));
  }
  if (options.handleSIGTERM)
    listeners.push(helper.addEventListener(process, 'SIGTERM', gracefullyClose));
  if (options.handleSIGHUP)
    listeners.push(helper.addEventListener(process, 'SIGHUP', gracefullyClose));

  let gracefullyClosing = false;
  async function gracefullyClose(): Promise<void> {
    // We keep listeners until we are done, to handle 'exit' and 'SIGINT' while
    // asynchronously closing to prevent zombie processes. This might introduce
    // reentrancy to this function, for example user sends SIGINT second time.
    // In this case, let's forcefully kill the process.
    if (gracefullyClosing) {
      logger._log(browserLog, `<forecefully close>`);
      killProcess();
      return;
    }
    gracefullyClosing = true;
    logger._log(browserLog, `<gracefully close start>`);
    await options.attemptToGracefullyClose().catch(() => killProcess());
    await waitForProcessToClose;
    logger._log(browserLog, `<gracefully close end>`);
  }

  // This method has to be sync to be used as 'exit' event handler.
  function killProcess() {
    logger._log(browserLog, `<kill>`);
    helper.removeEventListeners(listeners);
    if (spawnedProcess.pid && !spawnedProcess.killed && !processClosed) {
      // Force kill the browser.
      try {
        if (process.platform === 'win32')
          childProcess.execSync(`taskkill /pid ${spawnedProcess.pid} /T /F`);
        else
          process.kill(-spawnedProcess.pid, 'SIGKILL');
      } catch (e) {
        // the process might have already stopped
      }
    }
    // Attempt to remove temporary profile directory to avoid littering.
    try {
      if (options.tempDir)
        removeFolder.sync(options.tempDir);
    } catch (e) { }
  }

  return { launchedProcess: spawnedProcess, gracefullyClose, downloadsPath };
}

export function waitForLine(process: childProcess.ChildProcess, inputStream: stream.Readable, regex: RegExp, timeout: number, timeoutError: TimeoutError): Promise<RegExpMatchArray> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: inputStream });
    let stderr = '';
    const listeners = [
      helper.addEventListener(rl, 'line', onLine),
      helper.addEventListener(rl, 'close', () => onClose()),
      helper.addEventListener(process, 'exit', () => onClose()),
      helper.addEventListener(process, 'error', error => onClose(error))
    ];
    const timeoutId = timeout ? setTimeout(onTimeout, timeout) : 0;

    function onClose(error?: Error) {
      cleanup();
      reject(new Error([
        'Failed to launch browser!' + (error ? ' ' + error.message : ''),
        stderr,
        '',
        'TROUBLESHOOTING: https://github.com/Microsoft/playwright/blob/master/docs/troubleshooting.md',
        '',
      ].join('\n')));
    }

    function onTimeout() {
      cleanup();
      reject(timeoutError);
    }

    function onLine(line: string) {
      stderr += line + '\n';
      const match = line.match(regex);
      if (!match)
        return;
      cleanup();
      resolve(match);
    }

    function cleanup() {
      if (timeoutId)
        clearTimeout(timeoutId);
      helper.removeEventListeners(listeners);
    }
  });
}
