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

import path from 'path';

import { ManualPromise } from '@isomorphic/manualPromise';
import { wrapInASCIIBox } from '@utils/ascii';
import { spawnAsync } from '@utils/spawnAsync';
import { kBrowserCloseMessageId } from './wkConnection';
import { Browser } from '../browser';
import { BrowserType, kNoXServerRunningError } from '../browserType';
import { registry } from '../registry';
import { WKBrowser } from './wkBrowser';
import { connectOverRDP } from './webview/wvBrowser';
import { connectOverWebDriver } from './webdriver/wdBrowser';

import type { BrowserOptions } from '../browser';
import type { SdkObject } from '../instrumentation';
import type { Progress } from '../progress';
import type { ConnectionTransport } from '../transport';
import type * as types from '../types';
import type { RecentLogsCollector } from '@utils/debugLogger';
import type * as channels from '../channels';

// Must be kept in sync with bin/install_webkit_wsl.ps1 that provisions the distribution.
const kWSLDistribution = 'playwright';
const kWSLUser = 'pwuser';
const kWSLHome = '/home/pwuser';

export class WebKit extends BrowserType {
  constructor(parent: SdkObject) {
    super(parent, 'webkit');
  }

  override connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<WKBrowser> {
    return WKBrowser.connect(this.attribution.playwright, transport, options);
  }

  override async connectOverCDP(progress: Progress, params: channels.BrowserTypeConnectOverCDPParams): Promise<Browser> {
    // `webdriver://host:port` / `webdriver+launch://safari` route to the classic
    // W3C WebDriver backend (e.g. safaridriver); everything else is the WebKit
    // inspector-protocol (webview) backend.
    const endpointURL = params.endpointURL || '';
    if (endpointURL.startsWith('webdriver://') || endpointURL.startsWith('webdriver+launch://'))
      return connectOverWebDriver(progress, this, params);
    return connectOverRDP(progress, this, params);
  }

  override amendEnvironment(env: NodeJS.ProcessEnv, userDataDir: string, isPersistent: boolean, options: types.LaunchOptions): NodeJS.ProcessEnv {
    return {
      ...env,
      // Cookie jar is only used by the Windows port of WebKit.
      CURL_COOKIE_JAR_PATH: process.platform === 'win32' && options.channel !== 'webkit-wsl' && isPersistent ? path.join(userDataDir, 'cookiejar.db') : undefined,
    };
  }

  override supportsPipeTransport(options: types.LaunchOptions): boolean {
    return options.channel !== 'webkit-wsl';
  }

  override async resolveExecutablePath(options: types.LaunchOptions): Promise<string | undefined> {
    if (options.channel !== 'webkit-wsl')
      return super.resolveExecutablePath(options);
    // executablePath points inside the WSL distribution and is consumed in defaultArgs; the
    // host command is wsl.exe from the registry.
    if (options.executablePath && !await wslPathExists(options.executablePath))
      throw new Error(`Failed to launch webkit because executable doesn't exist at ${options.executablePath}`);
    return undefined;
  }

  override async waitForReadyState(options: types.LaunchOptions, browserLogsCollector: RecentLogsCollector): Promise<{ wsEndpoint?: string }> {
    if (options.channel !== 'webkit-wsl')
      return {};
    const result = new ManualPromise<{ wsEndpoint?: string }>();
    browserLogsCollector.onMessage(message => {
      const match = message.match(/Playwright listening on (ws:\/\/\S+)/);
      if (match)
        result.resolve({ wsEndpoint: match[1] });
    });
    return result;
  }

  override doRewriteStartupLog(logs: string): string {
    if (logs.includes('Failed to open display') || logs.includes('cannot open display'))
      logs = '\n' + wrapInASCIIBox(kNoXServerRunningError, 1);
    return logs;
  }

  override attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void {
    // Note that it's fine to reuse the transport, since our connection ignores kBrowserCloseMessageId.
    transport.send({ method: 'Playwright.close', params: {}, id: kBrowserCloseMessageId });
  }

  override async defaultArgs(options: types.LaunchOptions, isPersistent: boolean, userDataDir: string): Promise<string[]> {
    const { args = [], headless } = options;
    const userDataDirArg = args.find(arg => arg.startsWith('--user-data-dir'));
    if (userDataDirArg)
      throw this._createUserDataDirArgMisuseError('--user-data-dir');
    if (args.find(arg => !arg.startsWith('-')))
      throw new Error('Arguments can not specify page to be opened');
    const isWSL = options.channel === 'webkit-wsl';
    const webkitArguments = [isWSL ? '--remote-debugging-port=0' : '--inspector-pipe'];

    if (isWSL) {
      const wslExecutablePath = options.executablePath || registry.findExecutable('webkit-wsl')!.wslExecutablePath!;
      webkitArguments.unshift(
          '-d', kWSLDistribution,
          '-u', kWSLUser,
          '--cd', kWSLHome,
          '--',
          wslExecutablePath,
      );
    }

    if (process.platform === 'win32' && !isWSL)
      webkitArguments.push('--disable-accelerated-compositing');
    if (headless)
      webkitArguments.push('--headless');
    if (isPersistent)
      webkitArguments.push(`--user-data-dir=${isWSL ? await translatePathToWSL(userDataDir) : userDataDir}`);
    else
      webkitArguments.push(`--no-startup-window`);
    const proxy = options.proxyOverride || options.proxy;
    if (proxy) {
      if (process.platform === 'darwin') {
        webkitArguments.push(`--proxy=${proxy.server}`);
        if (proxy.bypass)
          webkitArguments.push(`--proxy-bypass-list=${proxy.bypass}`);
      } else if (process.platform === 'linux' || isWSL) {
        webkitArguments.push(`--proxy=${proxy.server}`);
        if (proxy.bypass)
          webkitArguments.push(...proxy.bypass.split(',').map(t => `--ignore-host=${t}`));
      } else if (process.platform === 'win32') {
        // Enable socks5 hostname resolution on Windows. Workaround can be removed once fixed upstream.
        // See https://github.com/microsoft/playwright/issues/20451
        webkitArguments.push(`--curl-proxy=${proxy.server.replace(/^socks5:\/\//, 'socks5h://')}`);
        if (proxy.bypass)
          webkitArguments.push(`--curl-noproxy=${proxy.bypass}`);
      }
    }
    webkitArguments.push(...args);
    if (isPersistent)
      webkitArguments.push('about:blank');
    return webkitArguments;
  }
}

export async function translatePathToWSL(path: string): Promise<string> {
  const { stdout } = await spawnAsync('wsl.exe', ['-d', kWSLDistribution, '--cd', kWSLHome, 'wslpath', path.replace(/\\/g, '\\\\')]);
  return stdout.toString().trim();
}

async function wslPathExists(wslPath: string): Promise<boolean> {
  const { code } = await spawnAsync('wsl.exe', ['-d', kWSLDistribution, '-u', kWSLUser, '--', 'test', '-e', wslPath]);
  return code === 0;
}
