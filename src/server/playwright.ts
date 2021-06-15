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

import path from 'path';
import { Android } from './android/android';
import { AdbBackend } from './android/backendAdb';
import { PlaywrightOptions } from './browser';
import { Chromium } from './chromium/chromium';
import { Electron } from './electron/electron';
import { Firefox } from './firefox/firefox';
import { Selectors } from './selectors';
import { WebKit } from './webkit/webkit';
import { Registry } from '../utils/registry';
import { CallMetadata, createInstrumentation, SdkObject } from './instrumentation';
import { debugLogger } from '../utils/debugLogger';
import { PortForwardingServer } from './socksSocket';
import { SocksInterceptedSocketHandler } from './socksServer';
import { assert } from '../utils/utils';

export class Playwright extends SdkObject {
  readonly selectors: Selectors;
  readonly chromium: Chromium;
  readonly android: Android;
  readonly electron: Electron;
  readonly firefox: Firefox;
  readonly webkit: WebKit;
  readonly options: PlaywrightOptions;
  private _portForwardingServer: PortForwardingServer | undefined;

  constructor(isInternal: boolean) {
    super({ attribution: { isInternal }, instrumentation: createInstrumentation() } as any, undefined, 'Playwright');
    this.instrumentation.addListener({
      onCallLog: (logName: string, message: string, sdkObject: SdkObject, metadata: CallMetadata) => {
        debugLogger.log(logName as any, message);
      }
    });
    this.options = {
      registry: new Registry(path.join(__dirname, '..', '..')),
      rootSdkObject: this,
      selectors: new Selectors(),
    };
    this.chromium = new Chromium(this.options);
    this.firefox = new Firefox(this.options);
    this.webkit = new WebKit(this.options);
    this.electron = new Electron(this.options);
    this.android = new Android(new AdbBackend(), this.options);
    this.selectors = this.options.selectors;
  }

  async _enablePortForwarding() {
    assert(!this._portForwardingServer);
    this._portForwardingServer = await PortForwardingServer.create(this);
    this.options.loopbackProxyOverride = () => this._portForwardingServer!.proxyServer();
    this._portForwardingServer.on('incomingSocksSocket', (socket: SocksInterceptedSocketHandler) => {
      this.emit('incomingSocksSocket', socket);
    });
  }

  _disablePortForwarding() {
    if (!this._portForwardingServer)
      return;
    this._portForwardingServer.stop();
  }

  _setForwardedPorts(ports: number[]) {
    if (!this._portForwardingServer)
      throw new Error(`Port forwarding needs to be enabled when launching the server via BrowserType.launchServer.`);
    this._portForwardingServer.setForwardedPorts(ports);
  }
}

export function createPlaywright(isInternal = false) {
  return new Playwright(isInternal);
}
