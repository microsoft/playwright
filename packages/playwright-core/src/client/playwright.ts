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

import { Android } from './android';
import { Browser } from './browser';
import { BrowserType } from './browserType';
import { ChannelOwner } from './channelOwner';
import { Electron } from './electron';
import { TimeoutError } from './errors';
import { APIRequest } from './fetch';
import { Selectors } from './selectors';

import type * as channels from '@protocol/channels';
import type { BrowserContextOptions, LaunchOptions } from 'playwright-core';

export class Playwright extends ChannelOwner<channels.PlaywrightChannel> {
  readonly _android: Android;
  readonly _electron: Electron;
  readonly _bidiChromium: BrowserType;
  readonly _bidiFirefox: BrowserType;
  readonly chromium: BrowserType;
  readonly firefox: BrowserType;
  readonly webkit: BrowserType;
  readonly devices: any;
  selectors: Selectors;
  readonly request: APIRequest;
  readonly errors: { TimeoutError: typeof TimeoutError };

  // Instrumentation.
  _defaultLaunchOptions?: LaunchOptions;
  _defaultContextOptions?: BrowserContextOptions;
  _defaultContextTimeout?: number;
  _defaultContextNavigationTimeout?: number;

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.PlaywrightInitializer) {
    super(parent, type, guid, initializer);
    this.request = new APIRequest(this);
    this.chromium = BrowserType.from(initializer.chromium);
    this.chromium._playwright = this;
    this.firefox = BrowserType.from(initializer.firefox);
    this.firefox._playwright = this;
    this.webkit = BrowserType.from(initializer.webkit);
    this.webkit._playwright = this;
    this._android = Android.from(initializer.android);
    this._android._playwright = this;
    this._electron = Electron.from(initializer.electron);
    this._electron._playwright = this;
    this._bidiChromium = BrowserType.from(initializer._bidiChromium);
    this._bidiChromium._playwright = this;
    this._bidiFirefox = BrowserType.from(initializer._bidiFirefox);
    this._bidiFirefox._playwright = this;
    this.devices = this._connection.localUtils()?.devices ?? {};
    this.selectors = new Selectors(this._connection._platform);
    this.errors = { TimeoutError };
  }

  static from(channel: channels.PlaywrightChannel): Playwright {
    return (channel as any)._object;
  }

  private _browserTypes(): BrowserType[] {
    return [this.chromium, this.firefox, this.webkit, this._bidiChromium, this._bidiFirefox];
  }

  _preLaunchedBrowser(): Browser {
    const browser = Browser.from(this._initializer.preLaunchedBrowser!);
    browser._connectToBrowserType(this[browser._name as 'chromium' | 'firefox' | 'webkit'], {}, undefined);
    return browser;
  }

  _allContexts() {
    return this._browserTypes().flatMap(type => [...type._contexts]);
  }

  _allPages() {
    return this._allContexts().flatMap(context => context.pages());
  }
}
