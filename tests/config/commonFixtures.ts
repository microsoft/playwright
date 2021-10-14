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
import { ChildProcess, execSync, spawn } from 'child_process';
import net from 'net';
import path from 'path';
import socks from 'socksv5';
import { TestServer } from '../../utils/testserver';
import { TestProxy } from './proxy';

type TestChildParams = {
  command: string[],
  cwd?: string,
  env?: { [key: string]: string | number | boolean | undefined },
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
      } as any,
      cwd: params.cwd,
      shell: params.shell,
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

    const onExit = () => {
      if (!this.process.pid || this.process.killed)
        return;
      try {
        if (process.platform === 'win32')
          execSync(`taskkill /pid ${this.process.pid} /T /F /FI "MEMUSAGE gt 0"`);
        else
          process.kill(-this.process.pid, 'SIGKILL');
      } catch (e) {
        // the process might have already stopped
      }
    };
    process.on('exit', onExit);
    this.exited = new Promise(f => {
      this.process.on('exit', (exitCode, signal) => f({ exitCode, signal }));
      process.off('exit', onExit);
    });
    this.exitCode = this.exited.then(r => r.exitCode);
  }

  async close() {
    if (!this.process.killed)
      this.process.kill();
    return this.exited;
  }

  async cleanExit() {
    const r = await this.exited;
    if (r.exitCode)
      throw new Error(`Process failed with exit code ${r.exitCode}`);
    if (r.signal)
      throw new Error(`Process recieved signal: ${r.signal}`);
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
    if (testInfo.status !== 'passed' && !process.env.PWTEST_DEBUG) {
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

export type ServerOptions = {
  loopback?: string;
};
export type ServerFixtures = {
  server: TestServer;
  httpsServer: TestServer;
  socksPort: number;
  proxyServer: TestProxy;
  asset: (p: string) => string;
};

export type ServersInternal = ServerFixtures & { socksServer: socks.SocksServer };
export const serverFixtures: Fixtures<ServerFixtures, ServerOptions & { __servers: ServersInternal }> = {
  loopback: [ undefined, { scope: 'worker' } ],
  __servers: [ async ({ loopback }, run, workerInfo) => {
    const assetsPath = path.join(__dirname, '..', 'assets');
    const cachedPath = path.join(__dirname, '..', 'assets', 'cached');

    const port = 8907 + workerInfo.workerIndex * 4;
    const server = await TestServer.create(assetsPath, port, loopback);
    server.enableHTTPCache(cachedPath);

    const httpsPort = port + 1;
    const httpsServer = await TestServer.createHTTPS(assetsPath, httpsPort, loopback);
    httpsServer.enableHTTPCache(cachedPath);

    const socksServer = socks.createServer((info, accept, deny) => {
      const socket = accept(true);
      if (socket) {
        // Catch and ignore ECONNRESET errors.
        socket.on('error', () => {});
        const body = '<html><title>Served by the SOCKS proxy</title></html>';
        socket.end([
          'HTTP/1.1 200 OK',
          'Connection: close',
          'Content-Type: text/html',
          'Content-Length: ' + Buffer.byteLength(body),
          '',
          body
        ].join('\r\n'));
      }
    });
    const socksPort = port + 2;
    socksServer.listen(socksPort, 'localhost');
    socksServer.useAuth(socks.auth.None());

    const proxyPort = port + 3;
    const proxyServer = await TestProxy.create(proxyPort);

    await run({
      asset: (p: string) => path.join(__dirname, '..', 'assets', ...p.split('/')),
      server,
      httpsServer,
      socksPort,
      proxyServer,
      socksServer,
    });

    await Promise.all([
      server.stop(),
      httpsServer.stop(),
      socksServer.close(),
      proxyServer.stop(),
    ]);
  }, { scope: 'worker' } ],

  server: async ({ __servers }, run) => {
    __servers.server.reset();
    await run(__servers.server);
  },

  httpsServer: async ({ __servers }, run) => {
    __servers.httpsServer.reset();
    await run(__servers.httpsServer);
  },

  socksPort: async ({ __servers }, run) => {
    await run(__servers.socksPort);
  },

  proxyServer: async ({ __servers }, run) => {
    __servers.proxyServer.reset();
    await run(__servers.proxyServer);
  },

  asset: async ({ __servers }, run) => {
    await run(__servers.asset);
  },
};
