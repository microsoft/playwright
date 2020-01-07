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
import * as stream from 'stream';
import * as removeFolder from 'rimraf';
import { helper } from '../helper';
import * as readline from 'readline';
import { TimeoutError } from '../errors';
import * as platform from '../platform';

const removeFolderAsync = platform.promisify(removeFolder);

export type LaunchProcessOptions = {
  executablePath: string,
  args: string[],
  env?: {[key: string]: string},

  handleSIGINT?: boolean,
  handleSIGTERM?: boolean,
  handleSIGHUP?: boolean,
  dumpio?: boolean,
  pipe?: boolean,
  tempDir?: string,
};

export async function launchProcess(options: LaunchProcessOptions, attemptToGracefullyClose: () => Promise<any>): Promise<childProcess.ChildProcess> {
  let stdio: ('ignore' | 'pipe')[] = ['pipe', 'pipe', 'pipe'];
  if (options.pipe) {
    if (options.dumpio)
      stdio = ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'];
    else
      stdio = ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'];
  }
  const spawnedProcess = childProcess.spawn(
      options.executablePath,
      options.args,
      {
        // On non-windows platforms, `detached: true` makes child process a leader of a new
        // process group, making it possible to kill child process tree with `.kill(-pid)` command.
        // @see https://nodejs.org/api/child_process.html#child_process_options_detached
        detached: process.platform !== 'win32',
        env: options.env,
        stdio
      }
  );

  if (!spawnedProcess.pid) {
    let reject: (e: Error) => void;
    const result = new Promise<childProcess.ChildProcess>((f, r) => reject = r);
    spawnedProcess.once('error', error => {
      reject(new Error('Failed to launch browser: ' + error));
    });
    return result;
  }

  if (options.dumpio) {
    spawnedProcess.stderr.pipe(process.stderr);
    spawnedProcess.stdout.pipe(process.stdout);
  }

  let processClosed = false;
  const waitForProcessToClose = new Promise((fulfill, reject) => {
    spawnedProcess.once('exit', () => {
      processClosed = true;
      helper.removeEventListeners(listeners);
      // Cleanup as processes exit.
      if (options.tempDir) {
        removeFolderAsync(options.tempDir)
            .then(() => fulfill())
            .catch((err: Error) => console.error(err));
      } else {
        fulfill();
      }
    });
  });

  const listeners = [ helper.addEventListener(process, 'exit', killProcess) ];
  if (options.handleSIGINT)
    listeners.push(helper.addEventListener(process, 'SIGINT', () => { killProcess(); process.exit(130); }));
  if (options.handleSIGTERM)
    listeners.push(helper.addEventListener(process, 'SIGTERM', gracefullyClose));
  if (options.handleSIGHUP)
    listeners.push(helper.addEventListener(process, 'SIGHUP', gracefullyClose));
  return spawnedProcess;

  async function gracefullyClose(): Promise<void> {
    helper.removeEventListeners(listeners);
    attemptToGracefullyClose().catch(() => killProcess());
    await waitForProcessToClose;
  }

  // This method has to be sync to be used as 'exit' event handler.
  function killProcess() {
    helper.removeEventListeners(listeners);
    if (spawnedProcess.pid && !spawnedProcess.killed && !processClosed) {
      // Force kill chrome.
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
      removeFolder.sync(options.tempDir);
    } catch (e) { }
  }
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
