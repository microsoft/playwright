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
import { navigate } from './index';
import { Screencast } from './screencast';

import type { SessionConfig } from '../../playwright/src/cli/client/registry';
import type { SessionModel, SessionStatus } from './sessionModel';

export const Grid: React.FC<{ model: SessionModel }> = ({ model }) => {
  const [expandedWorkspaces, setExpandedWorkspaces] = React.useState<Set<string>>(new Set());
  const sessions = model.sessions;
  const clientInfo = model.clientInfo;

  function browserLabel(config: SessionConfig): string {
    if (config.resolvedConfig)
      return config.resolvedConfig.browser.launchOptions.channel ?? config.resolvedConfig.browser.browserName;
    return config.cli.browser || 'chromium';
  }

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
      const key = session.config.workspaceDir || 'Unknown';
      let list = groups.get(key);
      if (!list) {
        list = [];
        groups.set(key, list);
      }
      list.push(session);
    }
    for (const list of groups.values())
      list.sort((a, b) => a.config.name.localeCompare(b.config.name));

    // Current workspace first, then alphabetical.
    const entries = [...groups.entries()];
    const current = entries.filter(([key]) => key === clientInfo?.workspaceDir);
    const other = entries.filter(([key]) => key !== clientInfo?.workspaceDir).sort((a, b) => a[0].localeCompare(b[0]));
    return [...current, ...other];
  }, [sessions, clientInfo?.workspaceDir]);

  function renderSessionChip(config: SessionConfig, canConnect: boolean, visible: boolean) {
    const href = '#session=' + encodeURIComponent(config.socketPath);
    const wsUrl = model.wsUrls.get(config.socketPath);
    return (
      <a key={config.socketPath} className={'session-chip' + (canConnect ? '' : ' disconnected')} href={canConnect ? href : undefined} onClick={e => {
        e.preventDefault(); if (canConnect)
          navigate(href);
      }}>
        <div className='session-chip-header'>
          <div className={'session-status-dot ' + (canConnect ? 'open' : 'closed')} />
          <span className='session-chip-name'>{config.name}</span>
          <span className='session-chip-detail'>{browserLabel(config)}</span>
          <span className='session-chip-detail'>v{config.version}</span>
          {canConnect && (
            <button
              className='session-chip-action'
              title='Close session'
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                void model.closeSession(config);
              }}
            >
              <svg viewBox='0 0 12 12' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round'>
                <line x1='2' y1='2' x2='10' y2='10'/>
                <line x1='10' y1='2' x2='2' y2='10'/>
              </svg>
            </button>
          )}
          {!canConnect && (
            <button
              className='session-chip-action'
              title='Delete session data'
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                void model.deleteSessionData(config);
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
          {canConnect && visible && wsUrl && <Screencast wsUrl={wsUrl} />}
          {!canConnect && <div className='screencast-placeholder'>Session closed</div>}
        </div>
      </a>
    );
  }

  return (<div className='grid-view'>
    {model.loading && sessions.length === 0 && <div className='grid-loading'>Loading sessions...</div>}
    {model.error && <div className='grid-error'>Error: {model.error}</div>}
    {!model.loading && !model.error && sessions.length === 0 && <div className='grid-empty'>No sessions found.</div>}

    <div className='workspace-list'>
      {workspaceGroups.map(([workspace, entries]) => {
        const isCurrent = workspace === clientInfo?.workspaceDir;
        const isExpanded = isCurrent || expandedWorkspaces.has(workspace);
        return (
          <div key={workspace} className='workspace-group'>
            <div
              className={'workspace-header' + (isCurrent ? '' : ' collapsible')}
              onClick={isCurrent ? undefined : () => toggleWorkspace(workspace)}
            >
              {!isCurrent && (
                <svg className={'workspace-chevron' + (isExpanded ? ' expanded' : '')} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                  <polyline points='9 18 15 12 9 6'/>
                </svg>
              )}
              <span className='workspace-name'>{workspace.split('/').pop() || workspace}</span>
              <span className='workspace-path'>&mdash; {workspace}</span>
            </div>
            {isExpanded && (
              <div className='session-chips'>
                {entries.map(({ config, canConnect }) => renderSessionChip(config, canConnect, isExpanded))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>);
};
