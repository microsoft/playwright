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
import { EventEmitter } from 'events';
import { createPlaywright, DispatcherConnection, RootDispatcher, PlaywrightDispatcher } from '../server';
import { Browser } from '../server/browser';
import { serverSideCallMetadata } from '../server/instrumentation';
import { gracefullyCloseAll } from '../utils/processLauncher';
import { SocksProxy } from '../common/socksProxy';
import type { LaunchOptions } from '../server/types';
import { DebugControllerDispatcher } from '../server/dispatchers/debugControllerDispatcher';
import { ManualPromise } from '../utils/manualPromise';

type Options = {
  enableSocksProxy: boolean,
  launchOptions: LaunchOptions,
};

export class PlaywrightConnection extends EventEmitter {
  private _ws: WebSocket;
  private _semaphore: Semaphore;
  private _dispatcherConnection: DispatcherConnection;
  private _cleanups: (() => Promise<void>)[] = [];
  private _debugLog: (m: string) => void;
  private _disconnected = false;
  private _root: DispatcherScope | undefined;

  static createForPreLaunchedBrowser(semaphore: Semaphore, ws: WebSocket, log: (m: string) => void, playwright: Playwright, browser: Browser) {
    const connection = new PlaywrightConnection(semaphore, ws, log);
    connection._root = new RootDispatcher(connection._dispatcherConnection, async (scope: RootDispatcher) => {
      log(`engaged pre-launched mode`);
      browser.on(Browser.Events.Disconnected, () => {
        // Underlying browser did close for some reason - force disconnect the client.
        connection.close({ code: 1001, reason: 'Browser closed' });
      });
      const playwrightDispatcher = new PlaywrightDispatcher(scope, playwright, undefined, browser);
      // In pre-launched mode, keep only the pre-launched browser.
      for (const b of playwright.allBrowsers()) {
        if (b !== browser)
          await b.close();
      }
      connection._cleanups.push(() => playwrightDispatcher.cleanup());
      return playwrightDispatcher;
    });
    return connection;
  }

  static createForDebugController(semaphore: Semaphore, ws: WebSocket, log: (m: string) => void, playwright: Playwright) {
    log(`engaged reuse controller mode`);
    const connection = new PlaywrightConnection(semaphore, ws, log);
    connection._cleanups.push(() => gracefullyCloseAll());
    // Always create new instance based on the reused Playwright instance.
    connection._root = new DebugControllerDispatcher(connection._dispatcherConnection, playwright.debugController);
    return connection;
  }

  static createForBrowserReuse(semaphore: Semaphore, ws: WebSocket, log: (m: string) => void, playwright: Playwright, browserName: string, options: Options) {
    const connection = new PlaywrightConnection(semaphore, ws, log);
    connection._root = new RootDispatcher(connection._dispatcherConnection, async scope => {
      connection._debugLog(`engaged reuse browsers mode for ${browserName}`);
      const requestedOptions = launchOptionsHash(options.launchOptions);
      let browser = playwright.allBrowsers().find(b => {
        if (b.options.name !== browserName)
          return false;
        const existingOptions = launchOptionsHash(b.options.originalLaunchOptions);
        return existingOptions === requestedOptions;
      });

      // Close remaining browsers of this type+channel. Keep different browser types for the speed.
      for (const b of playwright.allBrowsers()) {
        if (b === browser)
          continue;
        if (b.options.name === browserName && b.options.channel === options.launchOptions.channel)
          await b.close();
      }

      if (!browser) {
        browser = await playwright[(browserName || 'chromium') as 'chromium'].launch(serverSideCallMetadata(), {
          ...options.launchOptions,
          headless: false,
        });
        browser.on(Browser.Events.Disconnected, () => {
          // Underlying browser did close for some reason - force disconnect the client.
          connection.close({ code: 1001, reason: 'Browser closed' });
        });
      }

      connection._cleanups.push(async () => {
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
    });
    return connection;
  }

  static createForBrowserLaunch(semaphore: Semaphore, ws: WebSocket, log: (m: string) => void, browserName: string, options: Options) {
    const connection = new PlaywrightConnection(semaphore, ws, log);
    connection._root = new RootDispatcher(connection._dispatcherConnection, async scope => {
      log(`engaged launch mode for "${browserName}"`);

      const playwright = createPlaywright('javascript');
      const socksProxy = options.enableSocksProxy ? await connection._enableSocksProxy(playwright) : undefined;
      const browser = await playwright[browserName as 'chromium'].launch(serverSideCallMetadata(), options.launchOptions);

      connection._cleanups.push(async () => {
        for (const browser of playwright.allBrowsers())
          await browser.close();
      });
      browser.on(Browser.Events.Disconnected, () => {
        // Underlying browser did close for some reason - force disconnect the client.
        connection.close({ code: 1001, reason: 'Browser closed' });
      });

      return new PlaywrightDispatcher(scope, playwright, socksProxy, browser);
    });
    return connection;
  }

  static createForPlaywrightConnect(semaphore: Semaphore, ws: WebSocket, log: (m: string) => void, options: Options) {
    const connection = new PlaywrightConnection(semaphore, ws, log);
    connection._root = new RootDispatcher(connection._dispatcherConnection, async scope => {
      log(`engaged playwright.connect mode`);
      const playwright = createPlaywright('javascript');
      // Close all launched browsers on disconnect.
      connection._cleanups.push(() => gracefullyCloseAll());

      const socksProxy = options.enableSocksProxy ? await connection._enableSocksProxy(playwright) : undefined;
      return new PlaywrightDispatcher(scope, playwright, socksProxy);
    });
    return connection;
  }

  constructor(semaphore: Semaphore, ws: WebSocket, log: (m: string) => void) {
    super();
    this._ws = ws;
    this._debugLog = log;
    this._semaphore = semaphore;

    const lock = semaphore.aquire();
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
    this._root?._dispose();
    this._debugLog(`starting cleanup`);
    for (const cleanup of this._cleanups)
      await cleanup().catch(() => {});
    this.emit('close');
    this._semaphore.release();
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
export class Semaphore {
  private _max: number;
  private _aquired = 0;
  private _queue: ManualPromise[] = [];

  constructor(max: number) {
    this._max = max;
  }

  setMax(max: number) {
    this._max = max;
  }

  aquire(): Promise<void> {
    const lock = new ManualPromise();
    this._queue.push(lock);
    this._flush();
    return lock;
  }

  requested() {
    return this._aquired + this._queue.length;
  }

  release() {
    --this._aquired;
    this._flush();
  }

  private _flush() {
    while (this._aquired < this._max && this._queue.length) {
      ++this._aquired;
      this._queue.shift()!.resolve();
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
