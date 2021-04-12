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
import * as http from 'http';
import WebSocket from 'ws';
import { DispatcherConnection } from '../dispatchers/dispatcher';
import { PlaywrightDispatcher } from '../dispatchers/playwrightDispatcher';
import { createPlaywright } from '../server/playwright';
import { gracefullyCloseAll } from '../server/processLauncher';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { PassThrough } from 'stream';
import { v1 as uuidv1 } from 'uuid';

const debugLog = debug('pw:server');
const tunnelPort = 5000;

const delay = (ms:any)  => new Promise(res => setTimeout(res, ms));

export class PlaywrightServer {
  private _server: http.Server | undefined;
  private _client: WebSocket | undefined;
  private _responseObject: { [id: string] : any } = {};

  private _tunnelServer: http.Server | undefined;

  listen(port: number) {

    this._tunnelServer = createServer(async (request: IncomingMessage, response: ServerResponse) => {
      console.log("received request to make a request");
      const chunks: any = [];
      request.on('data', (chunk) => {
        chunks.push(chunk);
      });
      let requestId: string = uuidv1();

      request.on('end', () => {
        const result = Buffer.concat(chunks);
        // TODO: test if buffer can be converted to JSON
        // TODO: test the request response parsing locally

        let requestBody = result;
        let method = request.method;
        let url = "http://localhost:1234/";
        let headers = request.headers;
      
        let httpRequestObject = {
          headers: headers,
          url: url,
          method: method,
          requestBody: requestBody,
          requestId: requestId
        }
        console.log("DEBUG::: Received request message : " + JSON.stringify(httpRequestObject));
        this._client?.send(JSON.stringify({"httpResponse": httpRequestObject, "playwright": null}));
      });

      while (this._responseObject[requestId] == null) {
        console.log("waiting for the response .... ");
        await delay(10);
      }

      response.end(this._responseObject[requestId]);
      
      delete this._responseObject[requestId];
    });

    this._tunnelServer.listen(port, (error: any) => {
      if (error) {
        console.log(error);
      } else {
        console.log(`Tunnel  Server listening  on     port ${port}`);
      }
    });

    // this._server = http.createServer((request, response) => {
    //   response.end('Running');
    // });
    // this._server.on('error', error => debugLog(error));
    // this._server.listen(port);
    // debugLog('ws server Listening on ' + port);

    const wsServer = new WebSocket.Server({ server:  this._tunnelServer, path: '/ws' });
    wsServer.on('connection', async ws => {
      if (this._client) {
        ws.close();
        return;
      }
      this._client = ws;
      debugLog('Incoming connection');
      const dispatcherConnection = new DispatcherConnection();

      ws.on('message', message => {
        console.log("DEBUG::: Received WS message : " + message);

        let wsMessageObject = JSON.parse(message.toString());

        if (wsMessageObject["playwright"] != null)
          dispatcherConnection.dispatch(wsMessageObject["playwright"]);

        let httpResponse = wsMessageObject["httpResponse"];
        if (httpResponse != null)
          this._responseObject[httpResponse.requestId] = httpResponse.response;
      });

      ws.on('close', () => {
        debugLog('Client closed');
        this._onDisconnect();
      });
      ws.on('error', error => {
        debugLog('Client error ' + error);
        this._onDisconnect();
      });
      dispatcherConnection.onmessage = message => ws.send(JSON.stringify({"httpResponse": null, "playwright": message}));
      new PlaywrightDispatcher(dispatcherConnection.rootDispatcher(), createPlaywright());
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
