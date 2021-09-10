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
import { EventEmitter } from 'events';
import { URL } from 'url';
import WebSocket, { Server as WebSocketServer } from 'ws';
import { Connection } from '../client/connection';
import { Playwright } from '../client/playwright';
import { HttpServer } from '../utils/httpServer';
import { createGuid } from '../utils/utils';
import * as docker from './docker';

class GridWorker extends EventEmitter {
  readonly workerId = createGuid();
  private _workerSocket: WebSocket | undefined;
  private _clientSocket: WebSocket;
  private _log: debug.Debugger;

  constructor(clientSocket: WebSocket) {
    super();
    this._log = debug(`[worker ${this.workerId}]`);
    this._clientSocket = clientSocket;
    clientSocket.on('close', () => this.closeWorker('client socket closed'));
    clientSocket.on('error', () => this.closeWorker('client socket error'));
  }

  workerConnected(workerSocket: WebSocket) {
    this._log('connected');
    this._workerSocket = workerSocket;
    workerSocket.on('close', () => this.closeWorker('worker socket closed'));
    workerSocket.on('error', () => this.closeWorker('worker socket error'));
    this._clientSocket.on('message', data => workerSocket!.send(data));
    workerSocket.on('message', data => this._clientSocket!.send(data));
    this._clientSocket.send('run');
  }

  closeWorker(reason = '<unknown>') {
    this._log('close' + ' reason = ' + reason);
    this._workerSocket?.close();
    this._clientSocket.close();
    this.emit('close');
  }

  debugInfo() {
    return { worker: !!this._workerSocket, client: !!this._clientSocket };
  }
}

type AgentStatus = 'none' | 'created' | 'connected' | 'retiring';

class GridAgent extends EventEmitter {
  private _capacity: number;
  readonly agentId = createGuid();
  private _ws: WebSocket | undefined;
  readonly _workers = new Map<string, GridWorker>();
  private _status: AgentStatus = 'none';
  private _workersWaitingForAgentConnected: GridWorker[] = [];
  private _retireTimeout: NodeJS.Timeout | undefined;
  private _log: debug.Debugger;
  private _tenantId: string;
  private _agentCreationTimeout: NodeJS.Timeout;

  constructor(tenantId: string, capacity: number) {
    super();
    this._tenantId = tenantId;
    this._capacity = capacity;
    this._log = debug(`[agent ${this.agentId}]`);
    this.setStatus('created');
    this._agentCreationTimeout = setTimeout(() => {
      // This will close the first socket, which is the creator of the agent.
      for (const worker of this._workersWaitingForAgentConnected)
        worker.closeWorker('timeout');
      this.close();
    }, 5 * 60_000);
  }

  public status(): AgentStatus {
    return this._status;
  }

  setStatus(status: AgentStatus) {
    this._log(`status ${this._status} => ${status}`);
    this._status = status;
  }

  agentConnected(ws: WebSocket) {
    clearTimeout(this._agentCreationTimeout);
    this.setStatus('connected');
    this._ws = ws;
    for (const worker of this._workersWaitingForAgentConnected) {
      this._log(`send worker id: ${worker.workerId}`);
      ws.send(worker.workerId);
    }
    this._workersWaitingForAgentConnected = [];
  }

  canCreateWorker(tenantId: string) {
    return this._workers.size < this._capacity && tenantId === this._tenantId;
  }

  async createWorker(clientSocket: WebSocket) {
    if (this._retireTimeout)
      clearTimeout(this._retireTimeout);
    if (this._ws)
      this.setStatus('connected');
    const worker = new GridWorker(clientSocket);
    this._log(`create worker: ${worker.workerId}`);
    this._workers.set(worker.workerId, worker);
    worker.on('close', () => {
      this._workers.delete(worker.workerId);
      if (!this._workers.size) {
        this.setStatus('retiring');
        if (this._retireTimeout)
          clearTimeout(this._retireTimeout);
        this._retireTimeout = setTimeout(() => this.close(), 30000);
      }
    });
    if (this._ws) {
      this._log(`send worker id: ${worker.workerId}`);
      this._ws.send(worker.workerId);
    } else {
      this._workersWaitingForAgentConnected.push(worker);
    }
  }

  workerConnected(workerId: string, ws: WebSocket) {
    this._log(`worker connected: ${workerId}`);
    const worker = this._workers.get(workerId)!;
    worker.workerConnected(ws);
  }

  close() {
    this._log('close');
    this._ws?.close();
    this.emit('close');
  }
}

export class GridServer {
  private _server: HttpServer;
  private _wsServer: WebSocketServer;
  private _agents = new Map<string, GridAgent>();
  private _log: debug.Debugger;

  constructor() {
    this._log = debug(`[grid]`);
    this._server = new HttpServer();

    this._server.routePath('/', (request, response) => {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/plain');
      response.end(this._state());
      return true;
    });

    this._wsServer = this._server.createWebSocketServer();

    this._wsServer.shouldHandle = request => {
      this._log(request.url);
      if (request.url!.startsWith('/claimWorker')) {
        // shouldHandle claims it accepts promise, except it doesn't.
        return true;
      }

      if (request.url!.startsWith('/registerAgent') || request.url!.startsWith('/registerWorker')) {
        const params = new URL('http://localhost/' + request.url).searchParams;
        const agentId = params.get('agentId');
        return !!agentId && this._agents.has(agentId);
      }

      return false;
    };

    this._wsServer.on('connection', async (ws, request) => {
      if (request.url?.startsWith('/claimWorker')) {
        const params = new URL('http://localhost/' + request.url).searchParams;
        const tenantId = params.get('tenantId');
        if (!tenantId) {
          ws.close();
          return;
        }
        const agent = [...this._agents.values()].find(w => w.canCreateWorker(tenantId)) || this._createAgent(tenantId);
        if (!agent) {
          ws.close();
          return;
        }

        agent.createWorker(ws);
        return;
      }

      if (request.url?.startsWith('/registerAgent')) {
        const params = new URL('http://localhost/' + request.url).searchParams;
        const agentId = params.get('agentId')!;
        const agent = this._agents.get(agentId);
        if (!agent) {
          ws.close();
          return;
        }

        agent.agentConnected(ws);
        return;
      }

      if (request.url?.startsWith('/registerWorker')) {
        const params = new URL('http://localhost/' + request.url).searchParams;
        const agentId = params.get('agentId')!;
        const workerId = params.get('workerId')!;
        const agent = this._agents.get(agentId);
        if (!agent || agent.status() !== 'connected') {
          ws.close();
          return;
        }
        agent.workerConnected(workerId, ws);
        return;
      }
    });
  }

  private _createAgent(tenantId: string): GridAgent {
    this._log('create agent for', tenantId);
    const agent = new GridAgent(tenantId, Infinity);
    this._agents.set(agent.agentId, agent);
    agent.on('close', () => {
      this._agents.delete(agent.agentId);
    });
    createAgent(agent.agentId, this._server.port()).then(success => {
      if (success)
        this._log('created');
      else
        agent.close();
    });
    return agent;
  }

  private _state(): string {
    const lines = [this._agents.size + ' Agents(s)'];
    for (const [agentId, agent] of this._agents) {
      lines.push(`  agent ${mangle(agentId)}}: ${agent.status()}`);
      for (const [workerId, worker] of agent._workers)
        lines.push(`    ${mangle(workerId)} - ${JSON.stringify(worker.debugInfo())}`);
    }
    return lines.join('\n');
  }

  async start(port = 3000) {
    return await this._server.start(port);
  }

  port(): number {
    return this._server.port();
  }

  async stop() {
    for (const agent of this._agents.values())
      agent.close();
    this._agents.clear();
    await this._server.stop();
  }
}

export class GridServerClient {
  private _ws: WebSocket;
  private _playwright: Playwright;

  static async create(gridURL: string) {
    const ws = new WebSocket(`${gridURL}/claimWorker?tenantId=docker`);
    await new Promise(f => ws.once('message', f));
    const connection = new Connection();
    connection.onmessage = (message: Object) => ws.send(JSON.stringify(message));
    ws.on('message', message => connection.dispatch(JSON.parse(message.toString())));
    const playwright = await connection.initializePlaywright();
    playwright._enablePortForwarding();
    return new GridServerClient(ws, playwright);
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

function mangle(sessionId: string) {
  return sessionId.replace(/\w{28}/, 'x'.repeat(28));
}

async function createAgent(agentId: string, gridPort: number): Promise<boolean> {
  try {
    await docker.launchAgent(agentId, gridPort);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

