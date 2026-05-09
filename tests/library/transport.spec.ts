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

import { playwrightTest as test, expect } from '../config/browserTest';
import { WebSocketServer } from 'ws';
import { server as coreServer } from '../../packages/playwright-core/lib/coreBundle';

const { WebSocketTransport } = coreServer;

test('closeAndWait should not hang when server does not send close frame', async () => {
  const wss = new WebSocketServer({ port: 0 });
  const port = (wss.address() as { port: number }).port;

  // Server accepts but never closes its end of the connection.
  wss.on('connection', () => {});

  const transport = await WebSocketTransport.connect(undefined, `ws://localhost:${port}`);
  const start = Date.now();
  await transport.closeAndWait(1000);
  const elapsed = Date.now() - start;

  expect(elapsed).toBeLessThan(5000);
  wss.close();
});

test('closeAndWait should return immediately when already closed', async () => {
  const wss = new WebSocketServer({ port: 0 });
  const port = (wss.address() as { port: number }).port;

  wss.on('connection', ws => {
    ws.on('close', () => ws.close());
  });

  const transport = await WebSocketTransport.connect(undefined, `ws://localhost:${port}`);
  await transport.closeAndWait();

  const start = Date.now();
  await transport.closeAndWait();
  const elapsed = Date.now() - start;

  expect(elapsed).toBeLessThan(100);
  wss.close();
});