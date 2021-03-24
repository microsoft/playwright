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
import * as ws from 'ws';
import { Browser } from './server/browser';
import { EventEmitter } from 'ws';
import { DispatcherScope, DispatcherConnection } from './dispatchers/dispatcher';
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

export class BrowserServerLauncherImpl implements BrowserServerLauncher {
  private _playwright: Playwright;
  private _browserType: BrowserType;

  constructor(playwright: Playwright, browserType: BrowserType) {
    this._playwright = playwright;
    this._browserType = browserType;
  }

  async launchServer(options: LaunchServerOptions = {}): Promise<BrowserServer> {
    const browser = await this._browserType.launch(internalCallMetadata(), {
      ...options,
      ignoreDefaultArgs: Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : undefined,
      ignoreAllDefaultArgs: !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs),
      env: options.env ? envObjectToArray(options.env) : undefined,
    }, toProtocolLogger(options.logger));

    const server = await PlaywrightServer.start(scope => {
      const selectors = new Selectors();
      const browserDispatcher = new ConnectedBrowser(scope, browser, selectors);
      return {
        playwright: new PlaywrightDispatcher(scope, this._playwright, new SelectorsDispatcher(scope, selectors), browserDispatcher),
        onDisconnect: () => {
          // Cleanup contexts upon disconnect.
          browserDispatcher.close().catch(e => {});
        }
      };
    }, options.port);

    const browserServer = new EventEmitter() as (BrowserServer & EventEmitter);
    browserServer.process = () => browser.options.browserProcess.process!;
    browserServer.wsEndpoint = () => server.wsEndpoint();
    browserServer.close = () => browser.options.browserProcess.close();
    browserServer.kill = () => browser.options.browserProcess.kill();
    browser.options.browserProcess.onclose = (exitCode, signal) => {
      server.close();
      browserServer.emit('close', exitCode, signal);
    };
    return browserServer;
  }
}

type OnConnect = (scope: DispatcherScope) => {
  playwright: PlaywrightDispatcher;
  onDisconnect(): any;
};

class PlaywrightServer extends EventEmitter {
  private _onConnect: OnConnect;
  private _server: ws.Server;
  private _wsEndpoint: string;
  private _ready: Promise<void>;

  static async start(onConnect: OnConnect, port: number = 0): Promise<PlaywrightServer> {
    const server = new PlaywrightServer(onConnect, port);
    await server._ready;
    return server;
  }

  constructor(onConnect: OnConnect, port: number) {
    super();

    this._onConnect = onConnect;
    this._wsEndpoint = '';

    let readyCallback = () => {};
    this._ready = new Promise<void>(f => readyCallback = f);

    const token = createGuid();
    this._server = new ws.Server({ port, path: '/' + token }, () => {
      const address = this._server.address();
      this._wsEndpoint = typeof address === 'string' ? `${address}/${token}` : `ws://127.0.0.1:${address.port}/${token}`;
      readyCallback();
    });

    this._server.on('connection', (socket: ws, req) => {
      this._clientAttached(socket);
    });
  }

  close() {
    this._server.close();
  }

  wsEndpoint(): string {
    return this._wsEndpoint;
  }

  private _clientAttached(socket: ws) {
    const connection = new DispatcherConnection();
    connection.onmessage = message => {
      if (socket.readyState !== ws.CLOSING)
        socket.send(JSON.stringify(message));
    };
    socket.on('message', (message: string) => {
      connection.dispatch(JSON.parse(Buffer.from(message).toString()));
    });
    socket.on('error', () => {});
    const scope = connection.rootDispatcher();
    const connected = this._onConnect(scope);
    socket.on('close', () => {
      // Avoid sending any more messages over closed socket.
      connection.onmessage = () => {};
      connected.onDisconnect();
    });
  }
}

class ConnectedBrowser extends BrowserDispatcher {
  private _contexts: BrowserContextDispatcher[] = [];
  private _selectors: Selectors;
  _closed = false;

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
    dispatcher.streamVideos();
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
