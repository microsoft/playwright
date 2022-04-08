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

import type * as channels from '../protocol/channels';
import { Browser } from './browser';
import { BrowserContext, prepareBrowserContextParams } from './browserContext';
import { ChannelOwner } from './channelOwner';
import type { LaunchOptions, LaunchServerOptions, ConnectOptions, LaunchPersistentContextOptions, BrowserContextOptions } from './types';
import { Connection } from './connection';
import { Events } from './events';
import type { ChildProcess } from 'child_process';
import { envObjectToArray } from './clientHelper';
import { assert, headersObjectToArray, monotonicTime } from '../utils';
import type * as api from '../../types/types';
import { kBrowserClosedError } from '../common/errors';
import { raceAgainstTimeout } from '../utils/timeoutRunner';
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

export class BrowserType extends ChannelOwner<channels.BrowserTypeChannel> implements api.BrowserType {
  _serverLauncher?: BrowserServerLauncher;
  _contexts = new Set<BrowserContext>();
  _playwright!: Playwright;

  // Instrumentation.
  _defaultContextOptions?: BrowserContextOptions;
  _defaultLaunchOptions?: LaunchOptions;
  _onDidCreateContext?: (context: BrowserContext) => Promise<void>;
  _onWillCloseContext?: (context: BrowserContext) => Promise<void>;

  static from(browserType: channels.BrowserTypeChannel): BrowserType {
    return (browserType as any)._object;
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
    const logger = options.logger || this._defaultLaunchOptions?.logger;
    assert(!(options as any).userDataDir, 'userDataDir option is not supported in `browserType.launch`. Use `browserType.launchPersistentContext` instead');
    assert(!(options as any).port, 'Cannot specify a port without launching as a server.');
    options = { ...this._defaultLaunchOptions, ...options };
    const launchOptions: channels.BrowserTypeLaunchParams = {
      ...options,
      ignoreDefaultArgs: Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : undefined,
      ignoreAllDefaultArgs: !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs),
      env: options.env ? envObjectToArray(options.env) : undefined,
    };
    const browser = Browser.from((await this._channel.launch(launchOptions)).browser);
    browser._logger = logger;
    browser._setBrowserType(this);
    browser._localUtils = this._playwright._utils;
    return browser;
  }

  async launchServer(options: LaunchServerOptions = {}): Promise<api.BrowserServer> {
    if (!this._serverLauncher)
      throw new Error('Launching server is not supported');
    options = { ...this._defaultLaunchOptions, ...options };
    return this._serverLauncher.launchServer(options);
  }

  async launchPersistentContext(userDataDir: string, options: LaunchPersistentContextOptions = {}): Promise<BrowserContext> {
    const logger = options.logger || this._defaultLaunchOptions?.logger;
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
    const result = await this._channel.launchPersistentContext(persistentParams);
    const context = BrowserContext.from(result.context);
    context._options = contextParams;
    context._logger = logger;
    context._setBrowserType(this);
    context.tracing._localUtils = this._playwright._utils;
    await this._onDidCreateContext?.(context);
    return context;
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
    return await this._wrapApiCall(async () => {
      const deadline = params.timeout ? monotonicTime() + params.timeout : 0;
      let browser: Browser;
      const headers = { 'x-playwright-browser': this.name(), ...params.headers };
      const connectParams: channels.BrowserTypeConnectParams = { wsEndpoint, headers, slowMo: params.slowMo, timeout: params.timeout };
      if ((params as any).__testHookRedirectPortForwarding)
        connectParams.socksProxyRedirectPortForTest = (params as any).__testHookRedirectPortForwarding;
      const { pipe } = await this._channel.connect(connectParams);
      const closePipe = () => pipe.close().catch(() => {});
      const connection = new Connection();
      connection.markAsRemote();
      connection.on('close', closePipe);

      let closeError: string | undefined;
      const onPipeClosed = () => {
        // Emulate all pages, contexts and the browser closing upon disconnect.
        for (const context of browser?.contexts() || []) {
          for (const page of context.pages())
            page._onClose();
          context._onClose();
        }
        browser?._didClose();
        connection.close(closeError || kBrowserClosedError);
      };
      pipe.on('closed', onPipeClosed);
      connection.onmessage = message => pipe.send({ message }).catch(onPipeClosed);

      pipe.on('message', ({ message }) => {
        try {
          connection!.dispatch(message);
        } catch (e) {
          closeError = e.toString();
          closePipe();
        }
      });

      const result = await raceAgainstTimeout(async () => {
        // For tests.
        if ((params as any).__testHookBeforeCreateBrowser)
          await (params as any).__testHookBeforeCreateBrowser();

        const playwright = await connection!.initializePlaywright();
        if (!playwright._initializer.preLaunchedBrowser) {
          closePipe();
          throw new Error('Malformed endpoint. Did you use launchServer method?');
        }
        playwright._setSelectors(this._playwright.selectors);
        browser = Browser.from(playwright._initializer.preLaunchedBrowser!);
        browser._logger = logger;
        browser._shouldCloseConnectionOnClose = true;
        browser._setBrowserType(this);
        browser._localUtils = this._playwright._utils;
        browser.on(Events.Browser.Disconnected, closePipe);
        return browser;
      }, deadline ? deadline - monotonicTime() : 0);
      if (!result.timedOut) {
        return result.result;
      } else {
        closePipe();
        throw new Error(`Timeout ${params.timeout}ms exceeded`);
      }
    });
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
    const headers = params.headers ? headersObjectToArray(params.headers) : undefined;
    const result = await this._channel.connectOverCDP({
      endpointURL,
      headers,
      slowMo: params.slowMo,
      timeout: params.timeout
    });
    const browser = Browser.from(result.browser);
    if (result.defaultContext)
      browser._contexts.add(BrowserContext.from(result.defaultContext));
    browser._logger = params.logger;
    browser._setBrowserType(this);
    browser._localUtils = this._playwright._utils;
    return browser;
  }
}
