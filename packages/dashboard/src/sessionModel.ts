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

import type { ClientInfo } from '../../playwright-core/src/tools/cli-client/registry';
import type { BrowserDescriptor, BrowserStatus } from '../../playwright-core/src/serverRegistry';

export type SessionStatus = BrowserStatus;

type Listener = () => void;

type SessionsChannel = {
  on(event: 'sessions', listener: (params: { sessions: SessionStatus[]; clientInfo: ClientInfo }) => void): void;
  off(event: 'sessions', listener: (params: { sessions: SessionStatus[]; clientInfo: ClientInfo }) => void): void;
  closeSession(params: { browser: string }): Promise<void>;
  deleteSessionData(params: { browser: string }): Promise<void>;
};

export class SessionModel {
  sessions: SessionStatus[] = [];
  clientInfo: ClientInfo | undefined;
  loading = true;

  private _client: SessionsChannel;
  private _listeners = new Set<Listener>();
  private _onSessions = (params: { sessions: SessionStatus[]; clientInfo: ClientInfo }) => {
    this.sessions = params.sessions;
    this.clientInfo = params.clientInfo;
    this.loading = false;
    this._notify();
  };

  constructor(client: SessionsChannel) {
    this._client = client;
    this._client.on('sessions', this._onSessions);
  }

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _notify() {
    for (const listener of this._listeners)
      listener();
  }

  sessionByGuid(guid: string): SessionStatus | undefined {
    return this.sessions.find(s => s.browser.guid === guid);
  }

  async closeSession(descriptor: BrowserDescriptor) {
    await this._client.closeSession({ browser: descriptor.browser.guid });
  }

  async deleteSessionData(descriptor: BrowserDescriptor) {
    await this._client.deleteSessionData({ browser: descriptor.browser.guid });
  }

  dispose() {
    this._client.off('sessions', this._onSessions);
    this._listeners.clear();
  }
}
