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
import { BrowserContext, prepareBrowserContextParams } from './browserContext';
import { ChannelOwner } from './channelOwner';
import { LaunchOptions, LaunchServerOptions, ConnectOptions, LaunchPersistentContextOptions } from './types';
import WebSocket from 'ws';
import { Connection } from './connection';
import { Events } from './events';
import { TimeoutSettings } from '../utils/timeoutSettings';
import { ChildProcess } from 'child_process';
import { envObjectToArray } from './clientHelper';
import { assert, headersObjectToArray, makeWaitForNextTask, getUserAgent } from '../utils/utils';
import { kBrowserClosedError } from '../utils/errors';
import * as api from '../../types/types';
import type { Playwright } from './playwright';

export interface BrowserServerLauncher {
  launchServer(options?: LaunchServerOptions): Promise<api.BrowserServer>;
}

// This is here just for api generation and checking.
export interface BrowserServer extends api.BrowserServer {
  process(): ChildProcess;
  wsEndpoint(): string;
  close(): Promise<void>;
  kill(): Promise<void>;
}

export class BrowserType extends ChannelOwner<channels.BrowserTypeChannel, channels.BrowserTypeInitializer> implements api.BrowserType {
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
    return this._wrapApiCall(async (channel: channels.BrowserTypeChannel) => {
      assert(!(options as any).userDataDir, 'userDataDir option is not supported in `browserType.launch`. Use `browserType.launchPersistentContext` instead');
      assert(!(options as any).port, 'Cannot specify a port without launching as a server.');
      const launchOptions: channels.BrowserTypeLaunchParams = {
        ...options,
        ignoreDefaultArgs: Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : undefined,
        ignoreAllDefaultArgs: !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs),
        env: options.env ? envObjectToArray(options.env) : undefined,
      };
      const browser = Browser.from((await channel.launch(launchOptions)).browser);
      browser._logger = logger;
      return browser;
    }, logger);
  }

  async launchServer(options: LaunchServerOptions = {}): Promise<api.BrowserServer> {
    if (!this._serverLauncher)
      throw new Error('Launching server is not supported');
    return this._serverLauncher.launchServer(options);
  }

  async launchPersistentContext(userDataDir: string, options: LaunchPersistentContextOptions = {}): Promise<BrowserContext> {
    return this._wrapApiCall(async (channel: channels.BrowserTypeChannel) => {
      assert(!(options as any).port, 'Cannot specify a port without launching as a server.');
      const contextParams = await prepareBrowserContextParams(options);
      const persistentParams: channels.BrowserTypeLaunchPersistentContextParams = {
        ...contextParams,
        ignoreDefaultArgs: Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : undefined,
        ignoreAllDefaultArgs: !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs),
        env: options.env ? envObjectToArray(options.env) : undefined,
        channel: options.channel,
        userDataDir,
      };
      const result = await channel.launchPersistentContext(persistentParams);
      const context = BrowserContext.from(result.context);
      context._options = contextParams;
      context._logger = options.logger;
      return context;
    }, options.logger);
  }

  async connect(params: ConnectOptions): Promise<Browser> {
    const logger = params.logger;
    const paramsHeaders = Object.assign({'User-Agent': getUserAgent()}, params.headers);
    return this._wrapApiCall(async () => {
      const ws = new WebSocket(params.wsEndpoint, [], {
        perMessageDeflate: false,
        maxPayload: 256 * 1024 * 1024, // 256Mb,
        handshakeTimeout: this._timeoutSettings.timeout(params),
        headers: paramsHeaders,
      });
      const connection = new Connection(() => ws.close());

      // The 'ws' module in node sometimes sends us multiple messages in a single task.
      const waitForNextTask = params.slowMo
        ? (cb: () => any) => setTimeout(cb, params.slowMo)
        : makeWaitForNextTask();
      connection.onmessage = message => {
        // Connection should handle all outgoing message in disconnected().
        if (ws.readyState !== WebSocket.OPEN)
          return;
        ws.send(JSON.stringify(message));
      };
      ws.addEventListener('message', event => {
        waitForNextTask(() => {
          try {
            // Since we may slow down the messages, but disconnect
            // synchronously, we might come here with a message
            // after disconnect.
            if (!connection.isDisconnected())
              connection.dispatch(JSON.parse(event.data));
          } catch (e) {
            console.error(`Playwright: Connection dispatch error`);
            console.error(e);
            ws.close();
          }
        });
      });

      let timeoutCallback = (e: Error) => {};
      const timeoutPromise = new Promise<Browser>((f, r) => timeoutCallback = r);
      const timer = params.timeout ? setTimeout(() => timeoutCallback(new Error(`Timeout ${params.timeout}ms exceeded.`)), params.timeout) : undefined;

      const successPromise = new Promise<Browser>(async (fulfill, reject) => {
        if ((params as any).__testHookBeforeCreateBrowser) {
          try {
            await (params as any).__testHookBeforeCreateBrowser();
          } catch (e) {
            reject(e);
          }
        }
        ws.addEventListener('open', async () => {
          const prematureCloseListener = (event: { code: number, reason: string }) => {
            reject(new Error(`WebSocket server disconnected (${event.code}) ${event.reason}`));
          };
          ws.addEventListener('close', prematureCloseListener);
          const playwright = await connection.waitForObjectWithKnownName('Playwright') as Playwright;

          if (!playwright._initializer.preLaunchedBrowser) {
            reject(new Error('Malformed endpoint. Did you use launchServer method?'));
            ws.close();
            return;
          }

          const browser = Browser.from(playwright._initializer.preLaunchedBrowser!);
          browser._logger = logger;
          browser._remoteType = 'owns-connection';
          const closeListener = () => {
            // Emulate all pages, contexts and the browser closing upon disconnect.
            for (const context of browser.contexts()) {
              for (const page of context.pages())
                page._onClose();
              context._onClose();
            }
            browser._didClose();
            connection.didDisconnect(kBrowserClosedError);
          };
          ws.removeEventListener('close', prematureCloseListener);
          ws.addEventListener('close', closeListener);
          browser.on(Events.Browser.Disconnected, () => {
            playwright._cleanup();
            ws.removeEventListener('close', closeListener);
            ws.close();
          });
          if (params._forwardPorts) {
            try {
              await playwright._enablePortForwarding(params._forwardPorts);
            } catch (err) {
              reject(err);
              return;
            }
          }
          fulfill(browser);
        });
        ws.addEventListener('error', event => {
          ws.close();
          reject(new Error(event.message + '. Most likely ws endpoint is incorrect'));
        });
      });

      try {
        return await Promise.race([successPromise, timeoutPromise]);
      } finally {
        if (timer)
          clearTimeout(timer);
      }
    }, logger);
  }

  async connectOverCDP(params: api.ConnectOverCDPOptions): Promise<Browser>
  async connectOverCDP(params: api.ConnectOptions): Promise<Browser>
  async connectOverCDP(params: api.ConnectOverCDPOptions | api.ConnectOptions): Promise<Browser> {
    if (this.name() !== 'chromium')
      throw new Error('Connecting over CDP is only supported in Chromium.');
    const logger = params.logger;
    return this._wrapApiCall(async (channel: channels.BrowserTypeChannel) => {
      const paramsHeaders = Object.assign({'User-Agent': getUserAgent()}, params.headers);
      const headers = paramsHeaders ? headersObjectToArray(paramsHeaders) : undefined;
      const result = await channel.connectOverCDP({
        sdkLanguage: 'javascript',
        endpointURL: 'endpointURL' in params ? params.endpointURL : params.wsEndpoint,
        headers,
        slowMo: params.slowMo,
        timeout: params.timeout
      });
      const browser = Browser.from(result.browser);
      if (result.defaultContext)
        browser._contexts.add(BrowserContext.from(result.defaultContext));
      browser._remoteType = 'uses-connection';
      browser._logger = logger;
      return browser;
    }, logger);
  }
}
