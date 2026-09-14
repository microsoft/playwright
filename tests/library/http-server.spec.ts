/**
 * Copyright (c) Microsoft Corporation.
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

import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { test, expect } from '@playwright/test';
import { HttpServer } from '../../packages/utils/httpServer';

async function startServer(dir: string) {
  const server = new HttpServer(dir);
  server.routePrefix('/', (request, response) => {
    const url = new URL(request.url!, 'http://localhost');
    const filePath = path.join(dir, path.basename(url.pathname));
    return server.serveFile(request, response, filePath);
  });
  await server.start({ port: 0, host: '127.0.0.1' });
  return server;
}

test('range request returns partial content', async ({}, testInfo) => {
  const dir = testInfo.outputPath();
  const file = path.join(dir, 'data.bin');
  fs.writeFileSync(file, Buffer.from('abcdefghij'));
  const server = await startServer(dir);
  try {
    const url = server.urlPrefix('precise') + '/data.bin';
    const res = await fetch(url, { headers: { Range: 'bytes=2-5' } });
    expect(res.status).toBe(206);
    expect(await res.text()).toBe('cdef');
  } finally {
    await server.stop();
  }
});

test('unreadable file range request does not crash the server', async ({}, testInfo) => {
  test.skip(process.platform === 'win32', 'chmod is not a reliable ACL on Windows');
  test.skip(os.userInfo().uid === 0, 'root can read chmod 0 files');
  const dir = testInfo.outputPath();
  const file = path.join(dir, 'data.bin');
  fs.writeFileSync(file, Buffer.alloc(1024, 1));
  fs.chmodSync(file, 0);
  const server = await startServer(dir);
  try {
    const url = server.urlPrefix('precise') + '/data.bin';
    const status = await new Promise<number>((resolve, reject) => {
      const req = http.get(url, { headers: { Range: 'bytes=0-10' } }, res => {
        res.resume();
        res.on('end', () => resolve(res.statusCode || 0));
      });
      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('range request hung'));
      });
    });
    expect(status).toBeGreaterThan(0);
  } finally {
    fs.chmodSync(file, 0o644);
    await server.stop();
  }
});
