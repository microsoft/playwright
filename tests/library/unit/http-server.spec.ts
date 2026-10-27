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

import fs from 'fs';
import net from 'net';
import path from 'path';
import { test as it, expect } from '@playwright/test';
import { utils } from '../../../packages/playwright-core/lib/coreBundle';

it('HS-001 should not serve files through a symlink that leaves the folder', async ({}, testInfo) => {
  const folder = testInfo.outputPath('folder');
  const outside = testInfo.outputPath('outside');
  await fs.promises.mkdir(folder, { recursive: true });
  await fs.promises.mkdir(outside, { recursive: true });
  await fs.promises.writeFile(path.join(folder, 'index.html'), 'inside');
  await fs.promises.writeFile(path.join(outside, 'secret.txt'), 'secret');
  await fs.promises.symlink(outside, path.join(folder, 'escape'), 'junction');

  const server = utils.serveFolder(folder);
  await server.start();
  try {
    const prefix = server.urlPrefix('precise');
    expect(await (await fetch(prefix + '/index.html')).text()).toBe('inside');
    expect((await fetch(prefix + '/escape/secret.txt')).status).toBe(403);
    const filePath = path.join(folder, 'escape', 'secret.txt');
    expect((await fetch(prefix + '/trace/file?path=' + encodeURIComponent(filePath))).status).toBe(403);
  } finally {
    await server.stop();
  }
});

it('HS-002 should close upgrade requests to unknown paths', async ({}) => {
  const server = new utils.HttpServer();
  server.createWebSocket(() => {
    throw new Error('Unexpected connection');
  });
  await server.start();
  try {
    const { hostname, port } = new URL(server.urlPrefix('precise'));
    const socket = net.connect(+port, hostname.replace(/^\[|\]$/g, ''));
    socket.on('error', () => {});
    const closed = new Promise(f => socket.on('close', f));
    socket.write(`GET /unknown HTTP/1.1\r\nHost: localhost:${port}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n`);
    await closed;
  } finally {
    await server.stop();
  }
});
