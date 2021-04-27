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

import WebSocket from "ws";
import { Connection } from "../client/connection";
import { Playwright } from "../client/playwright";
import { IWSMessage, WsMessage, TcpData } from "./wsMessageInterface";
import * as net from "net";
import { debugLogger } from "../utils/debugLogger";
import { exception, timeStamp } from "console";
import { EventEmitter } from "events";

const delay = (ms: any) => new Promise((res) => setTimeout(res, ms));

const eventsEmitter = new EventEmitter();

export class PlaywrightClient {
  private _playwright: Playwright | undefined | unknown;
  private _ws: WebSocket | undefined;
  private _closePromise: Promise<void>;
  private _tcpConnections: {
    [port: number]: { [clientId: string]: net.Socket };
  };
  private _connection: Connection | undefined;
  private _wsEndpoint: string;
  private _ports: [number] | undefined;
  private _portsOpened: boolean;

  static async connect(
    wsEndpoint: string,
    ports?: [number]
  ): Promise<PlaywrightClient> {
    let playwrightClient = new PlaywrightClient(wsEndpoint, ports);
    debugLogger.log("api", "created playwright object");
    return playwrightClient;
  }

  constructor(wsEndpoint: string, ports?: [number]) {
    this._portsOpened = false;
    this._wsEndpoint = wsEndpoint;
    this._closePromise = new Promise((f) => this.ws.on("close", f));
    this._tcpConnections = {};
    this.addHandlers();
    this._ports = ports;
  }

  private get ws(): WebSocket {
    if (this._ws === undefined) this._ws = new WebSocket(this._wsEndpoint);
    return this._ws;
  }

  private get connection(): Connection {
    if (this._connection === undefined) this._connection = new Connection();
    return this._connection;
  }

  addHandlers() {
    try {
      this.ws.on("message", async (message: WebSocket.Data) => {
        // demultiplex the messages from the server
        let wsmessage: IWSMessage = JSON.parse(message.toString());

        if (wsmessage.playwright)
          this.connection.dispatch(wsmessage.playwright);

        if (wsmessage.TcpData) {
          let port = wsmessage.TcpData.port;
          if (wsmessage.clientId == undefined)
            throw exception("client ID is undefined");

          if (
            !this._tcpConnections.hasOwnProperty(wsmessage.TcpData.port) ||
            !this._tcpConnections[wsmessage.TcpData.port].hasOwnProperty(
              wsmessage.clientId
            )
          ) {
            let conn = net.connect(
              { port: port, host: "localhost" },
              function () {}
            );
            if (!this._tcpConnections.hasOwnProperty(wsmessage.TcpData.port))
              this._tcpConnections[wsmessage.TcpData.port] = {};
            this._tcpConnections[wsmessage.TcpData.port][
              wsmessage.clientId
            ] = conn;
            this.addConnectionHandler(port, wsmessage.clientId);
          }
          await this.processIncomingTcpData(
            wsmessage.TcpData,
            port,
            wsmessage.clientId
          );
        }

        if (wsmessage.ports) {
          debugLogger.log("api", "ports opened");
          this._portsOpened = true;
          eventsEmitter.emit("portsOpenedEvent");
        }
      });

      this.connection.onmessage = async (message: object) =>
        await new Promise<Error | undefined>(f => this.ws.send(JSON.stringify(new WsMessage({ playwright: message })), f));
    } catch (e) {
      debugLogger.log("api", "Exception : " + e);
    }
  }

  async processIncomingTcpData(
    tcpData: TcpData,
    port: number,
    clientId: string
  ) {
    debugLogger.log(
      "api",
      "processing incoming tcp request" + JSON.stringify(tcpData)
    );

    switch (tcpData.event) {
      case "data": {
        if (tcpData.data == undefined)
          throw exception("empty data sent from the playwright server");
        let tcpDataBinary = Buffer.from(tcpData.data, "base64");
        // wait for the data to be written to the tcp connection
        await new Promise<void>((f) =>
          this._tcpConnections[port][clientId].write(tcpDataBinary, f)
        );
        break;
      }
      case "close": {
        debugLogger.log("api", port + ": " + clientId + ":: closing port ");
        if (this._tcpConnections[port].hasOwnProperty(clientId)) {
          // wait for the data to be completely flushed out
          await new Promise<void>(async (f) => {
            if (
              this._tcpConnections[port][clientId].writableLength !=
              this._tcpConnections[port][clientId].writableHighWaterMark
            )
              this._tcpConnections[port][clientId].on("drain", f);
            else f();
          });
          // delete this._tcpConnections[port][clientId];
        }
        break;
      }
      case "error": {
        debugLogger.log(
          "api",
          port + ": " + clientId + ":: error closing port "
        );
        if (this._tcpConnections[port].hasOwnProperty(clientId)) {
          // delete this._tcpConnections[port][clientId];
        }
        break;
      }
      default: {
        throw exception("unhandled event from the playwright server");
      }
    }
  }

  addConnectionHandler(port: number, clientId: string) {
    this._tcpConnections[port][clientId].on("data", async (buffer: Buffer) => {
      debugLogger.log(
        "api",
        clientId +
          " :: " +
          port +
          ":: Got the response from the tcp connection : " +
          buffer.toString("base64")
      );
      await new Promise<Error | undefined>((f) =>
        this.ws.send(
          JSON.stringify(
            new WsMessage({
              TcpData: {
                port: port,
                data: buffer.toString("base64"),
                event: "data",
              },
              clientId: clientId,
            })
          ),
          f
        )
      );
    });

    this._tcpConnections[port][clientId].on("error", async (err) => {
      debugLogger.log(
        "api",
        port + ":: [SYSTEM] --> TCP Error " + err + " : " + clientId
      );
      await new Promise<Error | undefined>((f) =>
        this.ws.send(
          JSON.stringify(
            new WsMessage({
              TcpData: { port: port, event: "error" },
              clientId: clientId,
            })
          ),
          f
        )
      );
    });

    this._tcpConnections[port][clientId].on("close", async (err) => {
      debugLogger.log(
        "api",
        port + ":: [SYSTEM] --> TCP Close " + err + clientId
      );
      await new Promise<Error | undefined>((f) =>
        this.ws.send(
          JSON.stringify(
            new WsMessage({
              TcpData: { port: port, event: "close" },
              clientId: clientId,
            })
          ),
          f
        )
      );
    });
  }

  async playwright(): Promise<Playwright> {
    if (this._playwright === undefined) {
      // debugLogger.log('api', "playwright object is undefined creating one for the client.");
      const errorPromise = new Promise((_, reject) => {
        this.ws.on("error", (error: any) => {
          debugLogger.log(
            "api",
            "Error on the websocket connection : " + error
          );
          reject(error);
        });
      });
      const closePromise = new Promise((_, reject) =>
        this.ws.on("close", () => {
          // debugLogger.log('api', "Error on the websocket connection -> Connection closed");
          reject(new Error("Connection closed"));
        })
      );

      this._playwright = await Promise.race([
        this.connection.waitForObjectWithKnownName("Playwright"),
        errorPromise,
        closePromise,
      ]);
      debugLogger.log("api", "playwright object got from the server.");

      debugLogger.log("api", "asking playwright server to open ports");

      await new Promise<Error | undefined>(f => this.ws.send(JSON.stringify(new WsMessage({ ports: this._ports })), f));

      await new Promise<void>((f) => {
        if (this._portsOpened) {
          f();
        } else {
          eventsEmitter.on("portsOpenedEvent", () => {
            this._portsOpened = true;
            f();
          });
        }
      });

      debugLogger.log("api", "tcp ports opened");
    }
    return this._playwright as Playwright;
  }

  async close() {
    this.ws.close();
    await this._closePromise;
  }
}
