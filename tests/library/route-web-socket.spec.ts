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

import { attachFrame, detachFrame } from '../config/utils';
import { contextTest as test, expect } from '../config/browserTest';
import type { Frame, Page, WebSocketRoute } from '@playwright/test';
import { TestServer } from '../config/testserver';

declare global {
  interface Window {
    ws: WebSocket;
    wsOpened: Promise<void>;
    log: string[];
  }
}

// Polyfill for Promise.withResolvers, not available in older Node.
function withResolvers<T = void>() {
  let resolve: (value: T) => void;
  const promise = new Promise<T>(f => resolve = f);
  return { promise, resolve };
}

async function setupWS(target: Page | Frame, server: TestServer, binaryType: 'blob' | 'arraybuffer', protocols?: string | string[], relativeURL?: boolean) {
  await target.goto(server.EMPTY_PAGE);
  const wsUrl = relativeURL ? '/ws' : 'ws://' + server.HOST + '/ws';
  await target.evaluate(({ wsUrl, binaryType, protocols }) => {
    window.log = [];
    window.ws = new WebSocket(wsUrl, protocols);
    window.ws.binaryType = binaryType;
    window.ws.addEventListener('open', () => window.log.push('open'));
    window.ws.addEventListener('close', event => window.log.push(`close code=${event.code} reason=${event.reason} wasClean=${event.wasClean}`));
    window.ws.addEventListener('error', event => window.log.push(`error`));
    window.ws.addEventListener('message', async event => {
      let data;
      if (typeof event.data === 'string')
        data = event.data;
      else if (event.data instanceof Blob)
        data = 'blob:' + await event.data.text();
      else
        data = 'arraybuffer:' + await (new Blob([event.data])).text();
      window.log.push(`message: data=${data} origin=${event.origin} lastEventId=${event.lastEventId}`);
    });
    window.wsOpened = new Promise(f => window.ws.addEventListener('open', () => f()));
  }, { wsUrl, binaryType, protocols });
}

for (const mock of ['no-mock', 'no-match', 'pass-through']) {
  test.describe(mock, async () => {
    test.beforeEach(async ({ page }) => {
      if (mock === 'no-match') {
        await page.routeWebSocket(/zzz/, () => {});
      } else if (mock === 'pass-through') {
        await page.routeWebSocket(/.*/, ws => {
          const server = ws.connectToServer();
          ws.onMessage(message => server.send(message));
          server.onMessage(message => ws.send(message));
        });
      }
    });

    test('should work with text message', async ({ page, server }) => {
      const wsPromise = server.waitForWebSocket();
      const upgradePromise = server.waitForUpgrade();
      await setupWS(page, server, 'blob');
      expect(await page.evaluate(() => window.ws.readyState)).toBe(0);
      const { doUpgrade } = await upgradePromise;
      expect(await page.evaluate(() => window.ws.readyState)).toBe(0);
      expect(await page.evaluate(() => window.log)).toEqual([]);
      doUpgrade();
      await expect.poll(() => page.evaluate(() => window.ws.readyState)).toBe(1);
      expect(await page.evaluate(() => window.log)).toEqual(['open']);
      const ws = await wsPromise;
      ws.send('hello');
      await expect.poll(() => page.evaluate(() => window.log)).toEqual([
        'open',
        `message: data=hello origin=ws://${server.HOST} lastEventId=`,
      ]);
      expect(await page.evaluate(() => window.ws.readyState)).toBe(1);
      const messagePromise = new Promise(f => ws.once('message', data => f(data.toString())));
      await page.evaluate(() => window.ws.send('hi'));
      expect(await messagePromise).toBe('hi');
      ws.close(1008, 'oops');
      await expect.poll(() => page.evaluate(() => window.ws.readyState)).toBe(3);
      expect(await page.evaluate(() => window.log)).toEqual([
        'open',
        `message: data=hello origin=ws://${server.HOST} lastEventId=`,
        'close code=1008 reason=oops wasClean=true',
      ]);
    });

    test('should work with binaryType=blob', async ({ page, server }) => {
      const wsPromise = server.waitForWebSocket();
      await setupWS(page, server, 'blob');
      const ws = await wsPromise;
      ws.send(Buffer.from('hi'));
      await expect.poll(() => page.evaluate(() => window.log)).toEqual([
        'open',
        `message: data=blob:hi origin=ws://${server.HOST} lastEventId=`,
      ]);
      const messagePromise = new Promise(f => ws.once('message', data => f(data.toString())));
      await page.evaluate(() => window.ws.send(new Blob([new Uint8Array(['h'.charCodeAt(0), 'i'.charCodeAt(0)])])));
      expect(await messagePromise).toBe('hi');
    });

    test('should work with binaryType=arraybuffer', async ({ page, server }) => {
      const wsPromise = server.waitForWebSocket();
      await setupWS(page, server, 'arraybuffer');
      const ws = await wsPromise;
      ws.send(Buffer.from('hi'));
      await expect.poll(() => page.evaluate(() => window.log)).toEqual([
        'open',
        `message: data=arraybuffer:hi origin=ws://${server.HOST} lastEventId=`,
      ]);
      const messagePromise = new Promise(f => ws.once('message', data => f(data.toString())));
      await page.evaluate(() => window.ws.send(new Uint8Array(['h'.charCodeAt(0), 'i'.charCodeAt(0)]).buffer));
      expect(await messagePromise).toBe('hi');
    });

    test('should work when connection errors out', async ({ page, server, browserName }) => {
      test.skip(browserName === 'webkit', 'WebKit ignores the connection error and fires no events!');

      const upgradePromise = server.waitForUpgrade();
      await setupWS(page, server, 'blob');
      const { socket } = await upgradePromise;
      expect(await page.evaluate(() => window.ws.readyState)).toBe(0);
      expect(await page.evaluate(() => window.log)).toEqual([]);
      socket.destroy();
      await expect.poll(() => page.evaluate(() => window.ws.readyState)).toBe(3);
      expect(await page.evaluate(() => window.log)).toEqual([
        'error',
        expect.stringMatching(/close code=\d+ reason= wasClean=false/),
      ]);
    });

    test('should work with error after successful open', async ({ page, server, browserName, isLinux, isWindows }) => {
      test.skip(browserName === 'firefox', 'Firefox does not close the websocket upon a bad frame');
      test.skip(browserName === 'webkit' && isLinux, 'WebKit linux does not close the websocket upon a bad frame');
      test.skip(browserName === 'webkit' && isWindows, 'WebKit Windows does not close the websocket upon a bad frame');

      const upgradePromise = server.waitForUpgrade();
      await setupWS(page, server, 'blob');
      const { socket, doUpgrade } = await upgradePromise;
      doUpgrade();
      await expect.poll(() => page.evaluate(() => window.ws.readyState)).toBe(1);
      expect(await page.evaluate(() => window.log)).toEqual(['open']);
      socket.write('garbage');
      await expect.poll(() => page.evaluate(() => window.ws.readyState)).toBe(3);
      expect(await page.evaluate(() => window.log)).toEqual([
        'open',
        'error',
        expect.stringMatching(/close code=\d+ reason= wasClean=false/),
      ]);
    });

    test('should work with client-side close', async ({ page, server }) => {
      const wsPromise = server.waitForWebSocket();
      const upgradePromise = server.waitForUpgrade();
      await setupWS(page, server, 'blob');
      expect(await page.evaluate(() => window.ws.readyState)).toBe(0);
      const { doUpgrade } = await upgradePromise;
      expect(await page.evaluate(() => window.ws.readyState)).toBe(0);
      expect(await page.evaluate(() => window.log)).toEqual([]);
      doUpgrade();
      await expect.poll(() => page.evaluate(() => window.ws.readyState)).toBe(1);
      expect(await page.evaluate(() => window.log)).toEqual(['open']);
      const ws = await wsPromise;
      const closedPromise = new Promise<{ code: number, reason: Buffer }>(f => ws.once('close', (code, reason) => f({ code, reason })));
      const readyState = await page.evaluate(() => {
        window.ws.close(3002, 'oops');
        return window.ws.readyState;
      });
      expect(readyState).toBe(2);
      await expect.poll(() => page.evaluate(() => window.ws.readyState)).toBe(3);
      expect(await page.evaluate(() => window.log)).toEqual([
        'open',
        'close code=3002 reason=oops wasClean=true',
      ]);
      const closed = await closedPromise;
      expect(closed.code).toBe(3002);
      expect(closed.reason.toString()).toBe('oops');
    });

    test('should pass through the required protocol', async ({ page, server }) => {
      await setupWS(page, server, 'blob', 'my-custom-protocol');
      await page.evaluate(() => window.wsOpened);
      const protocol = await page.evaluate(() => window.ws.protocol);
      expect(protocol).toBe('my-custom-protocol');
    });

    test('should work with relative WebSocket URL', async ({ page, server }) => {
      const wsPromise = server.waitForWebSocket();
      await setupWS(page, server, 'blob', undefined, true);
      const ws = await wsPromise;
      ws.send(Buffer.from('hi'));
      await expect.poll(() => page.evaluate(() => window.log)).toEqual([
        'open',
        `message: data=blob:hi origin=ws://${server.HOST} lastEventId=`,
      ]);
      const messagePromise = new Promise(f => ws.once('message', data => f(data.toString())));
      await page.evaluate(() => window.ws.send(new Blob([new Uint8Array(['h'.charCodeAt(0), 'i'.charCodeAt(0)])])));
      expect(await messagePromise).toBe('hi');
    });
  });
}

test('should work with ws.close', async ({ page, server }) => {
  const { promise, resolve } = withResolvers<WebSocketRoute>();
  await page.routeWebSocket(/.*/, async ws => {
    ws.connectToServer();
    resolve(ws);
  });

  const wsPromise = server.waitForWebSocket();
  await setupWS(page, server, 'blob');
  const ws = await wsPromise;

  const route = await promise;
  route.send('hello');
  await expect.poll(() => page.evaluate(() => window.log)).toEqual([
    'open',
    `message: data=hello origin=ws://${server.HOST} lastEventId=`,
  ]);

  const closedPromise = new Promise(f => ws.once('close', (code, reason) => f({ code, reason: reason.toString() })));
  await route.close({ code: 3009, reason: 'oops' });
  await expect.poll(() => page.evaluate(() => window.log)).toEqual([
    'open',
    `message: data=hello origin=ws://${server.HOST} lastEventId=`,
    'close code=3009 reason=oops wasClean=true',
  ]);
  expect(await closedPromise).toEqual({ code: 3009, reason: 'oops' });
});

test('should pattern match', async ({ page, server }) => {
  await page.routeWebSocket(/.*\/ws$/, async ws => {
    ws.connectToServer();
  });

  await page.routeWebSocket('**/mock-ws', ws => {
    ws.onMessage(message => {
      ws.send('mock-response');
    });
  });

  const wsPromise = server.waitForWebSocket();

  await page.goto('about:blank');
  await page.evaluate(async ({ host }) => {
    window.log = [];
    (window as any).ws1 = new WebSocket('ws://' + host + '/ws');
    (window as any).ws1.addEventListener('message', event => window.log.push(`ws1:${event.data}`));
    (window as any).ws2 = new WebSocket('ws://' + host + '/something/something/mock-ws');
    (window as any).ws2.addEventListener('message', event => window.log.push(`ws2:${event.data}`));
    await Promise.all([
      new Promise(f => (window as any).ws1.addEventListener('open', f)),
      new Promise(f => (window as any).ws2.addEventListener('open', f)),
    ]);
  }, { host: server.HOST });

  const ws = await wsPromise;
  ws.on('message', () => ws.send('response'));

  await page.evaluate(() => (window as any).ws1.send('request'));
  await expect.poll(() => page.evaluate(() => window.log)).toEqual([`ws1:response`]);

  await page.evaluate(() => (window as any).ws2.send('request'));
  await expect.poll(() => page.evaluate(() => window.log)).toEqual([`ws1:response`, `ws2:mock-response`]);
});

test('should work with server', async ({ page, server }) => {
  const { promise, resolve } = withResolvers<WebSocketRoute>();
  await page.routeWebSocket(/.*/, async ws => {
    const server = ws.connectToServer();
    ws.onMessage(message => {
      switch (message) {
        case 'to-respond':
          ws.send('response');
          return;
        case 'to-block':
          return;
        case 'to-modify':
          server.send('modified');
          return;
      }
      server.send(message);
    });
    server.onMessage(message => {
      switch (message) {
        case 'to-block':
          return;
        case 'to-modify':
          ws.send('modified');
          return;
      }
      ws.send(message);
    });
    server.send('fake');
    resolve(ws);
  });

  const wsPromise = server.waitForWebSocket();
  const log: string[] = [];
  server.onceWebSocketConnection(ws => {
    ws.on('message', data => log.push(`message: ${data.toString()}`));
    ws.on('close', (code, reason) => log.push(`close: code=${code} reason=${reason.toString()}`));
  });

  await setupWS(page, server, 'blob');
  const ws = await wsPromise;
  await expect.poll(() => log).toEqual(['message: fake']);

  ws.send('to-modify');
  ws.send('to-block');
  ws.send('pass-server');
  await expect.poll(() => page.evaluate(() => window.log)).toEqual([
    'open',
    `message: data=modified origin=ws://${server.HOST} lastEventId=`,
    `message: data=pass-server origin=ws://${server.HOST} lastEventId=`,
  ]);

  await page.evaluate(() => {
    window.ws.send('to-respond');
    window.ws.send('to-modify');
    window.ws.send('to-block');
    window.ws.send('pass-client');
  });
  await expect.poll(() => log).toEqual(['message: fake', 'message: modified', 'message: pass-client']);
  await expect.poll(() => page.evaluate(() => window.log)).toEqual([
    'open',
    `message: data=modified origin=ws://${server.HOST} lastEventId=`,
    `message: data=pass-server origin=ws://${server.HOST} lastEventId=`,
    `message: data=response origin=ws://${server.HOST} lastEventId=`,
  ]);

  const route = await promise;
  route.send('another');
  await expect.poll(() => page.evaluate(() => window.log)).toEqual([
    'open',
    `message: data=modified origin=ws://${server.HOST} lastEventId=`,
    `message: data=pass-server origin=ws://${server.HOST} lastEventId=`,
    `message: data=response origin=ws://${server.HOST} lastEventId=`,
    `message: data=another origin=ws://${server.HOST} lastEventId=`,
  ]);

  await page.evaluate(() => {
    window.ws.send('pass-client-2');
  });
  await expect.poll(() => log).toEqual(['message: fake', 'message: modified', 'message: pass-client', 'message: pass-client-2']);

  await page.evaluate(() => {
    window.ws.close(3009, 'problem');
  });
  await expect.poll(() => log).toEqual(['message: fake', 'message: modified', 'message: pass-client', 'message: pass-client-2', 'close: code=3009 reason=problem']);
});

test('should work without server', async ({ page, server }) => {
  const { promise, resolve } = withResolvers<WebSocketRoute>();
  await page.routeWebSocket(/.*/, ws => {
    ws.onMessage(message => {
      switch (message) {
        case 'to-respond':
          ws.send('response');
          return;
      }
    });
    resolve(ws);
  });

  await setupWS(page, server, 'blob');

  await page.evaluate(async () => {
    await window.wsOpened;
    window.ws.send('to-respond');
    window.ws.send('to-block');
    window.ws.send('to-respond');
  });

  await expect.poll(() => page.evaluate(() => window.log)).toEqual([
    'open',
    `message: data=response origin=ws://${server.HOST} lastEventId=`,
    `message: data=response origin=ws://${server.HOST} lastEventId=`,
  ]);

  const route = await promise;
  route.send('another');
  await route.close({ code: 3008, reason: 'oops' });

  await expect.poll(() => page.evaluate(() => window.log)).toEqual([
    'open',
    `message: data=response origin=ws://${server.HOST} lastEventId=`,
    `message: data=response origin=ws://${server.HOST} lastEventId=`,
    `message: data=another origin=ws://${server.HOST} lastEventId=`,
    'close code=3008 reason=oops wasClean=true',
  ]);
});

test('should emit close upon frame navigation', async ({ page, server }) => {
  const { promise, resolve } = withResolvers<WebSocketRoute>();
  await page.routeWebSocket(/.*/, async ws => {
    ws.connectToServer();
    resolve(ws);
  });

  await setupWS(page, server, 'blob');

  const route = await promise;
  route.send('hello');

  await expect.poll(() => page.evaluate(() => window.log)).toEqual([
    'open',
    `message: data=hello origin=ws://${server.HOST} lastEventId=`,
  ]);

  const closedPromise = new Promise<void>(f => route.onClose(() => f()));
  await page.goto(server.EMPTY_PAGE);
  await closedPromise;
});

test('should emit close upon frame detach', async ({ page, server }) => {
  const { promise, resolve } = withResolvers<WebSocketRoute>();
  await page.routeWebSocket(/.*/, async ws => {
    ws.connectToServer();
    resolve(ws);
  });

  const frame = await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  await setupWS(frame, server, 'blob');

  const route = await promise;
  route.send('hello');

  await expect.poll(() => frame.evaluate(() => window.log)).toEqual([
    'open',
    `message: data=hello origin=ws://${server.HOST} lastEventId=`,
  ]);

  const closedPromise = new Promise<void>(f => route.onClose(() => f()));
  await detachFrame(page, 'frame1');
  await closedPromise;
});

test('should route on context', async ({ page, server }) => {
  await page.routeWebSocket(/ws1/, ws => {
    ws.onMessage(message => {
      ws.send('page-mock-1');
    });
  });

  await page.routeWebSocket(/ws1/, ws => {
    ws.onMessage(message => {
      ws.send('page-mock-2');
    });
  });

  await page.context().routeWebSocket(/.*/, ws => {
    ws.onMessage(message => {
      ws.send('context-mock-1');
    });
    ws.onMessage(message => {
      ws.send('context-mock-2');
    });
  });

  await page.goto('about:blank');
  await page.evaluate(({ host }) => {
    window.log = [];
    (window as any).ws1 = new WebSocket('ws://' + host + '/ws1');
    (window as any).ws1.addEventListener('message', event => window.log.push(`ws1:${event.data}`));
    (window as any).ws2 = new WebSocket('ws://' + host + '/ws2');
    (window as any).ws2.addEventListener('message', event => window.log.push(`ws2:${event.data}`));
  }, { host: server.HOST });

  await page.evaluate(() => (window as any).ws1.send('request'));
  await expect.poll(() => page.evaluate(() => window.log)).toEqual([`ws1:page-mock-2`]);

  await page.evaluate(() => (window as any).ws2.send('request'));
  await expect.poll(() => page.evaluate(() => window.log)).toEqual([`ws1:page-mock-2`, `ws2:context-mock-2`]);
});

test('should not throw after page closure', async ({ page, server }) => {
  const { promise, resolve } = withResolvers<WebSocketRoute>();
  await page.routeWebSocket(/.*/, async ws => {
    ws.connectToServer();
    resolve(ws);
  });

  await setupWS(page, server, 'blob');

  const route = await promise;
  await Promise.all([
    page.close(),
    route.send('hello'),
  ]);
});

test('should not throw with empty handler', async ({ page, server }) => {
  await page.routeWebSocket(/.*/, () => {});
  await setupWS(page, server, 'blob');
  await expect.poll(() => page.evaluate(() => window.log)).toEqual(['open']);
  await page.evaluate(() => window.ws.send('hi'));
  await page.evaluate(() => window.ws.send('hi2'));
  await expect.poll(() => page.evaluate(() => window.log)).toEqual(['open']);
});

test('should throw when connecting twice', async ({ page, server }) => {
  const { promise, resolve } = withResolvers<Error>();

  await page.routeWebSocket(/.*/, ws => {
    ws.connectToServer();
    try {
      ws.connectToServer();
    } catch (e) {
      resolve(e);
    }
  });
  await setupWS(page, server, 'blob');
  const error = await promise;
  expect(error.message).toContain('Already connected to the server');
});

test('should work with no trailing slash', async ({ page, server }) => {
  const log: string[] = [];
  // No trailing slash!
  await page.routeWebSocket('ws://' + server.HOST, ws => {
    ws.onMessage(message => {
      log.push(message as string);
      ws.send('response');
    });
  });

  await page.goto('about:blank');
  await page.evaluate(({ host }) => {
    window.log = [];
    // No trailing slash!
    window.ws = new WebSocket('ws://' + host);
    window.ws.addEventListener('message', event => window.log.push(event.data));
  }, { host: server.HOST });

  await expect.poll(() => page.evaluate(() => window.ws.readyState)).toBe(1);
  await page.evaluate(() => window.ws.send('query'));
  await expect.poll(() => log).toEqual(['query']);
  expect(await page.evaluate(() => window.log)).toEqual(['response']);
});

test('should work with baseURL', async ({ contextFactory, server }) => {
  const context = await contextFactory({ baseURL: 'http://' + server.HOST });
  const page = await context.newPage();

  await page.routeWebSocket('/ws', ws => {
    ws.onMessage(message => {
      ws.send(message);
    });
  });

  await setupWS(page, server, 'blob');

  await page.evaluate(async () => {
    await window.wsOpened;
    window.ws.send('echo');
  });

  await expect.poll(() => page.evaluate(() => window.log)).toEqual([
    'open',
    `message: data=echo origin=ws://${server.HOST} lastEventId=`,
  ]);
});
