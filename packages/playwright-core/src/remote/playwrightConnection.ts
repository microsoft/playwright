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
import type { DispatcherScope, Playwright } from '../server';
import { createPlaywright, DispatcherConnection, RootDispatcher, PlaywrightDispatcher } from '../server';
import { Browser } from '../server/browser';
import { serverSideCallMetadata } from '../server/instrumentation';
import { SocksProxy } from '../common/socksProxy';
import { assert } from '../utils';
import type { LaunchOptions } from '../server/types';
import { AndroidDevice } from '../server/android/android';
import { DebugControllerDispatcher } from '../server/dispatchers/debugControllerDispatcher';

export type ClientType = 'controller' | 'playwright' | 'launch-browser' | 'reuse-browser' | 'pre-launched-browser-or-android';

type Options = {
  socksProxyPattern: string | undefined,
  browserName: string | null,
  launchOptions: LaunchOptions,
};

type PreLaunched = {
  playwright?: Playwright | undefined;
  browser?: Browser | undefined;
  androidDevice?: AndroidDevice | undefined;
  socksProxy?: SocksProxy | undefined;
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
  private _root: DispatcherScope;

  constructor(lock: Promise<void>, clientType: ClientType, ws: WebSocket, options: Options, preLaunched: PreLaunched, log: (m: string) => void, onClose: () => void) {
    this._ws = ws;
    this._preLaunched = preLaunched;
    this._options = options;
    if (clientType === 'reuse-browser' || clientType === 'pre-launched-browser-or-android')
      assert(preLaunched.playwright);
    if (clientType === 'pre-launched-browser-or-android')
      assert(preLaunched.browser || preLaunched.androidDevice);
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
    ws.on('error', (error: Error) => this._onDisconnect(error));

    if (clientType === 'controller') {
      this._root = this._initDebugControllerMode();
      return;
    }

    this._root = new RootDispatcher(this._dispatcherConnection, async scope => {
      if (clientType === 'reuse-browser')
        return await this._initReuseBrowsersMode(scope);
      if (clientType === 'pre-launched-browser-or-android')
        return this._preLaunched.browser ? await this._initPreLaunchedBrowserMode(scope) : await this._initPreLaunchedAndroidMode(scope);
      if (clientType === 'launch-browser')
        return await this._initLaunchBrowserMode(scope);
      if (clientType === 'playwright')
        return await this._initPlaywrightConnectMode(scope);
      throw new Error('Unsupported client type: ' + clientType);
    });
  }

  private async _initPlaywrightConnectMode(scope: RootDispatcher) {
    this._debugLog(`engaged playwright.connect mode`);
    const playwright = createPlaywright('javascript');
    // Close all launched browsers on disconnect.
    this._cleanups.push(async () => {
      await Promise.all(playwright.allBrowsers().map(browser => browser.close()));
    });

    const ownedSocksProxy = await this._createOwnedSocksProxy(playwright);
    return new PlaywrightDispatcher(scope, playwright, ownedSocksProxy);
  }

  private async _initLaunchBrowserMode(scope: RootDispatcher) {
    this._debugLog(`engaged launch mode for "${this._options.browserName}"`);
    const playwright = createPlaywright('javascript');

    const ownedSocksProxy = await this._createOwnedSocksProxy(playwright);
    const browser = await playwright[this._options.browserName as 'chromium'].launch(serverSideCallMetadata(), this._options.launchOptions);

    this._cleanups.push(async () => {
      for (const browser of playwright.allBrowsers())
        await browser.close();
    });
    browser.on(Browser.Events.Disconnected, () => {
      // Underlying browser did close for some reason - force disconnect the client.
      this.close({ code: 1001, reason: 'Browser closed' });
    });

    return new PlaywrightDispatcher(scope, playwright, ownedSocksProxy, browser);
  }

  private async _initPreLaunchedBrowserMode(scope: RootDispatcher) {
    this._debugLog(`engaged pre-launched (browser) mode`);
    const playwright = this._preLaunched.playwright!;

    // Note: connected client owns the socks proxy and configures the pattern.
    this._preLaunched.socksProxy?.setPattern(this._options.socksProxyPattern);

    const browser = this._preLaunched.browser!;
    browser.on(Browser.Events.Disconnected, () => {
      // Underlying browser did close for some reason - force disconnect the client.
      this.close({ code: 1001, reason: 'Browser closed' });
    });

    const playwrightDispatcher = new PlaywrightDispatcher(scope, playwright, this._preLaunched.socksProxy, browser);
    // In pre-launched mode, keep only the pre-launched browser.
    for (const b of playwright.allBrowsers()) {
      if (b !== browser)
        await b.close();
    }
    this._cleanups.push(() => playwrightDispatcher.cleanup());
    return playwrightDispatcher;
  }

  private async _initPreLaunchedAndroidMode(scope: RootDispatcher) {
    this._debugLog(`engaged pre-launched (Android) mode`);
    const playwright = this._preLaunched.playwright!;
    const androidDevice = this._preLaunched.androidDevice!;
    androidDevice.on(AndroidDevice.Events.Close, () => {
      // Underlying browser did close for some reason - force disconnect the client.
      this.close({ code: 1001, reason: 'Android device disconnected' });
    });
    const playwrightDispatcher = new PlaywrightDispatcher(scope, playwright, undefined, undefined, androidDevice);
    this._cleanups.push(() => playwrightDispatcher.cleanup());
    return playwrightDispatcher;
  }

  private _initDebugControllerMode(): DebugControllerDispatcher {
    this._debugLog(`engaged reuse controller mode`);
    const playwright = this._preLaunched.playwright!;
    // Always create new instance based on the reused Playwright instance.
    return new DebugControllerDispatcher(this._dispatcherConnection, playwright.debugController);
  }

  private async _initReuseBrowsersMode(scope: RootDispatcher) {
    // Note: reuse browser mode does not support socks proxy, because
    // clients come and go, while the browser stays the same.

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
      browser = await playwright[(this._options.browserName || 'chromium') as 'chromium'].launch(serverSideCallMetadata(), {
        ...this._options.launchOptions,
        headless: !!process.env.PW_DEBUG_CONTROLLER_HEADLESS,
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
          else
            await context.stopPendingOperations();
        }
        if (!browser.contexts())
          await browser.close();
      }
    });

    const playwrightDispatcher = new PlaywrightDispatcher(scope, playwright, undefined, browser);
    return playwrightDispatcher;
  }

  private async _createOwnedSocksProxy(playwright: Playwright): Promise<SocksProxy | undefined> {
    const socksProxy = new SocksProxy();
    socksProxy.setPattern(this._options.socksProxyPattern);
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
