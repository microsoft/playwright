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
import { parseHar } from '../config/utils';
import fs from 'fs';
import net from 'net';
import type { BrowserContext, BrowserContextOptions } from 'playwright-core';
import type { AddressInfo } from 'net';
import type { Entry, Log, WebSocketMessage } from '../../packages/trace/src/har';

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
    getZip: async () => {
      await context.close();
      return parseHar(harPath);
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

function messageSize(message: string | number[]): number {
  // The payload is short enough that they only need the minimum frame header size.
  if (message.length <= 125)
    return 6 + message.length;
  // The payload is large enough that additional bytes are needed to represent the payload length.
  if (message.length < 2 ** 16)
    return 6 + 2 + message.length;
  return 6 + 8 + message.length;
}

it('should only have one websocket entry', async ({ contextFactory, server }, testInfo) => {
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

it('should include websocket handshake headers and status', async ({ contextFactory, server }, testInfo) => {
  server.onceWebSocketConnection(ws => {
    ws.on('message', () => ws.close());
  });

  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);

  const beforeMs = Date.now();
  const wsUrl = `ws://${server.HOST}/ws`;
  const closed = page.evaluate(url => new Promise<void>(resolve => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => ws.send('ping'));
    ws.addEventListener('close', () => resolve());
  }), wsUrl);
  await closed;
  const log = await getLog();
  const afterMs = Date.now();

  const wsEntry = log.entries.find(e => e.request.url === wsUrl)! as Entry;
  expect(wsEntry._resourceType).toBe('websocket');
  expect(wsEntry.request.headersSize).toBe(requestHeadersSize(wsEntry.request.headers));
  expect(wsEntry.response.status).toBe(101);
  expect(wsEntry.response.statusText).toBe('Switching Protocols');
  expect(wsEntry.response.headersSize).toBe(responseHeadersSize(wsEntry.response.headers));

  const wallTimeMs = new Date(wsEntry.startedDateTime).getTime();
  expect(wallTimeMs).toBeGreaterThanOrEqual(beforeMs);
  expect(wallTimeMs).toBeLessThanOrEqual(afterMs);

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

async function testWebSocketMessages(contextFactory, server, testInfo, content) {
  const incomingText =   ['x'.repeat(125),             'x'.repeat(126),             'x'.repeat(2 ** 16)];
  const incomingBinary = [(new Array(125)).fill(0x01), (new Array(126)).fill(0x01), (new Array(2 ** 16)).fill(0x01)];
  const outgoingText =   ['y'.repeat(125),             'y'.repeat(126),             'y'.repeat(2 ** 16)];
  const outgoingBinary = [(new Array(125)).fill(0x02), (new Array(126)).fill(0x02), (new Array(2 ** 16)).fill(0x02)];
  const incomingCount = incomingText.length + incomingBinary.length;
  const outgoingCount = outgoingText.length + outgoingBinary.length;
  const delayMs = 100;

  server.onceWebSocketConnection(async ws => {
    for (const text of incomingText) {
      ws.send(text);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    for (const binary of incomingBinary) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      ws.send(Buffer.from(binary));
    }
  });

  const outputPath = content === 'embed' ? undefined : 'test.har.zip';
  const { page, getLog, getZip } = await pageWithHar(contextFactory, testInfo, { content, outputPath });
  await page.goto(server.EMPTY_PAGE);

  const beforeMs = Date.now();
  const wsUrl = `ws://${server.HOST}/ws`;
  const closed = page.evaluate(({ url, incomingCount, outgoingText, outgoingBinary, delayMs }) => new Promise<void>(resolve => {
    let count = 0;
    const ws = new WebSocket(url);
    ws.addEventListener('message', async () => {
      if (++count < incomingCount)
        return;
      for (const text of outgoingText) {
        ws.send(text);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      for (const binary of outgoingBinary) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        ws.send(new Uint8Array(binary));
      }
      ws.close();
    });
    ws.addEventListener('close', () => resolve());
  }), { url: wsUrl, incomingCount, outgoingText, outgoingBinary, delayMs });
  await closed;
  const afterMs = Date.now();

  let zip: Map<string, Buffer>;
  let log: Log;
  if (outputPath) {
    zip = await getZip();
    log = JSON.parse(zip.get('har.har')!.toString())['log'] as Log;
  } else {
    log = await getLog();
  }
  const wsEntry = log.entries.find(e => e.request.url === wsUrl)! as Entry;
  expect(wsEntry.response._transferSize).toBe(responseHeadersSize(wsEntry.response.headers) + [...incomingText, ...incomingBinary].reduce((accumulator, current) => accumulator + messageSize(current), 0));
  expect(wsEntry.time).toBeLessThanOrEqual(afterMs - beforeMs);

  if (content === 'omit') {
    expect(wsEntry.response.content._file).toBeUndefined();
    return;
  }

  let messages: WebSocketMessage[];
  if (content === 'attach') {
    expect(wsEntry._webSocketMessages).toBeUndefined();
    const file = wsEntry.response.content._file!;
    expect(file).toMatch(/^[0-9a-f]+\.jsonl$/);
    messages = zip.get(file)!.toString().split('\n').filter(Boolean).map(line => JSON.parse(line)) as WebSocketMessage[];
  } else {
    messages = wsEntry._webSocketMessages;
  }
  expect(messages.map(m => ({ type: m.type, opcode: m.opcode, data: m.opcode === 1 ? m.data : [...Buffer.from(m.data, 'base64')] }))).toEqual([
    ...incomingText.map(m => ({ type: 'receive', opcode: 1, data: m })),
    ...incomingBinary.map(m => ({ type: 'receive', opcode: 2, data: m })),
    ...outgoingText.map(m => ({ type: 'send', opcode: 1, data: m })),
    ...outgoingBinary.map(m => ({ type: 'send', opcode: 2, data: m })),
  ]);
  for (const m of messages) {
    expect(m.time).toBeGreaterThanOrEqual(beforeMs - 1);
    expect(m.time).toBeLessThanOrEqual(afterMs + 1);
  }
  expect(messages[0].time).toBeLessThanOrEqual(messages[1].time);
  expect(wsEntry.time).toBeGreaterThanOrEqual(messages[messages.length - 1].time - messages[0].time);
  expect(wsEntry.time).toBeGreaterThanOrEqual(delayMs * (incomingCount + outgoingCount));
}

it('should embed websocket messages', async ({ contextFactory, server }, testInfo) => {
  await testWebSocketMessages(contextFactory, server, testInfo, 'embed');
});

it('should attach websocket messages', async ({ contextFactory, server }, testInfo) => {
  await testWebSocketMessages(contextFactory, server, testInfo, 'attach');
});

it('should attach websocket messages for a still open websocket after stopping', async ({ contextFactory, server }, testInfo) => {
  const incomingText = 'incoming';
  const incomingBinary = [0x01, 0x02, 0x03, 0x04];
  const outgoingText = 'outgoing';
  const outgoingBinary = [0x05, 0x06, 0x07, 0x08];

  server.onceWebSocketConnection(ws => {
    let count = 0;
    ws.on('message', () => ws.send((++count < 2) ? incomingText : Buffer.from(incomingBinary)));
  });

  const { page, getZip } = await pageWithHar(contextFactory, testInfo, { content: 'attach', outputPath: 'test.har.zip' });
  await page.goto(server.EMPTY_PAGE);

  const beforeMs = Date.now();
  const wsUrl = `ws://${server.HOST}/ws`;
  const [ws] = await Promise.all([
    page.waitForEvent('websocket'),
    page.evaluate(({ url, outgoingText, outgoingBinary }) => {
      const ws = new WebSocket(url);
      (window as any).ws = ws;
      let count = 0;
      ws.addEventListener('open', () => ws.send(outgoingText));
      ws.addEventListener('message', () => {
        if (++count < 2)
          ws.send(new Uint8Array(outgoingBinary));
      });
    }, { url: wsUrl, outgoingText, outgoingBinary }),
  ]);
  // Wait for all frames so the HAR tracer has observed them before the context is closed.
  await ws.waitForEvent('framesent');
  await ws.waitForEvent('framereceived');
  await ws.waitForEvent('framesent');
  await ws.waitForEvent('framereceived');
  const afterMs = Date.now();

  // Do not close the WebSocket on the page side. Closing the context should still flush messages.
  expect(await page.evaluate(() => (window as any).ws.readyState)).toBe(1 /* OPEN */);

  const zip = await getZip();
  const log = JSON.parse(zip.get('har.har')!.toString())['log'] as Log;

  const wsEntry = log.entries.find(e => e.request.url === wsUrl)! as Entry;
  expect(wsEntry.response._transferSize).toBe(responseHeadersSize(wsEntry.response.headers) + messageSize(incomingText) + messageSize(incomingBinary));
  expect(wsEntry.time).toBeLessThanOrEqual(afterMs - beforeMs);
  expect(wsEntry._webSocketMessages).toBeUndefined();

  const file = wsEntry.response.content._file!;
  expect(file).toMatch(/^[0-9a-f]+\.jsonl$/);

  const messages = zip.get(file)!.toString().split('\n').filter(Boolean).map(line => JSON.parse(line)) as Array<{ type: string, time: number, opcode: number, data: string }>;
  expect(messages.map(m => ({ type: m.type, opcode: m.opcode, data: m.opcode === 1 ? m.data : [...Buffer.from(m.data, 'base64')] }))).toEqual([
    { type: 'send',    opcode: 1, data: outgoingText },
    { type: 'receive', opcode: 1, data: incomingText },
    { type: 'send',    opcode: 2, data: outgoingBinary },
    { type: 'receive', opcode: 2, data: incomingBinary },
  ]);
  for (const m of messages) {
    expect(m.time).toBeGreaterThanOrEqual(beforeMs - 1);
    expect(m.time).toBeLessThanOrEqual(afterMs + 1);
  }
  expect(messages[0].time).toBeLessThanOrEqual(messages[1].time);
  expect(wsEntry.time).toBeGreaterThanOrEqual(messages[messages.length - 1].time - messages[0].time);
});

it('should omit websocket messages', async ({ contextFactory, server }, testInfo) => {
  await testWebSocketMessages(contextFactory, server, testInfo, 'omit');
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
  const wsPromise = page.waitForEvent('websocket');
  await page.evaluate(url => new Promise<void>(resolve => {
    const ws = new WebSocket(url);
    ws.addEventListener('close', () => resolve());
    ws.addEventListener('error', () => resolve());
  }), wsUrl);
  await wsPromise;
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

it('should respect PLAYWRIGHT_HAR_NO_WEBSOCKET_FRAMES', async ({ contextFactory, server }, testInfo) => {
  process.env.PLAYWRIGHT_HAR_NO_WEBSOCKET_FRAMES = '1';
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
  const wsEntry = log.entries.filter(e => e.request.url.endsWith(`://${server.HOST}/ws`))[0];
  expect(wsEntry._resourceType).toBe('websocket');
  expect(wsEntry._webSocketMessages).toBeUndefined();
  expect(wsEntry.response.content._file).toBe(undefined);
  delete process.env.PLAYWRIGHT_HAR_NO_WEBSOCKET_FRAMES;
});
