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
import { SettingsButton } from './settingsView';
import { BrowserIcon } from './icons';
import { ToolbarButton } from '@web/components/toolbarButton';
import { ListView } from '@web/components/listView';

import type { SessionStatus, Tab } from './dashboardChannel';
import type { DashboardModel } from './dashboardModel';

type SessionSidebarProps = {
  model: DashboardModel;
};

const TabListView = ListView<Tab>;

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

const TabRow: React.FC<{ tab: Tab; model: DashboardModel }> = ({ tab, model }) => {
  return <>
    {tab.faviconUrl
      ? <img className='sidebar-tab-favicon' src={tab.faviconUrl} alt='' aria-hidden='true' />
      : <span className='sidebar-tab-favicon placeholder' aria-hidden='true'>{tabFavicon(tab.url)}</span>}
    <span className='sidebar-tab-text'>
      <span className='sidebar-tab-title'>{tab.title || 'New Tab'}</span>
      <span className='sidebar-tab-url'>{tab.url || 'about:blank'}</span>
    </span>
    <ToolbarButton
      className='sidebar-tab-close'
      icon='close'
      title='Close tab'
      onClick={e => {
        e.stopPropagation();
        model.closeTab(tab);
      }}
    />
  </>;
};

export const SessionSidebar: React.FC<SessionSidebarProps> = ({ model }) => {
  const { sessions, clientInfo, loadingSessions, tabs: allTabs } = model.state;
  const openSessions = sessions;

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
      {loadingSessions && <p className='sidebar-empty' role='status' aria-live='polite'>Loading sessions...</p>}
      {!loadingSessions && openSessions.length === 0 && <p className='sidebar-empty' role='status' aria-live='polite'>No open sessions.</p>}
      {workspaceGroups.map(([workspace, entries]) => {
        const workspacePath = normalizeWorkspacePath(workspace, clientInfo?.homeDir);
        return <section key={workspace} className='workspace-group' aria-label={`Workspace ${workspacePath}`}>
          <h3 className='workspace-header'>
            <span className='workspace-path-full' title={workspacePath}>{workspacePath}</span>
          </h3>
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
            return rows.map((row, rowIdx) => {
              const activeTab = row.tabs?.find(t => t.context === activeContext && t.selected);
              const rowKey = `${guid}-${row.contextGuid ?? `placeholder-${rowIdx}`}`;
              return <section
                key={rowKey}
                className={'sidebar-session session-chip' + (activeTab ? ' active' : '')}
                aria-label={`Session ${session.title}`}
              >
                <header className='sidebar-session-row'>
                  <div className='session-browser-icon-wrap' title={channel || browserType}>
                    <span className='session-browser-icon' aria-hidden='true'>
                      <BrowserIcon browserName={browserType} channel={channel} />
                    </span>
                    <ToolbarButton
                      className='session-browser-close'
                      icon='close'
                      title='Close session'
                      onClick={() => model.closeSession(session)}
                    />
                  </div>
                  <span className='session-chip-name'>{session.title}</span>
                  <div className='sidebar-session-row-actions'>
                    {row.contextGuid && <ToolbarButton
                      className='sidebar-session-new-tab'
                      icon='add'
                      title='New tab'
                      onClick={() => model.newTab(guid, row.contextGuid!)}
                    />}
                  </div>
                </header>
                {row.tabs === undefined
                  ? <p className='sidebar-tabs-loading' role='status' aria-live='polite'>Loading tabs...</p>
                  : <TabListView
                    name={`sidebar-tabs-${rowKey}`}
                    ariaLabel={`${session.title} tabs`}
                    items={row.tabs}
                    id={tab => tab.page}
                    selectedItem={activeTab}
                    onSelected={tab => model.selectTab(tab)}
                    noItemsMessage='No tabs open.'
                    render={tab => <TabRow tab={tab} model={model} />}
                  />}
              </section>;
            });
          })}
        </section>;
      })}
    </div>
  </nav>;
};
