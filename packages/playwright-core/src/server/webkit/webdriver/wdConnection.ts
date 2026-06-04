/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ProtocolError } from '../../protocolError';

import type { RecentLogsCollector } from '@utils/debugLogger';
import type { ProtocolLogger } from '../../types';

export type WDCapabilities = Record<string, any>;

type WDResponse = { value: any };

// Classic W3C WebDriver HTTP client: synchronous request/response, no events.
export class WDConnection {
  readonly baseURL: string;
  private readonly _protocolLogger: ProtocolLogger;
  private readonly _browserLogsCollector: RecentLogsCollector;
  private _closed = false;
  // safaridriver processes one command per session at a time, and overlapping
  // requests get reordered by the driver (e.g. a pointerUp landing a cycle late,
  // breaking clicks). Serialize every command onto a single chain.
  private _commandChain: Promise<void> = Promise.resolve();

  constructor(baseURL: string, protocolLogger: ProtocolLogger, browserLogsCollector: RecentLogsCollector) {
    this.baseURL = baseURL.replace(/\/$/, '');
    this._protocolLogger = protocolLogger;
    this._browserLogsCollector = browserLogsCollector;
  }

  command(httpMethod: 'GET' | 'POST' | 'DELETE', path: string, body?: any): Promise<any> {
    const result = this._commandChain.then(() => this._sendCommand(httpMethod, path, body));
    this._commandChain = result.then(() => {}, () => {});
    return result;
  }

  private async _sendCommand(httpMethod: 'GET' | 'POST' | 'DELETE', path: string, body?: any): Promise<any> {
    if (this._closed)
      throw this._error('closed', undefined, 'WebDriver connection is closed');
    const url = `${this.baseURL}${path}`;
    this._protocolLogger('send', { method: `${httpMethod} ${path}`, params: body } as any);
    let res: Response;
    try {
      res = await fetch(url, {
        method: httpMethod,
        headers: body !== undefined ? { 'Content-Type': 'application/json; charset=utf-8' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw this._error('closed', `${httpMethod} ${path}`, `WebDriver request failed: ${(e as Error).message}`);
    }
    const text = await res.text();
    let json: WDResponse | undefined;
    try {
      json = text ? JSON.parse(text) as WDResponse : undefined;
    } catch {
      throw this._error('error', `${httpMethod} ${path}`, `Non-JSON WebDriver response (${res.status}): ${text.slice(0, 200)}`);
    }
    this._protocolLogger('receive', { result: json?.value } as any);
    const value = json?.value;
    if (!res.ok || (value && typeof value === 'object' && typeof value.error === 'string')) {
      const error = (value && value.error) || `HTTP ${res.status}`;
      const message = (value && value.message) || res.statusText;
      this._browserLogsCollector.log(`webdriver error ${error}: ${message}`);
      throw this._error('error', `${httpMethod} ${path}`, `${error}: ${message}`);
    }
    return value;
  }

  private _error(type: 'error' | 'closed', method: string | undefined, message: string): ProtocolError {
    const error = new ProtocolError(type, method);
    error.setMessage(message);
    return error;
  }

  isClosed(): boolean {
    return this._closed;
  }

  close() {
    this._closed = true;
  }
}

// A WebDriver session: a sessionId plus the per-session endpoints we use.
export class WDSession {
  readonly connection: WDConnection;
  readonly sessionId: string;

  constructor(connection: WDConnection, sessionId: string) {
    this.connection = connection;
    this.sessionId = sessionId;
  }

  static async create(connection: WDConnection, capabilities: WDCapabilities): Promise<WDSession> {
    const value = await connection.command('POST', '/session', { capabilities });
    if (!value.sessionId)
      throw new Error('WebDriver did not return a sessionId');
    return new WDSession(connection, value.sessionId);
  }

  send(httpMethod: 'GET' | 'POST' | 'DELETE', command: string, body?: any): Promise<any> {
    return this.connection.command(httpMethod, `/session/${this.sessionId}/${command}`, body);
  }

  // Runs a script that resolves a callback (its last argument), so we can await
  // promises that `execute/sync` would drop.
  executeAsync(script: string, args: any[] = []): Promise<any> {
    return this.send('POST', 'execute/async', { script, args });
  }

  navigate(url: string): Promise<void> {
    return this.send('POST', 'url', { url });
  }

  currentUrl(): Promise<string> {
    return this.send('GET', 'url');
  }

  windowHandle(): Promise<string> {
    return this.send('GET', 'window');
  }

  reload(): Promise<void> {
    return this.send('POST', 'refresh');
  }

  back(): Promise<void> {
    return this.send('POST', 'back');
  }

  forward(): Promise<void> {
    return this.send('POST', 'forward');
  }

  // Base64-encoded PNG of the current viewport.
  screenshot(): Promise<string> {
    return this.send('GET', 'screenshot');
  }

  getCookies(): Promise<any[]> {
    return this.send('GET', 'cookie');
  }

  addCookie(cookie: any): Promise<void> {
    return this.send('POST', 'cookie', { cookie });
  }

  deleteAllCookies(): Promise<void> {
    return this.send('DELETE', 'cookie');
  }

  performActions(actions: any[]): Promise<void> {
    return this.send('POST', 'actions', { actions });
  }

  async delete(): Promise<void> {
    await this.connection.command('DELETE', `/session/${this.sessionId}`).catch(() => {});
  }
}
