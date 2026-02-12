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

import type { SessionConfig } from '../../playwright/src/mcp/terminal/registry';

type SessionStatus = {
  config: SessionConfig;
  canConnect: boolean;
};

export const Grid: React.FC = () => {
  const [sessions, setSessions] = React.useState<SessionStatus[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | undefined>();
  const [screencastUrls, setScreencastUrls] = React.useState<Record<string, string>>({});

  const lastJsonRef = React.useRef<string>('');
  const knownTimestampsRef = React.useRef<Map<string, number>>(new Map());
  const startingRef = React.useRef<Set<string>>(new Set());

  async function fetchSessions() {
    try {
      const response = await fetch('/api/sessions/list');
      if (!response.ok)
        throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (text !== lastJsonRef.current) {
        lastJsonRef.current = text;
        setSessions(JSON.parse(text));
      }
      setError(undefined);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    async function poll() {
      await fetchSessions();
      if (active)
        timeoutId = setTimeout(poll, 3000);
    }
    poll();
    return () => { active = false; clearTimeout(timeoutId); };
  }, []);

  // Manage screencast lifecycle when sessions change.
  React.useEffect(() => {
    let active = true;
    const liveSockets = new Set<string>();

    for (const { config, canConnect } of sessions) {
      if (!canConnect)
        continue;
      const key = config.socketPath;
      liveSockets.add(key);

      const known = knownTimestampsRef.current.get(key);
      if (known === config.timestamp)
        continue;
      if (startingRef.current.has(key))
        continue;

      knownTimestampsRef.current.set(key, config.timestamp);
      startingRef.current.add(key);

      void (async () => {
        try {
          const resp = await fetch('/api/sessions/start-screencast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config }),
          });
          if (!resp.ok)
            throw new Error();
          const { url } = await resp.json();
          if (active)
            setScreencastUrls(prev => ({ ...prev, [key]: url }));
        } catch {
          knownTimestampsRef.current.delete(key);
        } finally {
          startingRef.current.delete(key);
        }
      })();
    }

    // Clean up sessions that are no longer live.
    setScreencastUrls(prev => {
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(next)) {
        if (!liveSockets.has(key)) {
          delete next[key];
          knownTimestampsRef.current.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    return () => { active = false; };
  }, [sessions]);

  // Clear all screencasts on unmount.
  React.useEffect(() => {
    return () => setScreencastUrls({});
  }, []);

  function browserLabel(config: SessionConfig): string {
    if (config.resolvedConfig)
      return config.resolvedConfig.browser.launchOptions.channel ?? config.resolvedConfig.browser.browserName;
    return config.cli.browser || 'chromium';
  }

  function headedLabel(config: SessionConfig): string {
    if (config.resolvedConfig)
      return config.resolvedConfig.browser.launchOptions.headless ? 'headless' : 'headed';
    return config.cli.headed ? 'headed' : 'headless';
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
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [sessions]);

  return (<div className='grid-view'>
    {loading && sessions.length === 0 && <div className='grid-loading'>Loading sessions...</div>}
    {error && <div className='grid-error'>Error: {error}</div>}
    {!loading && !error && sessions.length === 0 && <div className='grid-empty'>No sessions found.</div>}

    <div className='workspace-list'>
      {workspaceGroups.map(([workspace, entries]) => (
        <div key={workspace} className='workspace-group'>
          <div className='workspace-header'>{workspace}</div>
          <div className='session-chips'>
            {entries.map(({ config, canConnect }) => {
              const href = '#session=' + encodeURIComponent(config.socketPath);
              return (
                <a key={config.socketPath} className='session-chip' href={href} onClick={e => { e.preventDefault(); navigate(href); }}>
                  <div className='session-chip-header'>
                    <div className={'session-status-dot ' + (canConnect ? 'open' : 'closed')} />
                    <span className='session-chip-name'>{config.name}</span>
                    <span className='session-chip-detail'>{browserLabel(config)}</span>
                    <span className='session-chip-detail'>{headedLabel(config)}</span>
                    <span className='session-chip-detail'>v{config.version}</span>
                    <button
                      className='session-chip-close'
                      title='Close session'
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        void fetch('/api/sessions/close', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ config }),
                        }).then(() => fetchSessions());
                      }}
                    >
                      <svg viewBox='0 0 12 12' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round'>
                        <line x1='2' y1='2' x2='10' y2='10'/>
                        <line x1='10' y1='2' x2='2' y2='10'/>
                      </svg>
                    </button>
                  </div>
                  <div className='screencast-container'>
                    {screencastUrls[config.socketPath] && (
                      <Screencast wsUrl={screencastUrls[config.socketPath]} />
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  </div>);
};
