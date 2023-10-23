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

import fs from 'fs';
import { join } from 'path';
import { PNG } from 'playwright-core/lib/utilsBundle';
import { androidTest as test, expect } from './androidTest';

test('androidDevice.shell', async function({ androidDevice }) {
  const output = await androidDevice.shell('echo 123');
  expect(output.toString()).toBe('123\n');
});

test('androidDevice.open', async function({ androidDevice }) {
  const socket = await androidDevice.open('shell:/bin/cat');
  await socket.write(Buffer.from('321\n'));
  const output = await new Promise(resolve => socket.on('data', resolve));
  expect(output!.toString()).toBe('321\n');
  const closedPromise = new Promise<void>(resolve => socket.on('close', resolve));
  await socket.close();
  await closedPromise;
});

test('androidDevice.screenshot', async function({ androidDevice }, testInfo) {
  const path = testInfo.outputPath('screenshot.png');
  const result = await androidDevice.screenshot({ path });
  const buffer = fs.readFileSync(path);
  expect(result.length).toBe(buffer.length);
  const { width, height } = PNG.sync.read(result);
  expect(width).toBe(1080);
  expect(height).toBe(1920);
});

test('androidDevice.push', async function({ androidDevice }) {
  try {
    await androidDevice.push(Buffer.from('hello world'), '/data/local/tmp/hello-world');
    const data = await androidDevice.shell('cat /data/local/tmp/hello-world');
    expect(data).toEqual(Buffer.from('hello world'));
  } finally {
    await androidDevice.shell('rm /data/local/tmp/hello-world');
  }
});

test('androidDevice.fill', async function({ androidDevice }) {
  test.fixme(true, 'Hangs on the bots');

  await androidDevice.shell('am start org.chromium.webview_shell/.WebViewBrowserActivity');
  await androidDevice.fill({ res: 'org.chromium.webview_shell:id/url_field' }, 'Hello');
  expect((await androidDevice.info({ res: 'org.chromium.webview_shell:id/url_field' })).text).toBe('Hello');
});

test('androidDevice.options.omitDriverInstall', async function({ playwright }) {
  test.skip(true, 'Android._driverPromise gets cached and is in a closed state. Its stored inside the androidDevice worker fixture.');
  const devices = await playwright._android.devices({ omitDriverInstall: true });

  const androidDevice = devices[0];
  await androidDevice.shell(`cmd package uninstall com.microsoft.playwright.androiddriver`);
  await androidDevice.shell(`cmd package uninstall com.microsoft.playwright.androiddriver.test`);

  await androidDevice.shell('am start -a android.intent.action.VIEW -d about:blank com.android.chrome');

  let fillStatus = '';
  androidDevice.fill({ res: 'com.android.chrome:id/url_bar' }, 'Hello').then(() => {
    fillStatus = 'success';
  }).catch(() => {
    fillStatus = 'error';
  });

  // install and start driver
  for (const file of ['android-driver.apk', 'android-driver-target.apk']) {
    const filePath =  join(require.resolve('playwright-core'), '..', 'bin', file);
    await androidDevice.installApk(await fs.promises.readFile(filePath));
  }
  androidDevice.shell('am instrument -w com.microsoft.playwright.androiddriver.test/androidx.test.runner.AndroidJUnitRunner').catch(e => console.error(e));

  // wait for finishing fill operation
  while (!fillStatus)
    await new Promise(f => setTimeout(f, 200));

  expect(fillStatus).toBe('success');
});
