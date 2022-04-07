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

import { WKBrowser } from '../webkit/wkBrowser';
import type { Env } from '../../utils/processLauncher';
import path from 'path';
import { kBrowserCloseMessageId } from './wkConnection';
import { BrowserType, kNoXServerRunningError } from '../browserType';
import type { ConnectionTransport } from '../transport';
import type { BrowserOptions, PlaywrightOptions } from '../browser';
import type * as types from '../types';
import { rewriteErrorMessage } from '../../utils/stackTrace';
import { wrapInASCIIBox } from '../../utils';

export class WebKit extends BrowserType {
  constructor(playwrightOptions: PlaywrightOptions) {
    super('webkit', playwrightOptions);
  }

  _connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<WKBrowser> {
    return WKBrowser.connect(transport, options);
  }

  _amendEnvironment(env: Env, userDataDir: string, executable: string, browserArguments: string[]): Env {
    return { ...env, CURL_COOKIE_JAR_PATH: path.join(userDataDir, 'cookiejar.db') };
  }

  _rewriteStartupError(error: Error): Error {
    if (error.message.includes('cannot open display'))
      return rewriteErrorMessage(error, '\n' + wrapInASCIIBox(kNoXServerRunningError, 1));
    return error;
  }

  _attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void {
    transport.send({ method: 'Playwright.close', params: {}, id: kBrowserCloseMessageId });
  }

  _defaultArgs(options: types.LaunchOptions, isPersistent: boolean, userDataDir: string): string[] {
    const { args = [], proxy, headless } = options;
    const userDataDirArg = args.find(arg => arg.startsWith('--user-data-dir'));
    if (userDataDirArg)
      throw new Error('Pass userDataDir parameter to `browserType.launchPersistentContext(userDataDir, ...)` instead of specifying --user-data-dir argument');
    if (args.find(arg => !arg.startsWith('-')))
      throw new Error('Arguments can not specify page to be opened');
    const webkitArguments = ['--inspector-pipe'];
    if (process.platform === 'win32')
      webkitArguments.push('--disable-accelerated-compositing');
    if (headless)
      webkitArguments.push('--headless');
    if (isPersistent)
      webkitArguments.push(`--user-data-dir=${userDataDir}`);
    else
      webkitArguments.push(`--no-startup-window`);
    if (proxy) {
      if (process.platform === 'darwin') {
        webkitArguments.push(`--proxy=${proxy.server}`);
        if (proxy.bypass)
          webkitArguments.push(`--proxy-bypass-list=${proxy.bypass}`);
      } else if (process.platform === 'linux') {
        webkitArguments.push(`--proxy=${proxy.server}`);
        if (proxy.bypass)
          webkitArguments.push(...proxy.bypass.split(',').map(t => `--ignore-host=${t}`));
      } else if (process.platform === 'win32') {
        webkitArguments.push(`--curl-proxy=${proxy.server}`);
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
