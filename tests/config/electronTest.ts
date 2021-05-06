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

import { baseTest, CommonArgs } from './baseTest';
import { ElectronApplication, Page } from '../../index';
import * as folio from 'folio';
import * as path from 'path';
export { expect } from 'folio';

type ElectronTestArgs = {
  electronApp: ElectronApplication;
  newWindow: () => Promise<Page>;
};

export class ElectronEnv {
  private _electronApp: ElectronApplication | undefined;
  private _windows: Page[] = [];
  protected _browserVersion: string;
  protected _browserMajorVersion: number;

  private async _newWindow() {
    const [ window ] = await Promise.all([
      this._electronApp!.waitForEvent('window'),
      this._electronApp!.evaluate(electron => {
        const window = new electron.BrowserWindow({
          width: 800,
          height: 600,
          // Sandboxed windows share process with their window.open() children
          // and can script them. We use that heavily in our tests.
          webPreferences: { sandbox: true }
        });
        window.loadURL('about:blank');
      })
    ]);
    this._windows.push(window);
    return window;
  }

  async beforeAll() {
    // This env prevents 'Electron Security Policy' console message.
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
    this._browserVersion = require('electron/package.json').version;
    this._browserMajorVersion = Number(this._browserVersion.split('.')[0]);
    return {};
  }

  async beforeEach(args: CommonArgs, testInfo: folio.TestInfo): Promise<ElectronTestArgs> {
    this._electronApp = await args.playwright._electron.launch({
      args: [path.join(__dirname, 'electron-app.js')],
    });
    testInfo.data.browserVersion = this._browserVersion;
    return {
      electronApp: this._electronApp,
      newWindow: this._newWindow.bind(this),
    };
  }

  async afterEach({}, testInfo: folio.TestInfo) {
    for (const window of this._windows)
      await window.close();
    this._windows = [];
    if (this._electronApp) {
      await this._electronApp.close();
      this._electronApp = undefined;
    }
  }
}

export const baseElectronTest = baseTest;
export const electronTest = baseTest.extend(new ElectronEnv());
