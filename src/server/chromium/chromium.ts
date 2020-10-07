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

import * as path from 'path';
import * as os from 'os';
import { CRBrowser } from './crBrowser';
import { Env } from '../processLauncher';
import { kBrowserCloseMessageId } from './crConnection';
import { rewriteErrorMessage } from '../../utils/stackTrace';
import { BrowserType } from '../browserType';
import { ConnectionTransport, ProtocolRequest } from '../transport';
import type { BrowserDescriptor } from '../../utils/browserPaths';
import { CRDevTools } from './crDevTools';
import { BrowserOptions } from '../browser';
import * as types from '../types';
import { isDebugMode, getFromENV } from '../../utils/utils';

export class Chromium extends BrowserType {
  private _devtools: CRDevTools | undefined;
  private _debugPort: number | undefined;

  constructor(packagePath: string, browser: BrowserDescriptor) {
    const debugPortStr = getFromENV('PLAYWRIGHT_CHROMIUM_DEBUG_PORT');
    const debugPort: number | undefined = debugPortStr ? +debugPortStr : undefined;
    if (debugPort !== undefined) {
      if (Number.isNaN(debugPort))
        throw new Error(`PLAYWRIGHT_CHROMIUM_DEBUG_PORT must be a number, but is set to "${debugPortStr}"`);
    }

    super(packagePath, browser, debugPort ? { webSocketRegex: /^DevTools listening on (ws:\/\/.*)$/, stream: 'stderr' } : null);
    this._debugPort = debugPort;
    if (isDebugMode())
      this._devtools = this._createDevTools();
  }

  private _createDevTools() {
    return new CRDevTools(path.join(this._browserPath, 'devtools-preferences.json'));
  }

  async _connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<CRBrowser> {
    let devtools = this._devtools;
    if ((options as any).__testHookForDevTools) {
      devtools = this._createDevTools();
      await (options as any).__testHookForDevTools(devtools);
    }
    return CRBrowser.connect(transport, options, devtools);
  }

  _rewriteStartupError(error: Error): Error {
    // These error messages are taken from Chromium source code as of July, 2020:
    // https://github.com/chromium/chromium/blob/70565f67e79f79e17663ad1337dc6e63ee207ce9/content/browser/zygote_host/zygote_host_impl_linux.cc
    if (!error.message.includes('crbug.com/357670') && !error.message.includes('No usable sandbox!') && !error.message.includes('crbug.com/638180'))
      return error;
    return rewriteErrorMessage(error, [
      `Chromium sandboxing failed!`,
      `================================`,
      `To workaround sandboxing issues, do either of the following:`,
      `  - (preferred): Configure environment to support sandboxing: https://github.com/microsoft/playwright/blob/master/docs/troubleshooting.md`,
      `  - (alternative): Launch Chromium without sandbox using 'chromiumSandbox: false' option`,
      `================================`,
      ``,
    ].join('\n'));
  }

  _amendEnvironment(env: Env, userDataDir: string, executable: string, browserArguments: string[]): Env {
    return env;
  }

  _amendArguments(browserArguments: string[]): string[] {
    // We currently only support Linux.
    if (os.platform() !== 'linux')
      return browserArguments;

    // If there's already --no-sandbox passed in, do nothing.
    if (browserArguments.indexOf('--no-sandbox') !== -1)
      return browserArguments;
    const runningAsRoot = process.geteuid && process.geteuid() === 0;
    if (runningAsRoot)
      return ['--no-sandbox', ...browserArguments];
    return browserArguments;
  }

  _attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void {
    const message: ProtocolRequest = { method: 'Browser.close', id: kBrowserCloseMessageId, params: {} };
    transport.send(message);
  }

  _defaultArgs(options: types.LaunchOptions, isPersistent: boolean, userDataDir: string): string[] {
    const { args = [], proxy } = options;
    const userDataDirArg = args.find(arg => arg.startsWith('--user-data-dir'));
    if (userDataDirArg)
      throw new Error('Pass userDataDir parameter instead of specifying --user-data-dir argument');
    if (args.find(arg => arg.startsWith('--remote-debugging-pipe')))
      throw new Error('Playwright manages remote debugging connection itself.');
    if (args.find(arg => !arg.startsWith('-')))
      throw new Error('Arguments can not specify page to be opened');
    const chromeArguments = [...DEFAULT_ARGS];
    chromeArguments.push(`--user-data-dir=${userDataDir}`);
    if (this._debugPort !== undefined)
      chromeArguments.push('--remote-debugging-port=' + this._debugPort);
    else
      chromeArguments.push('--remote-debugging-pipe');
    if (options.devtools)
      chromeArguments.push('--auto-open-devtools-for-tabs');
    if (options.headless) {
      chromeArguments.push(
          '--headless',
          '--hide-scrollbars',
          '--mute-audio',
          '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4',
      );
    }
    if (options.chromiumSandbox === false)
      chromeArguments.push('--no-sandbox');
    if (proxy) {
      const proxyURL = new URL(proxy.server);
      const isSocks = proxyURL.protocol === 'socks5:';
      // https://www.chromium.org/developers/design-documents/network-settings
      if (isSocks) {
        // https://www.chromium.org/developers/design-documents/network-stack/socks-proxy
        chromeArguments.push(`--host-resolver-rules="MAP * ~NOTFOUND , EXCLUDE ${proxyURL.hostname}"`);
      }
      chromeArguments.push(`--proxy-server=${proxy.server}`);
      if (proxy.bypass) {
        const patterns = proxy.bypass.split(',').map(t => t.trim()).map(t => t.startsWith('.') ? '*' + t : t);
        chromeArguments.push(`--proxy-bypass-list=${patterns.join(';')}`);
      }
    }
    chromeArguments.push(...args);
    if (isPersistent)
      chromeArguments.push('about:blank');
    else
      chromeArguments.push('--no-startup-window');
    return chromeArguments;
  }
}

const DEFAULT_ARGS = [
  '--disable-background-networking',
  '--enable-features=NetworkService,NetworkServiceInProcess',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-breakpad',
  '--disable-client-side-phishing-detection',
  '--disable-component-extensions-with-background-pages',
  '--disable-default-apps',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  // BlinkGenPropertyTrees disabled due to crbug.com/937609
  '--disable-features=TranslateUI,BlinkGenPropertyTrees,ImprovedCookieControls,SameSiteByDefaultCookies,LazyFrameLoading',
  '--disable-hang-monitor',
  '--disable-ipc-flooding-protection',
  '--disable-popup-blocking',
  '--disable-prompt-on-repost',
  '--disable-renderer-backgrounding',
  '--disable-sync',
  '--force-color-profile=srgb',
  '--metrics-recording-only',
  '--no-first-run',
  '--enable-automation',
  '--password-store=basic',
  '--use-mock-keychain',
];
