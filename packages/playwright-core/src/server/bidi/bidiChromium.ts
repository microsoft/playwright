/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import os from 'os';
import { assert, wrapInASCIIBox } from '../../utils';
import type { Env } from '../../utils/processLauncher';
import type { BrowserOptions } from '../browser';
import { BrowserReadyState, BrowserType, kNoXServerRunningError } from '../browserType';
import { chromiumSwitches } from '../chromium/chromiumSwitches';
import type { SdkObject } from '../instrumentation';
import type { ProtocolError } from '../protocolError';
import type { ConnectionTransport } from '../transport';
import type * as types from '../types';
import { BidiBrowser } from './bidiBrowser';
import { kBrowserCloseMessageId } from './bidiConnection';

export class BidiChromium extends BrowserType {
  constructor(parent: SdkObject) {
    super(parent, 'bidi');
    this._useBidi = true;
  }

  override async connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<BidiBrowser> {
    // Chrome doesn't support Bidi, we create Bidi over CDP which is used by Chrome driver.
    // bidiOverCdp depends on chromium-bidi which we only have in devDependencies, so
    // we load bidiOverCdp dynamically.
    const bidiTransport = await require('./bidiOverCdp').connectBidiOverCdp(transport);
    (transport as any)[kBidiOverCdpWrapper] = bidiTransport;
    return BidiBrowser.connect(this.attribution.playwright, bidiTransport, options);
  }

  override doRewriteStartupLog(error: ProtocolError): ProtocolError {
    if (!error.logs)
      return error;
    if (error.logs.includes('Missing X server'))
      error.logs = '\n' + wrapInASCIIBox(kNoXServerRunningError, 1);
    // These error messages are taken from Chromium source code as of July, 2020:
    // https://github.com/chromium/chromium/blob/70565f67e79f79e17663ad1337dc6e63ee207ce9/content/browser/zygote_host/zygote_host_impl_linux.cc
    if (!error.logs.includes('crbug.com/357670') && !error.logs.includes('No usable sandbox!') && !error.logs.includes('crbug.com/638180'))
      return error;
    error.logs = [
      `Chromium sandboxing failed!`,
      `================================`,
      `To avoid the sandboxing issue, do either of the following:`,
      `  - (preferred): Configure your environment to support sandboxing`,
      `  - (alternative): Launch Chromium without sandbox using 'chromiumSandbox: false' option`,
      `================================`,
      ``,
    ].join('\n');
    return error;
  }

  override amendEnvironment(env: Env, userDataDir: string, executable: string, browserArguments: string[]): Env {
    return env;
  }

  override attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void {
    const bidiTransport = (transport as any)[kBidiOverCdpWrapper];
    if (bidiTransport)
      transport = bidiTransport;
    transport.send({ method: 'browser.close', params: {}, id: kBrowserCloseMessageId });
  }

  override defaultArgs(options: types.LaunchOptions, isPersistent: boolean, userDataDir: string): string[] {
    const chromeArguments = this._innerDefaultArgs(options);
    chromeArguments.push(`--user-data-dir=${userDataDir}`);
    chromeArguments.push('--remote-debugging-port=0');
    if (isPersistent)
      chromeArguments.push('about:blank');
    else
      chromeArguments.push('--no-startup-window');
    return chromeArguments;
  }

  override readyState(options: types.LaunchOptions): BrowserReadyState | undefined {
    assert(options.useWebSocket);
    return new ChromiumReadyState();
  }

  private _innerDefaultArgs(options: types.LaunchOptions): string[] {
    const { args = [] } = options;
    const userDataDirArg = args.find(arg => arg.startsWith('--user-data-dir'));
    if (userDataDirArg)
      throw this._createUserDataDirArgMisuseError('--user-data-dir');
    if (args.find(arg => arg.startsWith('--remote-debugging-pipe')))
      throw new Error('Playwright manages remote debugging connection itself.');
    if (args.find(arg => !arg.startsWith('-')))
      throw new Error('Arguments can not specify page to be opened');
    const chromeArguments = [...chromiumSwitches];

    if (os.platform() === 'darwin') {
      // See https://github.com/microsoft/playwright/issues/7362
      chromeArguments.push('--enable-use-zoom-for-dsf=false');
      // See https://bugs.chromium.org/p/chromium/issues/detail?id=1407025.
      if (options.headless)
        chromeArguments.push('--use-angle');
    }

    if (options.devtools)
      chromeArguments.push('--auto-open-devtools-for-tabs');
    if (options.headless) {
      if (process.env.PLAYWRIGHT_CHROMIUM_USE_HEADLESS_NEW)
        chromeArguments.push('--headless=new');
      else
        chromeArguments.push('--headless=old');

      chromeArguments.push(
          '--hide-scrollbars',
          '--mute-audio',
          '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4',
      );
    }
    if (options.chromiumSandbox !== true)
      chromeArguments.push('--no-sandbox');
    const proxy = options.proxyOverride || options.proxy;
    if (proxy) {
      const proxyURL = new URL(proxy.server);
      const isSocks = proxyURL.protocol === 'socks5:';
      // https://www.chromium.org/developers/design-documents/network-settings
      if (isSocks && !this.attribution.playwright.options.socksProxyPort) {
        // https://www.chromium.org/developers/design-documents/network-stack/socks-proxy
        chromeArguments.push(`--host-resolver-rules="MAP * ~NOTFOUND , EXCLUDE ${proxyURL.hostname}"`);
      }
      chromeArguments.push(`--proxy-server=${proxy.server}`);
      const proxyBypassRules = [];
      // https://source.chromium.org/chromium/chromium/src/+/master:net/docs/proxy.md;l=548;drc=71698e610121078e0d1a811054dcf9fd89b49578
      if (this.attribution.playwright.options.socksProxyPort)
        proxyBypassRules.push('<-loopback>');
      if (proxy.bypass)
        proxyBypassRules.push(...proxy.bypass.split(',').map(t => t.trim()).map(t => t.startsWith('.') ? '*' + t : t));
      if (!process.env.PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK && !proxyBypassRules.includes('<-loopback>'))
        proxyBypassRules.push('<-loopback>');
      if (proxyBypassRules.length > 0)
        chromeArguments.push(`--proxy-bypass-list=${proxyBypassRules.join(';')}`);
    }
    chromeArguments.push(...args);
    return chromeArguments;
  }
}

class ChromiumReadyState extends BrowserReadyState {
  override onBrowserOutput(message: string): void {
    const match = message.match(/DevTools listening on (.*)/);
    if (match)
      this._wsEndpoint.resolve(match[1]);
  }
}

const kBidiOverCdpWrapper = Symbol('kBidiConnectionWrapper');
