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

import { androidTest as test, expect } from './androidTest';

test('android.launchServer should connect to a device', async ({ playwright }) => {
  const browserServer = await playwright._android.launchServer();
  const device = await playwright._android.connect(browserServer.wsEndpoint());
  const output = await device.shell('echo 123');
  expect(output.toString()).toBe('123\n');
  await device.close();
  await browserServer.close();
});

test('android.launchServer should be abe to reconnect to a device', async ({ playwright }) => {
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

test('android.launchServer should make sure that the connection gets disconnected when the device gets closed', () => {

});

test('android.launchServer should not allow multiple connections', async ({ playwright }) => {
  const browserServer = await playwright._android.launchServer();
  try {
    const deviceConnection1 = await playwright._android.connect(browserServer.wsEndpoint());
    await expect(playwright._android.connect(browserServer.wsEndpoint())).rejects.toThrow('Cannot connect to device, because another connection is already open');
  } finally {
    // Cleanup
    await browserServer.close();
  }
});

test('android.launchServer BrowserServer.close() will disconnect the device', () => {

});

test('android.launchServer BrowserServer.kill() will disconnect the device', () => {

});

test('android.launchServer should terminate WS connection when device gets disconnected', () => {

});
