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

import type { Env, TestInfo } from 'folio';
import { PlaywrightEnv } from './browserEnv';
import * as path from 'path';
import { ElectronTestArgs } from './electronTest';
import { ElectronApplication, Page } from '../../index';
import { PageTestArgs } from './pageTest';

export class ElectronEnv extends PlaywrightEnv implements Env<ElectronTestArgs> {
  private _electronApp: ElectronApplication | undefined;
  private _windows: Page[] = [];

  constructor() {
    super('chromium', { mode: 'default' });
    // This env prevents 'Electron Security Policy' console message.
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
  }

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

  async beforeEach(testInfo: TestInfo) {
    const result = await super.beforeEach(testInfo);
    this._electronApp = await result.playwright._electron.launch({
      args: [path.join(__dirname, 'electron-app.js')],
    });
    return {
      ...result,
      isElectron: true,
      electronApp: this._electronApp,
      newWindow: this._newWindow.bind(this),
    };
  }

  async afterEach(testInfo: TestInfo) {
    for (const window of this._windows)
      await window.close();
    this._windows = [];
    if (this._electronApp) {
      await this._electronApp.close();
      this._electronApp = undefined;
    }
    await super.afterEach(testInfo);
  }
}

export class ElectronPageEnv extends ElectronEnv implements Env<PageTestArgs> {
  async beforeEach(testInfo: TestInfo) {
    const result = await super.beforeEach(testInfo);
    const page = await result.newWindow();
    return {
      ...result,
      browserVersion: require('electron/package.json').version,
      page,
    };
  }
}
