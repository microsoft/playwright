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

import { kBrowserCloseMessageId } from './wkConnection';
import { wrapInASCIIBox } from '../utils/ascii';
import { BrowserType, kNoXServerRunningError } from '../browserType';
import { WKBrowser } from '../webkit/wkBrowser';
import { spawnAsync } from '../utils/spawnAsync';

import type { BrowserOptions } from '../browser';
import type { SdkObject } from '../instrumentation';
import type { ConnectionTransport } from '../transport';
import type * as types from '../types';

export class WebKit extends BrowserType {
  constructor(parent: SdkObject) {
    super(parent, 'webkit');
  }

  override connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<WKBrowser> {
    return WKBrowser.connect(this.attribution.playwright, transport, options);
  }

  override amendEnvironment(env: NodeJS.ProcessEnv, userDataDir: string, isPersistent: boolean, options: types.LaunchOptions): NodeJS.ProcessEnv {
    return {
      ...env,
      CURL_COOKIE_JAR_PATH: process.platform === 'win32' && isPersistent ? path.join(userDataDir, 'cookiejar.db') : undefined,
    };
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
    const webkitArguments = ['--inspector-pipe'];

    if (process.platform === 'win32' && options.channel !== 'webkit-wsl')
      webkitArguments.push('--disable-accelerated-compositing');
    if (headless)
      webkitArguments.push('--headless');
    if (isPersistent)
      webkitArguments.push(`--user-data-dir=${options.channel === 'webkit-wsl' ? await translatePathToWSL(userDataDir) : userDataDir}`);
    else
      webkitArguments.push(`--no-startup-window`);
    const proxy = options.proxyOverride || options.proxy;
    if (proxy) {
      if (process.platform === 'darwin') {
        webkitArguments.push(`--proxy=${proxy.server}`);
        if (proxy.bypass)
          webkitArguments.push(`--proxy-bypass-list=${proxy.bypass}`);
      } else if (process.platform === 'linux' || (process.platform === 'win32' && options.channel === 'webkit-wsl')) {
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
  const { stdout } = await spawnAsync('wsl.exe', ['-d', 'playwright', '--cd', '/home/pwuser', 'wslpath', path.replace(/\\/g, '\\\\')]);
  return stdout.toString().trim();
}
