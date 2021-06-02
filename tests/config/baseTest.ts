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

import { TestServer } from '../../utils/testserver';
import * as folio from 'folio';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import socks from 'socksv5';
import { installCoverageHooks } from './coverage';
import * as childProcess from 'child_process';
import { start } from '../../lib/outofprocess';
import { PlaywrightClient } from '../../lib/remote/playwrightClient';
import type { PlaywrightClientConnectOptions } from '../../src/remote/playwrightClient';
import type { PlaywrightServerOptions } from '../../src/remote/playwrightServer';
import type { LaunchOptions } from '../../index';

export type BrowserName = 'chromium' | 'firefox' | 'webkit';
export type Mode = 'default' | 'driver' | 'service';
type PlaywrightModeSetupOptions = Partial<PlaywrightClientConnectOptions & PlaywrightServerOptions>;
type BaseOptions = {
  mode: Mode;
  browserName: BrowserName;
  channel: LaunchOptions['channel'];
  video: boolean | undefined;
  headless: boolean | undefined;
};
type BaseFixtures = {
  platform: 'win32' | 'darwin' | 'linux';
  getPlaywright: (options?: PlaywrightModeSetupOptions) => Promise<typeof import('../../index')>;
  playwright: typeof import('../../index');
  toImpl: (rpcObject: any) => any;
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
};

class DriverMode {
  private _playwrightObject: any;

  async setup(workerIndex: number) {
    this._playwrightObject = await start();
    return this._playwrightObject;
  }

  async teardown() {
    await this._playwrightObject.stop();
  }
}

class ServiceMode {
  private _playwrightObject: any;
  private _client: any;
  private _serviceProcess: childProcess.ChildProcess;
  private _tmpConfigFile?: string;

  async setup(workerIndex: number, options?: PlaywrightModeSetupOptions) {
    const config: any = {port: 10507 + workerIndex};
    if (options?.acceptForwardedPorts)
      config.acceptForwardedPorts = options.acceptForwardedPorts;
    this._tmpConfigFile = path.join(os.tmpdir(), `pw-server-config-${workerIndex}.json`);
    await fs.promises.writeFile(this._tmpConfigFile, JSON.stringify(config));
    this._serviceProcess = childProcess.fork(path.join(__dirname, '..', '..', 'lib', 'cli', 'cli.js'), [
      'run-server',
      ...(this._tmpConfigFile ? [this._tmpConfigFile] : [])
    ], {
      stdio: 'pipe',
    });
    this._serviceProcess.stderr.pipe(process.stderr);
    const wsEndpoint = await new Promise<string>(f => {
      this._serviceProcess.stdout.on('data', (data: Buffer) => {
        const prefix = 'Listening on ';
        const line = data.toString();
        if (line.startsWith(prefix))
          f(line.substring(prefix.length).trim());
      });
    });
    this._serviceProcess.on('exit', this._onExit);
    this._client = await PlaywrightClient.connect({
      wsEndpoint,
      forwardPorts: options?.forwardPorts
    });
    this._playwrightObject = this._client.playwright();
    return this._playwrightObject;
  }

  async teardown() {
    await this._client.close();
    this._serviceProcess.removeListener('exit', this._onExit);
    const processExited = new Promise(f => this._serviceProcess.on('exit', f));
    this._serviceProcess.kill();
    if (this._tmpConfigFile)
      await fs.promises.unlink(this._tmpConfigFile);
    await processExited;
  }

  private _onExit(exitCode, signal) {
    throw new Error(`Server closed with exitCode=${exitCode} signal=${signal}`);
  }
}

class DefaultMode {
  async setup(workerIndex: number) {
    return require('../../index');
  }

  async teardown() {
  }
}

const baseFixtures: folio.Fixtures<{ __baseSetup: void }, BaseOptions & BaseFixtures> = {
  mode: [ 'default', { scope: 'worker' } ],
  browserName: [ 'chromium' , { scope: 'worker' } ],
  channel: [ undefined, { scope: 'worker' } ],
  video: [ undefined, { scope: 'worker' } ],
  headless: [ undefined, { scope: 'worker' } ],
  platform: [ process.platform as 'win32' | 'darwin' | 'linux', { scope: 'worker' } ],
  getPlaywright: [ async ({ mode }, run, workerInfo) => {
    const modeImpl = {
      default: new DefaultMode(),
      service: new ServiceMode(),
      driver: new DriverMode(),
    }[mode];
    require('../../lib/utils/utils').setUnderTest();
    await run(async (options: PlaywrightModeSetupOptions) => {
      const playwright = await modeImpl.setup(workerInfo.workerIndex, options);
      return playwright;
    });
    await modeImpl.teardown();
  }, { scope: 'worker' } ],
  playwright: [ async ({ getPlaywright }, run) => {
    const playwright = await getPlaywright();
    await run(playwright);
  }, { scope: 'worker' } ],
  toImpl: [ async ({ playwright }, run) => run((playwright as any)._toImpl), { scope: 'worker' } ],
  isWindows: [ process.platform === 'win32', { scope: 'worker' } ],
  isMac: [ process.platform === 'darwin', { scope: 'worker' } ],
  isLinux: [ process.platform === 'linux', { scope: 'worker' } ],
  __baseSetup: [ async ({ browserName }, run, testInfo) => {
    testInfo.snapshotSuffix = browserName;
    await run();
  }, { auto: true } ],
};

type ServerOptions = {
  loopback?: string;
};
type ServerFixtures = {
  server: TestServer;
  httpsServer: TestServer;
  socksPort: number;
  asset: (p: string) => string;
};

type ServersInternal = ServerFixtures & { socksServer: any };
const serverFixtures: folio.Fixtures<ServerFixtures, ServerOptions & { __servers: ServersInternal }> = {
  loopback: [ undefined, { scope: 'worker' } ],
  __servers: [ async ({ loopback }, run, workerInfo) => {
    const assetsPath = path.join(__dirname, '..', 'assets');
    const cachedPath = path.join(__dirname, '..', 'assets', 'cached');

    const port = 8907 + workerInfo.workerIndex * 3;
    const server = await TestServer.create(assetsPath, port, loopback);
    server.enableHTTPCache(cachedPath);

    const httpsPort = port + 1;
    const httpsServer = await TestServer.createHTTPS(assetsPath, httpsPort, loopback);
    httpsServer.enableHTTPCache(cachedPath);

    const socksServer = socks.createServer((info, accept, deny) => {
      let socket;
      if ((socket = accept(true))) {
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

    await run({
      asset: (p: string) => path.join(__dirname, '..', 'assets', ...p.split('/')),
      server,
      httpsServer,
      socksPort,
      socksServer,
    });

    await Promise.all([
      server.stop(),
      httpsServer.stop(),
      socksServer.close(),
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

  asset: async ({ __servers }, run) => {
    await run(__servers.asset);
  },
};

type CoverageOptions = {
  coverageName?: string;
};

const coverageFixtures: folio.Fixtures<{}, CoverageOptions & { __collectCoverage: void }> = {
  coverageName: [ undefined, { scope: 'worker' } ],

  __collectCoverage: [ async ({ coverageName }, run, workerInfo) => {
    if (!coverageName) {
      await run();
      return;
    }

    const { coverage, uninstall } = installCoverageHooks(coverageName);
    await run();
    uninstall();
    const coveragePath = path.join(__dirname, '..', 'coverage-report', workerInfo.workerIndex + '.json');
    const coverageJSON = Array.from(coverage.keys()).filter(key => coverage.get(key));
    await fs.promises.mkdir(path.dirname(coveragePath), { recursive: true });
    await fs.promises.writeFile(coveragePath, JSON.stringify(coverageJSON, undefined, 2), 'utf8');
  }, { scope: 'worker', auto: true } ],
};

export type CommonOptions = BaseOptions & ServerOptions & CoverageOptions;
export type CommonWorkerFixtures = CommonOptions & BaseFixtures;

export const baseTest = folio.test.extend<{}, CoverageOptions>(coverageFixtures).extend<ServerFixtures>(serverFixtures).extend<{}, BaseOptions & BaseFixtures>(baseFixtures);
