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

import type { Playwright as PlaywrightAPI } from './client/playwright';
import { createPlaywright, DispatcherConnection, RootDispatcher, PlaywrightDispatcher } from './server';
import { Connection } from './client/connection';
import { BrowserServerLauncherImpl } from './browserServerImpl';
import { AndroidServerLauncherImpl } from './androidServerImpl';
import type { Language } from './utils';

export function createInProcessPlaywright(): PlaywrightAPI {
  const playwright = createPlaywright({ sdkLanguage: (process.env.PW_LANG_NAME as Language | undefined) || 'javascript' });

  const clientConnection = new Connection(undefined, undefined);
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

  // Switch to async dispatch after we got Playwright object.
  dispatcherConnection.onmessage = message => setImmediate(() => clientConnection.dispatch(message));
  clientConnection.onmessage = message => setImmediate(() => dispatcherConnection.dispatch(message));

  clientConnection.toImpl = (x: any) => x ? dispatcherConnection._dispatchers.get(x._guid)!._object : dispatcherConnection._dispatchers.get('');
  (playwrightAPI as any)._toImpl = clientConnection.toImpl;
  return playwrightAPI;
}
