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

import { baseTest } from '../config/baseTest';
import type { PageTestFixtures, PageWorkerFixtures } from '../page/pageTestApi';
import type { AndroidDevice, BrowserContext } from 'playwright-core';
export { expect } from '@playwright/test';

type AndroidTestFixtures = {
  androidDevice: AndroidDevice;
};

type AndroidWorkerFixtures = PageWorkerFixtures & {
  androidDeviceWorker: AndroidDevice;
  androidContext: BrowserContext;
};

async function closeAllActivities(device: AndroidDevice) {
  await device.shell('am force-stop com.google.android.googlequicksearchbox');
  await device.shell('am force-stop org.chromium.webview_shell');
  await device.shell('am force-stop com.android.chrome');
}

export const androidTest = baseTest.extend<PageTestFixtures & AndroidTestFixtures, AndroidWorkerFixtures>({
  androidDeviceWorker: [async ({ playwright }, run) => {
    const device = (await playwright._android.devices())[0];
    await closeAllActivities(device);
    device.setDefaultTimeout(90000);
    await run(device);
    await device.close();
  }, { scope: 'worker' }],

  browserVersion: [async ({ androidDeviceWorker }, run) => {
    const browserVersion = (await androidDeviceWorker.shell('dumpsys package com.android.chrome'))
        .toString('utf8')
        .split('\n')
        .find(line => line.includes('versionName='))!
        .trim()
        .split('=')[1];
    await run(browserVersion);
  }, { scope: 'worker' }],

  browserMajorVersion: [async ({ browserVersion }, run) => {
    await run(Number(browserVersion.split('.')[0]));
  }, { scope: 'worker' }],

  isAndroid: [true, { scope: 'worker' }],
  isElectron: [false, { scope: 'worker' }],
  electronMajorVersion: [0, { scope: 'worker' }],
  isWebView2: [false, { scope: 'worker' }],
  isHeadlessShell: [false, { scope: 'worker' }],

  androidDevice: async ({ androidDeviceWorker }, use) => {
    await closeAllActivities(androidDeviceWorker);
    await use(androidDeviceWorker);
    await closeAllActivities(androidDeviceWorker);
  },

  androidContext: [async ({ androidDeviceWorker }, run) => {
    const context = await androidDeviceWorker.launchBrowser();
    const [page] = context.pages();
    await page.goto('data:text/html,Default page');
    await run(context);
  }, { scope: 'worker' }],

  page: async ({ androidContext }, run) => {
    // Retain default page, otherwise Clank will re-create it.
    while (androidContext.pages().length > 1)
      await androidContext.pages()[1].close();
    const page = await androidContext.newPage();
    await run(page);
    await androidContext.clearCookies();
  },
});
