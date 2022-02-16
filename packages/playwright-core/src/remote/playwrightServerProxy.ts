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
import * as crypto from 'crypto';
import * as http from 'http';
import { EventEmitter } from 'events';
import WebSocket from 'ws';

const debugLog = debug('pw:server-proxy');
const debugProtocol = debug('pw:server-proxy-protocol');

type PlainHeaders = { [key: string]: string };
export class PlaywrightServerProxy {
  private _path: string;
  private _serverAddress: string;
  private _connectTimeout: number;
  private _server: http.Server | undefined;
  private _wsServer: WebSocket.Server | undefined;
  private _queues = new Map<string, ServerQueue>();

  constructor(options: { path?: string, serverAddress: string, connectTimeout: number }) {
    this._path = options.path || '/ws';
    this._serverAddress = options.serverAddress;
    if (this._serverAddress.endsWith('/'))
      this._serverAddress = this._serverAddress.substring(0, this._serverAddress.length - 1);
    this._connectTimeout = options.connectTimeout;
  }

  async listen(port: number = 0): Promise<string> {
    this._server = http.createServer((request, response) => {
      response.end('Running');
    });
    this._server.on('error', error => debugLog(error));

    this._wsServer = new WebSocket.Server({ noServer: true, path: this._path });
    this._server.on('upgrade', async (request, socket, head) => {
      debugLog(`incoming request ${request.url}`);

      const url = this._serverAddress + (request.url || '').substring(this._path.length);
      const headers = filterHeaders(request);
      const hash = computeRequestHash(url, headers);
      let queue = this._queues.get(hash);
      if (!queue) {
        queue = new ServerQueue(url, headers, this._connectTimeout);
        this._queues.set(hash, queue);
      }

      const { promise, cancel } = queue.claimConnection();
      socket.on('close', cancel);
      socket.on('error', cancel);
      const connection = await promise;
      socket.off('close', cancel);
      socket.off('error', cancel);
      if (!connection) {
        // Canceled, because socket was closed.
        return;
      }

      // We assume that handleUpgrade happens synchronously,
      // so it is impossible to have a connection claimed,
      // but not actually pumped to the client ws.
      connection.claimed = false;
      this._wsServer!.handleUpgrade(request, socket as any, head, ws => {
        connection.pump(ws);
      });
    });

    const wsEndpoint = await new Promise<string>((resolve, reject) => {
      this._server!.listen(port, () => {
        const address = this._server!.address();
        if (!address) {
          reject(new Error('Could not bind server socket'));
          return;
        }
        const wsEndpoint = typeof address === 'string' ? `${address}${this._path}` : `ws://127.0.0.1:${address.port}${this._path}`;
        resolve(wsEndpoint);
      }).on('error', reject);
    });

    debugLog('Listening at ' + wsEndpoint);
    return wsEndpoint;
  }

  async close() {
    if (!this._wsServer)
      return;
    debugLog('closing websocket server');
    for (const queue of this._queues.values())
      queue.stop();
    const waitForClose = new Promise(f => this._wsServer!.close(f));
    // First disconnect all remaining clients.
    for (const ws of this._wsServer.clients)
      ws.terminate();
    await waitForClose;
    debugLog('closing http server');
    await new Promise(f => this._server!.close(f));
    this._wsServer = undefined;
    this._server = undefined;
    debugLog('closed server');
  }
}

let lastServerQueueId = 0;
let lastConnectionId = 0;

class ServerQueue {
  private _url: string;
  private _headers: PlainHeaders;
  private _callbacks: ((connection: ServerConnection) => void)[] = [];
  private _connections = new Set<ServerConnection>();
  private _connectTimeout: number;
  private _retry: {
    index: number,
    timer?: NodeJS.Timer,
    connection?: ServerConnection,
  } | undefined;
  private _id: number;

  constructor(url: string, headers: PlainHeaders, connectTimeout: number) {
    this._id = ++lastServerQueueId;
    this._url = url;
    this._headers = headers;
    this._connectTimeout = connectTimeout;
  }

  claimConnection() {
    let callback: (connection: ServerConnection | undefined) => void = () => {};
    const promise = new Promise<ServerConnection | undefined>(f => {
      debugLog(`[queue=${this._id}] incoming client connection`);
      callback = f;
      this._callbacks.push(f);
      this._checkQueue();
    });
    const cancel = () => {
      debugLog(`[queue=${this._id}] client connection canceled before claim`);
      const index = this._callbacks.indexOf(callback);
      if (index !== -1)
        this._callbacks.splice(index, 1);
      callback(undefined);
    }
    return { promise, cancel };
  }

  stop() {
    if (this._retry && this._retry.timer)
      clearTimeout(this._retry.timer);
  }

  private _checkQueue() {
    if (!this._callbacks.length)
      return;
    debugLog(`[queue=${this._id}] checking for available connection, size=${this._callbacks.length}...`);

    // Is there a connection available?
    for (const connection of this._connections) {
      if (!connection.claimed && connection.ready()) {
        debugLog(`[queue=${this._id}] ...found available connection`);
        connection.claimed = true;
        this._callbacks.shift()!(connection);

        // Check one more time, perhaps someone is in the queue still?
        this._checkQueue();
        return;
      }
    }

    if (this._retry) {
      // There's a retry ongoing - check later.
      debugLog(`[queue=${this._id}] ...retry in progress - no connection found`);
      return;
    }

    // Create a new connection.
    debugLog(`[queue=${this._id}] ...creating a new connection`);
    this._createConnection();
  }

  private _createConnection() {
    const connectionId = `conn=${this._id}/${++lastConnectionId}`;
    const connection = new ServerConnection(connectionId, this._url, this._headers, this._connectTimeout);
    this._connections.add(connection);

    connection.on(ServerConnection.Events.Ready, () => {
      if (this._retry && this._retry.connection === connection) {
        // Retry succeeded!
        this._retry = undefined;
      }
      this._checkQueue();
    });

    connection.on(ServerConnection.Events.Closed, () => {
      this._connections.delete(connection);
      if (connection.connecting()) {
        // Closed during connect. Retry for the first time, or again if this was a retry connection.
        if (!this._retry)
          this._scheduleRetry();
        else if (connection === this._retry.connection)
          this._scheduleRetry();
      } else {
        // Closed for whatever reason - check whether we need another one.
        this._checkQueue();
      }
    });
    return connection;
  }

  private async _scheduleRetry() {
    if (!this._retry)
      this._retry = { index: 0 };
    this._retry.index++;
    const timeouts = [1000, 2000, 5000, 10000];
    const timeout = timeouts[Math.min(this._retry.index - 1, timeouts.length - 1)];
    debugLog(`[queue=${this._id}] needs a retry, waiting for ${timeout}`);
    this._retry.connection = undefined;
    await new Promise(f => this._retry!.timer = setTimeout(f, timeout));
    this._retry!.timer = undefined;
    if (!this._callbacks.length) {
      this._retry = undefined;
      debugLog(`[queue=${this._id}] queue is empty, stopping retries`);
      return;
    }
    debugLog(`[queue=${this._id}] initiating a retry connection`);
    this._retry.connection = this._createConnection();
  }
}

class ServerConnection extends EventEmitter {
  static Events = {
    Ready: 'ready',
    Closed: 'closed',
  };
  claimed = false;

  private _id: string;
  private _ready = false;
  private _connecting = true;
  private _ws: WebSocket;
  private _initMessages: any[] = [];
  private _initResponse: any;
  private _idleTimer: NodeJS.Timer | undefined;
  private _closed = false;

  constructor(id: string, url: string, headers: PlainHeaders, timeout: number) {
    super();

    this._id = id;
    debugLog(`[${this._id}] connecting to the server at ${url}`);
    this._ws = new WebSocket(url, {
      perMessageDeflate: false,
      maxPayload: 256 * 1024 * 1024, // 256Mb,
      headers,
      followRedirects: true,
      handshakeTimeout: timeout
    });

    this._ws.on('open', () => {
      debugLog(`[${this._id}] connected to the server`);
      this._connecting = false;
      this._markReady();
    });
    this._ws.on('error', (error: Error) => {
      if (!this._closed) {
        this._closed = true;
        debugLog(`[${this._id}] server connection is closed with error ${error}`);
        this.emit(ServerConnection.Events.Closed);
      }
    });
    this._ws.on('close', () => {
      if (!this._closed) {
        this._closed = true;
        debugLog(`[${this._id}] server connection is closed`);
        this.emit(ServerConnection.Events.Closed);
      }
    });
  }

  ready() {
    return this._ready;
  }

  connecting() {
    return this._connecting;
  }

  private _markReady() {
    if (this._closed)
      return;
    debugLog(`[${this._id}] connection is ready to accept clients`);
    const idleTimeout = 30000;
    this._idleTimer = setTimeout(() => {
      debugLog(`[${this._id}] connection was idle for ${idleTimeout}, closing`);
      this._ws.close();
    }, idleTimeout);
    this._ready = true;
    this.emit(ServerConnection.Events.Ready);
  }

  private _logProtocol(direction: string, message: string) {
    if (debugProtocol.enabled)
      debugProtocol(`[${this._id}] ${direction} ${message}`);
  }

  pump(client: WebSocket) {
    debugLog(`[${this._id}] connected to a client, pumping`);

    let clientInitMessageId: number | undefined;
    let playwrightGuid: string | undefined;

    const cleanup = () => {
      client.removeEventListener('message', clientMessageHandler);
      this._ws.removeEventListener('message', serverMessageHandler);
      client.removeEventListener('close', clientCloseHandler);
      this._ws.removeEventListener('close', serverCloseHandler);
      };

    const disconnect = async (error?: string) => {
      debugLog(`[${this._id}] disconnecting client: ${error || ''}`);
      cleanup();
      client.close(4000, error);
      if (playwrightGuid && !this._closed)
        await this._cleanupPreLaunchedBrowserOnTheServer(playwrightGuid);
      this._markReady();
    };

    const sendInitSequenceToTheClient = () => {
      debugLog(`[${this._id}] sending init sequence to the client`);
      for (const obj of this._initMessages) {
        if (obj.method === '__create__' && obj.params.type === 'Playwright')
          playwrightGuid = obj.params.guid;
        const message = JSON.stringify(obj);
        this._logProtocol('P>C', message);
        client.send(message);
      }
      this._initResponse.id = clientInitMessageId;
      const message = JSON.stringify(this._initResponse);
      this._logProtocol('P>C', message);
      client.send(message);
    };

    const clientMessageHandler = ({ data }: any) => {
      const message = data as string;
      this._logProtocol('C>P', message);

      // We are past the initialization, just pump.
      if (clientInitMessageId !== undefined) {
        this._logProtocol('P>S', message);
        this._ws.send(message);
        return;
      }

      // First init message from the client.
      try {
        const obj = JSON.parse(message);
        if (typeof obj.id !== 'number' || obj.guid !== '' || obj.method !== 'initialize') {
          disconnect('Malformed handshake');
          return;
        }
        clientInitMessageId = obj.id;
        debugLog(`[${this._id}] received init message from the client`);
      } catch (e) {
        disconnect(String(e));
        return;
      }

      // Not the first client - just replay previous response.
      if (this._initResponse !== undefined) {
        sendInitSequenceToTheClient();
        return;
      }

      // The first client - continue with initialization.
      this._logProtocol('P>S', message);
      this._ws.send(message);
    };

    const serverMessageHandler = ({ data }: any) => {
      const message = data as string;
      this._logProtocol('S>P', message);

      // We are past the initialization, just pump.
      if (this._initResponse !== undefined) {
        this._logProtocol('P>C', message);
        client.send(message);
        return;
      }

      debugLog(`[${this._id}] received init message from the server`);
      const obj = JSON.parse(message);
      if (obj.id === clientInitMessageId) {
        this._initResponse = obj;
        debugLog(`[${this._id}] received final init response from the server`);
        sendInitSequenceToTheClient();
      } else {
        this._initMessages.push(obj);
      }
    };

    const clientCloseHandler = () => disconnect('client closed connection');
    const serverCloseHandler = () => disconnect('server closed connection');

    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = undefined;
    }
    this._ready = false;
    client.addEventListener('message', clientMessageHandler);
    this._ws.addEventListener('message', serverMessageHandler);
    client.addEventListener('close', clientCloseHandler);
    this._ws.addEventListener('close', serverCloseHandler);
  }

  private async _cleanupPreLaunchedBrowserOnTheServer(playwrightGuid: string) {
    debugLog(`[${this._id}] performing cleanup on the server...`);
    let callback = () => {};
    const promise = new Promise<void>(f => callback = f);
    const cleanupMessageId = 1;

    const serverMessageHandler = ({ data }: any) => {
      const message = data as string;
      this._logProtocol('S>P', message);
      const obj = JSON.parse(message);
      if (obj.id == cleanupMessageId)
        callback();
    };

    this._ws.addEventListener('message', serverMessageHandler);
    const message = JSON.stringify({
      id: cleanupMessageId,
      guid: playwrightGuid,
      method: 'cleanupPreLaunchedBrowser',
      params: {},
      metadata: { stack: [], apiName: '', internal: true }
    });
    this._logProtocol('P>S', message);
    this._ws.send(message);
    await promise;
    this._ws.removeEventListener('message', serverMessageHandler);
    debugLog(`[${this._id}] ...cleanup finished`);
  }
}

function shouldPreserveHeader(header: string) {
  header = header.toLowerCase();
  return header === 'user-agent' || header.startsWith('x-playwright');
}

function filterHeaders(request: http.IncomingMessage): PlainHeaders {
  const result: PlainHeaders = {};
  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined && shouldPreserveHeader(key))
      result[key] = Array.isArray(value) ? value[0] : value;
  }
  return result;
}

function computeRequestHash(url: string, headers: PlainHeaders): string {
  const hash = crypto.createHash('sha1').update(url || '');
  for (const [key, value] of Object.entries(headers)) {
    hash.update(key);
    hash.update(value);
  }
  return hash.digest('hex');
}
