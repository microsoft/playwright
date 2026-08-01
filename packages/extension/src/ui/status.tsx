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

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, TabItem  } from './tabItem';
import { AuthTokenSection } from './authToken';

type ConnectionStatus = {
  connectionId: string;
  clientName?: string;
  taskId: string;
  connectedTabIds: number[];
};

type ConnectionView = Omit<ConnectionStatus, 'connectedTabIds'> & {
  tabs: chrome.tabs.Tab[];
};

const StatusApp: React.FC = () => {
  const [connections, setConnections] = useState<ConnectionView[]>([]);
  const [disconnecting, setDisconnecting] = useState<Set<string>>(new Set());

  useEffect(() => {
    void loadStatus();
  }, []);

  const loadStatus = async () => {
    const response = await chrome.runtime.sendMessage({ type: 'getConnectionStatus' });
    const views = await Promise.all((response.connections as ConnectionStatus[] ?? []).map(async connection => ({
      connectionId: connection.connectionId,
      clientName: connection.clientName,
      taskId: connection.taskId,
      tabs: (await Promise.all(connection.connectedTabIds.map(tabId => chrome.tabs.get(tabId).catch(() => undefined))))
          .filter((tab): tab is chrome.tabs.Tab => !!tab),
    })));
    setConnections(views);
  };

  const openTab = async (tabId: number) => {
    await chrome.tabs.update(tabId, { active: true });
    window.close();
  };

  const disconnect = async (connectionId: string) => {
    setDisconnecting(current => new Set(current).add(connectionId));
    try {
      await chrome.runtime.sendMessage({ type: 'disconnect', connectionId });
      await loadStatus();
    } finally {
      setDisconnecting(current => {
        const next = new Set(current);
        next.delete(connectionId);
        return next;
      });
    }
  };

  return (
    <div className='app-container'>
      <div className='content-wrapper'>
        {connections.length > 0 ? (
          <div>
            {connections.map(connection => (
              <section className='connection-section' key={connection.connectionId}>
                <div className='connection-header'>
                  <div className='client-info'>
                    <div>Connected client: <strong>"{connection.clientName || 'unknown'}"</strong></div>
                    <div className='task-info' title={connection.taskId}>Task: <strong>{connection.taskId}</strong></div>
                  </div>
                  <Button
                    variant='primary'
                    onClick={() => disconnect(connection.connectionId)}
                    disabled={disconnecting.has(connection.connectionId)}
                    ariaLabel={`Disconnect ${connection.clientName || 'unknown'} task ${connection.taskId}`}
                  >
                    {disconnecting.has(connection.connectionId) ? 'Disconnecting…' : 'Disconnect'}
                  </Button>
                </div>
                <div className='tab-section-title'>
                  {connection.tabs.length === 0 ? 'No accessible pages.' : connection.tabs.length === 1 ? 'Accessible page:' : 'Accessible pages:'}
                </div>
                <div>
                  {connection.tabs.map(tab => (
                    <TabItem
                      key={tab.id}
                      tab={tab}
                      onClick={() => openTab(tab.id!)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className='status-banner'>
            No clients are currently connected. You can connect from the Playwright CLI or MCP server by passing the --extension flag.
          </div>
        )}
        <AuthTokenSection />
      </div>
    </div>
  );
};

// Initialize the React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<StatusApp />);
}
