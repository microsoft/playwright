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

import { folio } from './android.fixtures';
const { it, expect } = folio;

if (process.env.PW_ANDROID_TESTS) {
  it('androidDevice.model', async function({ device }) {
    expect(device.model()).toBe('sdk_gphone_x86_arm');
  });

  it('androidDevice.launchBrowser', async function({ device }) {
    const context = await device.launchBrowser();
    const [page] = context.pages();
    await page.goto('data:text/html,<title>Hello world!</title>');
    expect(await page.title()).toBe('Hello world!');
    await context.close();
  });

  it('should create new page', async function({ device }) {
    const context = await device.launchBrowser();
    const page = await context.newPage();
    await page.goto('data:text/html,<title>Hello world!</title>');
    expect(await page.title()).toBe('Hello world!');
    await page.close();
    await context.close();
  });
}
