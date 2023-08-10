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

  constructor(readonly grid: string, readonly capacity: number, readonly accessKey?: string) {
    this.accessKey = accessKey || '';
    log('node created', accessKey);
  }

  async connect() {
    const wsGrid = this.grid;
    const url = wsGrid + `/registerNode?capacity=${this.capacity}&caps=${JSON.stringify(caps)}`;

    for (let i = 0; i < 5; ++i) {
      const ws = await this._connect(url);
      if (ws) {
        this._wire(ws, wsGrid);
        return;
      }
      await new Promise(f => setTimeout(f, 5000));
    }

    // eslint-disable-next-line no-restricted-properties
    process.exit(0);
  }

  private async _connect(url: string): Promise<WebSocket | null> {
    return await new Promise(resolve => {
      log('connecting', url);
      const ws = new WebSocket(url, {
        headers: {
          'x-playwright-access-key': this.accessKey,
        }
      });
      ws.on('error', error => {
        log(error);
        resolve(null);
      });
      ws.on('open', () => {
        log('connected', this.grid);
        resolve(ws);
      });
    });
  }

  private _wire(ws: WebSocket, wsGrid: string) {
    ws.on('close', () => {
      // eslint-disable-next-line no-restricted-properties
      process.exit(0);
    });
    ws.on('error', () => {
      // eslint-disable-next-line no-restricted-properties
      process.exit(0);
    });
    let nodeId = '';
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
          PLAYWRIGHT_GRID_ENDPOINT: wsGrid,
          PLAYWRIGHT_GRID_ACCESS_KEY: this.accessKey,
        },
        detached: true
      });
    });
  }
}
