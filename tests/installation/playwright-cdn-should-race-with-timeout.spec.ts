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
import http from 'http';
import type { AddressInfo } from 'net';
import { test, expect } from './npmTest';

test(`playwright cdn should race with a timeout`, async ({ exec }) => {
  const server = http.createServer(() => {});
  await new Promise<void>(resolve => server.listen(0, resolve));
  try {
    const result = await exec('npm i --foreground-scripts playwright', {
      env: {
        PLAYWRIGHT_DOWNLOAD_HOST: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        DEBUG: 'pw:install',
        PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT: '1000',
      },
      expectToExitWithError: true
    });
    expect(result).toContain(`timed out after 1000ms`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
