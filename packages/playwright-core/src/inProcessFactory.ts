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

import * as path from 'path';
import { EventEmitter } from 'events';

import { AndroidServerLauncherImpl } from './androidServerImpl';
import { BrowserServerLauncherImpl } from './browserServerImpl';
import { Connection } from './client/connection';
import { DispatcherConnection, PlaywrightDispatcher, RootDispatcher, createPlaywright } from './server';
import { setLibraryStackPrefix } from './utils/isomorphic/stackTrace';
import { setDebugMode } from './utils/isomorphic/debug';
import { getFromENV } from './server/utils/env';
import { nodePlatform } from './server/utils/nodePlatform';
import { setPlatformForSelectors } from './client/selectors';
import { setDefaultMaxListenersProvider } from './client/eventEmitter';

import type { Playwright as PlaywrightAPI } from './client/playwright';
import type { Language } from './utils';
import type { Platform } from './common/platform';


export function createInProcessPlaywright(platform: Platform): PlaywrightAPI {
  const playwright = createPlaywright({ sdkLanguage: (process.env.PW_LANG_NAME as Language | undefined) || 'javascript' });
  setDebugMode(getFromENV('PWDEBUG') || '');
  setPlatformForSelectors(nodePlatform);
  setDefaultMaxListenersProvider(() => EventEmitter.defaultMaxListeners);

  setLibraryStackPrefix(path.join(__dirname, '..'));

  const clientConnection = new Connection(undefined, platform, undefined, []);
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
  playwrightAPI._bidiChromium._serverLauncher = new BrowserServerLauncherImpl('bidiChromium');
  playwrightAPI._bidiFirefox._serverLauncher = new BrowserServerLauncherImpl('bidiFirefox');

  // Switch to async dispatch after we got Playwright object.
  dispatcherConnection.onmessage = message => setImmediate(() => clientConnection.dispatch(message));
  clientConnection.onmessage = message => setImmediate(() => dispatcherConnection.dispatch(message));

  clientConnection.toImpl = (x: any) => x ? dispatcherConnection._dispatchers.get(x._guid)!._object : dispatcherConnection._dispatchers.get('');
  (playwrightAPI as any)._toImpl = clientConnection.toImpl;
  return playwrightAPI;
}
