/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { LaunchServerOptions, Logger } from './client/types';
import { ws } from './utilsBundle';
import type { WebSocketEventEmitter } from './utilsBundle';
import type { BrowserServerLauncher, BrowserServer } from './client/browserType';
import { envObjectToArray } from './client/clientHelper';
import { createGuid } from './utils';
import type { ProtocolLogger } from './server/types';
import { serverSideCallMetadata } from './server/instrumentation';
import { createPlaywright } from './server/playwright';
import { PlaywrightServer } from './remote/playwrightServer';
import { helper } from './server/helper';
import { rewriteErrorMessage } from './utils/stackTrace';

export class BrowserServerLauncherImpl implements BrowserServerLauncher {
  private _browserName: 'chromium' | 'firefox' | 'webkit';

  constructor(browserName: 'chromium' | 'firefox' | 'webkit') {
    this._browserName = browserName;
  }

  async launchServer(options: LaunchServerOptions = {}): Promise<BrowserServer> {
    const playwright = createPlaywright('javascript');
    // 1. Pre-launch the browser
    const metadata = serverSideCallMetadata();
    const browser = await playwright[this._browserName].launch(metadata, {
      ...options,
      ignoreDefaultArgs: Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : undefined,
      ignoreAllDefaultArgs: !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs),
      env: options.env ? envObjectToArray(options.env) : undefined,
    }, toProtocolLogger(options.logger)).catch(e => {
      const log = helper.formatBrowserLogs(metadata.log);
      rewriteErrorMessage(e, `${e.message} Failed to launch browser.${log}`);
      throw e;
    });

    let path = `/${createGuid()}`;
    if (options.wsPath)
      path = options.wsPath.startsWith('/') ? options.wsPath : `/${options.wsPath}`;

    // 2. Start the server
    const server = new PlaywrightServer(path, Infinity, false, browser);
    const wsEndpoint = await server.listen(options.port);

    // 3. Return the BrowserServer interface
    const browserServer = new ws.EventEmitter() as (BrowserServer & WebSocketEventEmitter);
    browserServer.process = () => browser.options.browserProcess.process!;
    browserServer.wsEndpoint = () => wsEndpoint;
    browserServer.close = () => browser.options.browserProcess.close();
    browserServer.kill = () => browser.options.browserProcess.kill();
    (browserServer as any)._disconnectForTest = () => server.close();
    (browserServer as any)._userDataDirForTest = (browser as any)._userDataDirForTest;
    browser.options.browserProcess.onclose = async (exitCode, signal) => {
      server.close();
      browserServer.emit('close', exitCode, signal);
    };
    return browserServer;
  }
}

function toProtocolLogger(logger: Logger | undefined): ProtocolLogger | undefined {
  return logger ? (direction: 'send' | 'receive', message: object) => {
    if (logger.isEnabled('protocol', 'verbose'))
      logger.log('protocol', 'verbose', (direction === 'send' ? 'SEND ► ' : '◀ RECV ') + JSON.stringify(message), [], {});
  } : undefined;
}
