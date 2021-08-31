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
import { LaunchOptions, LaunchServerOptions, ConnectOptions, LaunchPersistentContextOptions, BrowserContextOptions } from './types';
import { Connection } from './connection';
import { Events } from './events';
import { ChildProcess } from 'child_process';
import { envObjectToArray } from './clientHelper';
import { assert, headersObjectToArray, getUserAgent, ManualPromise } from '../utils/utils';
import * as api from '../../types/types';
import { kBrowserClosedError } from '../utils/errors';

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
  _serverLauncher?: BrowserServerLauncher;
  _contexts = new Set<BrowserContext>();

  // Instrumentation.
  _defaultContextOptions: BrowserContextOptions = {};
  _defaultLaunchOptions: LaunchOptions = {};
  _onDidCreateContext?: (context: BrowserContext) => Promise<void>;
  _onWillCloseContext?: (context: BrowserContext) => Promise<void>;

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
      options = { ...this._defaultLaunchOptions, ...options };
      const launchOptions: channels.BrowserTypeLaunchParams = {
        ...options,
        ignoreDefaultArgs: Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : undefined,
        ignoreAllDefaultArgs: !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs),
        env: options.env ? envObjectToArray(options.env) : undefined,
      };
      const browser = Browser.from((await channel.launch(launchOptions)).browser);
      browser._logger = logger;
      browser._setBrowserType(this);
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
      options = { ...this._defaultLaunchOptions, ...this._defaultContextOptions, ...options };
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
      context._setBrowserType(this);
      await this._onDidCreateContext?.(context);
      return context;
    }, options.logger);
  }

  connect(options: api.ConnectOptions & { wsEndpoint?: string }): Promise<api.Browser>;
  connect(wsEndpoint: string, options?: api.ConnectOptions): Promise<api.Browser>;
  async connect(optionsOrWsEndpoint: string|(api.ConnectOptions & { wsEndpoint?: string }), options?: api.ConnectOptions): Promise<Browser>{
    if (typeof optionsOrWsEndpoint === 'string')
      return this._connect(optionsOrWsEndpoint, options);
    assert(optionsOrWsEndpoint.wsEndpoint, 'options.wsEndpoint is required');
    return this._connect(optionsOrWsEndpoint.wsEndpoint, optionsOrWsEndpoint);
  }

  async _connect(wsEndpoint: string, params: Partial<ConnectOptions> = {}): Promise<Browser> {
    const logger = params.logger;
    return await this._wrapApiCall(async (channel: channels.BrowserTypeChannel) => {
      const timeoutPromise = new ManualPromise<Browser>();
      const timer = params.timeout ? setTimeout(() => timeoutPromise.reject(new Error(`Timeout ${params.timeout}ms exceeded.`)), params.timeout) : undefined;

      const { pipe } = await channel.connect({ wsEndpoint, headers: params.headers, timeout: params.timeout });
      const connection = new Connection(() => pipe.close().catch(() => {}));
      connection.onmessage = message => pipe.send({ message }).catch(() => { });
      pipe.on('message', ({ message }) => {
        try {
          if (!connection!.isDisconnected())
            connection!.dispatch(message);
        } catch (e) {
          console.error(`Playwright: Connection dispatch error`);
          console.error(e);
          pipe.close().catch(() => {});
        }
      });

      const successPromise = new Promise<Browser>(async (fulfill, reject) => {
        if ((params as any).__testHookBeforeCreateBrowser) {
          try {
            await (params as any).__testHookBeforeCreateBrowser();
          } catch (e) {
            reject(e);
          }
        }
        const prematureCloseListener = (params: { error?: channels.SerializedError }) => {
          reject(new Error(`WebSocket server disconnected ${params.error!.error?.message}`));
        };
        pipe.on('closed', prematureCloseListener);

        pipe.on('opened', async () => {
          const playwright = await connection!.initializePlaywright();

          if (!playwright._initializer.preLaunchedBrowser) {
            reject(new Error('Malformed endpoint. Did you use launchServer method?'));
            pipe.close().catch(() => {});
            return;
          }

          const browser = Browser.from(playwright._initializer.preLaunchedBrowser!);
          browser._logger = logger;
          browser._remoteType = 'owns-connection';
          browser._setBrowserType((playwright as any)[browser._name]);
          const closeListener = (param: { error?: Error }) => {
            // Emulate all pages, contexts and the browser closing upon disconnect.
            for (const context of browser.contexts()) {
              for (const page of context.pages())
                page._onClose();
              context._onClose();
            }
            browser._didClose();
            connection.didDisconnect(kBrowserClosedError);
            if (param.error)
              reject(new Error(param.error + '. Most likely ws endpoint is incorrect'));
          };
          pipe.off('closed', prematureCloseListener);
          pipe.on('closed', closeListener);
          browser.on(Events.Browser.Disconnected, () => {
            playwright._cleanup();
            pipe.off('closed', closeListener);
            pipe.close().catch(() => {});
          });
          fulfill(browser);
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

  connectOverCDP(options: api.ConnectOverCDPOptions  & { wsEndpoint?: string }): Promise<api.Browser>;
  connectOverCDP(endpointURL: string, options?: api.ConnectOverCDPOptions): Promise<api.Browser>;
  connectOverCDP(endpointURLOrOptions: (api.ConnectOverCDPOptions & { wsEndpoint?: string })|string, options?: api.ConnectOverCDPOptions) {
    if (typeof endpointURLOrOptions === 'string')
      return this._connectOverCDP(endpointURLOrOptions, options);
    const endpointURL = 'endpointURL' in endpointURLOrOptions ? endpointURLOrOptions.endpointURL : endpointURLOrOptions.wsEndpoint;
    assert(endpointURL, 'Cannot connect over CDP without wsEndpoint.');
    return this.connectOverCDP(endpointURL, endpointURLOrOptions);
  }

  async _connectOverCDP(endpointURL: string, params: api.ConnectOverCDPOptions = {}): Promise<Browser>  {
    if (this.name() !== 'chromium')
      throw new Error('Connecting over CDP is only supported in Chromium.');
    const logger = params.logger;
    return this._wrapApiCall(async (channel: channels.BrowserTypeChannel) => {
      const paramsHeaders = Object.assign({'User-Agent': getUserAgent()}, params.headers);
      const headers = paramsHeaders ? headersObjectToArray(paramsHeaders) : undefined;
      const result = await channel.connectOverCDP({
        endpointURL,
        headers,
        slowMo: params.slowMo,
        timeout: params.timeout
      });
      const browser = Browser.from(result.browser);
      if (result.defaultContext)
        browser._contexts.add(BrowserContext.from(result.defaultContext));
      browser._remoteType = 'uses-connection';
      browser._logger = logger;
      browser._setBrowserType(this);
      return browser;
    }, logger);
  }
}
