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
  await androidDevice.shell('am start org.chromium.webview_shell/.WebViewBrowserActivity');
  await androidDevice.fill({ res: 'org.chromium.webview_shell:id/url_field' }, 'Hello', { timeout: test.info().timeout });
  expect((await androidDevice.info({ res: 'org.chromium.webview_shell:id/url_field' })).text).toBe('Hello');
});
