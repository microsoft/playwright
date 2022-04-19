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

import { debug } from '../utilsBundle';
import { EventEmitter } from 'events';
import { URL } from 'url';
import type { WebSocketServer, WebSocket, WebSocketRawData } from '../utilsBundle';
import { HttpServer } from '../utils/httpServer';
import { assert, createGuid } from '../utils';
import { getPlaywrightVersion } from '../common/userAgent';

const defaultOS = 'linux';

export type GridAgentLaunchOptions = {
  agentId: string,
  gridURL: string,
  playwrightVersion: string,
  os: string,
};

export type GridFactory = {
  name?: string,
  capacity?: number,
  launchTimeout?: number,
  retireTimeout?: number,
  statusUrl?: (runId: string) => string;
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
  CLIENT_UNSUPPORTED_OS: { code: 1013, reason: 'Unsupported OS' },
  GRID_SHUTDOWN: { code: 1000, reason: 'Grid was shutdown' },
  AGENT_MANUALLY_STOPPED: { code: 1000, reason: 'Grid agent was manually stopped' },
};


type GridWorkerParams = {
  browserAlias?: string;
  headless?: boolean;
};

class GridWorker extends EventEmitter {
  readonly workerId = createGuid();
  readonly params: GridWorkerParams;
  private _workerSocket: WebSocket | undefined;
  private _clientSocket: WebSocket;
  private _log: debug.Debugger;
  private _bufferedMessages: WebSocketRawData[] = [];

  constructor(clientSocket: WebSocket, params: GridWorkerParams) {
    super();
    this._log = debug(`pw:grid:worker:${this.workerId}`);
    this._clientSocket = clientSocket;
    this.params = params;
    clientSocket.on('close', (code: number, reason: string) => this.closeWorker(WSErrors.NO_ERROR));
    clientSocket.on('error', (error: Error) => this.closeWorker(WSErrors.CLIENT_SOCKET_ERROR));
    // clientSocket.pause() would be preferrable but according to the docs " Some events can still be
    // emitted after it is called, until all buffered data is consumed."
    this._clientSocket.on('message', data => {
      if (this._workerSocket)
        this._workerSocket.send(data);
      else
        this._bufferedMessages.push(data);
    });
  }

  workerConnected(workerSocket: WebSocket) {
    this._log('connected');
    this._workerSocket = workerSocket;
    workerSocket.on('close', (code: number, reason: string) => this.closeWorker(WSErrors.NO_ERROR));
    workerSocket.on('error', (error: Error) => this.closeWorker(WSErrors.WORKER_SOCKET_ERROR));
    workerSocket.on('message', data => this._clientSocket!.send(data));
    for (const data of this._bufferedMessages)
      workerSocket.send(data);
    this._bufferedMessages = [];
  }

  closeWorker(errorCode: ErrorCode) {
    this._log(`close ${errorCode.reason}`);
    this._workerSocket?.close(errorCode.code, errorCode.reason);
    this._clientSocket.close(errorCode.code, errorCode.reason);
    this.emit('close');
  }

  debugInfo() {
    return { worker: !!this._workerSocket, client: !!this._clientSocket };
  }
}

type AgentStatus = 'none' | 'created' | 'connected' | 'idle';

class GridAgent extends EventEmitter {
  private _capacity: number;
  readonly agentId = createGuid();
  readonly os: string;
  private _ws: WebSocket | undefined;
  runId: string | undefined;
  readonly _workers = new Map<string, GridWorker>();
  private _status: AgentStatus = 'none';
  private _workersWaitingForAgentConnected: Set<GridWorker> = new Set();
  private _retireTimeout = 30000;
  private _retireTimeoutId: NodeJS.Timeout | undefined;
  private _log: debug.Debugger;
  private _agentCreationTimeoutId: NodeJS.Timeout;

  constructor(os: string, capacity = Infinity, creationTimeout = 5 * 60000, retireTimeout = 30000) {
    super();
    this.os = os;
    this._capacity = capacity;
    this._log = debug(`pw:grid:agent:${this.agentId}`);
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

  agentConnected(ws: WebSocket, runId?: string) {
    clearTimeout(this._agentCreationTimeoutId);
    this.setStatus('connected');
    this._ws = ws;
    this.runId = runId;
    for (const worker of this._workersWaitingForAgentConnected)
      this._sendStartWorkerMessage(worker);
    this._workersWaitingForAgentConnected.clear();
  }

  canCreateWorker(os: string) {
    return this.os === os && this._workers.size < this._capacity;
  }

  async createWorker(clientSocket: WebSocket, params: GridWorkerParams) {
    if (this._retireTimeoutId)
      clearTimeout(this._retireTimeoutId);
    if (this._ws)
      this.setStatus('connected');
    const worker = new GridWorker(clientSocket, params);
    this._log(`create worker: ${worker.workerId}`);
    this._workers.set(worker.workerId, worker);
    worker.on('close', () => {
      this._workers.delete(worker.workerId);
      this._workersWaitingForAgentConnected.delete(worker);
      if (!this._workers.size) {
        this.setStatus('idle');
        if (this._retireTimeoutId)
          clearTimeout(this._retireTimeoutId);
        if (this._retireTimeout && isFinite(this._retireTimeout))
          this._retireTimeoutId = setTimeout(() => this.closeAgent(WSErrors.AGENT_RETIRED), this._retireTimeout);
      }
    });
    if (this._ws)
      this._sendStartWorkerMessage(worker);
    else
      this._workersWaitingForAgentConnected.add(worker);
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

  private _sendStartWorkerMessage(worker: GridWorker) {
    const message = JSON.stringify({
      ...worker.params,
      'workerId': worker.workerId,
    });
    this._log(`start worker message: ${message}`);
    assert(this._ws);
    this._ws.send(message);
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

  constructor(factory: GridFactory, authToken: string = '', address: string = '') {
    this._log = debug(`pw:grid:server`);
    this._log(`using factory ${factory.name}`);
    this._authToken = authToken || '';
    this._server = new HttpServer(address);
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
      if (request.url!.startsWith(this._securePath('/claimWorker')) ||
          request.url!.startsWith(this._securePath('/registerAgent')) ||
          request.url!.startsWith(this._securePath('/registerWorker'))) {
        // shouldHandle claims it accepts promise, except it doesn't.
        return true;
      }
      this._log('rejecting websocket request');
      return false;
    };

    this._wsServer.on('connection', async (ws, request) => {
      if (request.url?.startsWith(this._securePath('/claimWorker'))) {
        const params = new URL('http://localhost/' + request.url).searchParams;
        const version = params.get('pwVersion');
        if (version !== this._pwVersion && !process.env.PWTEST_UNSAFE_GRID_VERSION) {
          this._log(`version mismatch: ${version} !== ${this._pwVersion}`);
          ws.close(WSErrors.CLIENT_PLAYWRIGHT_VERSION_MISMATCH.code, WSErrors.CLIENT_PLAYWRIGHT_VERSION_MISMATCH.reason);
          return;
        }
        const os = params.get('os') || defaultOS;
        const agent = [...this._agents.values()].find(w => w.canCreateWorker(os)) || this._createAgent(os)?.agent;
        if (!agent) {
          this._log(`failed to get agent`);
          ws.close(WSErrors.AGENT_CREATION_FAILED.code, WSErrors.AGENT_CREATION_FAILED.reason);
          return;
        }

        agent.createWorker(ws, {
          browserAlias: request.headers['x-playwright-browser'] as string | undefined,
          headless: request.headers['x-playwright-headless'] !== '0',
        });
        return;
      }

      if (request.url?.startsWith(this._securePath('/registerAgent'))) {
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

        const runId = params.get('runId') || undefined;
        agent.agentConnected(ws, runId);
        return;
      }

      if (request.url?.startsWith(this._securePath('/registerWorker'))) {
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
    const { initPromise } = this._createAgent(defaultOS);
    return await initPromise;
  }

  private _createAgent(os: string): { agent: GridAgent, initPromise: Promise<{ error: any }> } {
    const agent = new GridAgent(os, this._factory.capacity, this._factory.launchTimeout, this._factory.retireTimeout);
    this._agents.set(agent.agentId, agent);
    agent.on('close', () => {
      this._agents.delete(agent.agentId);
    });
    const initPromise = Promise.resolve()
        .then(() => this._factory.launch({
          agentId: agent.agentId,
          gridURL: this.gridURL(),
          playwrightVersion: getPlaywrightVersion(),
          os
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
    const linkifyStatus = (agent: GridAgent) => {
      if (agent.runId && this._factory.statusUrl)
        return `<a href="${this._factory.statusUrl(agent.runId)}">${agent.status()}</a>`;
      return agent.status();
    };
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
              <div>Agent (${agent.os}) <code>${mangle(agentId)}</code>: ${linkifyStatus(agent)}</div>
              <div>Workers: ${agent._workers.size}</div>
              <ul>
                ${[...agent._workers].map(([workerId, worker]) => `
                  <li>worker <code>${mangle(workerId)}</code> - ${JSON.stringify(worker.debugInfo())}</li>
                `).join('')}
              </ul>
            </li>
          `).join('')}
        </ul>
    `;
  }

  async start(port?: number) {
    await this._server.start(port);
  }

  gridURL(): string {
    return this._server.urlPrefix() + this._securePath('');
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
