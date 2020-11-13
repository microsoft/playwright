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
import * as readline from 'readline';
import { helper } from './helper';
import { Progress } from './progress';
import * as types from './types';
import * as path from 'path';

export type Env = {[key: string]: string | number | boolean | undefined};

export type LaunchProcessOptions = {
  executablePath: string,
  args: string[],
  env?: Env,
  stdio: 'pipe' | 'stdin',
  tempDirectories: string[],
  cwd?: string,
  progress: Progress,
};

type LaunchResult = {
  launchedProcess: childProcess.ChildProcess,
  close: () => Promise<void>,
};

export function launchProcess(options: LaunchProcessOptions): Promise<LaunchResult> {
  const progress = options.progress;
  progress.log(`<launching> ${options.executablePath} ${options.args.join(' ')}`);

  const args = [path.join(__dirname, 'watchdog.js'), options.executablePath, options.stdio, String(options.tempDirectories.length), ...options.tempDirectories, ...options.args];
  const watchdog = childProcess.spawn(
      process.argv[0],
      args,
      {
        detached: true,
        env: (options.env as {[key: string]: string}),
        cwd: options.cwd,
        stdio: options.stdio === 'pipe' ? ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
      }
  );
  // Prevent Unhandled 'error' event.
  watchdog.on('error', () => {});

  if (!watchdog.pid) {
    // It is unlikely that we cannot spawn the watchdog, but just in case
    // let's handle this case.
    let failed: (e: Error) => void;
    const failedPromise = new Promise<Error>((f, r) => failed = f);
    watchdog.once('error', error => {
      failed(new Error('Failed to launch browser: ' + error));
    });
    return helper.removeFolders(options.tempDirectories).then(() => failedPromise).then(e => Promise.reject(e));
  }
  progress.log(`<launched> pid=${watchdog.pid}`);

  readline.createInterface({ input: watchdog.stdout }).on('line', (data: string) => {
    progress.log('[out] ' + data);
  });
  readline.createInterface({ input: watchdog.stderr }).on('line', (data: string) => {
    progress.log('[err] ' + data);
  });

  let didExitCallback = () => {};
  const didExitPromise = new Promise(f => didExitCallback = f);
  watchdog.once('exit', (exitCode, signal) => {
    progress.log(`<process did exit: exitCode=${exitCode}, signal=${signal}>`);
    didExitCallback();
  });

  async function close(): Promise<void> {
    progress.log(`<gracefully close>`);
    if (options.stdio === 'pipe') {
      const stdio = watchdog.stdio as any as [NodeJS.WritableStream, NodeJS.ReadableStream, NodeJS.ReadableStream, NodeJS.WritableStream, NodeJS.ReadableStream];
      stdio[3].end();
    } else {
      watchdog.stdin.end();
    }
    await didExitPromise;
  }

  return Promise.resolve({ launchedProcess: watchdog, close });
}

export function envArrayToObject(env: types.EnvArray): Env {
  const result: Env = {};
  for (const { name, value } of env)
    result[name] = value;
  return result;
}
