/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { BrowserType } from '../browserType';
import { Browser, BrowserOptions, BrowserProcess } from '../browser';
import * as types from '../types';
import { normalizeProxySettings, validateBrowserContextOptions } from '../browserContext';
import { Progress } from '../progress';
import { ConnectionTransport } from '../transport';
import { Env } from '../processLauncher';
import { CRBrowser } from '../chromium/crBrowser';
import { AndroidBrowser, AndroidClient, AndroidDevice } from './android';
import { AdbBackend } from './backendAdb';

export class Clank extends BrowserType {
  async _innerLaunch(progress: Progress, options: types.LaunchOptions, persistent: types.BrowserContextOptions | undefined, protocolLogger: types.ProtocolLogger, userDataDir?: string): Promise<Browser> {
    options.proxy = options.proxy ? normalizeProxySettings(options.proxy) : undefined;
    if ((options as any).__testHookBeforeCreateBrowser)
      await (options as any).__testHookBeforeCreateBrowser();

    // const client = new AndroidClient(new UsbBackend());
    const client = new AndroidClient(new AdbBackend());
    const device = (await client.devices())[0];
    await device.init();
    const adbBrowser = await device.launchBrowser(options.executablePath || 'com.android.chrome'); // com.chrome.canary
    const transport = adbBrowser;

    const browserOptions: BrowserOptions = {
      name: 'clank',
      slowMo: options.slowMo,
      persistent,
      headful: !options.headless,
      downloadsPath: undefined,
      browserProcess: new ClankBrowserProcess(device, adbBrowser),
      proxy: options.proxy,
      protocolLogger,
    };
    if (persistent)
      validateBrowserContextOptions(persistent, browserOptions);

    const browser = await this._connectToTransport(transport, browserOptions);
    // We assume no control when using custom arguments, and do not prepare the default context in that case.
    if (persistent && !options.ignoreAllDefaultArgs)
      await browser._defaultContext!._loadDefaultContext(progress);
    return browser;
  }

  _defaultArgs(options: types.LaunchOptions, isPersistent: boolean, userDataDir: string): string[] {
    return [];
  }

  _connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<Browser> {
    return CRBrowser.connect(transport, options);
  }

  _amendEnvironment(env: Env, userDataDir: string, executable: string, browserArguments: string[]): Env {
    return env;
  }

  _rewriteStartupError(error: Error): Error {
    return error;
  }

  _attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void {
  }
}

class ClankBrowserProcess implements BrowserProcess {
  private _device: AndroidDevice;
  private _browser: AndroidBrowser;

  constructor(device: AndroidDevice, browser: AndroidBrowser) {
    this._device = device;
    this._browser = browser;
  }

  onclose: ((exitCode: number | null, signal: string | null) => void) | undefined;

  async kill(): Promise<void> {
  }

  async close(): Promise<void> {
    await this._browser.close();
    await this._device.close();
  }
}
