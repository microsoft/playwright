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
import fs from 'fs';
import { stripAnsi } from './utils';

type TestChildParams = {
  command: string[],
  cwd?: string,
  env?: NodeJS.ProcessEnv,
  shell?: boolean,
  onOutput?: () => void;
};

import childProcess from 'child_process';

type ProcessData = {
  pid: number, // process ID
  pgrp: number, // process group ID
  children: Set<ProcessData>, // direct children of the process
};

function readAllProcessesLinux(): { pid: number, ppid: number, pgrp: number }[] {
  const result: {pid: number, ppid: number, pgrp: number}[] = [];
  for (const dir of fs.readdirSync('/proc')) {
    const pid = +dir;
    if (isNaN(pid))
      continue;
    try {
      const statFile = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      // Format of /proc/*/stat is described https://man7.org/linux/man-pages/man5/proc.5.html
      const match = statFile.match(/^(?<pid>\d+)\s+\((?<comm>.*)\)\s+(?<state>R|S|D|Z|T|t|W|X|x|K|W|P)\s+(?<ppid>\d+)\s+(?<pgrp>\d+)/);
      if (match && match.groups) {
        result.push({
          pid: +match.groups.pid,
          ppid: +match.groups.ppid,
          pgrp: +match.groups.pgrp,
        });
      }
    } catch (e) {
      // We don't have access to some /proc/<pid>/stat file.
    }
  }
  return result;
}

function readAllProcessesMacOS(): { pid: number, ppid: number, pgrp: number }[] {
  const result: {pid: number, ppid: number, pgrp: number}[] = [];
  const processTree = childProcess.spawnSync('ps', ['-eo', 'pid,pgid,ppid']);
  const lines = processTree.stdout.toString().trim().split('\n');
  for (const line of lines) {
    const [pid, pgrp, ppid] = line.trim().split(/\s+/).map(token => +token);
    // On linux, the very first line of `ps` is the header with "PID PGID PPID".
    if (isNaN(pid) || isNaN(pgrp) || isNaN(ppid))
      continue;
    result.push({ pid, ppid, pgrp });
  }
  return result;
}

function buildProcessTreePosix(pid: number): ProcessData {
  // Certain Linux distributions might not have `ps` installed.
  const allProcesses = process.platform === 'darwin' ? readAllProcessesMacOS() : readAllProcessesLinux();
  const pidToProcess = new Map<number, ProcessData>();
  for (const { pid, pgrp } of allProcesses)
    pidToProcess.set(pid, { pid, pgrp, children: new Set() });
  for (const { pid, ppid } of allProcesses) {
    const parent = pidToProcess.get(ppid);
    const child = pidToProcess.get(pid);
    // On POSIX, certain processes might not have parent (e.g. PID=1 and occasionally PID=2)
    // or we might not have access to it proc info.
    if (parent && child)
      parent.children.add(child);
  }
  return pidToProcess.get(pid)!;
}

export class TestChildProcess {
  params: TestChildParams;
  process: ChildProcess;
  output = '';
  stdout = '';
  stderr = '';
  fullOutput = '';
  onOutput?: (chunk: string | Buffer) => void;
  exited: Promise<{ exitCode: number | null, signal: string | null }>;
  exitCode: Promise<number | null>;

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

    const appendChunk = (type: 'stdout' | 'stderr', chunk: string | Buffer) => {
      this.output += String(chunk);
      if (type === 'stderr')
        this.stderr += String(chunk);
      else
        this.stdout += String(chunk);
      if (process.env.PWTEST_DEBUG)
        process.stdout.write(String(chunk));
      else
        this.fullOutput += String(chunk);
      this.onOutput?.(chunk);
      for (const cb of this._outputCallbacks)
        cb();
      this._outputCallbacks.clear();
    };

    this.process.stderr!.on('data', appendChunk.bind(null, 'stderr'));
    this.process.stdout!.on('data', appendChunk.bind(null, 'stdout'));

    const killProcessGroup = this._killProcessTree.bind(this, 'SIGKILL');
    process.on('exit', killProcessGroup);
    this.exited = new Promise(f => {
      this.process.on('exit', (exitCode, signal) => f({ exitCode, signal }));
      process.off('exit', killProcessGroup);
    });
    this.exitCode = this.exited.then(r => r.exitCode);
  }

  outputLines(): string[] {
    const strippedOutput = stripAnsi(this.output);
    return strippedOutput.split('\n').filter(line => line.startsWith('%%')).map(line => line.substring(2).trim());
  }

  async kill(signal: 'SIGINT' | 'SIGKILL' = 'SIGKILL') {
    this._killProcessTree(signal);
    return this.exited;
  }

  private _killProcessTree(signal: 'SIGINT' | 'SIGKILL') {
    if (!this.process.pid || !this.process.kill(0))
      return;

    // On Windows, we always call `taskkill` no matter signal.
    if (process.platform === 'win32') {
      try {
        execSync(`taskkill /pid ${this.process.pid} /T /F /FI "MEMUSAGE gt 0"`, { stdio: 'ignore' });
      } catch (e) {
        // the process might have already stopped
      }
      return;
    }

    // In case of POSIX and `SIGINT` signal, send it to the main process group only.
    if (signal === 'SIGINT') {
      try {
        process.kill(-this.process.pid, 'SIGINT');
      } catch (e) {
        // the process might have already stopped
      }
      return;
    }

    // In case of POSIX and `SIGKILL` signal, we should send it to all descendant process groups.
    const rootProcess = buildProcessTreePosix(this.process.pid);
    const descendantProcessGroups = (function flatten(processData: ProcessData, result: Set<number> = new Set()) {
      // Process can nullify its own process group with `setpgid`. Use its PID instead.
      result.add(processData.pgrp || processData.pid);
      processData.children.forEach(child => flatten(child, result));
      return result;
    })(rootProcess);
    for (const pgrp of descendantProcessGroups) {
      try {
        process.kill(-pgrp, 'SIGKILL');
      } catch (e) {
        // the process might have already stopped
      }
    }
  }

  async cleanExit() {
    const r = await this.exited;
    if (r.exitCode)
      throw new Error(`Process failed with exit code ${r.exitCode}`);
    if (r.signal)
      throw new Error(`Process received signal: ${r.signal}`);
  }

  async waitForOutput(substring: string, count = 1) {
    while (countTimes(stripAnsi(this.output), substring) < count)
      await new Promise<void>(f => this._outputCallbacks.add(f));
  }

  clearOutput() {
    this.output = '';
  }

  write(chars: string) {
    this.process.stdin!.write(chars);
  }
}

export type CommonFixtures = {
  childProcess: (params: TestChildParams) => TestChildProcess;
  waitForPort: (port: number) => Promise<void>;
};

export type CommonWorkerFixtures = {
  daemonProcess: (params: TestChildParams) => TestChildProcess;
};

export const commonFixtures: Fixtures<CommonFixtures, CommonWorkerFixtures> = {
  childProcess: async ({}, use, testInfo) => {
    const processes: TestChildProcess[] = [];
    await use(params => {
      const process = new TestChildProcess(params);
      processes.push(process);
      return process;
    });
    await Promise.all(processes.map(async child => child.kill()));
    if (testInfo.status !== 'passed' && testInfo.status !== 'skipped' && !process.env.PWTEST_DEBUG) {
      for (const process of processes) {
        console.log('====== ' + process.params.command.join(' '));
        console.log(process.fullOutput.replace(/\x1Bc/g, ''));
        console.log('=========================================');
      }
    }
  },

  daemonProcess: [async ({}, use) => {
    const processes: TestChildProcess[] = [];
    await use(params => {
      const process = new TestChildProcess(params);
      processes.push(process);
      return process;
    });
    await Promise.all(processes.map(child => child.kill('SIGINT')));
  }, { scope: 'worker' }],

  waitForPort: async ({}, use) => {
    const token = { canceled: false };
    await use(async port => {
      while (!token.canceled) {
        const promise = new Promise<boolean>(resolve => {
          const conn = net.connect(port, '127.0.0.1')
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

export function countTimes(s: string, sub: string): number {
  let result = 0;
  for (let index = 0; index !== -1;) {
    index = s.indexOf(sub, index);
    if (index !== -1) {
      result++;
      index += sub.length;
    }
  }
  return result;
}
