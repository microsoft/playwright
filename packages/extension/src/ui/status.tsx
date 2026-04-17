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

import type { TabInfo } from './tabItem';
import { AuthTokenSection } from './authToken';

const StatusApp: React.FC = () => {
  const [connectedTabs, setConnectedTabs] = useState<TabInfo[]>([]);

  useEffect(() => {
    void loadStatus();
  }, []);

  const loadStatus = async () => {
    const { connectedTabIds } = await chrome.runtime.sendMessage({ type: 'getConnectionStatus' });
    const tabs: TabInfo[] = [];
    for (const tabId of (connectedTabIds as number[] ?? [])) {
      try {
        const tab = await chrome.tabs.get(tabId);
        tabs.push({
          id: tab.id!,
          windowId: tab.windowId!,
          title: tab.title!,
          url: tab.url!,
          favIconUrl: tab.favIconUrl
        });
      } catch {
        // Tab may have been closed.
      }
    }
    setConnectedTabs(tabs);
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
            <div className='tab-section-title'>
              {connectedTabs.length === 1 ? 'Page connected to Playwright client:' : 'Pages connected to Playwright client:'}
            </div>
            <div>
              {connectedTabs.map((tab, index) => (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  button={index === 0 ? (
                    <Button variant='primary' onClick={disconnect}>
                      Disconnect
                    </Button>
                  ) : undefined}
                  onClick={() => openTab(tab.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className='status-banner'>
            No MCP clients are currently connected.
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
