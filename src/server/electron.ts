/**
 * Copyright (c) Microsoft Corporation.
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
import { BrowserContext } from '../browserContext';
import { CRBrowser } from '../chromium/crBrowser';
import { CRConnection } from '../chromium/crConnection';
import { TimeoutError } from '../errors';
import { Events } from '../events';
import { assert, helper } from '../helper';
import { RootLogger } from '../logger';
import { WebSocketTransport } from '../transport';
import { BrowserServer } from './browserServer';
import { LaunchOptions } from './browserType';
import { launchProcess, waitForLine } from './processLauncher';

export class Electron  {
  async launch(options: LaunchOptions): Promise<BrowserContext> {
    const {
      args = [],
      executablePath = null,
      env = process.env,
      handleSIGINT = true,
      handleSIGTERM = true,
      handleSIGHUP = true,
      timeout = 30000,
    } = options;

    if (!executablePath)
      throw new Error(`No executable path is specified. Pass "executablePath" option directly.`);

    const logger = new RootLogger(options.logger);
    const electronArguments = ['--inspect=0', '--remote-debugging-port=0', '--require', path.join(__dirname, 'electronLoader.js'), ...args];
    const { launchedProcess, gracefullyClose } = await launchProcess({
      executablePath,
      args: electronArguments,
      env,
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      logger,
      pipe: true,
      attemptToGracefullyClose: async () => {
        assert(browserServer);
        // We try to gracefully close to prevent crash reporting and core dumps.
        // Note that it's fine to reuse the pipe transport, since
        // our connection ignores kBrowserCloseMessageId.
        await nodeConnection!.rootSession.send('Runtime.evaluate', { expression: 'process._playwright_app_.quit()' });
        nodeConnection!.close();
      },
      onkill: (exitCode, signal) => {
        if (browserServer)
          browserServer.emit(Events.BrowserServer.Close, exitCode, signal);
      },
    });

    let nodeConnection: CRConnection | undefined;
    let browserServer: BrowserServer | undefined = undefined;

    const timeoutError = new TimeoutError(`Timed out after ${timeout} ms while trying to connect to Electron!`);
    {
      const match = await waitForLine(launchedProcess, launchedProcess.stderr, /^Debugger listening on (ws:\/\/.*)$/, timeout, timeoutError);
      nodeConnection = await WebSocketTransport.connect(match[1], transport => {
        return new CRConnection(transport, logger);
      });
      await nodeConnection.rootSession.send('Runtime.evaluate', { expression: 'process._playwright_initialized_flag_ = true; if (process._playwright_initialized_) process._playwright_initialized_(); 0' });
    }

    const match = await waitForLine(launchedProcess, launchedProcess.stderr, /^DevTools listening on (ws:\/\/.*)$/, timeout, timeoutError);
    const chromeTransport = await WebSocketTransport.connect(match[1], transport => {
      return transport;
    });
    browserServer = new BrowserServer(launchedProcess, gracefullyClose, null);
    const browser = await CRBrowser.connect(chromeTransport, true, logger, options);
    browser._ownedServer = browserServer;
    await helper.waitWithTimeout(browser._firstPagePromise, 'first page', timeout);
    return browser._defaultContext!;
  }
}
