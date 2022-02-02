/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
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

import WebSocket from 'ws';
import debug from 'debug';
import { DispatcherConnection, Root } from '../dispatchers/dispatcher';
import { PlaywrightDispatcher } from '../dispatchers/playwrightDispatcher';
import { createPlaywright } from '../server/playwright';
import { gracefullyCloseAll } from '../utils/processLauncher';

function launchGridWorker(gridURL: string, agentId: string, workerId: string) {
  const log = debug(`pw:grid:worker${workerId}`);
  log('created');
  const ws = new WebSocket(gridURL.replace('http://', 'ws://') + `/registerWorker?agentId=${agentId}&workerId=${workerId}`);
  const dispatcherConnection = new DispatcherConnection();
  dispatcherConnection.onmessage = message => ws.send(JSON.stringify(message));
  ws.once('open', () => {
    new Root(dispatcherConnection, async rootScope => {
      const playwright = createPlaywright('javascript');
      const dispatcher = new PlaywrightDispatcher(rootScope, playwright);
      dispatcher.enableSocksProxy();
      return dispatcher;
    });
  });
  ws.on('message', message => dispatcherConnection.dispatch(JSON.parse(message.toString())));
  ws.on('close', async () => {
    // Drop any messages during shutdown on the floor.
    dispatcherConnection.onmessage = () => {};
    setTimeout(() => process.exit(0), 30000);
    // Meanwhile, try to gracefully close all browsers.
    await gracefullyCloseAll();
    process.exit(0);
  });
}

launchGridWorker(process.argv[2], process.argv[3], process.argv[4]);
