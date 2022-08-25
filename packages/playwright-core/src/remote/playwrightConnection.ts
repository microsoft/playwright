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

import type { WebSocket } from '../utilsBundle';
import type { Playwright } from '../server';
import { createPlaywright, DispatcherConnection, RootDispatcher, PlaywrightDispatcher } from '../server';
import { Browser } from '../server/browser';
import { serverSideCallMetadata } from '../server/instrumentation';
import { gracefullyCloseAll } from '../utils/processLauncher';
import { SocksProxy } from '../common/socksProxy';
import type { Mode } from './playwrightServer';
import { assert } from '../utils';
import type { LaunchOptions } from '../server/types';

type Options = {
  enableSocksProxy: boolean,
  browserName: string | null,
  launchOptions: LaunchOptions,
};

type PreLaunched = {
  playwright: Playwright | null;
  browser: Browser | null;
};

export class PlaywrightConnection {
  private _ws: WebSocket;
  private _onClose: () => void;
  private _dispatcherConnection: DispatcherConnection;
  private _cleanups: (() => Promise<void>)[] = [];
  private _debugLog: (m: string) => void;
  private _disconnected = false;
  private _preLaunched: PreLaunched;
  private _options: Options;
  private _root: RootDispatcher;

  constructor(lock: Promise<void>, mode: Mode, ws: WebSocket, options: Options, preLaunched: PreLaunched, log: (m: string) => void, onClose: () => void) {
    this._ws = ws;
    this._preLaunched = preLaunched;
    this._options = options;
    if (mode === 'reuse-browser' || mode === 'use-pre-launched-browser')
      assert(preLaunched.playwright);
    if (mode === 'use-pre-launched-browser')
      assert(preLaunched.browser);
    this._onClose = onClose;
    this._debugLog = log;

    this._dispatcherConnection = new DispatcherConnection();
    this._dispatcherConnection.onmessage = async message => {
      await lock;
      if (ws.readyState !== ws.CLOSING)
        ws.send(JSON.stringify(message));
    };
    ws.on('message', async (message: string) => {
      await lock;
      this._dispatcherConnection.dispatch(JSON.parse(Buffer.from(message).toString()));
    });

    ws.on('close', () => this._onDisconnect());
    ws.on('error', error => this._onDisconnect(error));

    this._root = new RootDispatcher(this._dispatcherConnection, async scope => {
      if (mode === 'reuse-browser')
        return await this._initReuseBrowsersMode(scope);
      if (mode === 'use-pre-launched-browser')
        return await this._initPreLaunchedBrowserMode(scope);
      if (!options.browserName)
        return await this._initPlaywrightConnectMode(scope);
      return await this._initLaunchBrowserMode(scope);
    });
  }

  private async _initPlaywrightConnectMode(scope: RootDispatcher) {
    this._debugLog(`engaged playwright.connect mode`);
    const playwright = createPlaywright('javascript');
    // Close all launched browsers on disconnect.
    this._cleanups.push(() => gracefullyCloseAll());

    const socksProxy = this._options.enableSocksProxy ? await this._enableSocksProxy(playwright) : undefined;
    return new PlaywrightDispatcher(scope, playwright, socksProxy);
  }

  private async _initLaunchBrowserMode(scope: RootDispatcher) {
    this._debugLog(`engaged launch mode for "${this._options.browserName}"`);

    const playwright = createPlaywright('javascript');
    const socksProxy = this._options.enableSocksProxy ? await this._enableSocksProxy(playwright) : undefined;
    const browser = await playwright[this._options.browserName as 'chromium'].launch(serverSideCallMetadata(), this._options.launchOptions);

    this._cleanups.push(async () => {
      for (const browser of playwright.allBrowsers())
        await browser.close();
    });
    browser.on(Browser.Events.Disconnected, () => {
      // Underlying browser did close for some reason - force disconnect the client.
      this.close({ code: 1001, reason: 'Browser closed' });
    });

    return new PlaywrightDispatcher(scope, playwright, socksProxy, browser);
  }

  private async _initPreLaunchedBrowserMode(scope: RootDispatcher) {
    this._debugLog(`engaged pre-launched mode`);
    const playwright = this._preLaunched.playwright!;
    const browser = this._preLaunched.browser!;
    browser.on(Browser.Events.Disconnected, () => {
      // Underlying browser did close for some reason - force disconnect the client.
      this.close({ code: 1001, reason: 'Browser closed' });
    });
    const playwrightDispatcher = new PlaywrightDispatcher(scope, playwright, undefined, browser);
    // In pre-launched mode, keep only the pre-launched browser.
    for (const b of playwright.allBrowsers()) {
      if (b !== browser)
        await b.close();
    }
    this._cleanups.push(() => playwrightDispatcher.cleanup());
    return playwrightDispatcher;
  }

  private async _initReuseBrowsersMode(scope: RootDispatcher) {
    this._debugLog(`engaged reuse browsers mode for ${this._options.browserName}`);
    const playwright = this._preLaunched.playwright!;
    const requestedOptions = launchOptionsHash(this._options.launchOptions);
    let browser = playwright.allBrowsers().find(b => {
      if (b.options.name !== this._options.browserName)
        return false;
      const existingOptions = launchOptionsHash(b.options.originalLaunchOptions);
      return existingOptions === requestedOptions;
    });

    // Close remaining browsers of this type+channel. Keep different browser types for the speed.
    for (const b of playwright.allBrowsers()) {
      if (b === browser)
        continue;
      if (b.options.name === this._options.browserName && b.options.channel === this._options.launchOptions.channel)
        await b.close();
    }

    if (!browser) {
      browser = await playwright[this._options.browserName as 'chromium'].launch(serverSideCallMetadata(), {
        ...this._options.launchOptions,
        headless: false,
      });
      browser.on(Browser.Events.Disconnected, () => {
        // Underlying browser did close for some reason - force disconnect the client.
        this.close({ code: 1001, reason: 'Browser closed' });
      });
    }

    this._cleanups.push(async () => {
      // Don't close the pages so that user could debug them,
      // but close all the empty browsers and contexts to clean up.
      for (const browser of playwright.allBrowsers()) {
        for (const context of browser.contexts()) {
          if (!context.pages().length)
            await context.close(serverSideCallMetadata());
        }
        if (!browser.contexts())
          await browser.close();
      }
    });

    const playwrightDispatcher = new PlaywrightDispatcher(scope, playwright, undefined, browser);
    return playwrightDispatcher;
  }

  private async _enableSocksProxy(playwright: Playwright) {
    const socksProxy = new SocksProxy();
    playwright.options.socksProxyPort = await socksProxy.listen(0);
    this._debugLog(`started socks proxy on port ${playwright.options.socksProxyPort}`);
    this._cleanups.push(() => socksProxy.close());
    return socksProxy;
  }

  private async _onDisconnect(error?: Error) {
    this._disconnected = true;
    this._debugLog(`disconnected. error: ${error}`);
    this._root._dispose();
    this._debugLog(`starting cleanup`);
    for (const cleanup of this._cleanups)
      await cleanup().catch(() => {});
    this._onClose();
    this._debugLog(`finished cleanup`);
  }

  async close(reason?: { code: number, reason: string }) {
    if (this._disconnected)
      return;
    this._debugLog(`force closing connection: ${reason?.reason || ''} (${reason?.code || 0})`);
    try {
      this._ws.close(reason?.code, reason?.reason);
    } catch (e) {
    }
  }
}

function launchOptionsHash(options: LaunchOptions) {
  const copy = { ...options };
  for (const k of Object.keys(copy)) {
    const key = k as keyof LaunchOptions;
    if (copy[key] === defaultLaunchOptions[key])
      delete copy[key];
  }
  for (const key of optionsThatAllowBrowserReuse)
    delete copy[key];
  return JSON.stringify(copy);
}

const defaultLaunchOptions: LaunchOptions = {
  ignoreAllDefaultArgs: false,
  handleSIGINT: false,
  handleSIGTERM: false,
  handleSIGHUP: false,
  headless: true,
  devtools: false,
};

const optionsThatAllowBrowserReuse: (keyof LaunchOptions)[] = [
  'headless',
];
