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
import path from 'path';
import { assert, wrapInASCIIBox } from '../../utils';
import type { Env } from '../../utils/processLauncher';
import type { BrowserOptions } from '../browser';
import { BrowserReadyState, BrowserType, kNoXServerRunningError } from '../browserType';
import type { SdkObject } from '../instrumentation';
import type { ProtocolError } from '../protocolError';
import type { ConnectionTransport } from '../transport';
import type * as types from '../types';
import { BidiBrowser } from './bidiBrowser';
import { kBrowserCloseMessageId } from './bidiConnection';

export class BidiFirefox extends BrowserType {
  constructor(parent: SdkObject) {
    super(parent, 'bidi');
    this._useBidi = true;
  }

  override async connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<BidiBrowser> {
    return BidiBrowser.connect(this.attribution.playwright, transport, options);
  }

  override doRewriteStartupLog(error: ProtocolError): ProtocolError {
    if (!error.logs)
      return error;
    // https://github.com/microsoft/playwright/issues/6500
    if (error.logs.includes(`as root in a regular user's session is not supported.`))
      error.logs = '\n' + wrapInASCIIBox(`Firefox is unable to launch if the $HOME folder isn't owned by the current user.\nWorkaround: Set the HOME=/root environment variable${process.env.GITHUB_ACTION ? ' in your GitHub Actions workflow file' : ''} when running Playwright.`, 1);
    if (error.logs.includes('no DISPLAY environment variable specified'))
      error.logs = '\n' + wrapInASCIIBox(kNoXServerRunningError, 1);
    return error;
  }

  override amendEnvironment(env: Env, userDataDir: string, executable: string, browserArguments: string[]): Env {
    if (!path.isAbsolute(os.homedir()))
      throw new Error(`Cannot launch Firefox with relative home directory. Did you set ${os.platform() === 'win32' ? 'USERPROFILE' : 'HOME'} to a relative path?`);

    env = {
      ...env,
      'MOZ_CRASHREPORTER': '1',
      'MOZ_CRASHREPORTER_NO_REPORT': '1',
      'MOZ_CRASHREPORTER_SHUTDOWN': '1',
    };

    if (os.platform() === 'linux') {
      // Always remove SNAP_NAME and SNAP_INSTANCE_NAME env variables since they
      // confuse Firefox: in our case, builds never come from SNAP.
      // See https://github.com/microsoft/playwright/issues/20555
      return { ...env, SNAP_NAME: undefined, SNAP_INSTANCE_NAME: undefined };
    }
    return env;
  }

  override attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void {
    transport.send({ method: 'browser.close', params: {}, id: kBrowserCloseMessageId });
  }

  override defaultArgs(options: types.LaunchOptions, isPersistent: boolean, userDataDir: string): string[] {
    const { args = [], headless } = options;
    const userDataDirArg = args.find(arg => arg.startsWith('-profile') || arg.startsWith('--profile'));
    if (userDataDirArg)
      throw this._createUserDataDirArgMisuseError('--profile');
    const firefoxArguments = ['--remote-debugging-port=0'];
    if (headless)
      firefoxArguments.push('--headless');
    else
      firefoxArguments.push('--foreground');
    firefoxArguments.push(`--profile`, userDataDir);
    firefoxArguments.push(...args);
    return firefoxArguments;
  }

  override readyState(options: types.LaunchOptions): BrowserReadyState | undefined {
    assert(options.useWebSocket);
    return new FirefoxReadyState();
  }
}

class FirefoxReadyState extends BrowserReadyState {
  override onBrowserOutput(message: string): void {
    // Bidi WebSocket in Firefox.
    const match = message.match(/WebDriver BiDi listening on (ws:\/\/.*)$/);
    if (match)
      this._wsEndpoint.resolve(match[1] + '/session');
  }
}
