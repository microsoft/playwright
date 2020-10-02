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
import { BrowserType } from './server/browserType';
import * as ws from 'ws';
import * as fs from 'fs';
import { Browser } from './server/browser';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'ws';
import { Dispatcher, DispatcherScope, DispatcherConnection } from './dispatchers/dispatcher';
import { BrowserDispatcher } from './dispatchers/browserDispatcher';
import { BrowserContextDispatcher } from './dispatchers/browserContextDispatcher';
import * as channels from './protocol/channels';
import { BrowserServerLauncher, BrowserServer } from './client/browserType';
import { envObjectToArray } from './client/clientHelper';
import { createGuid } from './utils/utils';
import { SelectorsDispatcher } from './dispatchers/selectorsDispatcher';
import { Selectors } from './server/selectors';
import { BrowserContext, Video } from './server/browserContext';
import { StreamDispatcher } from './dispatchers/streamDispatcher';

export class BrowserServerLauncherImpl implements BrowserServerLauncher {
  private _browserType: BrowserType;

  constructor(browserType: BrowserType) {
    this._browserType = browserType;
  }

  async launchServer(options: LaunchServerOptions = {}): Promise<BrowserServerImpl> {
    const browser = await this._browserType.launch({
      ...options,
      ignoreDefaultArgs: Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : undefined,
      ignoreAllDefaultArgs: !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs),
      env: options.env ? envObjectToArray(options.env) : undefined,
    });
    return new BrowserServerImpl(this._browserType, browser, options.port);
  }
}

export class BrowserServerImpl extends EventEmitter implements BrowserServer {
  private _server: ws.Server;
  private _browserType: BrowserType;
  private _browser: Browser;
  private _wsEndpoint: string;
  private _process: ChildProcess;

  constructor(browserType: BrowserType, browser: Browser, port: number = 0) {
    super();

    this._browserType = browserType;
    this._browser = browser;

    const token = createGuid();
    this._server = new ws.Server({ port });
    const address = this._server.address();
    this._wsEndpoint = typeof address === 'string' ? `${address}/${token}` : `ws://127.0.0.1:${address.port}/${token}`;
    this._process = browser._options.browserProcess.process;

    this._server.on('connection', (socket: ws, req) => {
      if (req.url !== '/' + token) {
        socket.close();
        return;
      }
      this._clientAttached(socket);
    });

    browser._options.browserProcess.onclose = (exitCode, signal) => {
      this._server.close();
      this.emit('close', exitCode, signal);
    };
  }

  process(): ChildProcess {
    return this._process;
  }

  wsEndpoint(): string {
    return this._wsEndpoint;
  }

  async close(): Promise<void> {
    await this._browser._options.browserProcess.close();
  }

  async kill(): Promise<void> {
    await this._browser._options.browserProcess.kill();
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
    const selectors = new Selectors();
    const scope = connection.rootDispatcher();
    const remoteBrowser = new RemoteBrowserDispatcher(scope, this._browser, selectors);
    socket.on('close', () => {
      // Avoid sending any more messages over closed socket.
      connection.onmessage = () => {};
      // Cleanup contexts upon disconnect.
      remoteBrowser.connectedBrowser.close().catch(e => {});
    });
  }
}

class RemoteBrowserDispatcher extends Dispatcher<{}, channels.RemoteBrowserInitializer> implements channels.PlaywrightChannel {
  readonly connectedBrowser: ConnectedBrowser;

  constructor(scope: DispatcherScope, browser: Browser, selectors: Selectors) {
    const connectedBrowser = new ConnectedBrowser(scope, browser, selectors);
    super(scope, {}, 'RemoteBrowser', {
      selectors: new SelectorsDispatcher(scope, selectors),
      browser: connectedBrowser,
    }, false, 'remoteBrowser');
    this.connectedBrowser = connectedBrowser;
    connectedBrowser._remoteBrowser = this;
  }
}

class ConnectedBrowser extends BrowserDispatcher {
  private _contexts: BrowserContextDispatcher[] = [];
  private _selectors: Selectors;
  _closed = false;
  _remoteBrowser?: RemoteBrowserDispatcher;

  constructor(scope: DispatcherScope, browser: Browser, selectors: Selectors) {
    super(scope, browser);
    this._selectors = selectors;
  }

  async newContext(params: channels.BrowserNewContextParams): Promise<{ context: channels.BrowserContextChannel }> {
    if (params.videosPath) {
      // TODO: we should create a separate temp directory or accept a launchServer parameter.
      params.videosPath = this._object._options.downloadsPath;
    }
    const result = await super.newContext(params);
    const dispatcher = result.context as BrowserContextDispatcher;
    dispatcher._object.on(BrowserContext.Events.VideoStarted, (video: Video) => this._sendVideo(dispatcher, video));
    dispatcher._object._setSelectors(this._selectors);
    this._contexts.push(dispatcher);
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

  private _sendVideo(contextDispatcher: BrowserContextDispatcher, video: Video) {
    video._waitForCallbackOnFinish(async () => {
      const readable = fs.createReadStream(video._path);
      await new Promise(f => readable.on('readable', f));
      const stream = new StreamDispatcher(this._remoteBrowser!._scope, readable);
      this._remoteBrowser!._dispatchEvent('video', { stream, context: contextDispatcher });
      await new Promise<void>(resolve => {
        readable.on('close', resolve);
        readable.on('end', resolve);
        readable.on('error', resolve);
      });
    });
  }
}
