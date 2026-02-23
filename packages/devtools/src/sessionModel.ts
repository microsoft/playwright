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

import type { ClientInfo, SessionConfig } from '../../playwright/src/cli/client/registry';

export type SessionStatus = {
  config: SessionConfig;
  canConnect: boolean;
};

type Listener = () => void;

export class SessionModel {
  sessions: SessionStatus[] = [];
  readonly wsUrls: Map<string, string | null> = new Map();
  clientInfo: ClientInfo | undefined;
  error: string | undefined;
  loading = true;

  private _knownTimestamps = new Map<string, number>();
  private _pollActive = false;
  private _pollTimeout: ReturnType<typeof setTimeout> | undefined;
  private _lastJson = '';
  private _listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _notify() {
    for (const listener of this._listeners)
      listener();
  }

  startPolling() {
    if (this._pollActive)
      return;
    this._pollActive = true;
    const poll = async () => {
      await this._fetchSessions();
      if (this._pollActive)
        this._pollTimeout = setTimeout(poll, 3000);
    };
    void poll();
  }

  stopPolling() {
    this._pollActive = false;
    if (this._pollTimeout) {
      clearTimeout(this._pollTimeout);
      this._pollTimeout = undefined;
    }
  }

  sessionBySocketPath(socketPath: string): SessionStatus | undefined {
    return this.sessions.find(s => s.config.socketPath === socketPath);
  }

  private async _fetchSessions() {
    try {
      this.loading = true;
      const response = await fetch('/api/sessions/list');
      if (!response.ok)
        throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (text !== this._lastJson) {
        this._lastJson = text;
        const data = JSON.parse(text);
        this.sessions = data.sessions;
        this.clientInfo = data.clientInfo;
        this._notify();

        for (const session of this.sessions) {
          if (session.canConnect)
            this._obtainDevtoolsUrl(session.config);
        }
      }
      this.error = undefined;
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
    this._notify();
  }

  async fetchSessions() {
    await this._fetchSessions();
  }

  async closeSession(config: SessionConfig) {
    await fetch('/api/sessions/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    await this._fetchSessions();
  }

  async deleteSessionData(config: SessionConfig) {
    await fetch('/api/sessions/delete-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    await this._fetchSessions();
  }

  private _obtainDevtoolsUrl(config: SessionConfig) {
    if (this._knownTimestamps.get(config.socketPath) === config.timestamp)
      return;
    this._knownTimestamps.set(config.socketPath, config.timestamp);
    fetch('/api/sessions/devtools-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    }).then(async resp => {
      if (resp.ok) {
        const { url } = await resp.json();
        this.wsUrls.set(config.socketPath, url);
      } else {
        this.wsUrls.set(config.socketPath, null);
      }
      this._notify();
    }).catch(() => {
      this._knownTimestamps.delete(config.socketPath);
    });
  }

  dispose() {
    this.stopPolling();
    this._listeners.clear();
  }
}
