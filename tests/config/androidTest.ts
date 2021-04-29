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

import type { AndroidDevice } from '../../index';
import { CommonArgs, baseTest } from './baseTest';
import * as folio from 'folio';
export { expect } from 'folio';

type AndroidTestArgs = {
  androidDevice: AndroidDevice;
};

export class AndroidEnv {
  protected _device?: AndroidDevice;
  protected _browserVersion: string;
  protected _browserMajorVersion: number;

  async beforeAll(args: CommonArgs, workerInfo: folio.WorkerInfo) {
    this._device = (await args.playwright._android.devices())[0];
    await this._device.shell('am force-stop org.chromium.webview_shell');
    await this._device.shell('am force-stop com.android.chrome');
    this._browserVersion = (await this._device.shell('dumpsys package com.android.chrome'))
        .toString('utf8')
        .split('\n')
        .find(line => line.includes('versionName='))
        .trim()
        .split('=')[1];
    this._browserMajorVersion = Number(this._browserVersion.split('.')[0]);
    this._device.setDefaultTimeout(90000);
  }

  async beforeEach({}, testInfo: folio.TestInfo): Promise<AndroidTestArgs> {
    testInfo.data.platform = 'Android';
    testInfo.data.headful = true;
    testInfo.data.browserVersion = this._browserVersion;
    return {
      androidDevice: this._device!,
    };
  }

  async afterAll({}, workerInfo: folio.WorkerInfo) {
    if (this._device)
      await this._device.close();
    this._device = undefined;
  }
}

export const androidTest = baseTest.extend(new AndroidEnv());
