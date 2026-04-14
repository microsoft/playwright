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
import { SettingsButton } from './settingsView';

import type { BrowserDescriptor } from '../../playwright-core/src/serverRegistry';
import type { SessionModel, SessionStatus } from './sessionModel';
import { useBrowser } from './dashboard';
import type { Page } from 'playwright-core';

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

    // Current workspace first, then alphabetical.
    const currentWorkspace = clientInfo?.workspaceDir || 'Global';
    const entries = [...groups.entries()];
    const current = entries.filter(([key]) => key === currentWorkspace);
    const other = entries.filter(([key]) => key !== currentWorkspace).sort((a, b) => a[0].localeCompare(b[0]));
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
                  {entries.map(session => <SessionChip key={session.browser.guid} descriptor={session} wsUrl={session.wsUrl} model={model} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </div>);
};

function useTitle(page: Page | undefined) {
  const [title, setTitle] = React.useState<string>();

  React.useEffect(() => {
    if (!page)
      return;
    const fetchTitle = async () => {
      setTitle(await page.title());
    };
    page.on('framenavigated', fetchTitle);
    fetchTitle();
    return () => {
      page.off('framenavigated', fetchTitle);
    };
  }, [page]);

  return title;
}

const SessionChip: React.FC<{ descriptor: BrowserDescriptor; wsUrl: string | undefined; model: SessionModel }> = ({ descriptor, wsUrl, model }) => {
  const href = '#session=' + encodeURIComponent(descriptor.browser.guid);

  const browser = useBrowser(wsUrl);

  const selectedPage = browser?.contexts().flatMap(c => c.pages())?.[0];
  const pageTitle = useTitle(selectedPage);

  const chipTitle = selectedPage ? `[${descriptor.title}] ${selectedPage.url()} \u2014 ${pageTitle ?? ''}` : descriptor.title;

  let disableReason: string | undefined;
  if (!wsUrl)
    disableReason = 'Session closed';
  else if (!descriptor.playwrightDashboardBundle)
    disableReason = 'Session on an older Playwright version';

  return (
    <a className={'session-chip' + (disableReason ? ' disconnected' : '')} href={disableReason ? undefined : href} title={chipTitle} onClick={e => {
      e.preventDefault();
      if (!disableReason)
        navigate(href);
    }}>
      <div className='session-chip-header'>
        <div className={'session-status-dot ' + (wsUrl ? 'open' : 'closed')} />
        <span className='session-chip-name'>
          {selectedPage ? <>[{descriptor.title}] {selectedPage.url()} <span className='session-chip-title'>&mdash; {pageTitle}</span></> : descriptor.title}
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
        {disableReason ?
          <div className='screencast-placeholder'>{disableReason}</div>
          : (
            selectedPage && <Screencast page={selectedPage} />
          )
        }
      </div>
    </a>
  );
};
