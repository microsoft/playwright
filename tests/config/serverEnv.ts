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

import type { WorkerInfo, TestInfo, Env } from 'folio';
import { TestServer } from '../../utils/testserver';
import * as path from 'path';
import socks from 'socksv5';
import { ServerTestArgs } from './serverTest';

export class ServerEnv implements Env<ServerTestArgs> {
  private _server: TestServer;
  private _httpsServer: TestServer;
  private _socksServer: any;
  private _socksPort: number;

  async beforeAll(workerInfo: WorkerInfo) {
    const assetsPath = path.join(__dirname, '..', '..', 'test', 'assets');
    const cachedPath = path.join(__dirname, '..', '..', 'test', 'assets', 'cached');

    const port = 8907 + workerInfo.workerIndex * 3;
    this._server = await TestServer.create(assetsPath, port);
    this._server.enableHTTPCache(cachedPath);

    const httpsPort = port + 1;
    this._httpsServer = await TestServer.createHTTPS(assetsPath, httpsPort);
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
  }

  async beforeEach(testInfo: TestInfo) {
    this._server.reset();
    this._httpsServer.reset();
    return {
      asset: (p: string) => path.join(__dirname, '..', '..', 'test', 'assets', p),
      server: this._server,
      httpsServer: this._httpsServer,
      socksPort: this._socksPort,
    };
  }

  async afterAll(workerInfo: WorkerInfo) {
    await Promise.all([
      this._server.stop(),
      this._httpsServer.stop(),
      this._socksServer.close(),
    ]);
  }
}
