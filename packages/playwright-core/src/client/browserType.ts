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

import type * as channels from '@protocol/channels';
import { Browser } from './browser';
import { BrowserContext, prepareBrowserContextParams } from './browserContext';
import { ChannelOwner } from './channelOwner';
import type { LaunchOptions, LaunchServerOptions, ConnectOptions, LaunchPersistentContextOptions, BrowserContextOptions, Logger } from './types';
import { Connection } from './connection';
import { Events } from './events';
import type { ChildProcess } from 'child_process';
import { envObjectToArray } from './clientHelper';
import { assert, headersObjectToArray, monotonicTime } from '../utils';
import type * as api from '../../types/types';
import { raceAgainstDeadline } from '../utils/timeoutRunner';
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
  _defaultContextTimeout?: number;
  _defaultContextNavigationTimeout?: number;
  private _defaultLaunchOptions?: LaunchOptions;

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

    const logger = options.logger || this._defaultLaunchOptions?.logger;
    options = { ...this._defaultLaunchOptions, ...options };
    const launchOptions: channels.BrowserTypeLaunchParams = {
      ...options,
      ignoreDefaultArgs: Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : undefined,
      ignoreAllDefaultArgs: !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs),
      env: options.env ? envObjectToArray(options.env) : undefined,
    };
    return await this._wrapApiCall(async () => {
      const browser = Browser.from((await this._channel.launch(launchOptions)).browser);
      this._didLaunchBrowser(browser, options, logger);
      return browser;
    });
  }

  async launchServer(options: LaunchServerOptions = {}): Promise<api.BrowserServer> {
    if (!this._serverLauncher)
      throw new Error('Launching server is not supported');
    options = { ...this._defaultLaunchOptions, ...options };
    return await this._serverLauncher.launchServer(options);
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
    return await this._wrapApiCall(async () => {
      const result = await this._channel.launchPersistentContext(persistentParams);
      const context = BrowserContext.from(result.context);
      await this._didCreateContext(context, contextParams, options, logger);
      return context;
    });
  }

  connect(options: api.ConnectOptions & { wsEndpoint: string }): Promise<api.Browser>;
  connect(wsEndpoint: string, options?: api.ConnectOptions): Promise<api.Browser>;
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
      const localUtils = this._connection.localUtils();
      const connectParams: channels.LocalUtilsConnectParams = {
        wsEndpoint: params.wsEndpoint,
        headers,
        exposeNetwork: params.exposeNetwork ?? params._exposeNetwork,
        slowMo: params.slowMo,
        timeout: params.timeout,
      };
      if ((params as any).__testHookRedirectPortForwarding)
        connectParams.socksProxyRedirectPortForTest = (params as any).__testHookRedirectPortForwarding;
      const { pipe, headers: connectHeaders } = await localUtils._channel.connect(connectParams);
      const closePipe = () => pipe.close().catch(() => {});
      const connection = new Connection(localUtils, this._instrumentation);
      connection.markAsRemote();
      connection.on('close', closePipe);

      let browser: Browser;
      let closeError: string | undefined;
      const onPipeClosed = (reason?: string) => {
        // Emulate all pages, contexts and the browser closing upon disconnect.
        for (const context of browser?.contexts() || []) {
          for (const page of context.pages())
            page._onClose();
          context._onClose();
        }
        connection.close(reason || closeError);
        // Give a chance to any API call promises to reject upon page/context closure.
        // This happens naturally when we receive page.onClose and browser.onClose from the server
        // in separate tasks. However, upon pipe closure we used to dispatch them all synchronously
        // here and promises did not have a chance to reject.
        // The order of rejects vs closure is a part of the API contract and our test runner
        // relies on it to attribute rejections to the right test.
        setTimeout(() => browser?._didClose(), 0);
      };
      pipe.on('closed', params => onPipeClosed(params.reason));
      connection.onmessage = message => this._wrapApiCall(() => pipe.send({ message }).catch(() => onPipeClosed()), /* isInternal */ true);

      pipe.on('message', ({ message }) => {
        try {
          connection!.dispatch(message);
        } catch (e) {
          closeError = String(e);
          closePipe();
        }
      });

      const result = await raceAgainstDeadline(async () => {
        // For tests.
        if ((params as any).__testHookBeforeCreateBrowser)
          await (params as any).__testHookBeforeCreateBrowser();

        const playwright = await connection!.initializePlaywright();
        if (!playwright._initializer.preLaunchedBrowser) {
          closePipe();
          throw new Error('Malformed endpoint. Did you use BrowserType.launchServer method?');
        }
        playwright._setSelectors(this._playwright.selectors);
        browser = Browser.from(playwright._initializer.preLaunchedBrowser!);
        this._didLaunchBrowser(browser, {}, logger);
        browser._shouldCloseConnectionOnClose = true;
        browser._connectHeaders = connectHeaders;
        browser.on(Events.Browser.Disconnected, () => this._wrapApiCall(() => closePipe(), /* isInternal */ true));
        return browser;
      }, deadline);
      if (!result.timedOut) {
        return result.result;
      } else {
        closePipe();
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
      timeout: params.timeout
    });
    const browser = Browser.from(result.browser);
    this._didLaunchBrowser(browser, {}, params.logger);
    if (result.defaultContext)
      await this._didCreateContext(BrowserContext.from(result.defaultContext), {}, {}, params.logger);
    return browser;
  }

  _didLaunchBrowser(browser: Browser, browserOptions: LaunchOptions, logger: Logger | undefined) {
    browser._browserType = this;
    browser._options = browserOptions;
    browser._logger = logger;
  }

  async _didCreateContext(context: BrowserContext, contextOptions: channels.BrowserNewContextParams, browserOptions: LaunchOptions, logger: Logger | undefined) {
    context._logger = logger;
    context._browserType = this;
    this._contexts.add(context);
    context._setOptions(contextOptions, browserOptions);
    if (this._defaultContextTimeout !== undefined)
      context.setDefaultTimeout(this._defaultContextTimeout);
    if (this._defaultContextNavigationTimeout !== undefined)
      context.setDefaultNavigationTimeout(this._defaultContextNavigationTimeout);
    await this._instrumentation.runAfterCreateBrowserContext(context);
  }

  async _willCloseContext(context: BrowserContext) {
    this._contexts.delete(context);
    await this._instrumentation.runBeforeCloseBrowserContext(context);
  }
}
