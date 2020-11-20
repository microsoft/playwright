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

import * as debug from 'debug';
import * as http from 'http';
import * as WebSocket from 'ws';
import { installDebugController } from '../debug/debugController';
import { DispatcherConnection } from '../dispatchers/dispatcher';
import { PlaywrightDispatcher } from '../dispatchers/playwrightDispatcher';
import { Electron } from '../server/electron/electron';
import { Playwright } from '../server/playwright';
import { gracefullyCloseAll } from '../server/processLauncher';
import { installTracer } from '../trace/tracer';
import { installHarTracer } from '../trace/harTracer';

const debugLog = debug('pw:server');

installDebugController();
installTracer();
installHarTracer();

export class PlaywrightServer {
  private _server: http.Server | undefined;
  private _client: WebSocket | undefined;

  listen(port: number) {
    this._server = http.createServer((request, response) => {
      response.end('Running');
    });
    this._server.on('error', error => debugLog(error));
    this._server.listen(port);
    debugLog('Listening on ' + port);

    const wsServer = new WebSocket.Server({ server: this._server, path: '/ws' });
    wsServer.on('connection', async ws => {
      if (this._client) {
        ws.close();
        return;
      }
      this._client = ws;
      debugLog('Incoming connection');
      const dispatcherConnection = new DispatcherConnection();
      ws.on('message', message => dispatcherConnection.dispatch(JSON.parse(message.toString())));
      ws.on('close', () => {
        debugLog('Client closed');
        this._onDisconnect();
      });
      ws.on('error', error => {
        debugLog('Client error ' + error);
        this._onDisconnect();
      });
      dispatcherConnection.onmessage = message => ws.send(JSON.stringify(message));
      const playwright = new Playwright(__dirname, require('../../browsers.json')['browsers']);
      (playwright as any).electron = new Electron();
      new PlaywrightDispatcher(dispatcherConnection.rootDispatcher(), playwright);
    });
  }

  async close() {
    if (!this._server)
      return;
    debugLog('Closing server');
    await new Promise(f => this._server!.close(f));
    await gracefullyCloseAll();
  }

  private async _onDisconnect() {
    await gracefullyCloseAll();
    this._client = undefined;
  }
}
