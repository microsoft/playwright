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

import { fixtures as baseFixtures } from '@playwright/test-runner';
import path from 'path';
import { TestServer } from '../utils/testserver';

type HttpWorkerFixtures = {
  asset: (path: string) => string;
  httpService: { server: TestServer, httpsServer: TestServer };
};

type HttpTestFixtures = {
  server: TestServer;
  httpsServer: TestServer;
};

export const fixtures = baseFixtures
    .defineWorkerFixtures<HttpWorkerFixtures>({
      httpService: async ({ testWorkerIndex }, test) => {
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
      },

      asset: async ({ }, test) => {
        await test(p => path.join(__dirname, `assets`, p));
      },
    })
    .defineTestFixtures<HttpTestFixtures>({
      server: async ({ httpService }, test) => {
        httpService.server.reset();
        await test(httpService.server);
      },

      httpsServer: async ({ httpService }, test) => {
        httpService.httpsServer.reset();
        await test(httpService.httpsServer);
      },
    });
