/**
 * Copyright 2020 Microsoft Corporation. All rights reserved.
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
import { androidTest as test, expect } from './androidTest';

// Force a separate worker to avoid messing up with `androidDevice` fixture.
test.use({ launchOptions: {} });

test('androidDevice.close', async function({ playwright }) {
  const devices = await playwright._android.devices();
  expect(devices.length).toBe(1);
  const device = devices[0];
  const events: string[] = [];
  device.on('close', () => events.push('close'));
  await device.close();
  await device.close();
  expect(events).toEqual(['close']);
});

test('should be able to use a custom port', async function({ playwright }) {
  const proxyPort = 5038;
  let countOfIncomingConnections = 0;
  let countOfConnections = 0;
  const server = net.createServer(socket => {
    ++countOfIncomingConnections;
    ++countOfConnections;
    socket.on('close', () => countOfConnections--);
    const client = net.connect(5037, '127.0.0.1');
    socket.pipe(client).pipe(socket);
  });
  await new Promise<void>(resolve => server.listen(proxyPort, resolve));

  const devices = await playwright._android.devices({ port: proxyPort });
  expect(countOfIncomingConnections).toBeGreaterThanOrEqual(1);
  expect(devices).toHaveLength(1);
  const device = devices[0];
  const value = await device.shell('echo foobar');
  expect(value.toString()).toBe('foobar\n');
  await device.close();

  await new Promise(resolve => server.close(resolve));
  expect(countOfIncomingConnections).toBeGreaterThanOrEqual(1);
  expect(countOfConnections).toBe(0);
});
