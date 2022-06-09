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
import type { Playwright, DispatcherScope } from '../server';
import { createPlaywright, DispatcherConnection, Root, PlaywrightDispatcher } from '../server';
import { Browser } from '../server/browser';
import { serverSideCallMetadata } from '../server/instrumentation';
import { gracefullyCloseAll } from '../utils/processLauncher';
import { registry } from '../server';
import { SocksProxy } from '../common/socksProxy';

export class PlaywrightConnection {
  private _ws: WebSocket;
  private _onClose: () => void;
  private _dispatcherConnection: DispatcherConnection;
  private _cleanups: (() => Promise<void>)[] = [];
  private _debugLog: (m: string) => void;
  private _disconnected = false;

  constructor(ws: WebSocket, enableSocksProxy: boolean, browserAlias: string | undefined, headless: boolean, browser: Browser | undefined, log: (m: string) => void, onClose: () => void) {
    this._ws = ws;
    this._onClose = onClose;
    this._debugLog = log;

    this._dispatcherConnection = new DispatcherConnection();
    this._dispatcherConnection.onmessage = message => {
      if (ws.readyState !== ws.CLOSING)
        ws.send(JSON.stringify(message));
    };
    ws.on('message', (message: string) => {
      this._dispatcherConnection.dispatch(JSON.parse(Buffer.from(message).toString()));
    });

    ws.on('close', () => this._onDisconnect());
    ws.on('error', error => this._onDisconnect(error));

    new Root(this._dispatcherConnection, async scope => {
      if (browser)
        return await this._initPreLaunchedBrowserMode(scope, browser);
      if (!browserAlias)
        return await this._initPlaywrightConnectMode(scope, enableSocksProxy);
      return await this._initLaunchBrowserMode(scope, enableSocksProxy, browserAlias, headless);
    });
  }

  private async _initPlaywrightConnectMode(scope: DispatcherScope, enableSocksProxy: boolean) {
    this._debugLog(`engaged playwright.connect mode`);
    const playwright = createPlaywright('javascript');
    // Close all launched browsers on disconnect.
    this._cleanups.push(() => gracefullyCloseAll());

    const socksProxy = enableSocksProxy ? await this._enableSocksProxy(playwright) : undefined;
    return new PlaywrightDispatcher(scope, playwright, socksProxy);
  }

  private async _initLaunchBrowserMode(scope: DispatcherScope, enableSocksProxy: boolean, browserAlias: string, headless: boolean) {
    this._debugLog(`engaged launch mode for "${browserAlias}"`);
    const executable = registry.findExecutable(browserAlias);
    if (!executable || !executable.browserName)
      throw new Error(`Unsupported browser "${browserAlias}`);

    const playwright = createPlaywright('javascript');
    const socksProxy = enableSocksProxy ? await this._enableSocksProxy(playwright) : undefined;
    const browser = await playwright[executable.browserName].launch(serverSideCallMetadata(), {
      channel: executable.type === 'browser' ? undefined : executable.name,
      headless,
    });

    // Close the browser on disconnect.
    // TODO: it is technically possible to launch more browsers over protocol.
    this._cleanups.push(() => browser.close());
    browser.on(Browser.Events.Disconnected, () => {
      // Underlying browser did close for some reason - force disconnect the client.
      this.close({ code: 1001, reason: 'Browser closed' });
    });

    return new PlaywrightDispatcher(scope, playwright, socksProxy, browser);
  }

  private async _initPreLaunchedBrowserMode(scope: DispatcherScope, browser: Browser) {
    this._debugLog(`engaged pre-launched mode`);
    browser.on(Browser.Events.Disconnected, () => {
      // Underlying browser did close for some reason - force disconnect the client.
      this.close({ code: 1001, reason: 'Browser closed' });
    });
    const playwright = browser.options.rootSdkObject as Playwright;
    const playwrightDispatcher = new PlaywrightDispatcher(scope, playwright, undefined, browser);
    // In pre-launched mode, keep the browser and just cleanup new contexts.
    // TODO: it is technically possible to launch more browsers over protocol.
    this._cleanups.push(() => playwrightDispatcher.cleanup());
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
    // Avoid sending any more messages over closed socket.
    this._dispatcherConnection.onmessage = () => {};
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
