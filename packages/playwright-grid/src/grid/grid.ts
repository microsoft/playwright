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

import crypto from 'crypto';
import debug from 'debug';
import { URL } from 'url';
import WebSocket from 'ws';
import type { Server as WebSocketServer } from 'ws';
import { HttpServer } from '../common/httpServer';
import type { Capabilities } from '../common/capabilities';
import type http from 'http';
import type stream from 'stream';

class WebSocketRequest {
  private _socketError: Error | undefined;

  constructor(readonly wsServer: WebSocketServer, readonly request: http.IncomingMessage, readonly socket: stream.Duplex, readonly head: Buffer) {
    this.socket.on('error', e => this._socketError = e);
  }

  upgrade(extraHeaders: string[] = []): Promise<WebSocket | null> {
    if (this._socketError || this.socket.destroyed)
      return Promise.resolve(null);

    return new Promise<WebSocket | null>(f => {
      const socketEndTimer = setTimeout(() => {
        this.socket.destroy();
        f(null);
      }, 5000);
      this.wsServer.once('headers', headers => {
        for (let i = 0; i < extraHeaders.length; i += 2) {
          if (extraHeaders[i].toLowerCase().startsWith('x-playwright'))
            headers.push(`${extraHeaders[i]}: ${extraHeaders[i + 1]}`);
        }
      });
      this.wsServer.handleUpgrade(this.request, this.socket, this.head, ws => {
        if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          f(null);
          return;
        }
        clearTimeout(socketEndTimer);
        this.wsServer.emit('connection', ws, this.request);
        f(ws);
      });
    });
  }
}

type ClientRequest = {
  webSocketRequest: WebSocketRequest;
  capabilities: Capabilities;
};

class Worker {
  readonly workerId = 'worker@' + createGuid();
  private _workerSocketRequest: WebSocketRequest | undefined;
  private _workerSocket: WebSocket | undefined;
  private _clientSocket: WebSocket | undefined;
  private _log: debug.Debugger;
  private _state: 'new' | 'available' | 'connecting' | 'connected' | 'closed' = 'new';
  private _onClose: () => void;
  private _retireTimer: NodeJS.Timeout;

  constructor(onClose: () => void) {
    this._log = debug(`pw:grid:${this.workerId}`);
    this._onClose = onClose;
    this._log('worker created');

    // Workers have 30 seconds to be picked up.
    this._retireTimer = setTimeout(() => {
      this.close();
    }, 30_000);
  }

  state(): 'new' | 'available' | 'connecting' | 'connected' | 'closed' {
    return this._state;
  }

  workerConnected(workerSocketRequest: WebSocketRequest) {
    this._log('worker available');
    this._state = 'available';
    this._workerSocketRequest = workerSocketRequest;
  }

  async connect(clientRequest: ClientRequest): Promise<'workerError' | 'clientError' | 'success'> {
    this._log('connect', clientRequest.webSocketRequest.request.headers);
    this._state = 'connecting';

    clearTimeout(this._retireTimer);

    const workerSocket = await this._workerSocketRequest!.upgrade(clientRequest.webSocketRequest.request.rawHeaders);
    if (!workerSocket || workerSocket.readyState === WebSocket.CLOSED || workerSocket.readyState === WebSocket.CLOSING) {
      this.close();
      return 'workerError';
    }

    const clientSocket = await clientRequest.webSocketRequest.upgrade();
    if (!clientSocket || clientSocket.readyState === WebSocket.CLOSED || clientSocket.readyState === WebSocket.CLOSING) {
      this.close();
      return 'clientError';
    }

    this._wire(workerSocket, clientSocket);
    return 'success';
  }

  private _wire(workerSocket: WebSocket, clientSocket: WebSocket) {
    this._log('connected');

    this._state = 'connected';
    workerSocket.on('close', () => this.close());
    workerSocket.on('error', () => this.close());
    clientSocket.on('close', () => this.close());
    clientSocket.on('error', () => this.close());
    clientSocket.on('message', data => {
      this._workerSocket?.send(data);
    });
    workerSocket.on('message', data => {
      this._clientSocket?.send(data);
    });

    this._workerSocket = workerSocket;
    this._clientSocket = clientSocket;
  }

  close() {
    if (this._state === 'closed')
      return;
    this._log('close');
    this._state = 'closed';
    this._workerSocket?.close();
    this._clientSocket?.close();
    this._workerSocket = undefined;
    this._clientSocket = undefined;
    this._onClose();
  }

  debugInfo() {
    return { state: this._state };
  }
}

class Node {
  readonly nodeId = 'node@' + createGuid();
  private _ws: WebSocket;
  readonly _workers = new Map<string, Worker>();
  private _log: debug.Debugger;
  private _onWorkersChanged: () => void;
  private _onClose: () => void;
  private _capabilities: Capabilities;
  private _capacity: number;

  constructor(ws: WebSocket, capacity: number, capabilities: Capabilities, onWorkersChanged: () => void, onClose: () => void) {
    this._capabilities = capabilities;
    this._capacity = capacity;
    this._log = debug(`pw:grid:${this.nodeId}`);
    ws.on('close', () => this.close());
    ws.on('error', () => this.close());
    ws.send(JSON.stringify({ nodeId: this.nodeId }));
    this._ws = ws;
    this._onWorkersChanged = onWorkersChanged;
    this._onClose = onClose;
  }

  hasWorker(workerId: string) {
    return this._workers.has(workerId);
  }

  hasCapabilities(capabilities: Capabilities): boolean {
    return !capabilities.platform || this._capabilities.platform === capabilities.platform;
  }

  workers() {
    return [...this._workers.values()];
  }

  canCreateWorker() {
    return this._workers.size < this._capacity;
  }

  createWorker() {
    const worker = new Worker(() => {
      this._workers.delete(worker.workerId);
      this._onWorkersChanged();
    });
    this._workers.set(worker.workerId, worker);
    this._ws.send(JSON.stringify({ workerId: worker.workerId }));
    return worker;
  }

  workerConnected(workerId: string, webSocketRequest: WebSocketRequest) {
    const worker = this._workers.get(workerId);
    if (worker) {
      worker.workerConnected(webSocketRequest);
      this._onWorkersChanged();
    }
  }

  close() {
    this._log('close');
    this._ws?.close();
    this._onClose();
  }
}

export class Grid {
  private _server: HttpServer;
  private _wsServer: WebSocketServer;
  private _nodes = new Map<string, Node>();
  private _log: debug.Debugger;
  private _clientRequests: ClientRequest[] = [];
  private _port: number;
  private _accessKey: string;

  static async create(options: { port: number, accessKey?: string, httpsCert?: string, httpsKey?: string }): Promise<Grid> {
    const server = await HttpServer.create(options);
    return new Grid(server, options);
  }

  private constructor(server: HttpServer, options: { port: number, accessKey?: string }) {
    this._log = debug(`pw:grid:proxy`);
    this._server = server;
    this._port = options.port;
    this._accessKey = options.accessKey || '';

    this._server.routePath('/' + this._accessKey, (request, response) => {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/plain');
      response.end(this._state());
      return true;
    });

    this._wsServer = new WebSocket.Server({ noServer: true });
    this._wsServer.on('connection', ws => {
      ws.on('error', e => this._log(e));
    });
    this._server.server.on('upgrade', async (request, socket, head) => {
      this._log('upgrade', request.url, request.headers);

      if (this._accessKey && request.headers['x-playwright-access-key'] !== this._accessKey) {
        socket.destroy();
        return;
      }

      const url = new URL('http://internal' + request.url);
      const params = url.searchParams;

      if (url.pathname.startsWith('/registerNode')) {
        const nodeRequest = new WebSocketRequest(this._wsServer, request, socket, head);
        const ws = await nodeRequest.upgrade();
        if (!ws)
          return;
        const capacity = +(params.get('capacity') || '1');
        const capabilities = JSON.parse(params.get('caps')!) as Capabilities;
        const node = new Node(ws, capacity, capabilities, () => {
          this._makeAMatch();
        }, () => {
          this._nodes.delete(node.nodeId);
        });
        this._nodes.set(node.nodeId, node);
        this._log('register node', node.nodeId);
        return;
      }

      if (url.pathname.startsWith('/registerWorker')) {
        const nodeId = params.get('nodeId')!;
        const workerId = params.get('workerId')!;
        const node = this._nodes.get(nodeId);
        if (!node) {
          socket.destroy();
          return;
        }
        if (!node.hasWorker(workerId)) {
          socket.destroy();
          return;
        }
        const workerRequest = new WebSocketRequest(this._wsServer, request, socket, head);
        node.workerConnected(workerId, workerRequest);
        return;
      }

      if (url.pathname === '/') {
        const capabilities = JSON.parse(params.get('caps') || '{}') as Capabilities;
        this._addClientRequest({
          webSocketRequest: new WebSocketRequest(this._wsServer, request, socket, head),
          capabilities,
        });
        return;
      }
    });
  }

  private _addClientRequest(clientRequest: ClientRequest) {
    this._clientRequests.push(clientRequest);
    this._makeAMatch();
  }

  private _nodesWithCapabilities(capabilities: Capabilities | null): Node[] {
    return [...this._nodes.values()].filter(node => !capabilities || node.hasCapabilities(capabilities));
  }

  private _workers(capabilities: Capabilities | null): Worker[] {
    const result: Worker[] = [];
    for (const node of this._nodesWithCapabilities(capabilities))
      result.push(...node.workers());
    return result;
  }

  private _makeAMatch() {
    this._log('making a match', {
      clients: this._clientRequests.length,
      nodes: this._nodes.size,
      workers: this._workers(null).length,
      availableWorkers: this._workers(null).filter(w => w.state() === 'available').length
    });

    // Remove closed client requests.
    this._clientRequests = this._clientRequests.filter(c => c.webSocketRequest.socket.readable);

    if (!this._clientRequests.length)
      return;

    const capabilities = this._clientRequests[0].capabilities;
    const nodes = this._nodesWithCapabilities(capabilities);
    const availableWorkers = nodes.map(n => n.workers()).flat().filter(w => w.state() === 'available');
    if (!availableWorkers.length) {
      // Try getting another worker for given capabilities.
      const node = nodes.find(w => w.canCreateWorker());
      if (node)
        node.createWorker();
      return;
    }

    // Make a match.
    const worker = availableWorkers[0];
    const clientRequest = this._clientRequests.shift()!;
    worker.connect(clientRequest).then(result => {
      if (result === 'workerError')
        this._clientRequests.unshift(clientRequest);
      this._makeAMatch();
    }).catch(e => this._log(e));
  }

  private _state(): string {
    const lines = [this._nodes.size + ' Nodes(s)'];
    for (const [nodeId, node] of this._nodes) {
      lines.push(`  node ${nodeId}`);
      for (const [workerId, worker] of node._workers)
        lines.push(`    ${workerId} - ${JSON.stringify(worker.debugInfo())}`);
    }
    return lines.join('\n');
  }

  async start() {
    const url = await this._server.start(this._port);
    // eslint-disable-next-line no-console
    console.log('Server is listening on: ' + url);
  }
}

function createGuid(): string {
  return crypto.randomBytes(16).toString('hex');
}
