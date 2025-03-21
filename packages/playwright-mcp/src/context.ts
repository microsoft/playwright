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

import * as playwright from 'playwright';

export class Context {
  private _launchOptions: playwright.LaunchOptions;
  private _page: playwright.Page | undefined;
  private _console: playwright.ConsoleMessage[] = [];
  private _initializePromise: Promise<void> | undefined;

  constructor(launchOptions: playwright.LaunchOptions) {
    this._launchOptions = launchOptions;
  }

  async ensurePage(): Promise<playwright.Page> {
    await this._initialize();
    return this._page!;
  }

  async ensureConsole(): Promise<playwright.ConsoleMessage[]> {
    await this._initialize();
    return this._console;
  }

  async close() {
    const page = await this.ensurePage();
    await page.close();
    this._initializePromise = undefined;
  }

  private async _initialize() {
    if (this._initializePromise)
      return this._initializePromise;
    this._initializePromise = (async () => {
      const browser = await this._createBrowser();
      this._page = await browser.newPage();
      this._page.on('console', event => this._console.push(event));
      this._page.on('framenavigated', () => this._console.length = 0);
    })();
    return this._initializePromise;
  }

  private async _createBrowser(): Promise<playwright.Browser> {
    if (process.env.PLAYWRIGHT_WS_ENDPOINT) {
      const url = new URL(process.env.PLAYWRIGHT_WS_ENDPOINT);
      url.searchParams.set('launch-options', JSON.stringify(this._launchOptions));
      return await playwright.chromium.connect(String(url));
    }
    return await playwright.chromium.launch({ channel: 'chrome', ...this._launchOptions });
  }
}
