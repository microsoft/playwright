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

import type { AndroidDevice, BrowserContext } from '../../index';
import { CommonWorkerFixtures, baseTest } from '../config/baseTest';
import type { Fixtures } from '../config/test-runner';
import { PageTestFixtures } from '../page/pageTest';
export { expect } from '../config/test-runner';

type AndroidWorkerFixtures = {
  androidDevice: AndroidDevice;
};

export const androidFixtures: Fixtures<PageTestFixtures, AndroidWorkerFixtures & { androidContext: BrowserContext }, {}, CommonWorkerFixtures> = {
  androidDevice: [ async ({ playwright }, run) => {
    const device = (await playwright._android.devices())[0];
    await device.shell('am force-stop org.chromium.webview_shell');
    await device.shell('am force-stop com.android.chrome');
    device.setDefaultTimeout(90000);
    await run(device);
    await device.close();
  }, { scope: 'worker' } ],

  browserVersion: async ({ androidDevice }, run) => {
    const browserVersion = (await androidDevice.shell('dumpsys package com.android.chrome'))
        .toString('utf8')
        .split('\n')
        .find(line => line.includes('versionName='))
        .trim()
        .split('=')[1];
    await run(browserVersion);
  },

  browserMajorVersion: async ({ browserVersion }, run) => {
    await run(Number(browserVersion.split('.')[0]));
  },

  isAndroid: true,
  isElectron: false,

  androidContext: [ async ({ androidDevice }, run) => {
    await run(await androidDevice.launchBrowser());
  }, { scope: 'worker' } ],

  page: async ({ androidContext }, run) => {
    const page = await androidContext.newPage();
    await run(page);
    for (const page of androidContext.pages())
      await page.close();
  },
};

export const androidTest = baseTest.extend<PageTestFixtures, AndroidWorkerFixtures>(androidFixtures as any);
