/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import { folio as base } from 'folio';
import path from 'path';
import socks from 'socksv5';
import { TestServer } from '../utils/testserver';

type HttpWorkerFixtures = {
  asset: (path: string) => string;
  httpService: { server: TestServer, httpsServer: TestServer };
  socksPort: number,
};

type HttpTestFixtures = {
  server: TestServer;
  httpsServer: TestServer;
};

const fixtures = base.extend<HttpTestFixtures, HttpWorkerFixtures>();
fixtures.httpService.init(async ({ testWorkerIndex }, test) => {
  const assetsPath = path.join(__dirname, 'assets');
  const cachedPath = path.join(__dirname, 'assets', 'cached');

  const port = 8907 + testWorkerIndex * 2;
  const server = await TestServer.create(assetsPath, port);
  server.enableHTTPCache(cachedPath);

  const httpsPort = port + 1;
  const httpsServer = await TestServer.createHTTPS(assetsPath, httpsPort);
  httpsServer.enableHTTPCache(cachedPath);

  await test({ server, httpsServer });

  await Promise.all([
    server.stop(),
    httpsServer.stop(),
  ]);
}, { scope: 'worker' });

fixtures.asset.init(async ({ }, test) => {
  await test(p => path.join(__dirname, `assets`, p));
}, { scope: 'worker' });

fixtures.server.init(async ({ httpService }, test) => {
  httpService.server.reset();
  await test(httpService.server);
});

fixtures.httpsServer.init(async ({ httpService }, test) => {
  httpService.httpsServer.reset();
  await test(httpService.httpsServer);
});

fixtures.socksPort.init(async ({ testWorkerIndex }, run) => {
  const server = socks.createServer((info, accept, deny) => {
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
  const socksPort = 9107 + testWorkerIndex * 2;
  server.listen(socksPort, 'localhost');
  server.useAuth(socks.auth.None());
  await run(socksPort);
  server.close();
}, { scope: 'worker' });

export const folio = fixtures.build();
