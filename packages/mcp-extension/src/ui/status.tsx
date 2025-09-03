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

interface ConnectionStatus {
  isConnected: boolean;
  connectedTabId: number | null;
  connectedTab?: TabInfo;
}

const StatusApp: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>({
    isConnected: false,
    connectedTabId: null
  });

  useEffect(() => {
    void loadStatus();
  }, []);

  const loadStatus = async () => {
    // Get current connection status from background script
    const { connectedTabId } = await chrome.runtime.sendMessage({ type: 'getConnectionStatus' });
    if (connectedTabId) {
      const tab = await chrome.tabs.get(connectedTabId);
      setStatus({
        isConnected: true,
        connectedTabId,
        connectedTab: {
          id: tab.id!,
          windowId: tab.windowId!,
          title: tab.title!,
          url: tab.url!,
          favIconUrl: tab.favIconUrl
        }
      });
    } else {
      setStatus({
        isConnected: false,
        connectedTabId: null
      });
    }
  };

  const openConnectedTab = async () => {
    if (!status.connectedTabId)
      return;
    await chrome.tabs.update(status.connectedTabId, { active: true });
    window.close();
  };

  const disconnect = async () => {
    await chrome.runtime.sendMessage({ type: 'disconnect' });
    window.close();
  };

  return (
    <div className='app-container'>
      <div className='content-wrapper'>
        {status.isConnected && status.connectedTab ? (
          <div>
            <div className='tab-section-title'>
              Page with connected MCP client:
            </div>
            <div>
              <TabItem
                tab={status.connectedTab}
                button={
                  <Button variant='primary' onClick={disconnect}>
                    Disconnect
                  </Button>
                }
                onClick={openConnectedTab}
              />
            </div>
          </div>
        ) : (
          <div className='status-banner'>
            No MCP clients are currently connected.
          </div>
        )}
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
