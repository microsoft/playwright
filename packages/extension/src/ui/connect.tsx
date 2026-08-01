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
import { Button, TabItem } from './tabItem';
import { AuthTokenSection, getOrCreateAuthToken } from './authToken';

type Status =
  | { type: 'connecting'; message: string }
  | { type: 'connected'; message: string }
  | { type: 'error'; message: string }
  | { type: 'error'; versionMismatch: { extensionVersion: string; } };

const SUPPORTED_PROTOCOL_VERSION = 2;

// Client name comes from the URL and never changes for the lifetime of this page.
const clientInfo = (() => {
  try {
    return JSON.parse(new URLSearchParams(window.location.search).get('client') || '{}').name || 'unknown';
  } catch {
    return 'unknown';
  }
})();

const connectionInfo = (() => {
  const params = new URLSearchParams(window.location.search);
  const relayUrl = params.get('mcpRelayUrl') ?? '';
  const fallbackConnectionId = relayUrl.split('/').filter(Boolean).at(-1) || crypto.randomUUID();
  return {
    connectionId: params.get('connectionId') || fallbackConnectionId,
    taskId: params.get('taskId') || clientInfo,
  };
})();

const ConnectApp: React.FC = () => {
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [showTabList, setShowTabList] = useState(true);

  const setError = useCallback((message: string) => {
    setShowTabList(false);
    setStatus({ type: 'error', message });
  }, []);

  useEffect(() => {
    const runAsync = async () => {
      const params = new URLSearchParams(window.location.search);
      const relayUrl = params.get('mcpRelayUrl');

      if (!relayUrl) {
        setError('Missing mcpRelayUrl parameter in URL.');
        return;
      }

      try {
        const host = new URL(relayUrl).hostname;
        if (host !== '127.0.0.1' && host !== '[::1]') {
          setError(`Playwright extension only allows loopback connections (127.0.0.1 or [::1]). Received host: ${host}`);
          return;
        }
      } catch (e) {
        setError(`Invalid mcpRelayUrl parameter in URL: ${relayUrl}. ${e}`);
        return;
      }

      setStatus({
        type: 'connecting',
        message: `"${clientInfo}" is trying to connect to the Playwright Extension.`
      });

      const parsedVersion = parseInt(params.get('protocolVersion') ?? '', 10);
      const requestedVersion = isNaN(parsedVersion) ? 1 : parsedVersion;
      if (requestedVersion > SUPPORTED_PROTOCOL_VERSION) {
        const extensionVersion = chrome.runtime.getManifest().version;
        setShowTabList(false);
        setStatus({
          type: 'error',
          versionMismatch: {
            extensionVersion,
          }
        });
        return;
      }
      if (requestedVersion < SUPPORTED_PROTOCOL_VERSION) {
        setError('The client uses an unsupported protocol version. Update Playwright MCP or CLI to the latest version.');
        return;
      }
      // The background only records the relay URL; the WS to the relay opens
      // once the user clicks Allow.
      await chrome.runtime.sendMessage({
        type: 'connectionRequested',
        mcpRelayUrl: relayUrl,
        ...connectionInfo,
      });

      const expectedToken = getOrCreateAuthToken();
      const token = params.get('token');
      if (token === expectedToken) {
        await handleConnectToTab();
        return;
      }
      if (token) {
        setError('Invalid token provided.');
        return;
      }

      // If this is a browser_navigate command, hide the tab list and show simple allow/reject
      if (params.get('newTab') === 'true')
        setShowTabList(false);
      else
        await loadTabs();
    };
    void runAsync();
    // Ping the background every 20s so the MV3 service worker (which holds the
    // pending connection state) stays above its 30s idle timeout while the
    // user decides.
    const keepalive = setInterval(() => {
      chrome.runtime.sendMessage({ type: 'keepalive' }).catch(() => {});
    }, 20_000);
    return () => clearInterval(keepalive);
  }, []);

  const loadTabs = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'getTabs' });
    if (response.success)
      setTabs(response.tabs);
    else
      setStatus({ type: 'error', message: 'Failed to load tabs: ' + response.error });
  }, []);

  const handleConnectToTab = useCallback(async (tab?: chrome.tabs.Tab) => {
    setShowTabList(false);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'connectToTab',
        tab,
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
  }, []);

  return (
    <div className='app-container'>
      <div className='content-wrapper'>
        {status && (
          <div className='status-container'>
            <StatusBanner status={status} />
          </div>
        )}

        {status?.type === 'connecting' && (
          <div className='warning-banner'>
            <strong>⚠️ Warning:</strong> Allowing this connection exposes the entire browser to the client,
            including any signed-in sessions, cookies, and content in other tabs and windows.
            Once approved, the client may also be able to reconnect later without showing this dialog again,
            unless you regenerate the token below and then restart the browser.
          </div>
        )}

        {status?.type === 'connecting' && (
          <AuthTokenSection />
        )}

        {status?.type === 'connecting' && (
          <div className='button-container'>
            <Button variant='primary' onClick={() => handleConnectToTab()}>
              Allow in background
            </Button>
          </div>
        )}

        {showTabList && (
          <div>
            <div className='tab-section-title'>
              You can drag tabs into the Playwright group later to make them accessible to the client.
              Only choose a tab below if you explicitly want to authorize and switch to it:
            </div>
            <div>
              {tabs.map(tab => (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  button={
                    <Button variant='primary' onClick={() => handleConnectToTab(tab)}>
                      Allow &amp; select
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
  const readmeUrl = 'https://github.com/WitMiao/playwright/blob/codex/session-isolated-extension/packages/extension/README.md';
  return (
    <div>
      Playwright client trying to connect requires newer extension version (current version: {extensionVersion}).{' '}
      Rebuild and reload the local extension.{' '}
      See <a href={readmeUrl} target='_blank' rel='noopener noreferrer'>local installation instructions</a> for details.
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
