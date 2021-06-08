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
import { assert } from '../../utils/utils';
import { FFBrowser } from './ffBrowser';
import { kBrowserCloseMessageId } from './ffConnection';
import { BrowserType } from '../browserType';
import { Env } from '../processLauncher';
import { ConnectionTransport } from '../transport';
import { BrowserOptions, PlaywrightOptions } from '../browser';
import * as types from '../types';

export class Firefox extends BrowserType {
  constructor(playwrightOptions: PlaywrightOptions) {
    super('firefox', playwrightOptions);
  }

  executablePath(channel?: string): string {
    if (channel) {
      let executablePath = undefined;
      if ((channel as any) === 'firefox-beta')
        executablePath = this._registry.executablePath('firefox-beta');
      assert(executablePath, `unsupported firefox channel "${channel}"`);
      assert(fs.existsSync(executablePath), `"${channel}" channel is not installed. Try running 'npx playwright install ${channel}'`);
      return executablePath;
    }
    return super.executablePath(channel);
  }

  _connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<FFBrowser> {
    return FFBrowser.connect(transport, options);
  }

  _rewriteStartupError(error: Error): Error {
    return error;
  }

  _amendEnvironment(env: Env, userDataDir: string, executable: string, browserArguments: string[]): Env {
    if (!path.isAbsolute(os.homedir()))
      throw new Error(`Cannot launch Firefox with relative home directory. Did you set ${os.platform() === 'win32' ? 'USERPROFILE' : 'HOME'} to a relative path?`);
    if (os.platform() === 'linux') {
      return {
        ...env,
        // On linux Juggler ships the libstdc++ it was linked against.
        LD_LIBRARY_PATH: `${path.dirname(executable)}:${process.env.LD_LIBRARY_PATH}`,
      };
    }
    if (os.platform() === 'darwin') {
      return {
        ...env,
        // @see https://github.com/microsoft/playwright/issues/5721
        MOZ_WEBRENDER: 0,
      };
    }
    return env;
  }

  _attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void {
    const message = { method: 'Browser.close', params: {}, id: kBrowserCloseMessageId };
    transport.send(message);
  }

  _defaultArgs(options: types.LaunchOptions, isPersistent: boolean, userDataDir: string): string[] {
    const { args = [], devtools, headless } = options;
    if (devtools)
      console.warn('devtools parameter is not supported as a launch argument in Firefox. You can launch the devtools window manually.');
    const userDataDirArg = args.find(arg => arg.startsWith('-profile') || arg.startsWith('--profile'));
    if (userDataDirArg)
      throw new Error('Pass userDataDir parameter to `browserType.launchPersistentContext(userDataDir, ...)` instead of specifying --profile argument');
    if (args.find(arg => arg.startsWith('-juggler')))
      throw new Error('Use the port parameter instead of -juggler argument');
    const firefoxUserPrefs = isPersistent ? undefined : options.firefoxUserPrefs;
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
