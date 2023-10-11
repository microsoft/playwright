/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import { kTargetClosedErrorMessage } from '../config/errors';
import { contextTest as it, expect } from '../config/browserTest';
import { Server as WebSocketServer } from 'ws';

it('should work @smoke', async ({ page, server }) => {
  server.sendOnWebSocketConnection('incoming');
  const value = await page.evaluate(port => {
    let cb;
    const result = new Promise(f => cb = f);
    const ws = new WebSocket('ws://localhost:' + port + '/ws');
    ws.addEventListener('message', data => { ws.close(); cb(data.data); });
    return result;
  }, server.PORT);
  expect(value).toBe('incoming');
});

it('should emit close events', async ({ page, server }) => {
  let socketClosed;
  const socketClosePromise = new Promise(f => socketClosed = f);
  const log = [];
  let webSocket;
  page.on('websocket', ws => {
    log.push(`open<${ws.url()}>`);
    webSocket = ws;
    ws.on('close', () => { log.push('close'); socketClosed(); });
  });
  await page.evaluate(port => {
    const ws = new WebSocket('ws://localhost:' + port + '/ws');
    ws.addEventListener('open', () => ws.close());
  }, server.PORT);
  await socketClosePromise;
  expect(log.join(':')).toBe(`open<ws://localhost:${server.PORT}/ws>:close`);
  expect(webSocket.isClosed()).toBeTruthy();
});

it('should emit frame events', async ({ page, server }) => {
  server.onceWebSocketConnection(ws => {
    ws.on('message', () => ws.send('incoming'));
  });
  let socketClosed;
  const socketClosePromise = new Promise(f => socketClosed = f);
  const log = [];
  page.on('websocket', ws => {
    log.push('open');
    ws.on('framesent', d => log.push('sent<' + d.payload + '>'));
    ws.on('framereceived', d => log.push('received<' + d.payload + '>'));
    ws.on('close', () => { log.push('close'); socketClosed(); });
  });
  await page.evaluate(port => {
    const ws = new WebSocket('ws://localhost:' + port + '/ws');
    ws.addEventListener('open', () => ws.send('outgoing'));
    ws.addEventListener('message', () => { ws.close(); });
    (window as any).ws = ws;
  }, server.PORT);
  await socketClosePromise;
  expect(log).toEqual(['open', 'sent<outgoing>', 'received<incoming>', 'close']);
});

it('should filter out the close events when the server closes with a message', async ({ page, server }) => {
  server.onceWebSocketConnection(ws => {
    ws.send('incoming');
    ws.on('message', () => ws.close(1003, 'closed by Playwright test-server'));
  });
  let socketClosed;
  const socketClosePromise = new Promise(f => socketClosed = f);
  const log = [];
  page.on('websocket', ws => {
    log.push('open');
    ws.on('framesent', d => log.push('sent<' + d.payload + '>'));
    ws.on('framereceived', d => log.push('received<' + d.payload + '>'));
    ws.on('close', () => { log.push('close'); socketClosed(); });
  });
  await page.evaluate(port => {
    const ws = new WebSocket('ws://localhost:' + port + '/ws');
    ws.addEventListener('message', () => ws.send('outgoing'));
    (window as any).ws = ws;
  }, server.PORT);
  await socketClosePromise;
  expect(log).toEqual(['open', 'received<incoming>', 'sent<outgoing>', 'close']);
});

it('should pass self as argument to close event', async ({ page, server }) => {
  let socketClosed;
  const socketClosePromise = new Promise(f => socketClosed = f);
  let webSocket;
  page.on('websocket', ws => {
    webSocket = ws;
    ws.on('close', socketClosed);
  });
  await page.evaluate(port => {
    const ws = new WebSocket('ws://localhost:' + port + '/ws');
    ws.addEventListener('open', () => ws.close());
  }, server.PORT);
  const eventArg = await socketClosePromise;
  expect(eventArg).toBe(webSocket);
});

it('should emit binary frame events', async ({ page, server }) => {
  let doneCallback;
  const donePromise = new Promise(f => doneCallback = f);
  const sent = [];
  page.on('websocket', ws => {
    ws.on('close', doneCallback);
    ws.on('framesent', d => sent.push(d.payload));
  });
  await page.evaluate(port => {
    const ws = new WebSocket('ws://localhost:' + port + '/ws');
    ws.addEventListener('open', () => {
      const binary = new Uint8Array(5);
      for (let i = 0; i < 5; ++i)
        binary[i] = i;
      ws.send('text');
      ws.send(binary);
      ws.close();
    });
  }, server.PORT);
  await donePromise;
  expect(sent[0]).toBe('text');
  for (let i = 0; i < 5; ++i)
    expect(sent[1][i]).toBe(i);
});

it('should emit error', async ({ page, server, browserName }) => {
  let callback;
  const result = new Promise(f => callback = f);
  page.on('websocket', ws => ws.on('socketerror', callback));
  await page.evaluate(port => {
    new WebSocket('ws://localhost:' + port + '/bogus-ws');
  }, server.PORT);
  const message = await result;
  if (browserName === 'firefox')
    expect(message).toBe('CLOSE_ABNORMAL');
  else
    expect(message).toContain(': 400');
});

it('should not have stray error events', async ({ page, server }) => {
  server.sendOnWebSocketConnection('incoming');
  let error;
  page.on('websocket', ws => ws.on('socketerror', e => error = e));
  await Promise.all([
    page.waitForEvent('websocket').then(async ws => {
      await ws.waitForEvent('framereceived');
      return ws;
    }),
    page.evaluate(port => {
      (window as any).ws = new WebSocket('ws://localhost:' + port + '/ws');
    }, server.PORT)
  ]);
  await page.evaluate('window.ws.close()');
  expect(error).toBeFalsy();
});

it('should reject waitForEvent on socket close', async ({ page, server }) => {
  server.sendOnWebSocketConnection('incoming');
  const [ws] = await Promise.all([
    page.waitForEvent('websocket').then(async ws => {
      await ws.waitForEvent('framereceived');
      return ws;
    }),
    page.evaluate(port => {
      (window as any).ws = new WebSocket('ws://localhost:' + port + '/ws');
    }, server.PORT)
  ]);
  const error = ws.waitForEvent('framesent').catch(e => e);
  await page.evaluate('window.ws.close()');
  expect((await error).message).toContain('Socket closed');
});

it('should reject waitForEvent on page close', async ({ page, server }) => {
  server.sendOnWebSocketConnection('incoming');
  const [ws] = await Promise.all([
    page.waitForEvent('websocket').then(async ws => {
      await ws.waitForEvent('framereceived');
      return ws;
    }),
    page.evaluate(port => {
      (window as any).ws = new WebSocket('ws://localhost:' + port + '/ws');
    }, server.PORT)
  ]);
  const error = ws.waitForEvent('framesent').catch(e => e);
  await page.close();
  expect((await error).message).toContain(kTargetClosedErrorMessage);
});

it('should turn off when offline', async ({ page }) => {
  it.fixme();

  const webSocketServer = new WebSocketServer();
  const address = webSocketServer.address();
  const [socket, wsHandle] = await Promise.all([
    new Promise<import('ws')>(x => webSocketServer.once('connection', x)),
    page.evaluateHandle(async address => {
      const ws = new WebSocket(`ws://${address}/`);
      await new Promise(x => ws.onopen = x);
      return ws;
    }, typeof address === 'string' ? address : 'localhost:' + address.port),
  ]);
  const failurePromise = new Promise(x => socket.on('message', data => x(data)));
  const closePromise = wsHandle.evaluate(async ws => {
    if (ws.readyState !== WebSocket.CLOSED)
      await new Promise(x => ws.onclose = x);
    return 'successfully closed';
  });
  const result = Promise.race([
    failurePromise,
    closePromise
  ]);
  await page.context().setOffline(true);
  await wsHandle.evaluate(ws => ws.send('if this arrives it failed'));
  expect(await result).toBe('successfully closed');
  await new Promise(x => webSocketServer.close(x));
});
