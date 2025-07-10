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
import net from 'net';
import { PassThrough } from 'stream';

import { kBrowserCloseMessageId } from './wkConnection';
import { wrapInASCIIBox } from '../utils/ascii';
import { BrowserType, kNoXServerRunningError, LaunchLifecycleHooks } from '../browserType';
import { WKBrowser } from '../webkit/wkBrowser';
import { spawnAsync } from '../utils/spawnAsync';
import { registry } from '../registry';

import type { BrowserOptions } from '../browser';
import type { SdkObject } from '../instrumentation';
import type { ProtocolError } from '../protocolError';
import type { ConnectionTransport } from '../transport';
import type * as types from '../types';

export class WebKit extends BrowserType {
  constructor(parent: SdkObject) {
    super(parent, 'webkit');
  }

  override connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<WKBrowser> {
    return WKBrowser.connect(this.attribution.playwright, transport, options);
  }

  override doRewriteStartupLog(error: ProtocolError): ProtocolError {
    if (!error.logs)
      return error;
    if (error.logs.includes('Failed to open display') || error.logs.includes('cannot open display'))
      error.logs = '\n' + wrapInASCIIBox(kNoXServerRunningError, 1);
    return error;
  }

  override attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void {
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

    if (options.channel === 'webkit-wsl') {
      const executablePath = registry.findExecutable('webkit-wsl')!._wslExecutablePath!;
      webkitArguments.unshift(
          '-d',
          'playwright',
          '--cd',
          '/home/pwuser',
          '/home/pwuser/node/bin/node',
          '/home/pwuser/webkit-wsl-pipe-wrapper.mjs',
          executablePath,
      );
    }

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
      } else if (process.platform === 'linux' || process.platform === 'win32' && options.channel === 'webkit-wsl') {
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

  override processLifecycleHooks(options: types.LaunchOptions): LaunchLifecycleHooks {
    if (options.channel !== 'webkit-wsl') {
      return {
        ...super.processLifecycleHooks(options),
        async amendEnvironment(env, options, userDataDir, isPersistent) {
          return {
            ...env,
            'CURL_COOKIE_JAR_PATH': process.platform === 'win32' && isPersistent && options.channel !== 'webkit-wsl' ? path.join(userDataDir, 'cookiejar.db') : undefined,
          };
        }
      };
    }
    let transportServer: net.Server = undefined!;
    const [readPipe, writePipe] = [new PassThrough(), new PassThrough()];
    return {
      preLaunch: async () => {
        transportServer = net.createServer({
          highWaterMark: 128 * 1024, // 128KB
        }, socket => {
          socket.setNoDelay(true);
          writePipe!.pipe(socket);
          socket.pipe(readPipe!);
        });
        await new Promise<void>(resolve => transportServer.listen(0, resolve));
      },
      onExit: async () => {
        transportServer.close();
        readPipe.destroy();
        writePipe.destroy();
      },
      amendEnvironment: async (env, options, userDataDir, isPersistent) => {
        return {
          ...env,
          'WSLENV': 'PW_WKWSL_PORT',
          'PW_WKWSL_PORT': (transportServer.address() as net.AddressInfo)?.port?.toString() ?? '',
        };
      },
      readPipe: () => readPipe,
      writePipe: () => writePipe,
    };
  }
}

export async function translatePathToWSL(path: string): Promise<string> {
  const { stdout } = await spawnAsync('wsl.exe', ['-d', 'playwright', '--cd', '/home/pwuser', 'wslpath', path.replace(/\\/g, '\\\\')]);
  return stdout.toString().trim();
}
