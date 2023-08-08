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
import child_process from 'child_process';
import debug from 'debug';
import type { Capabilities } from '../common/capabilities';

const log = debug('pw:grid:node');

const caps: Capabilities = {
  platform: process.platform,
};

export class Node {
  workerSeq = 0;

  constructor(grid: string, capacity: number, accessKey: string) {
    log('node created');
    const ws = new WebSocket(grid + `/registerNode?capacity=${capacity}&caps=${JSON.stringify(caps)}`, {
      headers: {
        'x-playwright-access-key': accessKey,
      }
    });
    let nodeId = '';
    ws.on('error', error => {
      log(error);
      // eslint-disable-next-line no-restricted-properties
      process.exit(0);
    });
    ws.on('message', data => {
      const text = data.toString();
      const message = JSON.parse(text);
      if (message.nodeId) {
        nodeId = message.nodeId;
        log('node id', nodeId);
        return;
      }
      const workerId = message.workerId;
      log('worked requested', workerId);
      child_process.fork(require.resolve('./worker.js'), {
        env: {
          ...process.env,
          PLAYWRIGHT_GRID_NODE_ID: nodeId,
          PLAYWRIGHT_GRID_WORKER_ID: workerId,
          PLAYWRIGHT_GRID_ENDPOINT: grid,
          PLAYWRIGHT_GRID_ACCESS_KEY: accessKey,
        },
        detached: true
      });
    });
    // eslint-disable-next-line no-restricted-properties
    ws.on('close', () => process.exit(0));
  }
}
