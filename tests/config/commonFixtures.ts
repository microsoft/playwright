/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Fixtures } from '@playwright/test';
import type { ChildProcess } from 'child_process';
import { execSync, spawn } from 'child_process';
import net from 'net';

type TestChildParams = {
  command: string[],
  cwd?: string,
  env?: NodeJS.ProcessEnv,
  shell?: boolean,
  onOutput?: () => void;
};

export class TestChildProcess {
  params: TestChildParams;
  process: ChildProcess;
  output = '';
  onOutput?: () => void;
  exited: Promise<{ exitCode: number | null, signal: string | null }>;
  exitCode: Promise<number>;

  private _outputCallbacks = new Set<() => void>();

  constructor(params: TestChildParams) {
    this.params = params;
    this.process = spawn(params.command[0], params.command.slice(1), {
      env: {
        ...process.env,
        ...params.env,
      },
      cwd: params.cwd,
      shell: params.shell,
      // On non-windows platforms, `detached: true` makes child process a leader of a new
      // process group, making it possible to kill child process tree with `.kill(-pid)` command.
      // @see https://nodejs.org/api/child_process.html#child_process_options_detached
      detached: process.platform !== 'win32',
    });
    if (process.env.PWTEST_DEBUG)
      process.stdout.write(`\n\nLaunching ${params.command.join(' ')}\n`);
    this.onOutput = params.onOutput;

    const appendChunk = (chunk: string | Buffer) => {
      this.output += String(chunk);
      if (process.env.PWTEST_DEBUG)
        process.stdout.write(String(chunk));
      this.onOutput?.();
      for (const cb of this._outputCallbacks)
        cb();
      this._outputCallbacks.clear();
    };

    this.process.stderr.on('data', appendChunk);
    this.process.stdout.on('data', appendChunk);

    const killProcessGroup = this._killProcessGroup.bind(this);
    process.on('exit', killProcessGroup);
    this.exited = new Promise(f => {
      this.process.on('exit', (exitCode, signal) => f({ exitCode, signal }));
      process.off('exit', killProcessGroup);
    });
    this.exitCode = this.exited.then(r => r.exitCode);
  }

  async close() {
    if (!this.process.killed)
      this._killProcessGroup();
    return this.exited;
  }

  private _killProcessGroup() {
    if (!this.process.pid || this.process.killed)
      return;
    try {
      if (process.platform === 'win32')
        execSync(`taskkill /pid ${this.process.pid} /T /F /FI "MEMUSAGE gt 0"`, { stdio: 'ignore' });
      else
        process.kill(-this.process.pid, 'SIGKILL');
    } catch (e) {
      // the process might have already stopped
    }
  }

  async cleanExit() {
    const r = await this.exited;
    if (r.exitCode)
      throw new Error(`Process failed with exit code ${r.exitCode}`);
    if (r.signal)
      throw new Error(`Process received signal: ${r.signal}`);
  }

  async waitForOutput(substring: string) {
    while (!this.output.includes(substring))
      await new Promise<void>(f => this._outputCallbacks.add(f));
  }
}

export type CommonFixtures = {
  childProcess: (params: TestChildParams) => TestChildProcess;
  waitForPort: (port: number) => Promise<void>;
};

export const commonFixtures: Fixtures<CommonFixtures, {}> = {
  childProcess: async ({}, use, testInfo) => {
    const processes: TestChildProcess[] = [];
    await use(params => {
      const process = new TestChildProcess(params);
      processes.push(process);
      return process;
    });
    await Promise.all(processes.map(child => child.close()));
    if (testInfo.status !== 'passed' && testInfo.status !== 'skipped' && !process.env.PWTEST_DEBUG) {
      for (const process of processes) {
        console.log('====== ' + process.params.command.join(' '));
        console.log(process.output);
        console.log('=========================================');
      }
    }
  },

  waitForPort: async ({}, use) => {
    const token = { canceled: false };
    await use(async port => {
      while (!token.canceled) {
        const promise = new Promise<boolean>(resolve => {
          const conn = net.connect(port)
              .on('error', () => resolve(false))
              .on('connect', () => {
                conn.end();
                resolve(true);
              });
        });
        if (await promise)
          return;
        await new Promise(x => setTimeout(x, 100));
      }
    });
    token.canceled = true;
  },
};
