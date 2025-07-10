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

import { wrapInASCIIBox } from '../utils/ascii';
import { BrowserType, kNoXServerRunningError } from '../browserType';
import { BidiBrowser } from './bidiBrowser';
import { kBrowserCloseMessageId } from './bidiConnection';
import { chromiumSwitches } from '../chromium/chromiumSwitches';
import { RecentLogsCollector } from '../utils/debugLogger';
import { waitForReadyState } from '../chromium/chromium';

import type { BrowserOptions } from '../browser';
import type { SdkObject } from '../instrumentation';
import type { Env } from '../utils/processLauncher';
import type { ProtocolError } from '../protocolError';
import type { ConnectionTransport } from '../transport';
import type * as types from '../types';


export class BidiChromium extends BrowserType {
  constructor(parent: SdkObject) {
    super(parent, '_bidiChromium');
  }

  override async connectToTransport(transport: ConnectionTransport, options: BrowserOptions, browserLogsCollector: RecentLogsCollector): Promise<BidiBrowser> {
    // Chrome doesn't support Bidi, we create Bidi over CDP which is used by Chrome driver.
    // bidiOverCdp depends on chromium-bidi which we only have in devDependencies, so
    // we load bidiOverCdp dynamically.
    const bidiTransport = await require('./bidiOverCdp').connectBidiOverCdp(transport);
    (transport as any)[kBidiOverCdpWrapper] = bidiTransport;
    try {
      return BidiBrowser.connect(this.attribution.playwright, bidiTransport, options);
    } catch (e) {
      if (browserLogsCollector.recentLogs().some(log => log.includes('Failed to create a ProcessSingleton for your profile directory.'))) {
        throw new Error(
            'Failed to create a ProcessSingleton for your profile directory. ' +
            'This usually means that the profile is already in use by another instance of Chromium.'
        );
      }
      throw e;
    }
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

  override amendEnvironment(env: Env): Env {
    return env;
  }

  override attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void {
    const bidiTransport = (transport as any)[kBidiOverCdpWrapper];
    if (bidiTransport)
      transport = bidiTransport;
    transport.send({ method: 'browser.close', params: {}, id: kBrowserCloseMessageId });
  }

  override supportsPipeTransport(): boolean {
    return false;
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

  override async waitForReadyState(options: types.LaunchOptions, browserLogsCollector: RecentLogsCollector): Promise<{ wsEndpoint?: string }> {
    return waitForReadyState({ ...options, cdpPort: 0 }, browserLogsCollector);
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
    const chromeArguments = [...chromiumSwitches(options.assistantMode)];

    if (os.platform() === 'darwin') {
      // See https://issues.chromium.org/issues/40277080
      chromeArguments.push('--enable-unsafe-swiftshader');
    }

    if (options.devtools)
      chromeArguments.push('--auto-open-devtools-for-tabs');
    if (options.headless) {
      chromeArguments.push('--headless');

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
      if (isSocks && !options.socksProxyPort) {
        // https://www.chromium.org/developers/design-documents/network-stack/socks-proxy
        chromeArguments.push(`--host-resolver-rules="MAP * ~NOTFOUND , EXCLUDE ${proxyURL.hostname}"`);
      }
      chromeArguments.push(`--proxy-server=${proxy.server}`);
      const proxyBypassRules = [];
      // https://source.chromium.org/chromium/chromium/src/+/master:net/docs/proxy.md;l=548;drc=71698e610121078e0d1a811054dcf9fd89b49578
      if (options.socksProxyPort)
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

const kBidiOverCdpWrapper = Symbol('kBidiConnectionWrapper');
