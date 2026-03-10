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
import './grid.css';
import { DevToolsClient } from './devtoolsClient';
import { navigate } from './index';
import { Screencast } from './screencast';
import { SettingsButton } from './settingsView';

import type { BrowserDescriptor } from '../../playwright-core/src/serverRegistry';
import type { Tab } from './devtoolsChannel';
import type { SessionModel, SessionStatus } from './sessionModel';

export const Grid: React.FC<{ model: SessionModel }> = ({ model }) => {
  const [expandedWorkspaces, setExpandedWorkspaces] = React.useState<Set<string>>(new Set());
  const sessions = model.sessions;
  const clientInfo = model.clientInfo;

  function toggleWorkspace(workspace: string) {
    setExpandedWorkspaces(prev => {
      const next = new Set(prev);
      if (next.has(workspace))
        next.delete(workspace);
      else
        next.add(workspace);
      return next;
    });
  }

  const workspaceGroups = React.useMemo(() => {
    const groups = new Map<string, SessionStatus[]>();
    for (const session of sessions) {
      const key = session.browserDescriptor.workspaceDir || 'Global';
      let list = groups.get(key);
      if (!list) {
        list = [];
        groups.set(key, list);
      }
      list.push(session);
    }
    for (const list of groups.values())
      list.sort((a, b) => a.browserDescriptor.title.localeCompare(b.browserDescriptor.title));

    // Current workspace first, then alphabetical.
    const entries = [...groups.entries()];
    const current = entries.filter(([key]) => key === clientInfo?.workspaceDir);
    const other = entries.filter(([key]) => key !== clientInfo?.workspaceDir).sort((a, b) => a[0].localeCompare(b[0]));
    return [...current, ...other];
  }, [sessions, clientInfo?.workspaceDir]);

  return (<div className='grid-view'>
    <div className='grid-toolbar'>
      <SettingsButton />
    </div>
    <div className='grid-content'>
      {model.loading && sessions.length === 0 && <div className='grid-loading'>Loading sessions...</div>}
      {model.error && <div className='grid-error'>Error: {model.error}</div>}
      {!model.loading && !model.error && sessions.length === 0 && <div className='grid-empty'>No sessions found.</div>}

      <div className='workspace-list'>
        {workspaceGroups.map(([workspace, entries], index) => {
          const isFirst = index === 0;
          const isExpanded = isFirst || expandedWorkspaces.has(workspace);
          return (
            <div key={workspace} className='workspace-group'>
              <div
                className={'workspace-header' + (isFirst ? '' : ' collapsible')}
                onClick={isFirst ? undefined : () => toggleWorkspace(workspace)}
              >
                {!isFirst && (
                  <svg className={'workspace-chevron' + (isExpanded ? ' expanded' : '')} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                    <polyline points='9 18 15 12 9 6'/>
                  </svg>
                )}
                <span className='workspace-name'>{workspace.split('/').pop() || workspace}</span>
                <span className='workspace-path'>&mdash; {workspace}</span>
              </div>
              {isExpanded && (
                <div className='session-chips'>
                  {entries.map(session => <SessionChip key={session.browserDescriptor.guid} descriptor={session.browserDescriptor} wsUrl={session.wsUrl} visible={isExpanded} model={model} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </div>);
};

const SessionChip: React.FC<{ descriptor: BrowserDescriptor; wsUrl: string | undefined; visible: boolean; model: SessionModel }> = ({ descriptor, wsUrl, visible, model }) => {
  const href = '#session=' + encodeURIComponent(descriptor.guid);

  const channel = React.useMemo(() => {
    if (!wsUrl || !visible)
      return undefined;
    return DevToolsClient.create(wsUrl);
  }, [wsUrl, visible]);

  const [selectedTab, setSelectedTab] = React.useState<Tab | undefined>();

  React.useEffect(() => {
    if (!channel)
      return;
    const onTabs = (params: { tabs: Tab[] }) => {
      setSelectedTab(params.tabs.find(t => t.selected));
    };
    channel.tabs().then(onTabs);
    channel.on('tabs', onTabs);
    return () => {
      channel.off('tabs', onTabs);
      channel.close();
    };
  }, [channel]);

  const chipTitle = selectedTab ? `[${descriptor.title}] ${selectedTab.url} \u2014 ${selectedTab.title}` : descriptor.title;

  return (
    <a className={'session-chip' + (wsUrl ? '' : ' disconnected')} href={wsUrl ? href : undefined} title={chipTitle} onClick={e => {
      e.preventDefault();
      if (wsUrl)
        navigate(href);
    }}>
      <div className='session-chip-header'>
        <div className={'session-status-dot ' + (wsUrl ? 'open' : 'closed')} />
        <span className='session-chip-name'>
          {selectedTab ? <>[{descriptor.title}] {selectedTab.url} <span className='session-chip-title'>&mdash; {selectedTab.title}</span></> : descriptor.title}
        </span>
        {wsUrl && (
          <button
            className='session-chip-action'
            title='Close session'
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              void model.closeSession(descriptor);
            }}
          >
            <svg viewBox='0 0 12 12' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round'>
              <line x1='2' y1='2' x2='10' y2='10'/>
              <line x1='10' y1='2' x2='2' y2='10'/>
            </svg>
          </button>
        )}
        {!wsUrl && (
          <button
            className='session-chip-action'
            title='Delete session data'
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              void model.deleteSessionData(descriptor);
            }}
          >
            <svg viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='1.2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M2 4h12'/>
              <path d='M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1'/>
              <path d='M4 4l.8 9a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9L12 4'/>
            </svg>
          </button>
        )}
      </div>
      <div className='screencast-container'>
        {channel && <Screencast channel={channel} />}
        {!wsUrl && <div className='screencast-placeholder'>Session closed</div>}
      </div>
    </a>
  );
};
