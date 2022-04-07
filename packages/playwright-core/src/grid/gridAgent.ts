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

import debug from 'debug';
import WebSocket from 'ws';
import { fork } from 'child_process';
import { getPlaywrightVersion } from '../utils';

export function launchGridAgent(agentId: string, gridURL: string) {
  const log = debug(`pw:grid:agent:${agentId}`);
  log('created');
  const params = new URLSearchParams();
  params.set('pwVersion', getPlaywrightVersion(true /* majorMinorOnly */));
  params.set('agentId', agentId);
  const ws = new WebSocket(gridURL.replace('http://', 'ws://') + `/registerAgent?` + params.toString());
  ws.on('message', (message: string) => {
    log('worker requested ' + message);
    const { workerId, browserAlias } = JSON.parse(message);
    if (browserAlias)
      fork(require.resolve('./gridBrowserWorker.js'), [gridURL, agentId, workerId, browserAlias], { detached: true });
    else
      fork(require.resolve('./gridWorker.js'), [gridURL, agentId, workerId], { detached: true });
  });
  ws.on('close', () => process.exit(0));
}
