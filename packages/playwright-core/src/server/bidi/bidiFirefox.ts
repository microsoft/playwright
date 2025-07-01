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

import { wrapInASCIIBox } from '../utils/ascii';
import { BrowserType, kNoXServerRunningError } from '../browserType';
import { BidiBrowser } from './bidiBrowser';
import { kBrowserCloseMessageId } from './bidiConnection';
import { createProfile } from './third_party/firefoxPrefs';
import { ManualPromise } from '../../utils/isomorphic/manualPromise';

import type { BrowserOptions } from '../browser';
import type { SdkObject } from '../instrumentation';
import type { Env } from '../utils/processLauncher';
import type { ProtocolError } from '../protocolError';
import type { ConnectionTransport } from '../transport';
import type * as types from '../types';
import type { RecentLogsCollector } from '../utils/debugLogger';


export class BidiFirefox extends BrowserType {
  constructor(parent: SdkObject) {
    super(parent, '_bidiFirefox');
  }

  override executablePath(): string {
    return '';
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

  override amendEnvironment(env: Env): Env {
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

  override supportsPipeTransport(): boolean {
    return false;
  }

  override async prepareUserDataDir(options: types.LaunchOptions, userDataDir: string): Promise<void> {
    await createProfile({
      path: userDataDir,
      preferences: options.firefoxUserPrefs || {},
    });
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

  override async waitForReadyState(options: types.LaunchOptions, browserLogsCollector: RecentLogsCollector): Promise<{ wsEndpoint?: string }> {
    const result = new ManualPromise<{ wsEndpoint?: string }>();
    browserLogsCollector.onMessage(message => {
      const match = message.match(/WebDriver BiDi listening on (ws:\/\/.*)$/);
      if (match)
        result.resolve({ wsEndpoint: match[1] + '/session' });
    });
    return result;
  }
}
