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

import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, TabItem  } from './tabItem';
import type { TabInfo } from './tabItem';

type Status =
  | { type: 'connecting'; message: string }
  | { type: 'connected'; message: string }
  | { type: 'error'; message: string }
  | { type: 'error'; versionMismatch: { extensionVersion: string; } };

const SUPPORTED_PROTOCOL_VERSION = 1;

const ConnectApp: React.FC = () => {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [showButtons, setShowButtons] = useState(true);
  const [showTabList, setShowTabList] = useState(true);
  const [clientInfo, setClientInfo] = useState('unknown');
  const [mcpRelayUrl, setMcpRelayUrl] = useState('');
  const [newTab, setNewTab] = useState<boolean>(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const relayUrl = params.get('mcpRelayUrl');

    if (!relayUrl) {
      setShowButtons(false);
      setStatus({ type: 'error', message: 'Missing mcpRelayUrl parameter in URL.' });
      return;
    }

    setMcpRelayUrl(relayUrl);

    try {
      const client = JSON.parse(params.get('client') || '{}');
      const info = `${client.name}/${client.version}`;
      setClientInfo(info);
      setStatus({
        type: 'connecting',
        message: `🎭 Playwright MCP started from  "${info}" is trying to connect. Do you want to continue?`
      });
    } catch (e) {
      setStatus({ type: 'error', message: 'Failed to parse client version.' });
      return;
    }

    const parsedVersion = parseInt(params.get('protocolVersion') ?? '', 10);
    const requiredVersion = isNaN(parsedVersion) ? 1 : parsedVersion;
    if (requiredVersion > SUPPORTED_PROTOCOL_VERSION) {
      const extensionVersion = chrome.runtime.getManifest().version;
      setShowButtons(false);
      setShowTabList(false);
      setStatus({
        type: 'error',
        versionMismatch: {
          extensionVersion,
        }
      });
      return;
    }

    void connectToMCPRelay(relayUrl);

    // If this is a browser_navigate command, hide the tab list and show simple allow/reject
    if (params.get('newTab') === 'true') {
      setNewTab(true);
      setShowTabList(false);
    } else {
      void loadTabs();
    }
  }, []);

  const handleReject = useCallback((message: string) => {
    setShowButtons(false);
    setShowTabList(false);
    setStatus({ type: 'error', message });
  }, []);

  const connectToMCPRelay = useCallback(async (mcpRelayUrl: string) => {

    const response = await chrome.runtime.sendMessage({ type: 'connectToMCPRelay', mcpRelayUrl  });
    if (!response.success)
      handleReject(response.error);
  }, [handleReject]);

  const loadTabs = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'getTabs' });
    if (response.success)
      setTabs(response.tabs);
    else
      setStatus({ type: 'error', message: 'Failed to load tabs: ' + response.error });
  }, []);

  const handleConnectToTab = useCallback(async (tab?: TabInfo) => {
    setShowButtons(false);
    setShowTabList(false);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'connectToTab',
        mcpRelayUrl,
        tabId: tab?.id,
        windowId: tab?.windowId,
      });

      if (response?.success) {
        setStatus({ type: 'connected', message: `MCP client "${clientInfo}" connected.` });
      } else {
        setStatus({
          type: 'error',
          message: response?.error || `MCP client "${clientInfo}" failed to connect.`
        });
      }
    } catch (e) {
      setStatus({
        type: 'error',
        message: `MCP client "${clientInfo}" failed to connect: ${e}`
      });
    }
  }, [clientInfo, mcpRelayUrl]);

  useEffect(() => {
    const listener = (message: any) => {
      if (message.type === 'connectionTimeout')
        handleReject('Connection timed out.');
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [handleReject]);

  return (
    <div className='app-container'>
      <div className='content-wrapper'>
        {status && (
          <div className='status-container'>
            <StatusBanner status={status} />
            {showButtons && (
              <div className='button-container'>
                {newTab ? (
                  <>
                    <Button variant='primary' onClick={() => handleConnectToTab()}>
                      Allow
                    </Button>
                    <Button variant='reject' onClick={() => handleReject('Connection rejected. This tab can be closed.')}>
                      Reject
                    </Button>
                  </>
                ) : (
                  <Button variant='reject' onClick={() => handleReject('Connection rejected. This tab can be closed.')}>
                    Reject
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {showTabList && (
          <div>
            <div className='tab-section-title'>
              Select page to expose to MCP server:
            </div>
            <div>
              {tabs.map(tab => (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  button={
                    <Button variant='primary' onClick={() => handleConnectToTab(tab)}>
                      Connect
                    </Button>
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const VersionMismatchError: React.FC<{ extensionVersion: string }> = ({ extensionVersion }) => {
  const readmeUrl = 'https://github.com/microsoft/playwright-mcp/blob/main/extension/README.md';
  const latestReleaseUrl = 'https://github.com/microsoft/playwright-mcp/releases/latest';
  return (
    <div>
      Playwright MCP version trying to connect requires newer extension version (current version: {extensionVersion}).{' '}
      <a href={latestReleaseUrl}>Click here</a> to download latest version of the extension, then drag and drop it into the Chrome Extensions page.{' '}
      See <a href={readmeUrl} target='_blank' rel='noopener noreferrer'>installation instructions</a> for more details.
    </div>
  );
};

const StatusBanner: React.FC<{ status: Status }> = ({ status }) => {
  return (
    <div className={`status-banner ${status.type}`}>
      {'versionMismatch' in status ? (
        <VersionMismatchError
          extensionVersion={status.versionMismatch.extensionVersion}
        />
      ) : (
        status.message
      )}
    </div>
  );
};

// Initialize the React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<ConnectApp />);
}
