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

import { debug } from '../utilsBundle';
import { ws as WebSocket } from '../utilsBundle';
import { PlaywrightConnection } from '../remote/playwrightConnection';
import { gracefullyCloseAll } from '../utils/processLauncher';

function launchGridBrowserWorker(gridURL: string, agentId: string, workerId: string, browserAlias: string) {
  const log = debug(`pw:grid:worker:${workerId}`);
  log('created');
  const ws = new WebSocket(gridURL.replace('http://', 'ws://') + `/registerWorker?agentId=${agentId}&workerId=${workerId}`);
  new PlaywrightConnection(ws, true, browserAlias, true, undefined, log, async () => {
    log('exiting process');
    setTimeout(() => process.exit(0), 30000);
    // Meanwhile, try to gracefully close all browsers.
    await gracefullyCloseAll();
    process.exit(0);
  });
}

launchGridBrowserWorker(process.argv[2], process.argv[3], process.argv[4], process.argv[5]);
