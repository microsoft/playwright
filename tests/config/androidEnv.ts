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

import type { Env, WorkerInfo, TestInfo } from '../folio/out';
import type { AndroidDevice, BrowserContext } from '../../index';
import * as os from 'os';
import { AndroidTestArgs } from './androidTest';
import { PageTestArgs } from './pageTest';

require('../../lib/utils/utils').setUnderTest();
const playwright: typeof import('../../index') = require('../../index');

export class AndroidEnv implements Env<AndroidTestArgs> {
  protected _device?: AndroidDevice;

  async beforeAll(workerInfo: WorkerInfo) {
    this._device = (await playwright._android.devices())[0];
    await this._device.shell('am force-stop org.chromium.webview_shell');
    await this._device.shell('am force-stop com.android.chrome');
    this._device.setDefaultTimeout(90000);
  }

  async beforeEach(testInfo: TestInfo) {
    // Use chromium screenshots.
    testInfo.snapshotPathSegment = 'chromium';
    return {
      mode: 'default' as const,
      isChromium: true,
      isFirefox: false,
      isWebKit: false,
      browserName: 'chromium' as const,
      browserChannel: undefined,
      isWindows: os.platform() === 'win32',
      isMac: os.platform() === 'darwin',
      isLinux: os.platform() === 'linux',
      platform: os.platform() as ('win32' | 'darwin' | 'linux'),
      video: false,
      headful: true,
      toImpl: (playwright as any)._toImpl,
      playwright,
      androidDevice: this._device!,
    };
  }

  async afterAll(workerInfo: WorkerInfo) {
    if (this._device)
      await this._device.close();
    this._device = undefined;
  }
}

export class AndroidPageEnv extends AndroidEnv implements Env<PageTestArgs> {
  private _context?: BrowserContext;

  async beforeAll(workerInfo: WorkerInfo) {
    await super.beforeAll(workerInfo);
    this._context = await this._device!.launchBrowser();
  }

  async beforeEach(testInfo: TestInfo) {
    const result = await super.beforeEach(testInfo);
    const page = await this._context!.newPage();
    return {
      ...result,
      androidDevice: undefined,
      page,
    };
  }

  async afterEach(testInfo: TestInfo) {
    for (const page of this._context!.pages())
      await page.close();
  }
}
