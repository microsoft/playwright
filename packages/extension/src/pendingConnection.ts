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

import { RelayConnection, debugLog } from './relayConnection';

// A RelayConnection opened by the connect page that has not yet been promoted
// to an active ConnectedTabGroup (the user hasn't picked a tab). Owns the
// RelayConnection until `connection` is handed off.
export class PendingConnection {
  readonly connection: RelayConnection;
  readonly selectorTabId: number;
  onclose?: () => void;

  private constructor(connection: RelayConnection, selectorTabId: number) {
    this.connection = connection;
    this.selectorTabId = selectorTabId;
    this.connection.onclose = () => this.onclose?.();
  }

  static async connect(selectorTabId: number, mcpRelayUrl: string, protocolVersion: number): Promise<PendingConnection> {
    try {
      const socket = new WebSocket(mcpRelayUrl);
      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve();
        socket.onerror = () => reject(new Error('WebSocket error'));
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
      const connection = new RelayConnection(socket, protocolVersion);
      return new PendingConnection(connection, selectorTabId);
    } catch (error: any) {
      const message = `Failed to connect to MCP relay: ${error.message}`;
      debugLog(message);
      throw new Error(message);
    }
  }

  close(reason: string): void {
    this.connection.close(reason);
  }
}

// Collection of PendingConnections keyed by their selector (connect page) tab.
// Owns the tab-removal listener that closes pendings whose selector tab went
// away, and notifies the connect page when the relay drops its socket.
export class PendingConnections {
  private _map = new Map<number, PendingConnection>();

  constructor() {
    chrome.tabs.onRemoved.addListener(this._onTabRemoved.bind(this));
  }

  async create(selectorTabId: number, mcpRelayUrl: string, protocolVersion: number): Promise<void> {
    const pending = await PendingConnection.connect(selectorTabId, mcpRelayUrl, protocolVersion);
    pending.onclose = () => {
      const existed = this._map.delete(selectorTabId);
      if (existed)
        chrome.tabs.sendMessage(selectorTabId, { type: 'pendingConnectionClosed' }).catch(() => {});
    };
    this._map.set(selectorTabId, pending);
  }

  reject(selectorTabId: number): void {
    const pending = this._map.get(selectorTabId);
    if (!pending)
      return;
    this._map.delete(selectorTabId);
    pending.close('Rejected by user');
  }

  // Hands off ownership of the pending connection. The caller is expected to
  // immediately transfer its RelayConnection to an active ConnectedTabGroup, which
  // replaces `onclose` so the pending's handler no longer fires.
  take(selectorTabId: number): PendingConnection | undefined {
    const pending = this._map.get(selectorTabId);
    if (pending)
      this._map.delete(selectorTabId);
    return pending;
  }

  private _onTabRemoved(tabId: number): void {
    const pending = this._map.get(tabId);
    if (!pending)
      return;
    this._map.delete(tabId);
    pending.close('Browser tab closed');
  }
}
