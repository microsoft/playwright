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

const StatusApp: React.FC = () => {
  const [connectedTabs, setConnectedTabs] = useState<chrome.tabs.Tab[]>([]);
  const [clientName, setClientName] = useState<string | undefined>(undefined);

  useEffect(() => {
    void loadStatus();
  }, []);

  const loadStatus = async () => {
    const { connectedTabIds, clientName } = await chrome.runtime.sendMessage({ type: 'getConnectionStatus' });
    const tabs = await Promise.all((connectedTabIds as number[] ?? []).map(tabId => chrome.tabs.get(tabId)));
    setConnectedTabs(tabs);
    setClientName(clientName);
  };

  const openTab = async (tabId: number) => {
    await chrome.tabs.update(tabId, { active: true });
    window.close();
  };

  const disconnect = async () => {
    await chrome.runtime.sendMessage({ type: 'disconnect' });
    window.close();
  };

  return (
    <div className='app-container'>
      <div className='content-wrapper'>
        {connectedTabs.length > 0 ? (
          <div>
            <div className='connection-header'>
              <div className='client-info'>
                Connected to <strong>"{clientName || 'unknown'}"</strong>
              </div>
              <Button variant='primary' onClick={disconnect}>
                Disconnect
              </Button>
            </div>
            <div className='tab-section-title'>
              {connectedTabs.length === 1 ? 'Accessible page:' : 'Accessible pages:'}
            </div>
            <div>
              {connectedTabs.map(tab => (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  onClick={() => openTab(tab.id!)}
                />
              ))}
            </div>
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
