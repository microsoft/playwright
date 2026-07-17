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

// Relay URLs recorded by `connectionRequested`, keyed by the connect page tab
// id. The relay WebSocket opens lazily in `take` once the user clicks Allow.
export class PendingConnections {
  private _map = new Map<number, string>();

  constructor() {
    chrome.tabs.onRemoved.addListener(tabId => this._map.delete(tabId));
  }

  create(selectorTabId: number, mcpRelayUrl: string): void {
    this._map.set(selectorTabId, mcpRelayUrl);
  }

  async take(selectorTabId: number): Promise<RelayConnection | undefined> {
    const mcpRelayUrl = this._map.get(selectorTabId);
    if (mcpRelayUrl === undefined)
      return undefined;
    this._map.delete(selectorTabId);
    return openRelayConnection(mcpRelayUrl);
  }
}

async function openRelayConnection(mcpRelayUrl: string): Promise<RelayConnection> {
  try {
    const socket = new WebSocket(mcpRelayUrl);
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () => reject(new Error('WebSocket error'));
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
    return new RelayConnection(socket);
  } catch (error: any) {
    const message = `Failed to connect to MCP relay: ${error.message}`;
    debugLog(message);
    throw new Error(message);
  }
}
