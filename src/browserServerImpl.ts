/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

import { LaunchServerOptions, Logger } from './client/types';
import { BrowserType } from './server/browserType';
import { Browser } from './server/browser';
import { EventEmitter } from 'ws';
import { DispatcherScope } from './dispatchers/dispatcher';
import { BrowserDispatcher } from './dispatchers/browserDispatcher';
import { BrowserContextDispatcher } from './dispatchers/browserContextDispatcher';
import * as channels from './protocol/channels';
import { BrowserServerLauncher, BrowserServer } from './client/browserType';
import { envObjectToArray } from './client/clientHelper';
import { createGuid } from './utils/utils';
import { SelectorsDispatcher } from './dispatchers/selectorsDispatcher';
import { Selectors } from './server/selectors';
import { ProtocolLogger } from './server/types';
import { CallMetadata, internalCallMetadata } from './server/instrumentation';
import { Playwright } from './server/playwright';
import { PlaywrightDispatcher } from './dispatchers/playwrightDispatcher';
import { PlaywrightServer, PlaywrightServerDelegate } from './remote/playwrightServer';

export class BrowserServerLauncherImpl implements BrowserServerLauncher {
  private _playwright: Playwright;
  private _browserType: BrowserType;

  constructor(playwright: Playwright, browserType: BrowserType) {
    this._playwright = playwright;
    this._browserType = browserType;
  }

  async launchServer(options: LaunchServerOptions = {}): Promise<BrowserServer> {
    // 1. Pre-launch the browser
    const browser = await this._browserType.launch(internalCallMetadata(), {
      ...options,
      ignoreDefaultArgs: Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : undefined,
      ignoreAllDefaultArgs: !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs),
      env: options.env ? envObjectToArray(options.env) : undefined,
    }, toProtocolLogger(options.logger));

    // 2. Start the server
    const delegate: PlaywrightServerDelegate = {
      path: '/' + createGuid(),
      allowMultipleClients: true,
      onClose: () => {},
      onConnect: this._onConnect.bind(this, browser),
    };
    const server = new PlaywrightServer(delegate);
    const wsEndpoint = await server.listen(options.port);

    // 3. Return the BrowserServer interface
    const browserServer = new EventEmitter() as (BrowserServer & EventEmitter);
    browserServer.process = () => browser.options.browserProcess.process!;
    browserServer.wsEndpoint = () => wsEndpoint;
    browserServer.close = () => browser.options.browserProcess.close();
    browserServer.kill = () => browser.options.browserProcess.kill();
    browser.options.browserProcess.onclose = async (exitCode, signal) => {
      server.close();
      browserServer.emit('close', exitCode, signal);
    };
    return browserServer;
  }

  private _onConnect(browser: Browser, scope: DispatcherScope) {
    const selectors = new Selectors();
    const selectorsDispatcher = new SelectorsDispatcher(scope, selectors);
    const browserDispatcher = new ConnectedBrowser(scope, browser, selectors);
    new PlaywrightDispatcher(scope, this._playwright, selectorsDispatcher, browserDispatcher);
    return () => {
      // Cleanup contexts upon disconnect.
      browserDispatcher.close().catch(e => {});
    };
  }
}

// This class implements multiplexing multiple BrowserDispatchers over a single Browser instance.
class ConnectedBrowser extends BrowserDispatcher {
  private _contexts: BrowserContextDispatcher[] = [];
  private _selectors: Selectors;
  private _closed = false;

  constructor(scope: DispatcherScope, browser: Browser, selectors: Selectors) {
    super(scope, browser);
    this._selectors = selectors;
  }

  async newContext(params: channels.BrowserNewContextParams, metadata: CallMetadata): Promise<{ context: channels.BrowserContextChannel }> {
    if (params.recordVideo) {
      // TODO: we should create a separate temp directory or accept a launchServer parameter.
      params.recordVideo.dir = this._object.options.downloadsPath!;
    }
    const result = await super.newContext(params, metadata);
    const dispatcher = result.context as BrowserContextDispatcher;
    dispatcher._object._setSelectors(this._selectors);
    this._contexts.push(dispatcher);
    return result;
  }

  async close(): Promise<void> {
    // Only close our own contexts.
    await Promise.all(this._contexts.map(context => context.close({}, internalCallMetadata())));
    this._didClose();
  }

  _didClose() {
    if (!this._closed) {
      // We come here multiple times:
      // - from ConnectedBrowser.close();
      // - from underlying Browser.on('close').
      this._closed = true;
      super._didClose();
    }
  }
}

function toProtocolLogger(logger: Logger | undefined): ProtocolLogger | undefined {
  return logger ? (direction: 'send' | 'receive', message: object) => {
    if (logger.isEnabled('protocol', 'verbose'))
      logger.log('protocol', 'verbose', (direction === 'send' ? 'SEND ► ' : '◀ RECV ') + JSON.stringify(message), [], {});
  } : undefined;
}
