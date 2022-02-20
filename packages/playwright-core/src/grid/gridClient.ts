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
import { Connection } from '../client/connection';
import { Playwright } from '../client/playwright';
import { getPlaywrightVersion } from '../utils/utils';

export class GridClient {
  private _ws: WebSocket;
  private _playwright: Playwright;

  static async connect(gridURL: string) {
    const params = new URLSearchParams();
    params.set('pwVersion', getPlaywrightVersion(true /* majorMinorOnly */));
    const ws = new WebSocket(`${gridURL}/claimWorker?` + params.toString());
    const errorText = await Promise.race([
      new Promise((f) => ws.once('message', () => f(undefined))),
      new Promise((f) => ws.once('close', (code, reason) => f(reason))),
    ]);
    if (errorText) throw errorText;
    const connection = new Connection();
    connection.markAsRemote();
    connection.onmessage = (message: Object) => ws.send(JSON.stringify(message));
    ws.on('message', (message) => connection.dispatch(JSON.parse(message.toString())));
    ws.on('close', (code, reason) => connection.close(reason.toString()));
    const playwright = await connection.initializePlaywright();
    playwright._enablePortForwarding();
    return new GridClient(ws, playwright);
  }

  constructor(ws: WebSocket, playwright: Playwright) {
    this._ws = ws;
    this._playwright = playwright;
  }

  playwright(): Playwright {
    return this._playwright;
  }

  close() {
    this._ws.close();
  }
}
