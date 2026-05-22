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
import { playwrightTest as test, expect } from '../config/browserTest';
import { WebSocketServer, WebSocket } from 'ws';

type Handler = (ws: WebSocket, msg: { id: number, method: string, params: any }) => void;

async function startStubRdpServer(handler?: Handler): Promise<{ url: string, close: () => Promise<void> }> {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>(resolve => wss.once('listening', () => resolve()));
  const port = (wss.address() as { port: number }).port;
  const sockets = new Set<WebSocket>();
  wss.on('connection', ws => {
    sockets.add(ws);
    ws.on('close', () => sockets.delete(ws));
    ws.on('message', raw => {
      const msg = JSON.parse(raw.toString()) as { id: number, method: string, params: any };
      if (handler)
        handler(ws, msg);
      else
        defaultHandler(ws, msg);
    });
  });
  return {
    url: `ws://127.0.0.1:${port}`,
    close: () => new Promise<void>(resolve => {
      for (const ws of sockets)
        ws.terminate();
      wss.close(() => resolve());
    }),
  };
}

function defaultHandler(ws: WebSocket, msg: { id: number, method: string, params: any }) {
  if (msg.method === 'Page.getResourceTree') {
    ws.send(JSON.stringify({
      id: msg.id,
      result: {
        frameTree: {
          frame: { id: 'frame-1', loaderId: 'loader-1', url: 'about:blank', mimeType: 'text/html', securityOrigin: 'null' },
          childFrames: [],
        },
      },
    }));
    return;
  }
  if (msg.method === 'Runtime.enable') {
    ws.send(JSON.stringify({ id: msg.id, result: {} }));
    ws.send(JSON.stringify({
      method: 'Runtime.executionContextCreated',
      params: { context: { id: 1, frameId: 'frame-1', type: 'normal', name: '' } },
    }));
    return;
  }
  ws.send(JSON.stringify({ id: msg.id, result: {} }));
}

test('webkit.connectOverCDP exposes the existing page', async ({ playwright }) => {
  const server = await startStubRdpServer();
  const browser = await playwright.webkit.connectOverCDP(server.url);
  try {
    const contexts = browser.contexts();
    expect(contexts).toHaveLength(1);
    const pages = contexts[0].pages();
    expect(pages).toHaveLength(1);
    expect(pages[0].url()).toBe('about:blank');
  } finally {
    await browser.close();
    await server.close();
  }
});

test('webkit.connectOverCDP cleans up artifacts dir on disconnect', async ({ playwright, toImpl }) => {
  const server = await startStubRdpServer();
  const browser = await playwright.webkit.connectOverCDP(server.url);
  const dir = toImpl(browser).options.artifactsDir;
  expect(fs.existsSync(dir)).toBe(true);
  await Promise.all([
    new Promise(resolve => browser.on('disconnected', resolve)),
    server.close(),
  ]);
  await expect.poll(() => fs.existsSync(dir)).toBe(false);
});
