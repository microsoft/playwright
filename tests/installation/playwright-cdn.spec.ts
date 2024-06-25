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
import { test, expect } from './npmTest';
import http from 'http';
import net from 'net';
import type { AddressInfo } from 'net';

test.use({ isolateBrowsers: true });

test(`playwright cdn should race with a timeout`, async ({ exec }) => {
  const server = http.createServer(() => {});
  await new Promise<void>(resolve => server.listen(0, resolve));
  try {
    await exec('npm i playwright');
    const result = await exec('npx playwright install', {
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

test(`npx playwright install should not hang when CDN closes the connection`, async ({ exec }) => {
  let retryCount = 0;
  const server = http.createServer((req, res) => {
    ++retryCount;
    res.writeHead(200, {
      'Content-Length': 100 * 1024 * 1024,
      'Content-Type': 'application/zip',
    });
    res.end('a');
  });
  await new Promise<void>(resolve => server.listen(0, resolve));
  try {
    await exec('npm i playwright');
    const result = await exec('npx playwright install', {
      env: {
        PLAYWRIGHT_DOWNLOAD_HOST: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        DEBUG: 'pw:install',
      },
      expectToExitWithError: true
    });
    expect(retryCount).toBe(3);
    expect([...result.matchAll(/Download failed: server closed connection/g)]).toHaveLength(3);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test(`npx playwright install should not hang when CDN TCP connection stalls`, async ({ exec }) => {
  let retryCount = 0;
  const socketsToDestroy = [];
  const server = net.createServer(socket => {
    socketsToDestroy.push(socket);
    ++retryCount;
    socket.write('HTTP/1.1 200 OK\r\n');
    socket.write('Content-Length: 100000000\r\n');
    socket.write('Content-Type: application/zip\r\n');
    socket.write('\r\n');
    socket.write('a');
  });
  await new Promise<void>(resolve => server.listen(0, resolve));
  try {
    await exec('npm i playwright');
    const result = await exec('npx playwright install', {
      env: {
        PLAYWRIGHT_DOWNLOAD_HOST: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        DEBUG: 'pw:install',
        PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT: '1000',
      },
      expectToExitWithError: true
    });
    expect(retryCount).toBe(3);
    expect([...result.matchAll(/timed out after/g)]).toHaveLength(3);
  } finally {
    for (const socket of socketsToDestroy)
      socket.destroy();
    await new Promise(resolve => server.close(resolve));
  }
});
