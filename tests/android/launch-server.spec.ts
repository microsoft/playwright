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

import ws from 'ws';
import { androidTest as test, expect } from './androidTest';
import { kTargetClosedErrorMessage } from '../config/errors';

// Force a separate worker to avoid messing up with `androidDevice` fixture.
test.use({ launchOptions: {} });

test('android.launchServer should connect to a device', async ({ playwright }) => {
  const browserServer = await playwright._android.launchServer();
  const device = await playwright._android.connect(browserServer.wsEndpoint());
  const output = await device.shell('echo 123');
  expect(output.toString()).toBe('123\n');
  await device.close();
  await browserServer.close();
});

test('android.launchServer should work with host', async ({ playwright }) => {
  const host = '0.0.0.0';
  const browserServer = await playwright._android.launchServer({ host });
  expect(browserServer.wsEndpoint()).toContain(String(host));
  const device = await playwright._android.connect(browserServer.wsEndpoint());
  const output = await device.shell('echo 123');
  expect(output.toString()).toBe('123\n');
  await device.close();
  await browserServer.close();
});

test('android.launchServer should handle close event correctly', async ({ playwright }) => {
  const receivedEvents: string[] = [];
  const browserServer = await playwright._android.launchServer();
  const device = await playwright._android.connect(browserServer.wsEndpoint());
  device.on('close', () => receivedEvents.push('device'));
  browserServer.on('close', () => receivedEvents.push('browserServer'));
  {
    const waitForDeviceClose = new Promise(f => device.on('close', f));
    await device.close();
    await waitForDeviceClose;
  }
  expect(receivedEvents).toEqual(['device']);
  await device.close();
  expect(receivedEvents).toEqual(['device']);
  await browserServer.close();
  expect(receivedEvents).toEqual(['device', 'browserServer']);
  await browserServer.close();
  expect(receivedEvents).toEqual(['device', 'browserServer']);
  await device.close();
  expect(receivedEvents).toEqual(['device', 'browserServer']);
});

test('android.launchServer should be able to reconnect to a device', async ({ playwright }) => {
  const browserServer = await playwright._android.launchServer();
  try {
    {
      const device = await playwright._android.connect(browserServer.wsEndpoint());
      await device.push(Buffer.from('hello world'), '/data/local/tmp/hello-world');
      await device.close();
    }
    {
      const device = await playwright._android.connect(browserServer.wsEndpoint());
      const data = await device.shell('cat /data/local/tmp/hello-world');
      expect(data).toEqual(Buffer.from('hello world'));
      await device.close();
    }
  } finally {
    // Cleanup
    const device = await playwright._android.connect(browserServer.wsEndpoint());
    await device.shell('rm /data/local/tmp/hello-world');
    await device.close();
    await browserServer.close();
  }
});

test('android.launchServer should throw if there is no device with a specified serial number', async ({ playwright }) => {
  await expect(playwright._android.launchServer({
    deviceSerialNumber: 'does-not-exist',
  })).rejects.toThrow(`No device with serial number 'does-not-exist'`);
});

test('android.launchServer should not allow multiple connections', async ({ playwright }) => {
  const browserServer = await playwright._android.launchServer();
  try {
    await playwright._android.connect(browserServer.wsEndpoint());
    await expect(playwright._android.connect(browserServer.wsEndpoint(), { timeout: 2_000 })).rejects.toThrow('android.connect: Timeout 2000ms exceeded');
  } finally {
    await browserServer.close();
  }
});

test('android.launchServer BrowserServer.close() will disconnect the device', async ({ playwright }) => {
  const browserServer = await playwright._android.launchServer();
  try {
    const device = await playwright._android.connect(browserServer.wsEndpoint());
    await browserServer.close();
    await expect(device.shell('echo 123')).rejects.toThrow('androidDevice.shell: ' + kTargetClosedErrorMessage);
  } finally {
    await browserServer.close();
  }
});

test('android.launchServer BrowserServer.kill() will disconnect the device',  async ({ playwright }) => {
  const browserServer = await playwright._android.launchServer();
  try {
    const device = await playwright._android.connect(browserServer.wsEndpoint());
    await browserServer.kill();
    await expect(device.shell('echo 123')).rejects.toThrow('androidDevice.shell: ' + kTargetClosedErrorMessage);
  } finally {
    await browserServer.close();
  }
});

test('android.launchServer should terminate WS connection when device gets disconnected', async  ({ playwright }) => {
  const browserServer = await playwright._android.launchServer();
  const forwardingServer = new ws.Server({ port: 0, path: '/connect' });
  let receivedConnection: ws.WebSocket | undefined;
  forwardingServer.on('connection', connection => {
    // Pause the connection until we establish the actual connection to the browser server.
    connection.pause();
    receivedConnection = connection;
    const actualConnection = new ws.WebSocket(browserServer.wsEndpoint());
    // We need to wait for the actual connection to be established before resuming
    actualConnection.on('open', () => connection.resume());
    actualConnection.on('message', message => connection.send(message));
    connection.on('message', message => actualConnection.send(message));
    connection.on('close', () => actualConnection.close());
    actualConnection.on('close', () => connection.close());
  });
  try {
    const device = await playwright._android.connect(`ws://localhost:${(forwardingServer.address() as ws.AddressInfo).port}/connect`);
    expect((await device.shell('echo 123')).toString()).toBe('123\n');
    expect(receivedConnection!.readyState).toBe(ws.OPEN);
    const waitToClose = new Promise(f => receivedConnection!.on('close', f));
    await device.close();
    await waitToClose;
    expect(receivedConnection!.readyState).toBe(ws.CLOSED);
  } finally {
    await browserServer.close();
    await new Promise(f => forwardingServer.close(f));
  }
});
