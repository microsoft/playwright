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

import { LaunchServerOptions } from './client/types';
import { BrowserTypeBase } from '../server/browserType';
import * as ws from 'ws';
import { helper } from '../helper';
import { BrowserBase } from '../browser';
import { ChildProcess } from 'child_process';
import { Events } from '../events';
import { EventEmitter } from 'ws';
import { DispatcherScope, DispatcherConnection } from './server/dispatcher';
import { BrowserTypeDispatcher } from './server/browserTypeDispatcher';
import { BrowserDispatcher } from './server/browserDispatcher';
import { BrowserContextDispatcher } from './server/browserContextDispatcher';
import { BrowserNewContextParams, BrowserContextChannel } from './channels';
import { BrowserServerLauncher, BrowserServer } from './client/browserType';

export class BrowserServerLauncherImpl implements BrowserServerLauncher {
  private _browserType: BrowserTypeBase;

  constructor(browserType: BrowserTypeBase) {
    this._browserType = browserType;
  }

  async launchServer(options: LaunchServerOptions = {}): Promise<BrowserServerImpl> {
    const browser = await this._browserType.launch(options);
    return new BrowserServerImpl(this._browserType, browser as BrowserBase, options.port);
  }
}

export class BrowserServerImpl extends EventEmitter implements BrowserServer {
  private _server: ws.Server;
  private _browserType: BrowserTypeBase;
  private _browser: BrowserBase;
  private _wsEndpoint: string;
  private _process: ChildProcess;

  constructor(browserType: BrowserTypeBase, browser: BrowserBase, port: number = 0) {
    super();

    this._browserType = browserType;
    this._browser = browser;

    const token = helper.guid();
    this._server = new ws.Server({ port });
    const address = this._server.address();
    this._wsEndpoint = typeof address === 'string' ? `${address}/${token}` : `ws://127.0.0.1:${address.port}/${token}`;
    const browserServer = browser._options.ownedServer!;
    this._process = browserServer.process();

    this._server.on('connection', (socket: ws, req) => {
      if (req.url !== '/' + token) {
        socket.close();
        return;
      }
      this._clientAttached(socket);
    });

    browserServer.on(Events.BrowserServer.Close, (exitCode, signal) => {
      this._server.close();
      this.emit('close', exitCode, signal);
    });
  }

  process(): ChildProcess {
    return this._process;
  }

  wsEndpoint(): string {
    return this._wsEndpoint;
  }

  async close(): Promise<void> {
    const browserServer = this._browser._options.ownedServer!;
    await browserServer.close();
  }

  async kill(): Promise<void> {
    const browserServer = this._browser._options.ownedServer!;
    await browserServer.kill();
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
    const browserType = new BrowserTypeDispatcher(connection.rootDispatcher(), this._browserType);
    const browser = new ConnectedBrowser(browserType._scope, this._browser);
    socket.on('close', () => {
      // Avoid sending any more messages over closed socket.
      connection.onmessage = () => {};
      // Cleanup contexts upon disconnect.
      browser.close().catch(e => {});
    });
  }
}

class ConnectedBrowser extends BrowserDispatcher {
  private _contexts: BrowserContextDispatcher[] = [];
  _closed = false;

  constructor(scope: DispatcherScope, browser: BrowserBase) {
    super(scope, browser, 'connectedBrowser');
  }

  async newContext(params: BrowserNewContextParams): Promise<{ context: BrowserContextChannel }> {
    const result = await super.newContext(params);
    this._contexts.push(result.context as BrowserContextDispatcher);
    return result;
  }

  async close(): Promise<void> {
    // Only close our own contexts.
    await Promise.all(this._contexts.map(context => context.close()));
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
