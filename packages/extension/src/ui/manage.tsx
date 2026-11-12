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
import { Button, PageHeader, TabItem } from './tabItem';
import { AuthTokenSection } from './authToken';

import type { PageMessage, SessionStatus } from '../types';

type Connection = {
  id: number;
  clientName: string;
  tabs: chrome.tabs.Tab[];
};

const ManageApp: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);

  const loadStatus = async () => {
    const response = await chrome.runtime.sendMessage<PageMessage>({ type: 'getStatus' });
    const sessions = response.sessions as SessionStatus[];
    const loaded = await Promise.all(sessions.map(async ({ id, clientName, tabIds }) => {
      const tabs = await Promise.all(tabIds.map(tabId => chrome.tabs.get(tabId).catch(() => undefined)));
      return { id, clientName, tabs: tabs.filter(tab => !!tab) };
    }));
    setConnections(loaded);
  };

  useEffect(() => {
    void loadStatus();
    // Each change of a client or of its tabs is also a change of a tab.
    const reload = () => void loadStatus();
    const events = [chrome.tabs.onCreated, chrome.tabs.onUpdated, chrome.tabs.onRemoved];
    for (const event of events)
      event.addListener(reload);
    return () => {
      for (const event of events)
        event.removeListener(reload);
    };
  }, []);

  const openTab = async (tab: chrome.tabs.Tab) => {
    await chrome.tabs.update(tab.id!, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  };

  const disconnect = async (sessionId: number) => {
    await chrome.runtime.sendMessage<PageMessage>({ type: 'disconnect', sessionId });
    await loadStatus();
  };

  return (
    <div className='page'>
      <PageHeader />
      <h2 className='section-title'>Connected clients</h2>
      {connections.map(connection => (
        <div className='card connection' key={connection.id}>
          <div className='card-header'>
            <div>
              <h2 className='card-title'>{connection.clientName}</h2>
              <div className='muted'>{connection.tabs.length === 1 ? '1 tab' : `${connection.tabs.length} tabs`}</div>
            </div>
            <Button variant='default' onClick={() => disconnect(connection.id)}>Disconnect</Button>
          </div>
          {connection.tabs.length > 0 && (
            <div className='list'>
              {connection.tabs.map(tab => <TabItem key={tab.id} tab={tab} onClick={() => openTab(tab)} />)}
            </div>
          )}
        </div>
      ))}
      {!connections.length && (
        <div className='card'>
          <div className='status-banner empty'>
            No clients are connected. To connect a client, start the Playwright CLI or the Playwright MCP server with the --extension flag.
          </div>
        </div>
      )}
      <AuthTokenSection />
    </div>
  );
};

// Initialize the React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<ManageApp />);
}
