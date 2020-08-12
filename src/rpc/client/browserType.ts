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

import { BrowserTypeChannel, BrowserTypeInitializer, BrowserTypeLaunchParams, BrowserTypeLaunchPersistentContextParams } from '../channels';
import { Browser } from './browser';
import { BrowserContext } from './browserContext';
import { ChannelOwner } from './channelOwner';
import { headersObjectToArray, envObjectToArray } from '../../converters';
import { assert, helper } from '../../helper';
import { LaunchOptions, LaunchServerOptions, ConnectOptions, LaunchPersistentContextOptions } from './types';
import * as WebSocket from 'ws';
import { Connection } from './connection';
import { serializeError } from '../serializers';
import { Events } from './events';
import { TimeoutSettings } from '../../timeoutSettings';
import { ChildProcess } from 'child_process';

export interface BrowserServerLauncher {
  launchServer(options?: LaunchServerOptions): Promise<BrowserServer>;
}

export interface BrowserServer {
  process(): ChildProcess;
  wsEndpoint(): string;
  close(): Promise<void>;
  kill(): Promise<void>;
}

export class BrowserType extends ChannelOwner<BrowserTypeChannel, BrowserTypeInitializer> {
  private _timeoutSettings = new TimeoutSettings();
  _serverLauncher?: BrowserServerLauncher;

  static from(browserType: BrowserTypeChannel): BrowserType {
    return (browserType as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: BrowserTypeInitializer) {
    super(parent, type, guid, initializer);
  }

  executablePath(): string {
    return this._initializer.executablePath;
  }

  name(): string {
    return this._initializer.name;
  }

  async launch(options: LaunchOptions = {}): Promise<Browser> {
    const logger = options.logger;
    options = { ...options, logger: undefined };
    return this._wrapApiCall('browserType.launch', async () => {
      assert(!(options as any).userDataDir, 'userDataDir option is not supported in `browserType.launch`. Use `browserType.launchPersistentContext` instead');
      assert(!(options as any).port, 'Cannot specify a port without launching as a server.');
      const launchOptions: BrowserTypeLaunchParams = {
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
    options = { ...options, logger: undefined };
    return this._wrapApiCall('browserType.launchPersistentContext', async () => {
      const persistentOptions: BrowserTypeLaunchPersistentContextParams = {
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
        : helper.makeWaitForNextTask();
      connection.onmessage = message => {
        if (ws.readyState !== WebSocket.OPEN) {
          setTimeout(() => {
            connection.dispatch({ id: (message as any).id, error: serializeError(new Error('Browser has been closed')) });
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
          const browser = (await connection.waitForObjectWithKnownName('connectedBrowser')) as Browser;
          browser._logger = logger;
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
