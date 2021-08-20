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

const gridProxy = process.env.PWGRID_PROXY;
const gridRepo = process.env.PWGRID_REPO;
const gridAccessToken = process.env.PWGRID_ACCESS_TOKEN;

export class GhaGridClient {
  private _ws: WebSocket | undefined;

  async connect(): Promise<Playwright> {
    this._ws = new WebSocket(gridProxy + `/claimWorker?access_token=${gridAccessToken}&repo=${gridRepo}`);
    await new Promise(f => this._ws!.once('message', f));

    const connection = new Connection();
    connection.onmessage = message => this._ws!.send(JSON.stringify(message));
    this._ws!.on('message', message => connection.dispatch(JSON.parse(message.toString())));

    const playwright = await connection.initializePlaywright();
    playwright._enablePortForwarding();
    return playwright;
  }

  disconnect() {
    this._ws!.close();
  }
}
