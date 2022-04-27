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
import * as path from 'path';
import { eventsHelper } from './eventsHelper';
import { isUnderTest } from './';
import { removeFolders } from './fileUtils';

export type Env = {[key: string]: string | number | boolean | undefined};

export type LaunchProcessOptions = {
  command: string,
  args?: string[],
  env?: Env,
  shell?: boolean,

  handleSIGINT?: boolean,
  handleSIGTERM?: boolean,
  handleSIGHUP?: boolean,
  stdio: 'pipe' | 'stdin',
  tempDirectories: string[],

  cwd?: string,

  // Note: attemptToGracefullyClose should reject if it does not close the browser.
  attemptToGracefullyClose: () => Promise<any>,
  onExit: (exitCode: number | null, signal: string | null) => void,
  log: (message: string) => void,
};

type LaunchResult = {
  launchedProcess: childProcess.ChildProcess,
  gracefullyClose: () => Promise<void>,
  kill: () => Promise<void>,
};

export const gracefullyCloseSet = new Set<() => Promise<void>>();

export async function gracefullyCloseAll() {
  await Promise.all(Array.from(gracefullyCloseSet).map(gracefullyClose => gracefullyClose().catch(e => {})));
}

// We currently spawn a process per page when recording video in Chromium.
//  This triggers "too many listeners" on the process object once you have more than 10 pages open.
const maxListeners = process.getMaxListeners();
if (maxListeners !== 0)
  process.setMaxListeners(Math.max(maxListeners || 0, 100));

export async function launchProcess(options: LaunchProcessOptions): Promise<LaunchResult> {
  const stdio: ('ignore' | 'pipe')[] = options.stdio === 'pipe' ? ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'];
  options.log(`<launching> ${options.command} ${options.args ? options.args.join(' ') : ''}`);
  const spawnOptions: childProcess.SpawnOptions = {
    // On non-windows platforms, `detached: true` makes child process a leader of a new
    // process group, making it possible to kill child process tree with `.kill(-pid)` command.
    // @see https://nodejs.org/api/child_process.html#child_process_options_detached
    detached: process.platform !== 'win32',
    env: (options.env as {[key: string]: string}),
    cwd: options.cwd,
    shell: options.shell,
    stdio,
  };
  const spawnedProcess = childProcess.spawn(options.command, options.args || [], spawnOptions);

  const cleanup = async () => {
    options.log(`[pid=${spawnedProcess.pid || 'N/A'}] starting temporary directories cleanup`);
    const errors = await removeFolders(options.tempDirectories);
    for (let i = 0; i < options.tempDirectories.length; ++i) {
      if (errors[i])
        options.log(`[pid=${spawnedProcess.pid || 'N/A'}] exception while removing ${options.tempDirectories[i]}: ${errors[i]}`);
    }
    options.log(`[pid=${spawnedProcess.pid || 'N/A'}] finished temporary directories cleanup`);
  };

  // Prevent Unhandled 'error' event.
  spawnedProcess.on('error', () => {});

  if (!spawnedProcess.pid) {
    let failed: (e: Error) => void;
    const failedPromise = new Promise<Error>((f, r) => failed = f);
    spawnedProcess.once('error', error => {
      failed(new Error('Failed to launch: ' + error));
    });
    return cleanup().then(() => failedPromise).then(e => Promise.reject(e));
  }
  options.log(`<launched> pid=${spawnedProcess.pid}`);

  const stdout = readline.createInterface({ input: spawnedProcess.stdout! });
  stdout.on('line', (data: string) => {
    options.log(`[pid=${spawnedProcess.pid}][out] ` + data);
  });

  const stderr = readline.createInterface({ input: spawnedProcess.stderr! });
  stderr.on('line', (data: string) => {
    options.log(`[pid=${spawnedProcess.pid}][err] ` + data);
  });

  let processClosed = false;
  let fulfillCleanup = () => {};
  const waitForCleanup = new Promise<void>(f => fulfillCleanup = f);
  spawnedProcess.once('exit', (exitCode, signal) => {
    options.log(`[pid=${spawnedProcess.pid}] <process did exit: exitCode=${exitCode}, signal=${signal}>`);
    processClosed = true;
    eventsHelper.removeEventListeners(listeners);
    gracefullyCloseSet.delete(gracefullyClose);
    options.onExit(exitCode, signal);
    // Cleanup as process exits.
    cleanup().then(fulfillCleanup);
  });

  const listeners = [ eventsHelper.addEventListener(process, 'exit', killProcessAndCleanup) ];
  if (options.handleSIGINT) {
    listeners.push(eventsHelper.addEventListener(process, 'SIGINT', () => {
      gracefullyClose().then(() => {
        // Give tests a chance to dispatch any async calls.
        if (isUnderTest())
          setTimeout(() => process.exit(130), 0);
        else
          process.exit(130);
      });
    }));
  }
  if (options.handleSIGTERM)
    listeners.push(eventsHelper.addEventListener(process, 'SIGTERM', gracefullyClose));
  if (options.handleSIGHUP)
    listeners.push(eventsHelper.addEventListener(process, 'SIGHUP', gracefullyClose));
  gracefullyCloseSet.add(gracefullyClose);

  let gracefullyClosing = false;
  async function gracefullyClose(): Promise<void> {
    gracefullyCloseSet.delete(gracefullyClose);
    // We keep listeners until we are done, to handle 'exit' and 'SIGINT' while
    // asynchronously closing to prevent zombie processes. This might introduce
    // reentrancy to this function, for example user sends SIGINT second time.
    // In this case, let's forcefully kill the process.
    if (gracefullyClosing) {
      options.log(`[pid=${spawnedProcess.pid}] <forecefully close>`);
      killProcess();
      await waitForCleanup;  // Ensure the process is dead and we have cleaned up.
      return;
    }
    gracefullyClosing = true;
    options.log(`[pid=${spawnedProcess.pid}] <gracefully close start>`);
    await options.attemptToGracefullyClose().catch(() => killProcess());
    await waitForCleanup;  // Ensure the process is dead and we have cleaned up.
    options.log(`[pid=${spawnedProcess.pid}] <gracefully close end>`);
  }

  // This method has to be sync to be used as 'exit' event handler.
  function killProcess() {
    options.log(`[pid=${spawnedProcess.pid}] <kill>`);
    eventsHelper.removeEventListeners(listeners);
    if (spawnedProcess.pid && !spawnedProcess.killed && !processClosed) {
      options.log(`[pid=${spawnedProcess.pid}] <will force kill>`);
      // Force kill the browser.
      try {
        if (process.platform === 'win32') {
          const taskkillProcess = childProcess.spawnSync(`taskkill /pid ${spawnedProcess.pid} /T /F`, { shell: true });
          const [stdout, stderr] = [taskkillProcess.stdout.toString(), taskkillProcess.stderr.toString()];
          if (stdout)
            options.log(`[pid=${spawnedProcess.pid}] taskkill stdout: ${stdout}`);
          if (stderr)
            options.log(`[pid=${spawnedProcess.pid}] taskkill stderr: ${stderr}`);
        } else {
          process.kill(-spawnedProcess.pid, 'SIGKILL');
        }
      } catch (e) {
        options.log(`[pid=${spawnedProcess.pid}] exception while trying to kill process: ${e}`);
        // the process might have already stopped
      }
    } else {
      options.log(`[pid=${spawnedProcess.pid}] <skipped force kill spawnedProcess.killed=${spawnedProcess.killed} processClosed=${processClosed}>`);
    }
  }

  function killProcessAndCleanup() {
    killProcess();
    options.log(`[pid=${spawnedProcess.pid || 'N/A'}] starting temporary directories cleanup`);
    if (options.tempDirectories.length) {
      const cleanupProcess = childProcess.spawnSync(process.argv0, [path.join(__dirname, 'processLauncherCleanupEntrypoint.js'), ...options.tempDirectories]);
      const [stdout, stderr] = [cleanupProcess.stdout.toString(), cleanupProcess.stderr.toString()];
      if (stdout)
        options.log(`[pid=${spawnedProcess.pid || 'N/A'}] ${stdout}`);
      if (stderr)
        options.log(`[pid=${spawnedProcess.pid || 'N/A'}] ${stderr}`);
    }
    options.log(`[pid=${spawnedProcess.pid || 'N/A'}] finished temporary directories cleanup`);
  }

  function killAndWait() {
    killProcess();
    return waitForCleanup;
  }

  return { launchedProcess: spawnedProcess, gracefullyClose, kill: killAndWait };
}

export function envArrayToObject(env: { name: string, value: string }[]): Env {
  const result: Env = {};
  for (const { name, value } of env)
    result[name] = value;
  return result;
}
