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

import { Browser } from './browser';
import { BrowserContext, prepareBrowserContextParams } from './browserContext';
import { ChannelOwner } from './channelOwner';
import { envObjectToArray } from './clientHelper';
import { Events } from './events';
import { assert } from '../utils/isomorphic/assert';
import { headersObjectToArray } from '../utils/isomorphic/headers';
import { monotonicTime } from '../utils/isomorphic/time';
import { raceAgainstDeadline } from '../utils/isomorphic/timeoutRunner';
import { connectOverWebSocket } from './webSocket';
import { TimeoutSettings } from './timeoutSettings';

import type { Playwright } from './playwright';
import type { ConnectOptions, LaunchOptions, LaunchPersistentContextOptions, LaunchServerOptions } from './types';
import type * as api from '../../types/types';
import type * as channels from '@protocol/channels';
import type { ChildProcess } from 'child_process';

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
    assert(!(options as any).userDataDir, 'userDataDir option is not supported in `browserType.launch`. Use `browserType.launchPersistentContext` instead');
    assert(!(options as any).port, 'Cannot specify a port without launching as a server.');

    const logger = options.logger || this._playwright._defaultLaunchOptions?.logger;
    options = { ...this._playwright._defaultLaunchOptions, ...options };
    const launchOptions: channels.BrowserTypeLaunchParams = {
      ...options,
      ignoreDefaultArgs: Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : undefined,
      ignoreAllDefaultArgs: !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs),
      env: options.env ? envObjectToArray(options.env) : undefined,
      timeout: new TimeoutSettings(this._platform).launchTimeout(options),
    };
    return await this._wrapApiCall(async () => {
      const browser = Browser.from((await this._channel.launch(launchOptions)).browser);
      browser._connectToBrowserType(this, options, logger);
      return browser;
    });
  }

  async launchServer(options: LaunchServerOptions = {}): Promise<api.BrowserServer> {
    if (!this._serverLauncher)
      throw new Error('Launching server is not supported');
    options = { ...this._playwright._defaultLaunchOptions, ...options };
    return await this._serverLauncher.launchServer(options);
  }

  async launchPersistentContext(userDataDir: string, options: LaunchPersistentContextOptions = {}): Promise<BrowserContext> {
    const logger = options.logger || this._playwright._defaultLaunchOptions?.logger;
    assert(!(options as any).port, 'Cannot specify a port without launching as a server.');
    options = this._playwright.selectors._withSelectorOptions({
      ...this._playwright._defaultLaunchOptions,
      ...this._playwright._defaultContextOptions,
      ...options,
    });
    const contextParams = await prepareBrowserContextParams(this._platform, options);
    const persistentParams: channels.BrowserTypeLaunchPersistentContextParams = {
      ...contextParams,
      ignoreDefaultArgs: Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : undefined,
      ignoreAllDefaultArgs: !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs),
      env: options.env ? envObjectToArray(options.env) : undefined,
      channel: options.channel,
      userDataDir: (this._platform.path().isAbsolute(userDataDir) || !userDataDir) ? userDataDir : this._platform.path().resolve(userDataDir),
      timeout: new TimeoutSettings(this._platform).launchTimeout(options),
    };
    return await this._wrapApiCall(async () => {
      const result = await this._channel.launchPersistentContext(persistentParams);
      const browser = Browser.from(result.browser);
      browser._connectToBrowserType(this, options, logger);
      const context = BrowserContext.from(result.context);
      await context._initializeHarFromOptions(options.recordHar);
      await this._instrumentation.runAfterCreateBrowserContext(context);
      return context;
    });
  }

  connect(options: api.ConnectOptions & { wsEndpoint: string }): Promise<Browser>;
  connect(wsEndpoint: string, options?: api.ConnectOptions): Promise<Browser>;
  async connect(optionsOrWsEndpoint: string | (api.ConnectOptions & { wsEndpoint: string }), options?: api.ConnectOptions): Promise<Browser>{
    if (typeof optionsOrWsEndpoint === 'string')
      return await this._connect({ ...options, wsEndpoint: optionsOrWsEndpoint });
    assert(optionsOrWsEndpoint.wsEndpoint, 'options.wsEndpoint is required');
    return await this._connect(optionsOrWsEndpoint);
  }

  async _connect(params: ConnectOptions): Promise<Browser> {
    const logger = params.logger;
    return await this._wrapApiCall(async () => {
      const deadline = params.timeout ? monotonicTime() + params.timeout : 0;
      const headers = { 'x-playwright-browser': this.name(), ...params.headers };
      const connectParams: channels.LocalUtilsConnectParams = {
        wsEndpoint: params.wsEndpoint,
        headers,
        exposeNetwork: params.exposeNetwork ?? params._exposeNetwork,
        slowMo: params.slowMo,
        timeout: params.timeout || 0,
      };
      if ((params as any).__testHookRedirectPortForwarding)
        connectParams.socksProxyRedirectPortForTest = (params as any).__testHookRedirectPortForwarding;
      const connection = await connectOverWebSocket(this._connection, connectParams);
      let browser: Browser;
      connection.on('close', () => {
        // Emulate all pages, contexts and the browser closing upon disconnect.
        for (const context of browser?.contexts() || []) {
          for (const page of context.pages())
            page._onClose();
          context._onClose();
        }
        setTimeout(() => browser?._didClose(), 0);
      });

      const result = await raceAgainstDeadline(async () => {
        // For tests.
        if ((params as any).__testHookBeforeCreateBrowser)
          await (params as any).__testHookBeforeCreateBrowser();

        const playwright = await connection!.initializePlaywright();
        if (!playwright._initializer.preLaunchedBrowser) {
          connection.close();
          throw new Error('Malformed endpoint. Did you use BrowserType.launchServer method?');
        }
        playwright.selectors = this._playwright.selectors;
        browser = Browser.from(playwright._initializer.preLaunchedBrowser!);
        browser._connectToBrowserType(this, {}, logger);
        browser._shouldCloseConnectionOnClose = true;
        browser.on(Events.Browser.Disconnected, () => connection.close());
        return browser;
      }, deadline);
      if (!result.timedOut) {
        return result.result;
      } else {
        connection.close();
        throw new Error(`Timeout ${params.timeout}ms exceeded`);
      }
    });
  }

  async connectOverCDP(options: api.ConnectOverCDPOptions  & { wsEndpoint?: string }): Promise<api.Browser>;
  async connectOverCDP(endpointURL: string, options?: api.ConnectOverCDPOptions): Promise<api.Browser>;
  async connectOverCDP(endpointURLOrOptions: (api.ConnectOverCDPOptions & { wsEndpoint?: string })|string, options?: api.ConnectOverCDPOptions) {
    if (typeof endpointURLOrOptions === 'string')
      return await this._connectOverCDP(endpointURLOrOptions, options);
    const endpointURL = 'endpointURL' in endpointURLOrOptions ? endpointURLOrOptions.endpointURL : endpointURLOrOptions.wsEndpoint;
    assert(endpointURL, 'Cannot connect over CDP without wsEndpoint.');
    return await this.connectOverCDP(endpointURL, endpointURLOrOptions);
  }

  async _connectOverCDP(endpointURL: string, params: api.ConnectOverCDPOptions = {}): Promise<Browser>  {
    if (this.name() !== 'chromium')
      throw new Error('Connecting over CDP is only supported in Chromium.');
    const headers = params.headers ? headersObjectToArray(params.headers) : undefined;
    const result = await this._channel.connectOverCDP({
      endpointURL,
      headers,
      slowMo: params.slowMo,
      timeout: new TimeoutSettings(this._platform).timeout(params),
    });
    const browser = Browser.from(result.browser);
    browser._connectToBrowserType(this, {}, params.logger);
    if (result.defaultContext)
      await this._instrumentation.runAfterCreateBrowserContext(BrowserContext.from(result.defaultContext));
    return browser;
  }
}
