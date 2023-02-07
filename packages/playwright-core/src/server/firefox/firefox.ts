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

import * as os from 'os';
import fs from 'fs';
import path from 'path';
import { FFBrowser } from './ffBrowser';
import { kBrowserCloseMessageId } from './ffConnection';
import { BrowserType, kNoXServerRunningError } from '../browserType';
import type { Env } from '../../utils/processLauncher';
import type { ConnectionTransport } from '../transport';
import type { BrowserOptions, PlaywrightOptions } from '../browser';
import type * as types from '../types';
import { rewriteErrorMessage } from '../../utils/stackTrace';
import { getAsBooleanFromENV, wrapInASCIIBox } from '../../utils';

export class Firefox extends BrowserType {
  constructor(playwrightOptions: PlaywrightOptions) {
    super('firefox', playwrightOptions);
  }

  _connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<FFBrowser> {
    return FFBrowser.connect(transport, options);
  }

  _rewriteStartupError(error: Error): Error {
    if (error.message.includes('no DISPLAY environment variable specified'))
      return rewriteErrorMessage(error, '\n' + wrapInASCIIBox(kNoXServerRunningError, 1));
    return error;
  }

  _amendEnvironment(env: Env, userDataDir: string, executable: string, browserArguments: string[]): Env {
    if (!path.isAbsolute(os.homedir()))
      throw new Error(`Cannot launch Firefox with relative home directory. Did you set ${os.platform() === 'win32' ? 'USERPROFILE' : 'HOME'} to a relative path?`);
    if (os.platform() === 'linux') {
      // Always remove SNAP_NAME and SNAP_INSTANCE_NAME env variables since they
      // confuse Firefox: in our case, builds never come from SNAP.
      // See https://github.com/microsoft/playwright/issues/20555
      return { ...env, SNAP_NAME: undefined, SNAP_INSTANCE_NAME: undefined };
    }
    return env;
  }

  _attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void {
    const message = { method: 'Browser.close', params: {}, id: kBrowserCloseMessageId };
    transport.send(message);
  }

  _defaultArgs(options: types.LaunchOptions, isPersistent: boolean, userDataDir: string): string[] {
    const { args = [], headless } = options;
    const userDataDirArg = args.find(arg => arg.startsWith('-profile') || arg.startsWith('--profile'));
    if (userDataDirArg)
      throw new Error('Pass userDataDir parameter to `browserType.launchPersistentContext(userDataDir, ...)` instead of specifying --profile argument');
    if (args.find(arg => arg.startsWith('-juggler')))
      throw new Error('Use the port parameter instead of -juggler argument');
    let firefoxUserPrefs = isPersistent ? undefined : options.firefoxUserPrefs;
    if (getAsBooleanFromENV('PLAYWRIGHT_DISABLE_FIREFOX_CROSS_PROCESS'))
      firefoxUserPrefs = { ...kDisableFissionFirefoxUserPrefs, ...firefoxUserPrefs };
    if (Object.keys(kBandaidFirefoxUserPrefs).length)
      firefoxUserPrefs = { ...kBandaidFirefoxUserPrefs, ...firefoxUserPrefs };
    if (firefoxUserPrefs) {
      const lines: string[] = [];
      for (const [name, value] of Object.entries(firefoxUserPrefs))
        lines.push(`user_pref(${JSON.stringify(name)}, ${JSON.stringify(value)});`);
      fs.writeFileSync(path.join(userDataDir, 'user.js'), lines.join('\n'));
    }
    const firefoxArguments = ['-no-remote'];
    if (headless) {
      firefoxArguments.push('-headless');
    } else {
      firefoxArguments.push('-wait-for-browser');
      firefoxArguments.push('-foreground');
    }
    firefoxArguments.push(`-profile`, userDataDir);
    firefoxArguments.push('-juggler-pipe');
    firefoxArguments.push(...args);
    if (isPersistent)
      firefoxArguments.push('about:blank');
    else
      firefoxArguments.push('-silent');
    return firefoxArguments;
  }
}

// Prefs for quick fixes that didn't make it to the build.
// Should all be moved to `playwright.cfg`.
const kBandaidFirefoxUserPrefs = {};

const kDisableFissionFirefoxUserPrefs = {
  'browser.tabs.remote.useCrossOriginEmbedderPolicy': false,
  'browser.tabs.remote.useCrossOriginOpenerPolicy': false,
  'browser.tabs.remote.separatePrivilegedMozillaWebContentProcess': false,
  'fission.autostart': false,
  'browser.tabs.remote.systemTriggeredAboutBlankAnywhere': true,
};
