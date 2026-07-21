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

type ConnectionInfo = {
  id: number;
  clientName?: string;
  label: string;
  connectedTabIds: number[];
};

type ConnectionView = {
  info: ConnectionInfo;
  tabs: chrome.tabs.Tab[];
};

const StatusApp: React.FC = () => {
  const [connections, setConnections] = useState<ConnectionView[]>([]);

  useEffect(() => {
    void loadStatus();
  }, []);

  const loadStatus = async () => {
    const { connections: infos } = await chrome.runtime.sendMessage({ type: 'getConnectionStatus' });
    const views = await Promise.all(((infos ?? []) as ConnectionInfo[]).map(async info => {
      const tabs = await Promise.all(info.connectedTabIds.map(tabId => chrome.tabs.get(tabId).catch(() => undefined)));
      return { info, tabs: tabs.filter((tab): tab is chrome.tabs.Tab => tab !== undefined) };
    }));
    setConnections(views);
  };

  const openTab = async (tabId: number) => {
    await chrome.tabs.update(tabId, { active: true });
    window.close();
  };

  const disconnect = async (connectionId: number) => {
    await chrome.runtime.sendMessage({ type: 'disconnect', connectionId });
    await loadStatus();
  };

  return (
    <div className='app-container'>
      <div className='content-wrapper'>
        {connections.length > 0 ? connections.map(({ info, tabs }) => (
          <div key={info.id}>
            <div className='connection-header'>
              <div className='client-info'>
                Connected to <strong>"{info.label}"</strong>
              </div>
              <Button variant='primary' onClick={() => disconnect(info.id)}>
                Disconnect
              </Button>
            </div>
            <div className='tab-section-title'>
              {tabs.length === 1 ? 'Accessible page:' : 'Accessible pages:'}
            </div>
            <div>
              {tabs.map(tab => (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  onClick={() => openTab(tab.id!)}
                />
              ))}
            </div>
          </div>
        )) : (
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
