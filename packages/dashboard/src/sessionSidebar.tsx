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

import React from 'react';
import './sessionSidebar.css';
import { DashboardClientContext } from './dashboardContext';
import { SettingsButton } from './settingsView';
import { BrowserIcon } from './icons';
import { ToolbarButton } from '@web/components/toolbarButton';

import type { Tab, DashboardChannelEvents } from './dashboardChannel';
import type { SessionModel, SessionStatus } from './sessionModel';

type SessionSidebarProps = {
  model: SessionModel;
  onSelectTab: (tab: Tab) => void;
  onCloseTab: (tab: Tab) => void;
  onNewTab: (browser: string, context: string) => void;
};

function tabFavicon(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    return host ? host[0].toUpperCase() : '';
  } catch {
    return '';
  }
}

function normalizeWorkspacePath(workspace: string, homeDir: string | undefined): string {
  if (!workspace || workspace === 'Global')
    return workspace;
  let normalized = workspace;
  if (!workspace.startsWith('/') && !workspace.startsWith('\\\\') && !/^[A-Za-z]:[\\/]/.test(workspace) && workspace.includes('/'))
    normalized = '/' + workspace;
  if (homeDir) {
    if (normalized === homeDir)
      return '~';
    if (normalized.startsWith(homeDir + '/') || normalized.startsWith(homeDir + '\\'))
      return '~' + normalized.slice(homeDir.length);
  }
  return normalized;
}

export const SessionSidebar: React.FC<SessionSidebarProps> = ({ model, onSelectTab, onCloseTab, onNewTab }) => {
  const client = React.useContext(DashboardClientContext);
  const openSessions = React.useMemo(() => model.sessions.filter(session => session.canConnect), [model.sessions]);
  const clientInfo = model.clientInfo;
  const [allTabs, setAllTabs] = React.useState<Tab[] | null>(null);

  React.useEffect(() => {
    if (!client)
      return;
    const onTabs = (params: DashboardChannelEvents['tabs']) => setAllTabs(params.tabs);
    client.on('tabs', onTabs);
    return () => client.off('tabs', onTabs);
  }, [client]);

  const tabsByBrowserAndContext = React.useMemo(() => {
    const map = new Map<string, Map<string, Tab[]>>();
    for (const tab of allTabs ?? []) {
      let byContext = map.get(tab.browser);
      if (!byContext) {
        byContext = new Map();
        map.set(tab.browser, byContext);
      }
      let list = byContext.get(tab.context);
      if (!list) {
        list = [];
        byContext.set(tab.context, list);
      }
      list.push(tab);
    }
    return map;
  }, [allTabs]);

  const activeContext = React.useMemo(() => allTabs?.find(t => t.selected)?.context, [allTabs]);

  const workspaceGroups = React.useMemo(() => {
    const groups = new Map<string, SessionStatus[]>();
    for (const session of openSessions) {
      const key = session.workspaceDir || 'Global';
      let list = groups.get(key);
      if (!list) {
        list = [];
        groups.set(key, list);
      }
      list.push(session);
    }
    for (const list of groups.values())
      list.sort((a, b) => a.title.localeCompare(b.title));

    const currentWorkspace = clientInfo?.workspaceDir || 'Global';
    const entries = [...groups.entries()];
    const current = entries.filter(([key]) => key === currentWorkspace);
    const other = entries.filter(([key]) => key !== currentWorkspace).sort((a, b) => a[0].localeCompare(b[0]));
    return [...current, ...other];
  }, [openSessions, clientInfo?.workspaceDir]);

  return <nav className='dashboard-shell-sidebar' aria-label='Sessions'>
    <div className='dashboard-shell-sidebar-header'>
      <h2 className='dashboard-shell-sidebar-title'>Sessions</h2>
      <SettingsButton />
    </div>
    <div className='dashboard-shell-sidebar-content'>
      {model.loading && <div className='sidebar-empty' role='status' aria-live='polite'>Loading sessions...</div>}
      {!model.loading && openSessions.length === 0 && <div className='sidebar-empty' role='status' aria-live='polite'>No open sessions.</div>}
      {workspaceGroups.map(([workspace, entries]) => {
        const workspacePath = normalizeWorkspacePath(workspace, clientInfo?.homeDir);
        return <section key={workspace} className='workspace-group'>
          <h3 className='workspace-header'>
            <span className='workspace-path-full' title={workspacePath}>{workspacePath}</span>
          </h3>
          <div className='sidebar-session-list' role='list'>
            {entries.map(session => {
              const guid = session.browser.guid;
              const browserType = session.browser.browserName;
              const channel = session.browser.launchOptions?.channel;
              const byContext = tabsByBrowserAndContext.get(guid);
              const contextEntries = byContext ? [...byContext.entries()] : [];
              const rows: { contextGuid: string | null; tabs: Tab[] | undefined }[] =
                allTabs === null
                  ? [{ contextGuid: null, tabs: undefined }]
                  : contextEntries.length === 0
                    ? [{ contextGuid: null, tabs: [] }]
                    : contextEntries.map(([contextGuid, tabs]) => ({ contextGuid, tabs }));
              return <React.Fragment key={guid}>
                {rows.map((row, rowIdx) => <div key={row.contextGuid ?? `placeholder-${rowIdx}`} className='session-chip sidebar-session' role='listitem' title={session.title}>
                  <div className='sidebar-session-row'>
                    <div className='session-browser-icon-wrap' title={channel || browserType}>
                      <span className='session-browser-icon' aria-hidden='true'>
                        <BrowserIcon browserName={browserType} channel={channel} />
                      </span>
                      <ToolbarButton
                        className='session-browser-close'
                        icon='close'
                        title='Close session'
                        onClick={() => void model.closeSession(session)}
                      />
                    </div>
                    <span className='session-chip-name'>{session.title}</span>
                    <div className='sidebar-session-row-actions'>
                      {row.contextGuid && <ToolbarButton
                        className='sidebar-session-new-tab'
                        icon='add'
                        title='New tab'
                        onClick={() => onNewTab(guid, row.contextGuid!)}
                      />}
                    </div>
                  </div>
                  <div className='sidebar-tab-list' role='list' aria-label={`${session.title} tabs`}>
                    {row.tabs === undefined && <div className='sidebar-tabs-loading' role='status' aria-live='polite'>Loading tabs...</div>}
                    {row.tabs?.length === 0 && <div className='sidebar-tabs-empty' role='status' aria-live='polite'>No tabs open.</div>}
                    {row.tabs?.map(tab => <div
                      key={tab.page}
                      className={'sidebar-tab' + (tab.context === activeContext && tab.selected ? ' active' : '')}
                      role='listitem'
                    >
                      <div
                        className='sidebar-tab-select'
                        role='button'
                        tabIndex={0}
                        aria-current={tab.context === activeContext && tab.selected ? 'page' : undefined}
                        title={tab.url || tab.title}
                        onClick={() => onSelectTab(tab)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectTab(tab);
                          }
                        }}
                      >
                        {tab.faviconUrl
                          ? <img className='sidebar-tab-favicon' src={tab.faviconUrl} alt='' aria-hidden='true' />
                          : <span className='sidebar-tab-favicon placeholder' aria-hidden='true'>{tabFavicon(tab.url)}</span>}
                        <span className='sidebar-tab-text'>
                          <span className='sidebar-tab-title'>{tab.title || 'New Tab'}</span>
                          <span className='sidebar-tab-url'>{tab.url || 'about:blank'}</span>
                        </span>
                      </div>
                      <ToolbarButton
                        className='sidebar-tab-close'
                        icon='close'
                        title='Close tab'
                        onClick={e => {
                          e.stopPropagation();
                          onCloseTab(tab);
                        }}
                      />
                    </div>)}
                  </div>
                </div>)}
              </React.Fragment>;
            })}
          </div>
        </section>;
      })}
    </div>
  </nav>;
};
