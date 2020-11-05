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

import { it, expect } from './fixtures';
import { instrumentWebSockets } from '../lib/client/websocket';

it('should work', async ({ page, server }) => {
  const logs: string[] = [];
  const log = (...s: string[]) => {
    logs.push(...s);
  };

  let closeCallback;
  const closePromise = new Promise(f => closeCallback = f);

  await instrumentWebSockets(page as any, async ws => {
    log(`open:${ws.url()}`);
    ws.on('close', () => {
      log('close');
      closeCallback();
    });
    ws.on('socketerror', () => log('socketerror'));
    ws.on('send', (buffer: Buffer) => log(`send:${buffer.toString()}`));
    ws.on('receive', (buffer: Buffer) => log(`receive:${buffer.toString()}`));
    ws.routeSend(async buffer => {
      log(`routesend:${buffer.toString()}`);
      if (buffer.toString() === 'outgoing1')
        return { response: Buffer.from('mocked') };
      return { data: Buffer.from(buffer.toString() + '-amended') };
    });
    ws.routeReceive(async buffer => {
      log(`routereceive:${buffer.toString()}`);
      if (buffer.toString() === 'incoming')
        return Buffer.from('intercepted');
      return buffer;
    });
    return 'ws://localhost:' + server.PORT + '/ws';
  });
  await page.goto(server.EMPTY_PAGE);

  page.on('console', m => log(m.text()));
  await page.evaluate(() => {
    let cb;
    let counter = 0;
    const result = new Promise(f => cb = f);
    const ws = new WebSocket('ws://dummy');
    ws.addEventListener('message', e => {
      console.log(`message:${e.data}`);
      ++counter;
      if (counter === 1) {
        ws.send('outgoing1');
      } else if (counter === 2) {
        ws.send('outgoing2');
      } if (counter === 3) {
        ws.close();
        cb();
      }
    });
    return result;
  });

  await closePromise;

  expect(logs).toEqual([
    'open:ws://dummy',
    'receive:incoming',
    'routereceive:incoming',
    'message:intercepted',
    'send:outgoing1',
    'routesend:outgoing1',
    'message:mocked',
    'send:outgoing2',
    'routesend:outgoing2',
    'receive:outgoing2-amended-echo',
    'routereceive:outgoing2-amended-echo',
    'message:outgoing2-amended-echo',
    'close',
  ]);
});
