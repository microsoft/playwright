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
import assert from 'assert';
import { EventEmitter } from 'events';
import { URL } from 'url';
import type { Server as WebSocketServer } from 'ws';
import type WebSocket from 'ws';
import { HttpServer } from '../utils/httpServer';
import { createGuid, getPlaywrightVersion } from '../utils/utils';

export type GridAgentLaunchOptions = {
  agentId: string,
  gridURL: string,
  playwrightVersion: string,
};

export type GridFactory = {
  name?: string,
  capacity?: number,
  launchTimeout?: number,
  retireTimeout?: number,
  launch: (launchOptions: GridAgentLaunchOptions) => Promise<void>,
};

type ErrorCode = {
  code: number,
  reason: string,
};

const WSErrors = {
  NO_ERROR: { code: 1000, reason: '' },
  AUTH_FAILED: { code: 1008, reason: 'Grid authentication failed' },
  AGENT_CREATION_FAILED: { code: 1013, reason: 'Grid agent creation failed' },
  AGENT_NOT_FOUND: { code: 1013, reason: 'Grid agent registration failed - agent with given ID not found' },
  AGENT_NOT_CONNECTED: { code: 1013, reason: 'Grid worker registration failed - agent has unsupported status' },
  AGENT_CREATION_TIMED_OUT: { code: 1013, reason: 'Grid agent creation timed out' },
  AGENT_RETIRED: { code: 1000, reason: 'Grid agent was retired' },
  CLIENT_SOCKET_ERROR: { code: 1011, reason: 'Grid client socket error' },
  WORKER_SOCKET_ERROR: { code: 1011, reason: 'Grid worker socket error' },
  CLIENT_PLAYWRIGHT_VERSION_MISMATCH: { code: 1013, reason: 'Grid Playwright and grid client versions are different' },
  AGENT_PLAYWRIGHT_VERSION_MISMATCH: { code: 1013, reason: 'Grid Playwright and grid agent versions are different' },
  GRID_SHUTDOWN: { code: 1000, reason: 'Grid was shutdown' },
  AGENT_MANUALLY_STOPPED: { code: 1000, reason: 'Grid agent was manually stopped' },
};

class GridWorker extends EventEmitter {
  readonly workerId = createGuid();
  private _workerSocket: WebSocket | undefined;
  private _clientSocket: WebSocket;
  private _log: debug.Debugger;

  constructor(clientSocket: WebSocket) {
    super();
    this._log = debug(`pw:grid:worker${this.workerId}`);
    this._clientSocket = clientSocket;
    clientSocket.on('close', (code: number, reason: string) => this.closeWorker(WSErrors.NO_ERROR));
    clientSocket.on('error', (error: Error) => this.closeWorker(WSErrors.CLIENT_SOCKET_ERROR));
  }

  workerConnected(workerSocket: WebSocket) {
    this._log('connected');
    this._workerSocket = workerSocket;
    workerSocket.on('close', (code: number, reason: string) => this.closeWorker(WSErrors.NO_ERROR));
    workerSocket.on('error', (error: Error) => this.closeWorker(WSErrors.WORKER_SOCKET_ERROR));
    this._clientSocket.on('message', data => workerSocket!.send(data));
    workerSocket.on('message', data => this._clientSocket!.send(data));
    this._clientSocket.send('run');
  }

  closeWorker(errorCode: ErrorCode) {
    this._log('close');
    this._workerSocket?.close(errorCode.code, errorCode.reason);
    this._clientSocket.close(errorCode.code, errorCode.reason);
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
  private _workersWaitingForAgentConnected: Set<GridWorker> = new Set();
  private _retireTimeout = 30000;
  private _retireTimeoutId: NodeJS.Timeout | undefined;
  private _log: debug.Debugger;
  private _agentCreationTimeoutId: NodeJS.Timeout;

  constructor(capacity = Infinity, creationTimeout = 5 * 60000, retireTimeout = 30000) {
    super();
    this._capacity = capacity;
    this._log = debug(`pw:grid:agent${this.agentId}`);
    this.setStatus('created');
    this._retireTimeout = retireTimeout;
    this._agentCreationTimeoutId = setTimeout(() => {
      this.closeAgent(WSErrors.AGENT_CREATION_TIMED_OUT);
    }, creationTimeout);
  }

  public status(): AgentStatus {
    return this._status;
  }

  setStatus(status: AgentStatus) {
    this._log(`status ${this._status} => ${status}`);
    this._status = status;
  }

  agentConnected(ws: WebSocket) {
    clearTimeout(this._agentCreationTimeoutId);
    this.setStatus('connected');
    this._ws = ws;
    for (const worker of this._workersWaitingForAgentConnected) {
      this._log(`send worker id: ${worker.workerId}`);
      ws.send(worker.workerId);
    }
    this._workersWaitingForAgentConnected.clear();
  }

  canCreateWorker() {
    return this._workers.size < this._capacity;
  }

  async createWorker(clientSocket: WebSocket) {
    if (this._retireTimeoutId)
      clearTimeout(this._retireTimeoutId);
    if (this._ws)
      this.setStatus('connected');
    const worker = new GridWorker(clientSocket);
    this._log(`create worker: ${worker.workerId}`);
    this._workers.set(worker.workerId, worker);
    worker.on('close', () => {
      this._workers.delete(worker.workerId);
      this._workersWaitingForAgentConnected.delete(worker);
      if (!this._workers.size) {
        this.setStatus('retiring');
        if (this._retireTimeoutId)
          clearTimeout(this._retireTimeoutId);
        if (this._retireTimeout && isFinite(this._retireTimeout))
          this._retireTimeoutId = setTimeout(() => this.closeAgent(WSErrors.AGENT_RETIRED), this._retireTimeout);
      }
    });
    if (this._ws) {
      this._log(`send worker id: ${worker.workerId}`);
      this._ws.send(worker.workerId);
    } else {
      this._workersWaitingForAgentConnected.add(worker);
    }
  }

  workerConnected(workerId: string, ws: WebSocket) {
    this._log(`worker connected: ${workerId}`);
    const worker = this._workers.get(workerId)!;
    worker.workerConnected(ws);
  }

  closeAgent(errorCode: ErrorCode) {
    for (const worker of this._workersWaitingForAgentConnected)
      worker.closeWorker(errorCode);
    for (const worker of this._workers.values())
      worker.closeWorker(errorCode);
    this._log('close');
    this._ws?.close(errorCode.code, errorCode.reason);
    this.emit('close');
  }
}

export class GridServer {
  private _server: HttpServer;
  private _wsServer: WebSocketServer;
  private _agents = new Map<string, GridAgent>();
  private _log: debug.Debugger;
  private _authToken: string;
  private _factory: GridFactory;
  private _pwVersion: string;

  constructor(factory: GridFactory, authToken: string = '') {
    this._log = debug(`pw:grid:server`);
    this._authToken = authToken || '';
    this._server = new HttpServer();
    this._factory = factory;
    this._pwVersion = getPlaywrightVersion(true /* majorMinorOnly */);

    this._server.routePath(this._securePath('/'), (request, response) => {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/html');
      response.end(this._state());
      return true;
    });

    this._server.routePath(this._securePath('/stopAll'), (request, response) => {
      for (const agent of this._agents.values())
        agent.closeAgent(WSErrors.AGENT_MANUALLY_STOPPED);
      response.statusCode = 302;
      response.setHeader('Location', this._securePath('/'));
      response.end();
      return true;
    });

    this._wsServer = this._server.createWebSocketServer();

    this._wsServer.shouldHandle = request => {
      this._log(request.url);
      if (request.url!.startsWith(this._securePath('/claimWorker'))) {
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
      if (request.url?.startsWith(this._securePath('/claimWorker'))) {
        const params = new URL('http://localhost/' + request.url).searchParams;
        if (params.get('pwVersion') !== this._pwVersion && !process.env.PWTEST_UNSAFE_GRID_VERSION) {
          ws.close(WSErrors.CLIENT_PLAYWRIGHT_VERSION_MISMATCH.code, WSErrors.CLIENT_PLAYWRIGHT_VERSION_MISMATCH.reason);
          return;
        }
        const agent = [...this._agents.values()].find(w => w.canCreateWorker()) || this._createAgent()?.agent;
        if (!agent) {
          ws.close(WSErrors.AGENT_CREATION_FAILED.code, WSErrors.AGENT_CREATION_FAILED.reason);
          return;
        }

        agent.createWorker(ws);
        return;
      }

      if (request.url?.startsWith('/registerAgent')) {
        const params = new URL('http://localhost/' + request.url).searchParams;
        if (params.get('pwVersion') !== this._pwVersion) {
          ws.close(WSErrors.AGENT_PLAYWRIGHT_VERSION_MISMATCH.code, WSErrors.AGENT_PLAYWRIGHT_VERSION_MISMATCH.reason);
          return;
        }
        const agentId = params.get('agentId')!;
        const agent = this._agents.get(agentId);
        if (!agent) {
          ws.close(WSErrors.AGENT_NOT_FOUND.code, WSErrors.AGENT_NOT_FOUND.reason);
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
        if (!agent)
          ws.close(WSErrors.AGENT_NOT_FOUND.code, WSErrors.AGENT_NOT_FOUND.reason);
        else if (agent.status() !== 'connected')
          ws.close(WSErrors.AGENT_NOT_CONNECTED.code, WSErrors.AGENT_NOT_CONNECTED.reason);
        else
          agent.workerConnected(workerId, ws);
        return;
      }
    });
  }

  public async createAgent(): Promise<{ error: any }> {
    const { initPromise } = this._createAgent();
    return await initPromise;
  }

  private _createAgent(): {agent: GridAgent, initPromise: Promise<{ error: any }>} {
    const agent = new GridAgent(this._factory.capacity, this._factory.launchTimeout, this._factory.retireTimeout);
    this._agents.set(agent.agentId, agent);
    agent.on('close', () => {
      this._agents.delete(agent.agentId);
    });
    const initPromise = Promise.resolve()
        .then(() => this._factory.launch({
          agentId: agent.agentId,
          gridURL: this._server.urlPrefix(),
          playwrightVersion: getPlaywrightVersion(),
        })).then(() => {
          this._log('created');
          return { error: undefined };
        }).catch(error => {
          this._log('failed to launch agent ' + agent.agentId);
          // eslint-disable-next-line no-console
          console.error(error);
          agent.closeAgent(WSErrors.AGENT_CREATION_FAILED);
          return { error };
        });
    return { agent, initPromise };
  }

  _securePath(suffix: string): string {
    return this._authToken ? '/' + this._authToken + suffix : suffix;
  }

  private _state(): string {
    return `
        <section style="display: flex; flex-direction: row">
          <div style="display: flex; flex-direction: column; align-items: end; margin-right: 1ex;">
            <span>Grid Playwright Version:</span>
            <span>Agent Factory:</span>
            <span>Agents:</span>
          </div>
          <div style="display: flex; flex-direction: column">
            <span>${this._pwVersion}</span>
            <span>${this._factory.name}</span>
            <span>${this._agents.size} <a href="./stopAll">(Stop All)</a></span>
          </div>
        </section>
        <hr/>
        <ul>
          ${[...this._agents].map(([agentId, agent]) => `
            <li>
              <div>Agent <code>${mangle(agentId)}</code>: ${agent.status()}</div>
              <div>Workers: ${agent._workers.size}</div>
              <ul>
                ${[...agent._workers].map(([workerId, worker]) => `
                  <li>worker <code>${mangle(workerId)}</code> - ${JSON.stringify(worker.debugInfo())}</li>
                `)}
              </ul>
            </li>
          `)}
        </ul>
    `;
  }

  async start(port?: number) {
    await this._server.start(port);
  }

  urlPrefix(): string {
    return this._server.urlPrefix() + this._securePath('/');
  }

  async stop() {
    for (const agent of this._agents.values())
      agent.closeAgent(WSErrors.GRID_SHUTDOWN);
    assert(this._agents.size === 0);
    await this._server.stop();
  }
}

function mangle(sessionId: string) {
  return sessionId.replace(/\w{28}/, 'x'.repeat(28));
}
