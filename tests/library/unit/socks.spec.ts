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

import net from 'net';
import { test as it, expect } from '@playwright/test';
import { utils } from '../../../packages/playwright-core/lib/coreBundle';

const { SocksProxy } = utils;

// Runs a SOCKS5 CONNECT handshake against the proxy and returns the raw 10-byte CONNECT reply
// (the 2-byte greeting response is consumed before the request is sent). The client socket is
// destroyed once the reply arrives so the proxy tears down the connection deterministically.
function socks5Connect(proxyPort: number, targetHost: string, targetPort: number): Promise<Buffer> {
  const socket = net.connect(proxyPort, '127.0.0.1');
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let greetingDone = false;

    const done = (error: Error | null, reply?: Buffer) => {
      socket.destroy();
      if (error)
        reject(error);
      else
        resolve(reply!);
    };

    socket.on('data', data => {
      chunks.push(data);
      const buffer = Buffer.concat(chunks);
      if (!greetingDone) {
        if (buffer.length < 2)
          return;
        // Consume the greeting response [0x05, 0x00] and issue the CONNECT request.
        greetingDone = true;
        chunks.length = 0;
        chunks.push(buffer.subarray(2));
        socket.write(Buffer.from([
          0x05, 0x01, 0x00, 0x01, // VER=5, CMD=CONNECT, RSV, ATYP=IPv4
          ...targetHost.split('.').map(Number),
          targetPort >> 8, targetPort & 0xFF, // DST.PORT
        ]));
        return;
      }
      if (buffer.length >= 10)
        done(null, buffer.subarray(0, 10));
    });

    socket.on('error', error => done(error));
    // Greeting: VER=5, one method, no authentication.
    socket.write(Buffer.from([0x05, 0x01, 0x00]));
  });
}

it('should reply with the unspecified 0.0.0.0:0 bound address in the SOCKS CONNECT reply', async () => {
  // A trivial TCP server that the proxy connects to on behalf of the client.
  const target = net.createServer(socket => socket.destroy());
  await new Promise<void>(f => target.listen(0, '127.0.0.1', () => f()));
  const targetPort = (target.address() as net.AddressInfo).port;

  const proxy = new SocksProxy();
  const proxyPort = await proxy.listen(0, '127.0.0.1');

  try {
    const reply = await socks5Connect(proxyPort, '127.0.0.1', targetPort);
    expect(reply[0]).toBe(0x05); // VER
    expect(reply[1]).toBe(0x00); // REP = Succeeded
    expect(reply[2]).toBe(0x00); // RSV
    expect(reply[3]).toBe(0x01); // ATYP = IPv4
    // Per RFC 1928, BND.ADDR/BND.PORT are ignored by the client, so the proxy must always report
    // the unspecified address instead of the (leaky, and sometimes non-IP) socket.localAddress.
    expect([...reply.subarray(4, 8)]).toEqual([0, 0, 0, 0]);
    expect([...reply.subarray(8, 10)]).toEqual([0, 0]);
  } finally {
    await proxy.close();
    await new Promise<void>(f => target.close(() => f()));
  }
});
