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

import { _electron } from 'playwright-core';
import { testDebug } from '../log';

import type * as playwright from 'playwright-core';
import type { FullConfig } from './config';
import type { BrowserContextFactory, BrowserContextFactoryResult } from './browserContextFactory';
import type { ClientInfo } from '../sdk/server';

export type ElectronConfig = NonNullable<FullConfig['browser']['electron']>;

/**
 * ElectronContextFactory launches and manages Electron applications.
 * It provides a BrowserContext from the Electron app's first window.
 */
export class ElectronContextFactory implements BrowserContextFactory {
  readonly config: FullConfig;
  private _electronApp: playwright.ElectronApplication | null = null;
  private _currentPage: playwright.Page | null = null;

  constructor(config: FullConfig) {
    this.config = config;
  }

  async createContext(clientInfo: ClientInfo): Promise<BrowserContextFactoryResult> {
    testDebug('create electron context');

    const electronConfig = this.config.browser.electron ?? {};

    // Launch the Electron application
    this._electronApp = await _electron.launch({
      args: electronConfig.args ?? ['.'],
      executablePath: electronConfig.executablePath,
      cwd: electronConfig.cwd,
      env: electronConfig.env,
      timeout: electronConfig.timeout ?? 30000,
      // Forward context options that are compatible with Electron
      colorScheme: this.config.browser.contextOptions?.colorScheme,
      locale: this.config.browser.contextOptions?.locale,
      timezoneId: this.config.browser.contextOptions?.timezoneId,
      acceptDownloads: this.config.browser.contextOptions?.acceptDownloads,
      bypassCSP: this.config.browser.contextOptions?.bypassCSP,
    });

    // Wait for the first window to open
    this._currentPage = await this._electronApp.firstWindow();
    testDebug('electron app launched, first window ready');

    const browserContext = this._electronApp.context();

    return {
      browserContext,
      close: async (afterClose: () => Promise<void>) => {
        testDebug('close electron context');
        await this._electronApp?.close().catch(() => {});
        this._electronApp = null;
        this._currentPage = null;
        await afterClose();
        testDebug('electron context closed');
      }
    };
  }

  /**
   * Get the ElectronApplication instance for Electron-specific operations.
   */
  getElectronApp(): playwright.ElectronApplication | null {
    return this._electronApp;
  }

  /**
   * Get all windows from the Electron app.
   */
  async getWindows(): Promise<playwright.Page[]> {
    if (!this._electronApp)
      throw new Error('Electron app not launched');
    return this._electronApp.windows();
  }

  /**
   * Evaluate code in the Electron main process.
   */
  async evaluateMain<T>(fn: string): Promise<T> {
    if (!this._electronApp)
      throw new Error('Electron app not launched');
    // Use Playwright's native evaluate which runs in the main process
    // The function receives Electron exports { app, BrowserWindow, ... } as first arg
    // We provide a shim for require('electron') that returns the exports
    return this._electronApp.evaluate((electron, fnStr) => {
      // Create a require shim for 'electron' module
      const requireShim = (mod: string) => {
        if (mod === 'electron')
          return electron;
        throw new Error(`Cannot require '${mod}' - only 'electron' is available`);
      };
      // Execute the function with require available
      const fn = new Function('require', `return (${fnStr})()`);
      return fn(requireShim);
    }, fn);
  }

  /**
   * Get the BrowserWindow handle for a given page.
   */
  async getBrowserWindow(page: playwright.Page): Promise<playwright.JSHandle> {
    if (!this._electronApp)
      throw new Error('Electron app not launched');
    return this._electronApp.browserWindow(page);
  }
}
