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

import { browserTest as it, expect } from '../config/browserTest';
import fs from 'fs';
import net from 'net';
import type { BrowserContext, BrowserContextOptions } from 'playwright-core';
import type { AddressInfo } from 'net';
import type { Entry, Log } from '../../packages/trace/src/har';

async function pageWithHar(contextFactory: (options?: BrowserContextOptions) => Promise<BrowserContext>, testInfo: any, options: { outputPath?: string } & Partial<Pick<BrowserContextOptions['recordHar'], 'content' | 'omitContent' | 'mode'>> = {}) {
  const harPath = testInfo.outputPath(options.outputPath || 'test.har');
  const context = await contextFactory({ recordHar: { path: harPath, ...options }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  return {
    page,
    context,
    getLog: async () => {
      await context.close();
      return JSON.parse(fs.readFileSync(harPath).toString())['log'] as Log;
    },
  };
}

function headersSize(headers: { name: string, value: string }[]): number {
  let result = 0;
  for (const header of headers)
    result += header.name.length + ': '.length + header.value.length + '\r\n'.length;
  return result;
}

function requestHeadersSize(headers: { name: string, value: string }[]): number {
  let result = 'GET /ws HTTP/1.1\r\n'.length;
  result += headersSize(headers);
  return result;
}

function responseHeadersSize(headers: { name: string, value: string }[]): number {
  let result = 'HTTP/1.1 101 Switching Protocols\r\n'.length;
  result += headersSize(headers);
  result += '\r\n'.length;
  return result;
}

it('should only have one websocket entry', async ({ contextFactory, server, browserName }, testInfo) => {
  server.onceWebSocketConnection(ws => {
    ws.on('message', () => ws.close());
  });
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);
  const wsUrl = `ws://${server.HOST}/ws`;
  const closed = page.evaluate(url => new Promise<void>(resolve => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => ws.send('ping'));
    ws.addEventListener('close', () => resolve());
  }), wsUrl);
  await closed;
  const log = await getLog();
  const wsEntries = log.entries.filter(e => e.request.url.endsWith(`://${server.HOST}/ws`))! as Entry[];
  expect(wsEntries.length).toBe(1);

  const wsEntry = wsEntries[0];
  expect(wsEntry._resourceType).toBe('websocket');
});

it('should include websocket handshake headers and status', async ({ contextFactory, server, browserName }, testInfo) => {
  server.onceWebSocketConnection(ws => {
    ws.on('message', () => ws.close());
  });

  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);

  const wsUrl = `ws://${server.HOST}/ws`;
  const closed = page.evaluate(url => new Promise<void>(resolve => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => ws.send('ping'));
    ws.addEventListener('close', () => resolve());
  }), wsUrl);
  await closed;
  const log = await getLog();

  const wsEntry = log.entries.find(e => e.request.url === wsUrl)! as Entry;
  expect(wsEntry._resourceType).toBe('websocket');
  expect(wsEntry.request.headersSize).toBe(requestHeadersSize(wsEntry.request.headers));
  expect(wsEntry.response.status).toBe(101);
  expect(wsEntry.response.statusText).toBe('Switching Protocols');
  expect(wsEntry.response.headersSize).toBe(responseHeadersSize(wsEntry.response.headers));

  const requestHeaderNames = wsEntry.request.headers.map(h => h.name.toLowerCase());
  expect(requestHeaderNames).toContain('upgrade');
  expect(requestHeaderNames).toContain('connection');
  expect(requestHeaderNames).toContain('sec-websocket-key');
  expect(requestHeaderNames).toContain('sec-websocket-version');
  const upgradeHeader = wsEntry.request.headers.find(h => h.name.toLowerCase() === 'upgrade')!;
  expect(upgradeHeader.value.toLowerCase()).toBe('websocket');

  const responseHeaderNames = wsEntry.response.headers.map(h => h.name.toLowerCase());
  expect(responseHeaderNames).toContain('upgrade');
  expect(responseHeaderNames).toContain('connection');
  expect(responseHeaderNames).toContain('sec-websocket-accept');
});

it('should include websocket messages', async ({ contextFactory, server }, testInfo) => {
  const incoming = 'x'.repeat(125);
  const outgoing = 'outgoing';

  server.onceWebSocketConnection(ws => {
    ws.on('message', () => ws.send(incoming));
  });

  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);

  const beforeMs = Date.now();
  const wsUrl = `ws://${server.HOST}/ws`;
  const closed = page.evaluate(({ url, outgoing }) => new Promise<void>(resolve => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => ws.send(outgoing));
    ws.addEventListener('message', () => ws.close());
    ws.addEventListener('close', () => resolve());
  }), { url: wsUrl, outgoing });
  await closed;
  const afterMs = Date.now();
  const log = await getLog();

  const wsEntry = log.entries.find(e => e.request.url === wsUrl)! as Entry;
  // The payload is short enough that they only need the minimum frame header size.
  expect(wsEntry.response._transferSize).toBe(responseHeadersSize(wsEntry.response.headers) + 6 + incoming.length);

  const messages = wsEntry._webSocketMessages;
  expect(messages.map(m => ({ type: m.type, opcode: m.opcode, data: m.data }))).toEqual([
    { type: 'send', opcode: 1, data: outgoing },
    { type: 'receive', opcode: 1, data: incoming },
  ]);
  for (const m of messages) {
    expect(m.time).toBeGreaterThanOrEqual(beforeMs - 1);
    expect(m.time).toBeLessThanOrEqual(afterMs + 1);
  }
  expect(messages[0].time).toBeLessThanOrEqual(messages[1].time);
});

it('should include larger websocket messages', async ({ contextFactory, server }, testInfo) => {
  const incoming = 'x'.repeat(126);
  const outgoing = 'outgoing';

  server.onceWebSocketConnection(ws => {
    ws.on('message', () => ws.send(incoming));
  });

  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);

  const beforeMs = Date.now();
  const wsUrl = `ws://${server.HOST}/ws`;
  const closed = page.evaluate(({ url, outgoing }) => new Promise<void>(resolve => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => ws.send(outgoing));
    ws.addEventListener('message', () => ws.close());
    ws.addEventListener('close', () => resolve());
  }), { url: wsUrl, outgoing });
  await closed;
  const afterMs = Date.now();
  const log = await getLog();

  const wsEntry = log.entries.find(e => e.request.url === wsUrl)! as Entry;
  // The payload is large enough that additional bytes are needed to represent the payload length.
  expect(wsEntry.response._transferSize).toBe(responseHeadersSize(wsEntry.response.headers) + 6 + 2 + incoming.length);

  const messages = wsEntry._webSocketMessages;
  expect(messages.map(m => ({ type: m.type, opcode: m.opcode, data: m.data }))).toEqual([
    { type: 'send', opcode: 1, data: outgoing },
    { type: 'receive', opcode: 1, data: incoming },
  ]);
  for (const m of messages) {
    expect(m.time).toBeGreaterThanOrEqual(beforeMs - 1);
    expect(m.time).toBeLessThanOrEqual(afterMs + 1);
  }
  expect(messages[0].time).toBeLessThanOrEqual(messages[1].time);
});

it('should include gigantic websocket messages', async ({ contextFactory, server }, testInfo) => {
  const incoming = 'x'.repeat(2 ** 16 + 1);
  const outgoing = 'outgoing';

  server.onceWebSocketConnection(ws => {
    ws.on('message', () => ws.send(incoming));
  });

  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);

  const beforeMs = Date.now();
  const wsUrl = `ws://${server.HOST}/ws`;
  const closed = page.evaluate(({ url, outgoing }) => new Promise<void>(resolve => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => ws.send(outgoing));
    ws.addEventListener('message', () => ws.close());
    ws.addEventListener('close', () => resolve());
  }), { url: wsUrl, outgoing });
  await closed;
  const afterMs = Date.now();
  const log = await getLog();

  const wsEntry = log.entries.find(e => e.request.url === wsUrl)! as Entry;
  // The payload is large enough that additional bytes are needed to represent the payload length.
  expect(wsEntry.response._transferSize).toBe(responseHeadersSize(wsEntry.response.headers) + 6 + 8 + incoming.length);

  const messages = wsEntry._webSocketMessages;
  expect(messages.map(m => ({ type: m.type, opcode: m.opcode, data: m.data }))).toEqual([
    { type: 'send', opcode: 1, data: outgoing },
    { type: 'receive', opcode: 1, data: incoming },
  ]);
  for (const m of messages) {
    expect(m.time).toBeGreaterThanOrEqual(beforeMs - 1);
    expect(m.time).toBeLessThanOrEqual(afterMs + 1);
  }
  expect(messages[0].time).toBeLessThanOrEqual(messages[1].time);
});

it('should include binary websocket messages', async ({ contextFactory, server }, testInfo) => {
  const incoming = [0x01, 0x02, 0x03, 0x04];
  const outgoing = [0x05, 0x06, 0x07, 0x08];

  server.onceWebSocketConnection(ws => {
    ws.on('message', () => ws.send(Buffer.from(incoming)));
  });

  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);

  const beforeMs = Date.now();
  const wsUrl = `ws://${server.HOST}/ws`;
  const closed = page.evaluate(({ url, outgoing }) => new Promise<void>(resolve => {
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('open', () => ws.send(new Uint8Array(outgoing)));
    ws.addEventListener('message', () => ws.close());
    ws.addEventListener('close', () => resolve());
  }), { url: wsUrl, outgoing });
  await closed;
  const afterMs = Date.now();
  const log = await getLog();

  const wsEntry = log.entries.find(e => e.request.url === wsUrl)! as Entry;
  // The payload is short enough that they only need the minimum frame header size.
  expect(wsEntry.response._transferSize).toBe(responseHeadersSize(wsEntry.response.headers) + 6 + incoming.length);

  const messages = wsEntry._webSocketMessages;
  expect(messages.map(m => ({ type: m.type, opcode: m.opcode, data: [...Buffer.from(m.data, 'base64')] }))).toEqual([
    { type: 'send', opcode: 2, data: outgoing },
    { type: 'receive', opcode: 2, data: incoming },
  ]);
  for (const m of messages) {
    expect(m.time).toBeGreaterThanOrEqual(beforeMs - 1);
    expect(m.time).toBeLessThanOrEqual(afterMs + 1);
  }
  expect(messages[0].time).toBeLessThanOrEqual(messages[1].time);
});

it('should include websocket entry time across multiple messages', async ({ contextFactory, server }, testInfo) => {
  server.onceWebSocketConnection(ws => {
    ws.on('message', message => {
      switch (message.toString()) {
        case 'a':
          setTimeout(() => ws.send('b'), 50);
          break;
        case 'b':
          setTimeout(() => ws.send('c'), 50);
          break;
        case 'c':
          setTimeout(() => ws.close(), 50);
          break;
      }
    });
  });

  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);

  const wsUrl = `ws://${server.HOST}/ws`;
  const beforeMs = Date.now();
  const closed = page.evaluate(url => new Promise<void>(resolve => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => ws.send('a'));
    ws.addEventListener('message', e => ws.send(e.data));
    ws.addEventListener('close', () => resolve());
  }), wsUrl);
  await closed;
  const afterMs = Date.now();
  const log = await getLog();

  const wsEntry = log.entries.find(e => e.request.url === wsUrl)! as Entry;
  const messages = wsEntry._webSocketMessages;
  expect(wsEntry.time).toBeGreaterThanOrEqual(messages[messages.length - 1].time - messages[0].time);
  expect(wsEntry.time).toBeLessThanOrEqual(afterMs - beforeMs);
});

it('should record websocket connection failure', async ({ contextFactory, server }, testInfo) => {
  // Reserve a port and immediately release it so the WebSocket connect attempt is refused.
  const portReservation = net.createServer();
  await new Promise<void>(resolve => portReservation.listen(0, '127.0.0.1', () => resolve()));
  const port = (portReservation.address() as AddressInfo).port;
  await new Promise<void>(resolve => portReservation.close(() => resolve()));

  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);

  const wsUrl = `ws://127.0.0.1:${port}/ws-connect-fail`;
  await page.evaluate(url => new Promise<void>(resolve => {
    const ws = new WebSocket(url);
    ws.addEventListener('close', () => resolve());
    ws.addEventListener('error', () => resolve());
  }), wsUrl);
  const log = await getLog();

  const wsEntry = log.entries.find(e => e.request.url === wsUrl)! as Entry;
  expect(wsEntry._resourceType).toBe('websocket');
  expect(wsEntry.response._failureText).toBeTruthy();
});

it('should record websocket handshake failure', async ({ contextFactory, server, browserName }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);

  const wsUrl = `ws://${server.HOST}/ws-handshake-fail`;
  const upgradePromise = server.waitForUpgrade();
  const wsClose = page.evaluate(url => new Promise<void>(resolve => {
    const ws = new WebSocket(url);
    ws.addEventListener('close', () => resolve());
    ws.addEventListener('error', () => resolve());
  }), wsUrl);
  const { socket } = await upgradePromise;
  socket.write('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n');
  socket.destroy();
  await wsClose;
  const log = await getLog();

  const wsEntry = log.entries.find(e => e.request.url === wsUrl)! as Entry;
  expect(wsEntry._resourceType).toBe('websocket');
  if (browserName !== 'chromium') {
    // Chromium only reports an error instead of giving a status code and text.
    expect(wsEntry.response.status).toBe(403);
    expect(wsEntry.response.statusText).toBe('Forbidden');
  }
  expect(wsEntry.response._failureText).toBeTruthy();
});

it('should still capture websocket when route passes messages through', async ({ contextFactory, server }, testInfo) => {
  server.onceWebSocketConnection(ws => {
    ws.on('message', () => ws.send('incoming'));
  });

  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  let routeHandlerCalled = 0;
  await page.routeWebSocket(/\/ws$/, ws => {
    ++routeHandlerCalled;
    const serverRoute = ws.connectToServer();
    ws.onMessage(message => serverRoute.send(message));
    serverRoute.onMessage(message => ws.send(message));
  });
  await page.goto(server.EMPTY_PAGE);

  const wsUrl = `ws://${server.HOST}/ws`;
  const messages = await page.evaluate(url => new Promise<string[]>(resolve => {
    const seen: string[] = [];
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => ws.send('outgoing'));
    ws.addEventListener('message', event => {
      seen.push(event.data);
      ws.close();
    });
    ws.addEventListener('close', () => resolve(seen));
  }), wsUrl);
  expect(routeHandlerCalled).toBe(1);
  expect(messages).toEqual(['incoming']);
  const log = await getLog();

  const wsEntries = log.entries.filter(e => e.request.url === wsUrl)! as Entry[];
  expect(wsEntries.length).toBe(1);
  expect(wsEntries[0]._resourceType).toBe('websocket');
  expect(wsEntries[0].response.status).toBe(101);
  expect(wsEntries[0]._webSocketMessages.map(m => ({ type: m.type, data: m.data }))).toEqual([
    { type: 'send', data: 'outgoing' },
    { type: 'receive', data: 'incoming' },
  ]);
});

it('should still allow routeWebSocket to fully mock the connection when capturing HAR', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  let routeHandlerCalled = 0;
  await page.routeWebSocket(/\/ws$/, ws => {
    ++routeHandlerCalled;
    ws.onMessage(message => {
      if (message === 'ping')
        ws.send('pong');
    });
  });
  await page.goto(server.EMPTY_PAGE);

  const wsUrl = `ws://${server.HOST}/ws`;
  const messages = await page.evaluate(url => new Promise<string[]>(resolve => {
    const seen: string[] = [];
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => ws.send('ping'));
    ws.addEventListener('message', event => {
      seen.push(event.data);
      ws.close();
    });
    ws.addEventListener('close', () => resolve(seen));
  }), wsUrl);
  expect(routeHandlerCalled).toBe(1);
  expect(messages).toEqual(['pong']);
  const log = await getLog();

  // Fully mocked routes never create a native WebSocket, so nothing should be recorded.
  const wsEntries = log.entries.filter(e => e.request.url === wsUrl);
  expect(wsEntries).toEqual([]);
});

it('should still allow routeWebSocket to modify messages when capturing HAR', async ({ contextFactory, server }, testInfo) => {
  server.onceWebSocketConnection(ws => {
    ws.on('message', message => ws.send(`server-saw-${message.toString()}`));
  });

  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  let routeHandlerCalled = 0;
  await page.routeWebSocket(/\/ws$/, ws => {
    ++routeHandlerCalled;
    const serverRoute = ws.connectToServer();
    ws.onMessage(message => serverRoute.send(`modified-${message.toString()}`));
    serverRoute.onMessage(message => ws.send(`page-got-${message.toString()}`));
  });
  await page.goto(server.EMPTY_PAGE);

  const wsUrl = `ws://${server.HOST}/ws`;
  const messages = await page.evaluate(url => new Promise<string[]>(resolve => {
    const seen: string[] = [];
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => ws.send('hello'));
    ws.addEventListener('message', event => {
      seen.push(event.data);
      ws.close();
    });
    ws.addEventListener('close', () => resolve(seen));
  }), wsUrl);
  expect(routeHandlerCalled).toBe(1);
  // The page sees the route-modified server response.
  expect(messages).toEqual(['page-got-server-saw-modified-hello']);
  const log = await getLog();

  // HAR records actual wire traffic from the native WebSocket: outgoing messages
  // are modified by the client-side route handler before they hit the server,
  // and incoming messages are recorded before the server-side route handler modifies them.
  const wsEntries = log.entries.filter(e => e.request.url === wsUrl)! as Entry[];
  expect(wsEntries.length).toBe(1);
  expect(wsEntries[0]._webSocketMessages.map(m => ({ type: m.type, data: m.data }))).toEqual([
    { type: 'send', data: 'modified-hello' },
    { type: 'receive', data: 'server-saw-modified-hello' },
  ]);
});
