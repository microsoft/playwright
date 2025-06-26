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

import { PlaywrightServer } from './remote/playwrightServer';
import { helper } from './server/helper';
import { serverSideCallMetadata } from './server/instrumentation';
import { createPlaywright } from './server/playwright';
import { createGuid } from './server/utils/crypto';
import { isUnderTest } from './server/utils/debug';
import { rewriteErrorMessage } from './utils/isomorphic/stackTrace';
import { DEFAULT_PLAYWRIGHT_LAUNCH_TIMEOUT } from './utils/isomorphic/time';
import { ws } from './utilsBundle';
import * as validatorPrimitives from './protocol/validatorPrimitives';
import { ProgressController } from './server/progress';

import type { BrowserServer, BrowserServerLauncher } from './client/browserType';
import type { LaunchServerOptions, Logger, Env } from './client/types';
import type { ProtocolLogger } from './server/types';
import type { WebSocketEventEmitter } from './utilsBundle';
import type { Browser } from './server/browser';

export class BrowserServerLauncherImpl implements BrowserServerLauncher {
  private _browserName: 'chromium' | 'firefox' | 'webkit' | '_bidiFirefox' | '_bidiChromium';

  constructor(browserName: 'chromium' | 'firefox' | 'webkit' | '_bidiFirefox' | '_bidiChromium') {
    this._browserName = browserName;
  }

  async launchServer(options: LaunchServerOptions & { _sharedBrowser?: boolean, _userDataDir?: string } = {}): Promise<BrowserServer> {
    const playwright = createPlaywright({ sdkLanguage: 'javascript', isServer: true });
    // 1. Pre-launch the browser
    const metadata = serverSideCallMetadata();
    const validatorContext = {
      tChannelImpl: (names: '*' | string[], arg: any, path: string) => {
        throw new validatorPrimitives.ValidationError(`${path}: channels are not expected in launchServer`);
      },
      binary: 'buffer',
      isUnderTest,
    } satisfies validatorPrimitives.ValidatorContext;
    let launchOptions = {
      ...options,
      ignoreDefaultArgs: Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : undefined,
      ignoreAllDefaultArgs: !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs),
      env: options.env ? envObjectToArray(options.env) : undefined,
      timeout: options.timeout ?? DEFAULT_PLAYWRIGHT_LAUNCH_TIMEOUT,
    };

    let browser: Browser;
    try {
      const controller = new ProgressController(metadata, playwright[this._browserName]);
      browser = await controller.run(async progress => {
        if (options._userDataDir !== undefined) {
          const validator = validatorPrimitives.scheme['BrowserTypeLaunchPersistentContextParams'];
          launchOptions = validator({ ...launchOptions, userDataDir: options._userDataDir }, '', validatorContext);
          const context = await playwright[this._browserName].launchPersistentContext(progress, options._userDataDir, launchOptions);
          return context._browser;
        } else {
          const validator = validatorPrimitives.scheme['BrowserTypeLaunchParams'];
          launchOptions = validator(launchOptions, '', validatorContext);
          return await playwright[this._browserName].launch(progress, launchOptions, toProtocolLogger(options.logger));
        }
      });
    } catch (e) {
      const log = helper.formatBrowserLogs(metadata.log);
      rewriteErrorMessage(e, `${e.message} Failed to launch browser.${log}`);
      throw e;
    }

    const path = options.wsPath ? (options.wsPath.startsWith('/') ? options.wsPath : `/${options.wsPath}`) : `/${createGuid()}`;

    // 2. Start the server
    const server = new PlaywrightServer({ mode: options._sharedBrowser ? 'launchServerShared' : 'launchServer', path, maxConnections: Infinity, preLaunchedBrowser: browser });
    const wsEndpoint = await server.listen(options.port, options.host);

    // 3. Return the BrowserServer interface
    const browserServer = new ws.EventEmitter() as (BrowserServer & WebSocketEventEmitter);
    browserServer.process = () => browser.options.browserProcess.process!;
    browserServer.wsEndpoint = () => wsEndpoint;
    browserServer.close = () => browser.options.browserProcess.close();
    browserServer[Symbol.asyncDispose] = browserServer.close;
    browserServer.kill = () => browser.options.browserProcess.kill();
    (browserServer as any)._disconnectForTest = () => server.close();
    (browserServer as any)._userDataDirForTest = (browser as any)._userDataDirForTest;
    browser.options.browserProcess.onclose = (exitCode, signal) => {
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

function envObjectToArray(env: Env): { name: string, value: string }[] {
  const result: { name: string, value: string }[] = [];
  for (const name in env) {
    if (!Object.is(env[name], undefined))
      result.push({ name, value: String(env[name]) });
  }
  return result;
}
