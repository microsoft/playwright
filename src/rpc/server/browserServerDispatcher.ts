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

import { BrowserBase } from '../../browser';
import { BrowserServerChannel, BrowserServerInitializer, BrowserNewContextParams, BrowserContextChannel } from '../channels';
import { Dispatcher, DispatcherScope, DispatcherConnection } from './dispatcher';
import { Events } from '../../events';
import { BrowserDispatcher } from './browserDispatcher';
import { BrowserContextDispatcher } from './browserContextDispatcher';
import * as ws from 'ws';
import { helper } from '../../helper';
import { BrowserTypeBase } from '../../server/browserType';
import { BrowserTypeDispatcher } from './browserTypeDispatcher';

export class BrowserServerDispatcher extends Dispatcher<BrowserBase, BrowserServerInitializer> implements BrowserServerChannel {
  private _server: ws.Server;
  private _browserType: BrowserTypeBase;

  constructor(scope: DispatcherScope, browserType: BrowserTypeBase, browser: BrowserBase, port: number = 0) {
    const token = helper.guid();
    const server = new ws.Server({ port });
    const address = server.address();
    const wsEndpoint = typeof address === 'string' ? `${address}/${token}` : `ws://127.0.0.1:${address.port}/${token}`;

    const browserServer = browser._options.ownedServer!;
    super(scope, browser, 'BrowserServer', {
      wsEndpoint,
      pid: browserServer.process().pid
    }, true);

    this._server = server;
    this._browserType = browserType;

    server.on('connection', (socket: ws, req) => {
      if (req.url !== '/' + token) {
        socket.close();
        return;
      }
      this._clientAttached(socket);
    });

    browserServer.on(Events.BrowserServer.Close, (exitCode, signal) => {
      this._server.close();
      this._dispatchEvent('close', {
        exitCode: exitCode === null ? undefined : exitCode,
        signal: signal === null ? undefined : signal,
      });
      this._dispose();
    });

    (browser as any)._checkLeaks = () => {};
  }

  async close(): Promise<void> {
    const browserServer = this._object._options.ownedServer!;
    await browserServer.close();
  }

  async kill(): Promise<void> {
    const browserServer = this._object._options.ownedServer!;
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
    const browser = new ConnectedBrowser(browserType._scope, this._object);
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
