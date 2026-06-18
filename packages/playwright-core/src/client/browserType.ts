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

import { assert } from '@isomorphic/assert';
import { headersObjectToArray } from '@isomorphic/headers';
import { Browser } from './browser';
import { BrowserContext, prepareBrowserContextParams } from './browserContext';
import { ChannelOwner } from './channelOwner';
import { envObjectToArray } from './clientHelper';
import { connectToBrowser } from './connect';
import { TimeoutSettings } from './timeoutSettings';
import { Worker } from './worker';

import type { Playwright } from './playwright';
import type { ConnectOptions, LaunchOptions, LaunchPersistentContextOptions, LaunchServerOptions } from './types';
import type * as api from '../../types/types';
import type * as channels from './channels';
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
      const browser = Browser.from((await this._channel.launch(launchOptions, options.signal)).browser);
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
    assert(!(options as any).port, 'Cannot specify a port without launching as a server.');
    options = this._playwright.selectors._withSelectorOptions({
      ...this._playwright._defaultLaunchOptions,
      ...options,
    });
    await this._instrumentation.runBeforeCreateBrowserContext(options);

    const logger = options.logger || this._playwright._defaultLaunchOptions?.logger;
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
    const context = await this._wrapApiCall(async () => {
      const result = await this._channel.launchPersistentContext(persistentParams, options.signal);
      const browser = Browser.from(result.browser);
      browser._connectToBrowserType(this, options, logger);
      const context = BrowserContext.from(result.context);
      await context._initializeHarFromOptions(options.recordHar);
      return context;
    });
    await this._instrumentation.runAfterCreateBrowserContext(context);
    return context;
  }

  connect(options: api.ConnectOptions & { wsEndpoint: string }): Promise<Browser>;
  connect(endpoint: string, options?: api.ConnectOptions): Promise<Browser>;
  async connect(optionsOrEndpoint: string | (api.ConnectOptions & { wsEndpoint?: string }), options?: api.ConnectOptions): Promise<Browser>{
    if (typeof optionsOrEndpoint === 'string')
      return await this._connect({ ...options, endpoint: optionsOrEndpoint });
    assert(optionsOrEndpoint.wsEndpoint, 'options.wsEndpoint is required');
    return await this._connect({ ...options, endpoint: optionsOrEndpoint.wsEndpoint });
  }

  async _connect(params: ConnectOptions): Promise<Browser> {
    return await this._wrapApiCall(async () => {
      const browser = await connectToBrowser(this._playwright, { browserName: this.name(), ...params });
      browser._connectToBrowserType(this, {}, undefined);
      return browser;
    });
  }

  async connectOverCDP(options: api.ConnectOverCDPOptions  & { wsEndpoint?: string }): Promise<api.Browser>;
  async connectOverCDP(endpointURL: string, options?: api.ConnectOverCDPOptions): Promise<api.Browser>;
  async connectOverCDP(transport: api.ConnectOverCDPTransport, options?: api.ConnectOverCDPOptions): Promise<api.Browser>;
  async connectOverCDP(overloaded: (api.ConnectOverCDPOptions & { wsEndpoint?: string }) | string | api.ConnectOverCDPTransport, options?: api.ConnectOverCDPOptions): Promise<Browser> {
    let endpointURL: string | undefined;
    let transport: api.ConnectOverCDPTransport | undefined;
    let params: api.ConnectOverCDPOptions;
    if (typeof overloaded === 'string') {
      endpointURL = overloaded;
      params = options ?? {};
    } else if (isConnectionTransport(overloaded)) {
      if (this.name() !== 'chromium' && this.name() !== 'webkit')
        throw new Error('Connecting over CDP is only supported in Chromium and WebKit.');
      if (this._connection.isRemote())
        throw new Error('Passing a ConnectionTransport to connectOverCDP is not supported when connecting remotely.');
      transport = overloaded;
      params = options ?? {};
    } else {
      endpointURL = 'endpointURL' in overloaded ? (overloaded as any).endpointURL : overloaded.wsEndpoint;
      assert(endpointURL, 'Cannot connect over CDP without wsEndpoint.');
      params = overloaded;
    }
    if (endpointURL && this.name() !== 'chromium' && this.name() !== 'webkit')
      throw new Error('Connecting over CDP is only supported in Chromium and WebKit.');

    const result = await this._channel.connectOverCDP({
      endpointURL,
      transport: transport as any,
      headers: params.headers ? headersObjectToArray(params.headers) : undefined,
      slowMo: params.slowMo,
      timeout: new TimeoutSettings(this._platform).timeout(params),
      isLocal: params.isLocal,
      noDefaults: params.noDefaults,
      artifactsDir: params.artifactsDir,
    }, undefined);
    return await this._browserFromConnectResult(result);
  }

  private async _browserFromConnectResult(result: { browser: channels.BrowserChannel, defaultContext?: channels.BrowserContextChannel }): Promise<Browser> {
    const browser = Browser.from(result.browser);
    browser._connectToBrowserType(this, {}, undefined);
    if (result.defaultContext)
      await this._instrumentation.runAfterCreateBrowserContext(BrowserContext.from(result.defaultContext));
    return browser;
  }

  async _connectToWorker(endpoint: string, options: { timeout?: number } = {}): Promise<Worker>  {
    if (this.name() !== 'chromium')
      throw new Error('Connecting to workers is only supported in Chromium.');
    const result = await this._channel.connectToWorker({
      endpoint,
      timeout: new TimeoutSettings(this._platform).timeout(options),
    }, undefined);
    return Worker.from(result.worker);
  }
}

function isConnectionTransport(value: any): value is api.ConnectOverCDPTransport {
  return !!value && typeof value === 'object' && typeof value.send === 'function' && typeof value.close === 'function';
}
