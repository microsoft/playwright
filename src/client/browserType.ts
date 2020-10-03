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

import * as channels from '../protocol/channels';
import { Browser } from './browser';
import { BrowserContext } from './browserContext';
import { ChannelOwner } from './channelOwner';
import { LaunchOptions, LaunchServerOptions, ConnectOptions, LaunchPersistentContextOptions } from './types';
import * as WebSocket from 'ws';
import * as path from 'path';
import * as fs from 'fs';
import { Connection } from './connection';
import { serializeError } from '../protocol/serializers';
import { Events } from './events';
import { TimeoutSettings } from '../utils/timeoutSettings';
import { ChildProcess } from 'child_process';
import { envObjectToArray } from './clientHelper';
import { validateHeaders } from './network';
import { assert, makeWaitForNextTask, headersObjectToArray, createGuid, mkdirIfNeeded } from '../utils/utils';
import { SelectorsOwner, sharedSelectors } from './selectors';
import { kBrowserClosedError } from '../utils/errors';
import { Stream } from './stream';

export interface BrowserServerLauncher {
  launchServer(options?: LaunchServerOptions): Promise<BrowserServer>;
}

export interface BrowserServer {
  process(): ChildProcess;
  wsEndpoint(): string;
  close(): Promise<void>;
  kill(): Promise<void>;
}

export class BrowserType extends ChannelOwner<channels.BrowserTypeChannel, channels.BrowserTypeInitializer> {
  private _timeoutSettings = new TimeoutSettings();
  _serverLauncher?: BrowserServerLauncher;

  static from(browserType: channels.BrowserTypeChannel): BrowserType {
    return (browserType as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.BrowserTypeInitializer) {
    super(parent, type, guid, initializer);
  }

  executablePath(): string {
    if (!this._initializer.executablePath)
      throw new Error('Browser is not supported on current platform');
    return this._initializer.executablePath;
  }

  name(): string {
    return this._initializer.name;
  }

  async launch(options: LaunchOptions = {}): Promise<Browser> {
    const logger = options.logger;
    return this._wrapApiCall('browserType.launch', async () => {
      assert(!(options as any).userDataDir, 'userDataDir option is not supported in `browserType.launch`. Use `browserType.launchPersistentContext` instead');
      assert(!(options as any).port, 'Cannot specify a port without launching as a server.');
      const launchOptions: channels.BrowserTypeLaunchParams = {
        ...options,
        ignoreDefaultArgs: Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : undefined,
        ignoreAllDefaultArgs: !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs),
        env: options.env ? envObjectToArray(options.env) : undefined,
      };
      const browser = Browser.from((await this._channel.launch(launchOptions)).browser);
      browser._logger = logger;
      return browser;
    }, logger);
  }

  async launchServer(options: LaunchServerOptions = {}): Promise<BrowserServer> {
    if (!this._serverLauncher)
      throw new Error('Launching server is not supported');
    return this._serverLauncher.launchServer(options);
  }

  async launchPersistentContext(userDataDir: string, options: LaunchPersistentContextOptions = {}): Promise<BrowserContext> {
    const logger = options.logger;
    return this._wrapApiCall('browserType.launchPersistentContext', async () => {
      assert(!(options as any).port, 'Cannot specify a port without launching as a server.');
      if (options.extraHTTPHeaders)
        validateHeaders(options.extraHTTPHeaders);
      const persistentOptions: channels.BrowserTypeLaunchPersistentContextParams = {
        ...options,
        viewport: options.viewport === null ? undefined : options.viewport,
        noDefaultViewport: options.viewport === null,
        ignoreDefaultArgs: Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : undefined,
        ignoreAllDefaultArgs: !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs),
        env: options.env ? envObjectToArray(options.env) : undefined,
        extraHTTPHeaders: options.extraHTTPHeaders ? headersObjectToArray(options.extraHTTPHeaders) : undefined,
        userDataDir,
      };
      const result = await this._channel.launchPersistentContext(persistentOptions);
      const context = BrowserContext.from(result.context);
      context._logger = logger;
      return context;
    }, logger);
  }

  async connect(options: ConnectOptions): Promise<Browser> {
    const logger = options.logger;
    return this._wrapApiCall('browserType.connect', async () => {
      const connection = new Connection();

      const ws = new WebSocket(options.wsEndpoint, [], {
        perMessageDeflate: false,
        maxPayload: 256 * 1024 * 1024, // 256Mb,
        handshakeTimeout: this._timeoutSettings.timeout(options),
      });

      // The 'ws' module in node sometimes sends us multiple messages in a single task.
      const waitForNextTask = options.slowMo
        ? (cb: () => any) => setTimeout(cb, options.slowMo)
        : makeWaitForNextTask();
      connection.onmessage = message => {
        if (ws.readyState !== WebSocket.OPEN) {
          setTimeout(() => {
            connection.dispatch({ id: (message as any).id, error: serializeError(new Error(kBrowserClosedError)) });
          }, 0);
          return;
        }
        ws.send(JSON.stringify(message));
      };
      ws.addEventListener('message', event => {
        waitForNextTask(() => connection.dispatch(JSON.parse(event.data)));
      });

      return await new Promise<Browser>(async (fulfill, reject) => {
        if ((options as any).__testHookBeforeCreateBrowser) {
          try {
            await (options as any).__testHookBeforeCreateBrowser();
          } catch (e) {
            reject(e);
          }
        }
        ws.addEventListener('open', async () => {
          const remoteBrowser = await connection.waitForObjectWithKnownName('remoteBrowser') as RemoteBrowser;

          // Inherit shared selectors for connected browser.
          const selectorsOwner = SelectorsOwner.from(remoteBrowser._initializer.selectors);
          sharedSelectors._addChannel(selectorsOwner);

          const browser = Browser.from(remoteBrowser._initializer.browser);
          browser._logger = logger;
          browser._isRemote = true;
          const closeListener = () => {
            // Emulate all pages, contexts and the browser closing upon disconnect.
            for (const context of browser.contexts()) {
              for (const page of context.pages())
                page._onClose();
              context._onClose();
            }
            browser._didClose();
          };
          ws.addEventListener('close', closeListener);
          browser.on(Events.Browser.Disconnected, () => {
            sharedSelectors._removeChannel(selectorsOwner);
            ws.removeEventListener('close', closeListener);
            ws.close();
          });
          fulfill(browser);
        });
        ws.addEventListener('error', event => {
          ws.close();
          reject(new Error('WebSocket error: ' + event.message));
        });
      });
    }, logger);
  }
}

export class RemoteBrowser extends ChannelOwner<channels.RemoteBrowserChannel, channels.RemoteBrowserInitializer> {
  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.RemoteBrowserInitializer) {
    super(parent, type, guid, initializer);
    this._channel.on('video', ({ context, stream }) => this._onVideo(BrowserContext.from(context), Stream.from(stream)));
  }

  private async _onVideo(context: BrowserContext, stream: Stream) {
    if (!context._videosPathForRemote) {
      stream._channel.close().catch(e => null);
      return;
    }

    const videoFile = path.join(context._videosPathForRemote, createGuid() + '.webm');
    await mkdirIfNeeded(videoFile);
    stream.stream().pipe(fs.createWriteStream(videoFile));
  }
}
