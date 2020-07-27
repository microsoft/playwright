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

import * as types from '../../types';
import { BrowserTypeChannel, BrowserTypeInitializer, BrowserTypeLaunchParams, BrowserTypeLaunchServerParams, BrowserTypeLaunchPersistentContextParams } from '../channels';
import { Browser } from './browser';
import { BrowserContext } from './browserContext';
import { ChannelOwner } from './channelOwner';
import { BrowserServer } from './browserServer';
import { LoggerSink } from '../../loggerSink';
import { headersObjectToArray, envObjectToArray } from '../serializers';
import { serializeArgument } from './jsHandle';
import { assert } from '../../helper';

type FirefoxPrefsOptions = { firefoxUserPrefs?: { [key: string]: string | number | boolean } };

export class BrowserType extends ChannelOwner<BrowserTypeChannel, BrowserTypeInitializer> {

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

  async launch(options: types.LaunchOptions & FirefoxPrefsOptions & { logger?: LoggerSink } = {}): Promise<Browser> {
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
        firefoxUserPrefs: options.firefoxUserPrefs ? serializeArgument(options.firefoxUserPrefs).value : undefined,
      };
      const browser = Browser.from((await this._channel.launch(launchOptions)).browser);
      browser._logger = logger;
      return browser;
    }, logger);
  }

  async launchServer(options: types.LaunchServerOptions & FirefoxPrefsOptions & { logger?: LoggerSink } = {}): Promise<BrowserServer> {
    const logger = options.logger;
    options = { ...options, logger: undefined };
    return this._wrapApiCall('browserType.launchServer', async () => {
      const launchServerOptions: BrowserTypeLaunchServerParams = {
        ...options,
        ignoreDefaultArgs: Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : undefined,
        ignoreAllDefaultArgs: !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs),
        env: options.env ? envObjectToArray(options.env) : undefined,
        firefoxUserPrefs: options.firefoxUserPrefs ? serializeArgument(options.firefoxUserPrefs).value : undefined,
      };
      return BrowserServer.from((await this._channel.launchServer(launchServerOptions)).server);
    }, logger);
  }

  async launchPersistentContext(userDataDir: string, options: types.LaunchOptions & types.BrowserContextOptions & { logger?: LoggerSink } = {}): Promise<BrowserContext> {
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

  async connect(options: types.ConnectOptions & { logger?: LoggerSink }): Promise<Browser> {
    const logger = options.logger;
    options = { ...options, logger: undefined };
    return this._wrapApiCall('browserType.connect', async () => {
      const browser = Browser.from((await this._channel.connect(options)).browser);
      browser._logger = logger;
      return browser;
    }, logger);
  }
}
