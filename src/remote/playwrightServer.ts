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
 import { IWSMessage, TcpData, WsMessage} from './wsMessageInterface';
 const path = require('path');
 import * as net from "net";
import { exception } from 'console';
import { serverSelectors } from '../server/selectors';
import { EventEmitter } from 'events';

const eventsEmitter = new EventEmitter();


const {
  v1: uuidv1,
  v4: uuidv4,
} = require('uuid');


 const debugLog = debug('pw:server');
 const delay = (ms:any)  => new Promise(res => setTimeout(res, ms));
 export class PlaywrightServer {
   private _client: WebSocket | undefined;
   private _tcpConnections: {[uuid:string]: net.Socket} ;
   private _playwrightServerPort: number | undefined;
   private _tunnelServer: http.Server | undefined;
   private _tcpServers: net.Server[];
   private _allPortsOpened: boolean;
   private _allPortsClosed: boolean;

   constructor() {
     this._tcpConnections = {};
     this._tcpServers = [];
     this._allPortsOpened = false;
     this._allPortsClosed = false;
   }

   listen(port: number) {
     this._playwrightServerPort = port;
     this._tunnelServer = createServer(async (request: IncomingMessage, response: ServerResponse) => {
        response.end("running playwright server on : " + this._playwrightServerPort);
     });

     this._tunnelServer.listen(port, (error: any) => {
       if (error) {
         console.log(error);
       } else {
         console.log(`Tunnel  Server listening on port ${port}`);
       }
     });

     const wsServer = new WebSocket.Server({ server:  this._tunnelServer, path: '/ws' });

     wsServer.on('connection', async (ws: any) => {
       if (this._client) {
         ws.close();
         return;
       }
       this._client = ws;
       this._allPortsClosed = false;
       this._allPortsOpened = false;

       debugLog('Incoming connection');
       const dispatcherConnection = new DispatcherConnection();

       ws.on('message', async (message: any) => {
         debugLog("DEBUG::: Received WS message : " + message);
         let wsMessageObject: IWSMessage = JSON.parse(message.toString());

         if (wsMessageObject.playwright)
           dispatcherConnection.dispatch(wsMessageObject.playwright);

         if (wsMessageObject.TcpData)
            this._processIncomingData(wsMessageObject.TcpData, wsMessageObject.clientId);

         if (wsMessageObject.ports)
           this._openPorts(wsMessageObject.ports);

       });

       ws.on('close', () => {
         debugLog('Client closed');
         this._onDisconnect();
       });

       ws.on('error', (error: any) => {
         debugLog('Client error ' + error);
         this._onDisconnect();
       });

       // dispatcherConnection.onmessage = message => ws.send(JSON.stringify({"httpResponse": undefined, "playwright": message}));
       dispatcherConnection.onmessage = message => ws.send(JSON.stringify(new WsMessage({playwright:  message})));
       new PlaywrightDispatcher(dispatcherConnection.rootDispatcher(), createPlaywright());
     });
   }

   private async _processIncomingData(tcpData: TcpData, clientId: string | undefined) {
      if (clientId == undefined)
        throw exception("clientId is undefined");

      let tcpConn = this._tcpConnections[clientId];

      switch(tcpData.event) {
        case 'data': {
          if (tcpData.data == undefined)
            throw exception("empty data sent from the playwright server");
          let tcpDataBinary = Buffer.from(tcpData.data, 'base64');
          await new Promise<void>(f => tcpConn.write(tcpDataBinary, f));
          break;
        }

        case 'error' : {
          debugLog('got error on the tcp connection for the client : ' + clientId);
          // delete this._tcpConnections[clientId];
          break;
        }
        case 'close' : {
          debugLog('got close on the tcp connection for the client : ' + clientId);
          // delete this._tcpConnections[clientId];
          break;
        }
        default :
          throw exception("undefined event from the client.");
      }
   }

   private async _openPorts(ports: [number]) {
      if (this._client == undefined)
        throw exception("client is undefined");

      ports.forEach(async port => {
        let tcpServer: net.Server = net.createServer();
        tcpServer.listen(port);
        this._tcpServers.push(tcpServer);
        tcpServer.on('connection', tcpconn => {
          let clientId: string = uuidv4();
          this._tcpConnections[clientId] = tcpconn;

          tcpconn.on("data", async (buffer: Buffer) => {
            await new Promise<Error | undefined>(f => {
              if (this._client == undefined)
                throw exception("client doesn't exist");
              this._client.send(JSON.stringify(new WsMessage({ TcpData : {port: port, data: buffer.toString('base64'), event: 'data'}, clientId: clientId})), f);
            });
          });


          tcpconn.on("error", async (err) => {
            debugLog('api', port + ":: [SYSTEM] --> TCP Error " + err);
            await new Promise<Error | undefined>(f => {
              if (this._client == undefined)
                throw exception("client doesn't exist");
              this._client.send(JSON.stringify(new WsMessage({ TcpData : {port: port, event: 'error'}, clientId: clientId})), f);
            });
          });

          tcpconn.on("close", async () => {
            debugLog('api', port + ":: [SYSTEM] --> TCP connection close.");
            await new Promise<Error | undefined>(f => {
              if (this._client == undefined)
                throw exception("client doesn't exist");
              this._client.send(JSON.stringify(new WsMessage({ TcpData : {port: port, event: 'close'}, clientId: clientId})), f);
            });
            if (this._tcpConnections.hasOwnProperty(clientId)) {
              await new Promise<void>(async f => {
                // wait for the data to be completely flushed out
                if (this._tcpConnections[clientId].writableLength != this._tcpConnections[clientId].writableHighWaterMark)
                this._tcpConnections[clientId].on('drain', f);
                else
                  f();
              });
            }
          });
        });
        if (this._tcpServers.length == ports.length) {
          // when all the ports are opened emit the event
          debugLog('all ports opened');
          this._allPortsOpened = true;
          eventsEmitter.emit('allPortsOpened');
        }
      });
      await new Promise<void>(f => {
        if (this._allPortsOpened)
          f();
        eventsEmitter.on('allPortsOpened', f);
      });
      debugLog("opened all the tcp ports");
      // echo back the ports indicating all the ports have been opened successfully
      this._client.send(JSON.stringify(new WsMessage({ports: ports})));
   }

   async closeAllTcpServers() {
    let _closedServers: net.Server[] = [];

    this._tcpServers.forEach(async server => {
      await new Promise<Error | undefined>(f => server.close(() => {
        _closedServers.push(server);
        if (_closedServers.length == this._tcpServers.length) {
          this._allPortsClosed = true;
          eventsEmitter.emit('tcpServersClosed');
        }
      }));
    });
    await new Promise<void>(f => {
      if (this._allPortsClosed)
        f();
      eventsEmitter.on('tcpServersClosed', f);
    });
    this._allPortsClosed = false;
    this._allPortsOpened = false;
    this._tcpServers = [];
   }

   async close() {
     if (!this._tunnelServer)
       return;
     debugLog('Closing all the active tcp servers');
     await this.closeAllTcpServers();
     debugLog("closed all the tcp servers");
     await new Promise(f => this._tunnelServer!.close(f));
     await gracefullyCloseAll();
     serverSelectors.unregisterAll();
   }

   private async _onDisconnect() {
    debugLog('Closing all the active tcp connections');
    debugLog('Closing all the active tcp servers');
    await this.closeAllTcpServers();
    debugLog("closed all the tcp servers");
    await gracefullyCloseAll();
    serverSelectors.unregisterAll();
    this._client = undefined;
   }
 }