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
import { Button, ListItem, PageHeader, TabItem } from './tabItem';
import { getOrCreateAuthToken } from './authToken';
import * as icons from './icons';

import type { CandidateGroup, Candidates, PageMessage, Selection, SessionOptions } from '../types';

type Status =
  | { type: 'connecting' | 'connected' | 'error', message: string }
  | { type: 'error', versionMismatch: { extensionVersion: string } };

const SUPPORTED_PROTOCOL_VERSION = 2;
const params = new URLSearchParams(window.location.search);
const options = sessionOptions();

function sessionOptions(): SessionOptions {
  let clientName = 'unknown';
  try {
    clientName = JSON.parse(params.get('client') || '{}').name || clientName;
  } catch {
  }
  const tabGroup = params.get('tabGroup') === 'false' ? undefined : {
    title: params.get('tabGroupTitle') ?? undefined,
    color: params.get('tabGroupColor') ?? undefined,
  };
  return { clientName, tabGroup, background: params.get('background') === 'true' };
}

function relayUrlError(relayUrl: string | null): string | undefined {
  if (!relayUrl)
    return 'Missing mcpRelayUrl parameter in URL.';
  try {
    const host = new URL(relayUrl).hostname;
    if (host !== '127.0.0.1' && host !== '[::1]')
      return `Playwright extension only allows loopback connections (127.0.0.1 or [::1]). Received host: ${host}`;
  } catch (e) {
    return `Invalid mcpRelayUrl parameter in URL: ${relayUrl}. ${e}`;
  }
}

function protocolVersionError(): Status | undefined {
  const parsedVersion = parseInt(params.get('protocolVersion') ?? '', 10);
  const requestedVersion = isNaN(parsedVersion) ? 1 : parsedVersion;
  if (requestedVersion > SUPPORTED_PROTOCOL_VERSION)
    return { type: 'error', versionMismatch: { extensionVersion: chrome.runtime.getManifest().version } };
  if (requestedVersion < SUPPORTED_PROTOCOL_VERSION)
    return { type: 'error', message: 'The client uses an unsupported protocol version. Update Playwright MCP or CLI to the latest version.' };
}

const ConnectApp: React.FC = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [candidates, setCandidates] = useState<Candidates | null>(null);
  const [selection, setSelection] = useState<Selection>({});

  const connect = useCallback(async (selection: Selection) => {
    setCandidates(null);
    const response = await chrome.runtime.sendMessage<PageMessage>({ type: 'connect', options, selection }).catch(e => ({ error: String(e) }));
    if (response?.success)
      setStatus({ type: 'connected', message: `"${options.clientName}" connected.` });
    else
      setStatus({ type: 'error', message: response?.error || `"${options.clientName}" failed to connect.` });
  }, []);

  useEffect(() => {
    const start = async () => {
      const relayUrl = params.get('mcpRelayUrl');
      const urlError = relayUrlError(relayUrl);
      if (urlError) {
        setStatus({ type: 'error', message: urlError });
        return;
      }
      const versionError = protocolVersionError();
      if (versionError) {
        setStatus(versionError);
        return;
      }
      setStatus({ type: 'connecting', message: `"${options.clientName}" is trying to connect to the Playwright Extension.` });
      await chrome.runtime.sendMessage<PageMessage>({ type: 'connectionRequested', mcpRelayUrl: relayUrl! });

      const token = params.get('token');
      if (!token) {
        setCandidates(await chrome.runtime.sendMessage<PageMessage>({ type: 'getCandidates' }));
        return;
      }
      // With a token, this page becomes the blank tab of the client; keep the token out of its history.
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState(null, '', url);
      if (token === getOrCreateAuthToken())
        await connect({});
      else
        setStatus({ type: 'error', message: 'Invalid token provided.' });
    };
    void start();
    // The service worker holds the pending request and stops after 30s without messages.
    const keepalive = setInterval(() => void chrome.runtime.sendMessage<PageMessage>({ type: 'keepalive' }).catch(() => {}), 20_000);
    return () => clearInterval(keepalive);
  }, [connect]);

  const toggleGroup = (groupId: number) => setSelection(selection.groupId === groupId ? {} : { groupId });
  const toggleTab = (tabId: number) => {
    const tabIds = selection.tabIds ?? [];
    setSelection({ tabIds: tabIds.includes(tabId) ? tabIds.filter(id => id !== tabId) : [...tabIds, tabId] });
  };

  return (
    <div className='page'>
      <PageHeader>
        <a className='page-header-link' href='manage.html' target='_blank' rel='noreferrer'>Manage clients</a>
      </PageHeader>
      <div className='card'>
        {status && <StatusBanner status={status} />}

        {status?.type === 'connecting' && (
          <div className='card-body'>
            <div className='warning-banner'>
              {icons.alert()}
              <div>
                Allowing this connection exposes the entire browser to the client,
                including any signed-in sessions, cookies, and content in other tabs and windows.
                Once approved, the client may also be able to reconnect later without showing this dialog again,
                unless you rotate the token on the <a href='manage.html' target='_blank' rel='noreferrer'>Manage clients</a> page and then restart the browser.
              </div>
            </div>

            {candidates && <>
              <div className='muted'>
                Select one tab group or some tabs for the client.
                {options.tabGroup && <> You can drag more tabs into the tab group of the client later.</>}
              </div>
              {candidates.groups.length > 0 && (
                <div>
                  <h2 className='list-title'>Tab groups</h2>
                  <div className='list'>
                    {candidates.groups.map(group => (
                      <GroupItem
                        key={group.id}
                        group={group}
                        checked={selection.groupId === group.id}
                        onClick={() => toggleGroup(group.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {candidates.tabs.length > 0 && (
                <div>
                  <h2 className='list-title'>Tabs</h2>
                  <div className='list'>
                    {candidates.tabs.map(tab => (
                      <TabItem
                        key={tab.id}
                        tab={tab}
                        checked={!!selection.tabIds?.includes(tab.id!)}
                        onClick={() => toggleTab(tab.id!)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>}
          </div>
        )}

        {candidates && (
          <div className='card-footer'>
            <div className='muted'>{selectionSummary(selection)}</div>
            <Button variant='primary' onClick={() => connect(selection)}>Allow</Button>
          </div>
        )}
      </div>
    </div>
  );
};

function selectionSummary(selection: Selection): string {
  if (selection.groupId !== undefined)
    return '1 tab group selected.';
  const count = selection.tabIds?.length ?? 0;
  if (count)
    return count === 1 ? '1 tab selected.' : `${count} tabs selected.`;
  return 'Nothing selected. The client gets a new blank tab.';
}

// The colors that Chrome uses for tab groups.
const GROUP_COLORS: Record<string, string> = {
  grey: '#5f6368',
  blue: '#1a73e8',
  red: '#d93025',
  yellow: '#f9ab00',
  green: '#188038',
  pink: '#d01884',
  purple: '#a142f4',
  cyan: '#007b83',
  orange: '#fa903e',
};

const GroupItem: React.FC<{ group: CandidateGroup, checked: boolean, onClick: () => void }> = ({ group, checked, onClick }) => {
  return (
    <ListItem
      icon={<span className='tab-favicon group-dot' style={{ backgroundColor: GROUP_COLORS[group.color] }} />}
      title={group.title || 'Unnamed group'}
      subtitle={`Tab group, ${group.tabs.length === 1 ? '1 tab' : `${group.tabs.length} tabs`}`}
      checked={checked}
      onClick={onClick}
    />
  );
};

const VersionMismatchError: React.FC<{ extensionVersion: string }> = ({ extensionVersion }) => {
  const readmeUrl = 'https://github.com/microsoft/playwright/blob/main/packages/extension/README.md';
  const chromeWebStoreUrl = 'https://chromewebstore.google.com/detail/playwright-extension/mmlmfjhmonkocbjadbfplnigmagldckm';
  return (
    <div>
      Playwright client trying to connect requires newer extension version (current version: {extensionVersion}).{' '}
      Update <a href={chromeWebStoreUrl} target='_blank' rel='noopener noreferrer'>Playwright Extension</a> from the Chrome Web Store to the latest version.{' '}
      See <a href={readmeUrl} target='_blank' rel='noopener noreferrer'>installation instructions</a> for more details.
    </div>
  );
};

const StatusBanner: React.FC<{ status: Status }> = ({ status }) => {
  return (
    <div className={`status-banner ${status.type}`}>
      {status.type === 'connected' && icons.check()}
      {status.type === 'error' && icons.cross()}
      {'versionMismatch' in status ? (
        <VersionMismatchError extensionVersion={status.versionMismatch.extensionVersion} />
      ) : (
        <div>{status.message}</div>
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container)
  createRoot(container).render(<ConnectApp />);
