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
import * as fs from 'fs';
import socks from 'socksv5';
import { installCoverageHooks } from './coverage';
import * as childProcess from 'child_process';
import { start } from '../../lib/outofprocess';
import { PlaywrightClient } from '../../lib/remote/playwrightClient';

export type BrowserName = 'chromium' | 'firefox' | 'webkit';
type Mode = 'default' | 'driver' | 'service';
type BaseOptions = {
  mode: Mode;
  browserName: BrowserName;
  channel?: string;
  video?: boolean;
  headless?: boolean;
};
type BaseWorkerArgs = {
  platform: 'win32' | 'darwin' | 'linux';
  playwright: typeof import('../../index');
  toImpl: (rpcObject: any) => any;
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
};

class DriverMode {
  private _playwrightObject: any;

  async setup(workerInfo: folio.WorkerInfo) {
    this._playwrightObject = await start();
    return this._playwrightObject;
  }

  async teardown() {
    await this._playwrightObject.stop();
  }
}

class ServiceMode {
  private _playwrightObejct: any;
  private _client: any;
  private _serviceProcess: childProcess.ChildProcess;

  async setup(workerInfo: folio.WorkerInfo) {
    const port = 10507 + workerInfo.workerIndex;
    this._serviceProcess = childProcess.fork(path.join(__dirname, '..', '..', 'lib', 'cli', 'cli.js'), ['run-server', String(port)], {
      stdio: 'pipe'
    });
    this._serviceProcess.stderr.pipe(process.stderr);
    await new Promise<void>(f => {
      this._serviceProcess.stdout.on('data', data => {
        if (data.toString().includes('Listening on'))
          f();
      });
    });
    this._serviceProcess.on('exit', this._onExit);
    this._client = await PlaywrightClient.connect(`ws://localhost:${port}/ws`);
    this._playwrightObejct = this._client.playwright();
    return this._playwrightObejct;
  }

  async teardown() {
    await this._client.close();
    this._serviceProcess.removeListener('exit', this._onExit);
    const processExited = new Promise(f => this._serviceProcess.on('exit', f));
    this._serviceProcess.kill();
    await processExited;
  }

  private _onExit(exitCode, signal) {
    throw new Error(`Server closed with exitCode=${exitCode} signal=${signal}`);
  }
}

class DefaultMode {
  async setup(workerInfo: folio.WorkerInfo) {
    return require('../../index');
  }

  async teardown() {
  }
}

class BaseEnv {
  private _mode: DriverMode | ServiceMode | DefaultMode;
  private _options: BaseOptions;
  private _playwright: typeof import('../../index');

  hasBeforeAllOptions(options: BaseOptions) {
    return 'mode' in options || 'browserName' in options || 'channel' in options || 'video' in options || 'headless' in options;
  }

  async beforeAll(options: BaseOptions, workerInfo: folio.WorkerInfo): Promise<BaseWorkerArgs> {
    this._options = options;
    this._mode = {
      default: new DefaultMode(),
      service: new ServiceMode(),
      driver: new DriverMode(),
    }[this._options.mode];
    require('../../lib/utils/utils').setUnderTest();
    this._playwright = await this._mode.setup(workerInfo);
    return {
      playwright: this._playwright,
      isWindows: process.platform === 'win32',
      isMac: process.platform === 'darwin',
      isLinux: process.platform === 'linux',
      platform: process.platform as ('win32' | 'darwin' | 'linux'),
      toImpl: (this._playwright as any)._toImpl,
    };
  }

  async beforeEach({}, testInfo: folio.TestInfo) {
    testInfo.snapshotPathSegment = this._options.browserName;
    testInfo.data = { browserName: this._options.browserName };
    if (!this._options.headless)
      testInfo.data.headful = true;
    if (this._options.mode !== 'default')
      testInfo.data.mode = this._options.mode;
    if (this._options.video)
      testInfo.data.video = true;
    return {};
  }

  async afterAll({}, workerInfo: folio.WorkerInfo) {
    await this._mode.teardown();
  }
}

type ServerWorkerArgs = {
  asset: (path: string) => string;
  socksPort: number;
  server: TestServer;
  httpsServer: TestServer;
};

type ServerOptions = {
  loopback?: string;
};

class ServerEnv {
  private _server: TestServer;
  private _httpsServer: TestServer;
  private _socksServer: any;
  private _socksPort: number;

  hasBeforeAllOptions(options: ServerOptions) {
    return 'loopback' in options;
  }

  async beforeAll(options: ServerOptions, workerInfo: folio.WorkerInfo) {
    const assetsPath = path.join(__dirname, '..', 'assets');
    const cachedPath = path.join(__dirname, '..', 'assets', 'cached');

    const port = 8907 + workerInfo.workerIndex * 3;
    this._server = await TestServer.create(assetsPath, port, options.loopback);
    this._server.enableHTTPCache(cachedPath);

    const httpsPort = port + 1;
    this._httpsServer = await TestServer.createHTTPS(assetsPath, httpsPort, options.loopback);
    this._httpsServer.enableHTTPCache(cachedPath);

    this._socksServer = socks.createServer((info, accept, deny) => {
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
    this._socksPort = port + 2;
    this._socksServer.listen(this._socksPort, 'localhost');
    this._socksServer.useAuth(socks.auth.None());
    return {
      asset: (p: string) => path.join(__dirname, '..', 'assets', ...p.split('/')),
      server: this._server,
      httpsServer: this._httpsServer,
      socksPort: this._socksPort,
    };
  }

  async beforeEach({}, testInfo: folio.TestInfo) {
    this._server.reset();
    this._httpsServer.reset();
    return {};
  }

  async afterAll({}, workerInfo: folio.WorkerInfo) {
    await Promise.all([
      this._server.stop(),
      this._httpsServer.stop(),
      this._socksServer.close(),
    ]);
  }
}

type CoverageOptions = {
  coverageName?: string;
};

class CoverageEnv {
  private _coverage: ReturnType<typeof installCoverageHooks> | undefined;

  hasBeforeAllOptions(options: CoverageOptions) {
    return 'coverageName' in options;
  }

  async beforeAll(options: CoverageOptions, workerInfo: folio.WorkerInfo) {
    if (options.coverageName)
      this._coverage = installCoverageHooks(options.coverageName);
    return {};
  }

  async afterAll({}, workerInfo: folio.WorkerInfo) {
    if (!this._coverage)
      return;
    const { coverage, uninstall } = this._coverage;
    uninstall();
    const coveragePath = path.join(__dirname, '..', 'coverage-report', workerInfo.workerIndex + '.json');
    const coverageJSON = Array.from(coverage.keys()).filter(key => coverage.get(key));
    await fs.promises.mkdir(path.dirname(coveragePath), { recursive: true });
    await fs.promises.writeFile(coveragePath, JSON.stringify(coverageJSON, undefined, 2), 'utf8');
  }
}

export type CommonOptions = BaseOptions & ServerOptions & CoverageOptions;
export type CommonArgs = CommonOptions & BaseWorkerArgs & ServerWorkerArgs;

export const baseTest = folio.test.extend(new CoverageEnv()).extend(new ServerEnv()).extend(new BaseEnv());
