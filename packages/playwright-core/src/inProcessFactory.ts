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

import { AndroidServerLauncherImpl } from './androidServerImpl';
import { BrowserServerLauncherImpl } from './browserServerImpl';
import { DispatcherConnection, PlaywrightDispatcher, RootDispatcher, createPlaywright } from './server';
import { nodePlatform } from './server/utils/nodePlatform';
import { Connection } from './client/connection';
import { BrowserDispatcher } from './server/dispatchers/browserDispatcher';
import { ProgressController } from './server/progress';

import type { Browser } from './client/browser';
import type { BrowserContext } from './client/browserContext';
import type { Playwright as PlaywrightAPI } from './client/playwright';
import type { Chromium } from './server/chromium/chromium';
import type { BrowserTypeDispatcher } from './server/dispatchers/browserTypeDispatcher';
import type { ConnectionTransport } from './server/transport';
import type { Language } from './utils';

export function createInProcessPlaywright(): PlaywrightAPI {
  const playwright = createPlaywright({ sdkLanguage: (process.env.PW_LANG_NAME as Language | undefined) || 'javascript' });
  const clientConnection = new Connection(nodePlatform);
  clientConnection.useRawBuffers();
  const dispatcherConnection = new DispatcherConnection(true /* local */);

  // Dispatch synchronously at first.
  dispatcherConnection.onmessage = message => clientConnection.dispatch(message);
  clientConnection.onmessage = message => dispatcherConnection.dispatch(message);

  const rootScope = new RootDispatcher(dispatcherConnection);

  // Initialize Playwright channel.
  new PlaywrightDispatcher(rootScope, playwright);
  const playwrightAPI = clientConnection.getObjectWithKnownName('Playwright') as PlaywrightAPI;
  playwrightAPI.chromium._serverLauncher = new BrowserServerLauncherImpl('chromium');
  playwrightAPI.firefox._serverLauncher = new BrowserServerLauncherImpl('firefox');
  playwrightAPI.webkit._serverLauncher = new BrowserServerLauncherImpl('webkit');
  playwrightAPI._android._serverLauncher = new AndroidServerLauncherImpl();

  (playwrightAPI.chromium as any)._connectOverCDPTransport = async (transport: ConnectionTransport) => {
    const serverChromium = clientConnection.toImpl!(playwrightAPI.chromium) as Chromium;
    const chromiumDispatcher = dispatcherConnection._dispatcherByGuid.get(playwrightAPI.chromium._guid)! as BrowserTypeDispatcher;
    const controller = new ProgressController();
    const browser = await controller.run(async progress => {
      return await serverChromium.connectOverCDPTransport(progress, transport);
    });
    const browserDispatcher = new BrowserDispatcher(chromiumDispatcher, browser);
    // Wait for async dispatch to process the __create__ message.
    await new Promise(resolve => setImmediate(resolve));
    const clientBrowser = clientConnection._objects.get(browserDispatcher._guid)! as Browser;
    clientBrowser._connectToBrowserType(playwrightAPI.chromium, {}, undefined);
    if (browser._defaultContext) {
      // BrowserDispatcher pushes default context to the client in its constructor.
      const clientBrowserContext = clientConnection._objects.get(browser._defaultContext.guid)! as BrowserContext;
      await playwrightAPI.chromium._instrumentation.runAfterCreateBrowserContext(clientBrowserContext);
    }
    return clientBrowser;
  };

  // Switch to async dispatch after we got Playwright object.
  dispatcherConnection.onmessage = message => setImmediate(() => clientConnection.dispatch(message));
  clientConnection.onmessage = message => setImmediate(() => dispatcherConnection.dispatch(message));

  clientConnection.toImpl = x => {
    if (x instanceof Connection)
      return x === clientConnection ? dispatcherConnection : undefined;
    if (!x)
      return dispatcherConnection._dispatcherByGuid.get('');
    return dispatcherConnection._dispatcherByGuid.get(x._guid)!._object;
  };
  return playwrightAPI;
}
