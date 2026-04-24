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

import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, NewTabRadioItem, TabRadioItem } from './tabItem';
import { AuthTokenSection, getOrCreateAuthToken } from './authToken';

import type { TabInfo } from './tabItem';

type Status =
  | { type: 'connecting'; message: string }
  | { type: 'connected'; message: string }
  | { type: 'error'; message: string }
  | { type: 'error'; versionMismatch: { extensionVersion: string; } };

const SUPPORTED_PROTOCOL_VERSION = 2;

const NEW_TAB_VALUE = '__new_tab__';

const ConnectApp: React.FC = () => {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [showButtons, setShowButtons] = useState(true);
  const [showTabList, setShowTabList] = useState(true);
  const [clientInfo, setClientInfo] = useState('unknown');
  const [mcpRelayUrl, setMcpRelayUrl] = useState('');
  const [selectedTabKey, setSelectedTabKey] = useState<string>(NEW_TAB_VALUE);

  useEffect(() => {
    const runAsync = async () => {
      const params = new URLSearchParams(window.location.search);
      const relayUrl = params.get('mcpRelayUrl');

      if (!relayUrl) {
        handleReject('Missing mcpRelayUrl parameter in URL.');
        return;
      }

      try {
        const host = new URL(relayUrl).hostname;
        if (host !== '127.0.0.1' && host !== '[::1]') {
          handleReject(`Playwright extension only allows loopback connections (127.0.0.1 or [::1]). Received host: ${host}`);
          return;
        }
      } catch (e) {
        handleReject(`Invalid mcpRelayUrl parameter in URL: ${relayUrl}. ${e}`);
        return;
      }

      setMcpRelayUrl(relayUrl);

      try {
        const client = JSON.parse(params.get('client') || '{}');
        const info = `${client.name || 'unknown'}`;
        setClientInfo(info);
        setStatus({
          type: 'connecting',
          message: `"${info}" wants to connect to this browser using the Playwright Extension.`
        });
      } catch (e) {
        setStatus({ type: 'error', message: 'Failed to parse client version.' });
        return;
      }

      const parsedVersion = parseInt(params.get('protocolVersion') ?? '', 10);
      const requestedVersion = isNaN(parsedVersion) ? 1 : parsedVersion;
      if (requestedVersion > SUPPORTED_PROTOCOL_VERSION) {
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

      const expectedToken = getOrCreateAuthToken();
      const token = params.get('token');
      if (token === expectedToken) {
        await connectToMCPRelay(relayUrl, requestedVersion);
        await handleConnectToTab();
        return;
      }
      if (token) {
        handleReject('Invalid token provided.');
        return;
      }

      await connectToMCPRelay(relayUrl, requestedVersion);

      // If this is a browser_navigate command, hide the tab list and show simple allow/reject
      if (params.get('newTab') === 'true')
        setShowTabList(false);
      else
        await loadTabs();
    };
    void runAsync();
  }, []);

  const handleReject = useCallback((message: string) => {
    setShowButtons(false);
    setShowTabList(false);
    setStatus({ type: 'error', message });
    // Ask the background to close the pending MCP relay connection so the
    // client daemon sees a disconnect and exits.
    chrome.runtime.sendMessage({ type: 'rejectConnection' }).catch(() => {});
  }, []);

  const connectToMCPRelay = useCallback(async (mcpRelayUrl: string, protocolVersion: number) => {
    const response = await chrome.runtime.sendMessage({ type: 'connectToMCPRelay', mcpRelayUrl, protocolVersion });
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
        tabId: tab?.id,
        windowId: tab?.windowId,
        clientName: clientInfo,
      });

      if (response?.success) {
        setStatus({ type: 'connected', message: `"${clientInfo}" connected.` });
      } else {
        setStatus({
          type: 'error',
          message: response?.error || `"${clientInfo}" failed to connect.`
        });
      }
    } catch (e) {
      setStatus({
        type: 'error',
        message: `"${clientInfo}" failed to connect: ${e}`
      });
    }
  }, [clientInfo, mcpRelayUrl]);

  const handleAllow = useCallback(() => {
    if (selectedTabKey === NEW_TAB_VALUE || !showTabList) {
      void handleConnectToTab();
      return;
    }
    const tab = tabs.find(t => String(t.id) === selectedTabKey);
    void handleConnectToTab(tab);
  }, [handleConnectToTab, selectedTabKey, showTabList, tabs]);

  useEffect(() => {
    const listener = (message: any) => {
      if (message.type === 'pendingConnectionClosed') {
        handleReject('Pending client connection closed.');
        document.title = 'Playwright Extension';
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [handleReject]);

  const isConnecting = status?.type === 'connecting';

  return (
    <div className='app-container'>
      <div className='content-wrapper'>
        {status && <StatusHeader status={status} />}

        {isConnecting && (
          <div className='warning-text'>
            <span className='warning-icon' aria-hidden='true'>⚠</span>
            Allowing this connection exposes the entire browser to the client,
            including any signed-in sessions, cookies, and content in other tabs and windows.
            Once approved, the client may also be able to reconnect later without showing this dialog again,
            unless you regenerate the token below and then restart the browser.
          </div>
        )}

        {isConnecting && showTabList && (
          <div className='tab-section'>
            <div className='tab-section-title'>
              Select a tab to allow, or open a new one. You can drag more tabs into the Playwright tab group later.
            </div>
            <div className='tab-list' role='radiogroup' aria-label='Select a tab'>
              {tabs.map(tab => (
                <TabRadioItem
                  key={tab.id}
                  tab={tab}
                  name='connect-tab'
                  checked={selectedTabKey === String(tab.id)}
                  onSelect={() => setSelectedTabKey(String(tab.id))}
                />
              ))}
              <NewTabRadioItem
                name='connect-tab'
                checked={selectedTabKey === NEW_TAB_VALUE}
                onSelect={() => setSelectedTabKey(NEW_TAB_VALUE)}
              />
            </div>
          </div>
        )}

        {isConnecting && (
          <AuthTokenSection />
        )}

        {showButtons && (
          <div className='footer'>
            <Button variant='default' onClick={() => handleReject('Connection rejected. This tab can be closed.')}>
              Reject
            </Button>
            <Button variant='primary' onClick={handleAllow}>
              Allow
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const VersionMismatchError: React.FC<{ extensionVersion: string }> = ({ extensionVersion }) => {
  const readmeUrl = 'https://github.com/microsoft/playwright-mcp/blob/main/packages/extension/README.md';
  const chromeWebStoreUrl = 'https://chromewebstore.google.com/detail/playwright-mcp-bridge/mmlmfjhmonkocbjadbfplnigmagldckm';
  return (
    <div>
      Playwright client trying to connect requires newer extension version (current version: {extensionVersion}).{' '}
      Update <a href={chromeWebStoreUrl} target='_blank' rel='noopener noreferrer'>Playwright Extension</a> from the Chrome Web Store to the latest version.{' '}
      See <a href={readmeUrl} target='_blank' rel='noopener noreferrer'>installation instructions</a> for more details.
    </div>
  );
};

const StatusHeader: React.FC<{ status: Status }> = ({ status }) => {
  return (
    <h1 className={`status-heading ${status.type}`}>
      {'versionMismatch' in status ? (
        <VersionMismatchError
          extensionVersion={status.versionMismatch.extensionVersion}
        />
      ) : (
        status.message
      )}
    </h1>
  );
};

// Initialize the React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<ConnectApp />);
}
