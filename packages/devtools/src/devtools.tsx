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
import './devtools.css';
import { DevToolsTransport } from './transport';

type TabInfo = { id: string; title: string; url: string; contextId: string; sourceWsUrl?: string; sourceName?: string };
type RemoteSource = { name: string; wsUrl: string };
type SourceGroup = { name: string; wsUrl?: string; tabs: TabInfo[] };

function tabFavicon(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    return host ? host[0].toUpperCase() : '';
  } catch {
    return '';
  }
}

export const DevTools: React.FC = () => {
  const [status, setStatus] = React.useState<{ text: string; cls: string }>({ text: 'Connecting', cls: '' });
  const [tabsByContext, setTabsByContext] = React.useState<Record<string, TabInfo[]>>({});
  const [contexts, setContexts] = React.useState<{ id: string }[]>([]);

  // Remote sources directory + their tabs.
  const [remoteSources, setRemoteSources] = React.useState<RemoteSource[]>([]);
  const [remoteTabsBySource, setRemoteTabsBySource] = React.useState<Record<string, TabInfo[]>>({});
  const [remoteContextsBySource, setRemoteContextsBySource] = React.useState<Record<string, string[]>>({});
  const remoteTransportsRef = React.useRef<Map<string, DevToolsTransport>>(new Map());

  const sourceGroups = React.useMemo<SourceGroup[]>(() => {
    const groups: SourceGroup[] = [];
    const localTabs = Object.values(tabsByContext).flat();
    // Always show the Local group so the "new tab" button is accessible.
    groups.push({ name: 'Local', tabs: localTabs });
    for (const source of remoteSources) {
      const sourceTabs = remoteTabsBySource[source.wsUrl] || [];
      groups.push({ name: source.name, wsUrl: source.wsUrl, tabs: sourceTabs });
    }
    return groups;
  }, [tabsByContext, remoteSources, remoteTabsBySource]);

  const [collapsedSources, setCollapsedSources] = React.useState<Set<string>>(new Set());

  function toggleSource(name: string) {
    setCollapsedSources(prev => {
      const next = new Set(prev);
      if (next.has(name))
        next.delete(name);
      else
        next.add(name);
      return next;
    });
  }

  const [selectedPageId, setSelectedPageId] = React.useState<string | undefined>();
  const [selectedSourceWsUrl, setSelectedSourceWsUrl] = React.useState<string | undefined>();
  const [url, setUrl] = React.useState('');
  const [frameSrc, setFrameSrc] = React.useState('');
  const [captured, setCaptured] = React.useState(false);
  const [hintVisible, setHintVisible] = React.useState(false);

  const transportRef = React.useRef<DevToolsTransport | null>(null);
  const displayRef = React.useRef<HTMLImageElement>(null);
  const screenRef = React.useRef<HTMLDivElement>(null);
  const omniboxRef = React.useRef<HTMLInputElement>(null);
  const viewportSizeRef = React.useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const resizedRef = React.useRef(false);
  const capturedRef = React.useRef(false);
  const moveThrottleRef = React.useRef(0);
  const selectedSourceRef = React.useRef<string | undefined>(undefined);

  // Keep refs in sync with state.
  React.useEffect(() => {
    capturedRef.current = captured;
  }, [captured]);
  React.useEffect(() => {
    selectedSourceRef.current = selectedSourceWsUrl;
  }, [selectedSourceWsUrl]);

  function activeTransport(): DevToolsTransport | null {
    if (!selectedSourceRef.current)
      return transportRef.current;
    return remoteTransportsRef.current.get(selectedSourceRef.current) ?? null;
  }

  // Manage remote transport connections when remoteSources changes.
  React.useEffect(() => {
    const currentUrls = new Set(remoteSources.map(s => s.wsUrl));
    const existingUrls = new Set(remoteTransportsRef.current.keys());

    // Remove transports for sources that are no longer in the directory.
    for (const wsUrl of existingUrls) {
      if (!currentUrls.has(wsUrl)) {
        const t = remoteTransportsRef.current.get(wsUrl)!;
        t.close();
        remoteTransportsRef.current.delete(wsUrl);
        setRemoteTabsBySource(prev => {
          const next = { ...prev };
          delete next[wsUrl];
          return next;
        });
        setRemoteContextsBySource(prev => {
          const next = { ...prev };
          delete next[wsUrl];
          return next;
        });
      }
    }

    // Create transports for new sources.
    for (const source of remoteSources) {
      if (existingUrls.has(source.wsUrl))
        continue;
      const remote = new DevToolsTransport(source.wsUrl);
      remoteTransportsRef.current.set(source.wsUrl, remote);

      remote.onevent = (method: string, params: any) => {
        if (method === 'tabs') {
          const contextId = params.contextId as string;
          const contextTabs = (params.tabs as { id: string; title: string; url: string }[]).map(t => ({
            ...t,
            contextId,
            sourceWsUrl: source.wsUrl,
            sourceName: source.name,
          }));
          setRemoteTabsBySource(prev => {
            const next = { ...prev };
            // Build complete tab list for this source: replace context's tabs.
            const existing = (prev[source.wsUrl] || []).filter(t => t.contextId !== contextId);
            const merged = [...existing, ...contextTabs];
            if (merged.length === 0)
              delete next[source.wsUrl];
            else
              next[source.wsUrl] = merged;
            return next;
          });
        }
        if (method === 'contexts') {
          const ids = new Set((params.contexts as { id: string }[]).map(c => c.id));
          setRemoteContextsBySource(prev => ({ ...prev, [source.wsUrl]: [...ids] }));
          setRemoteTabsBySource(prev => {
            const current = prev[source.wsUrl] || [];
            const filtered = current.filter(t => ids.has(t.contextId));
            const next = { ...prev };
            if (filtered.length === 0)
              delete next[source.wsUrl];
            else
              next[source.wsUrl] = filtered;
            return next;
          });
        }
        // Only relay frame/url/selectPage if this source owns the selected page.
        if (method === 'frame' && selectedSourceRef.current === source.wsUrl) {
          setFrameSrc('data:image/jpeg;base64,' + params.data);
          if (params.viewportWidth)
            viewportSizeRef.current.width = params.viewportWidth;
          if (params.viewportHeight)
            viewportSizeRef.current.height = params.viewportHeight;
          resizeToFit();
        }
        if (method === 'url' && selectedSourceRef.current === source.wsUrl)
          setUrl(params.url);
        if (method === 'selectPage' && selectedSourceRef.current === source.wsUrl)
          setSelectedPageId(params.pageId);
      };

      remote.onclose = () => {
        remoteTransportsRef.current.delete(source.wsUrl);
        setRemoteTabsBySource(prev => {
          const next = { ...prev };
          delete next[source.wsUrl];
          return next;
        });
        setRemoteContextsBySource(prev => {
          const next = { ...prev };
          delete next[source.wsUrl];
          return next;
        });
      };
    }
  }, [remoteSources]);

  // Clean up all remote transports on unmount.
  React.useEffect(() => {
    return () => {
      for (const t of remoteTransportsRef.current.values())
        t.close();
      remoteTransportsRef.current.clear();
    };
  }, []);

  React.useEffect(() => {
    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const transport = new DevToolsTransport(wsProtocol + '//' + location.host + '/ws');
    transportRef.current = transport;

    transport.onopen = () => setStatus({ text: 'Connected', cls: 'connected' });

    transport.onevent = (method: string, params: any) => {
      if (method === 'selectPage') {
        // Only update if the local source is active.
        if (!selectedSourceRef.current) {
          setSelectedPageId(params.pageId);
          if (params.pageId)
            omniboxRef.current?.focus();
        }
      }
      if (method === 'frame') {
        // Only update if local source is active.
        if (!selectedSourceRef.current) {
          setFrameSrc('data:image/jpeg;base64,' + params.data);
          if (params.viewportWidth)
            viewportSizeRef.current.width = params.viewportWidth;
          if (params.viewportHeight)
            viewportSizeRef.current.height = params.viewportHeight;
          resizeToFit();
        }
      }
      if (method === 'url' && !selectedSourceRef.current)
        setUrl(params.url);
      if (method === 'tabs') {
        setTabsByContext(prev => {
          const next = { ...prev };
          const contextId = params.contextId as string;
          const contextTabs = (params.tabs as { id: string; title: string; url: string }[]).map(t => ({ ...t, contextId }));
          if (contextTabs.length === 0)
            delete next[contextId];
          else
            next[contextId] = contextTabs;
          return next;
        });
      }
      if (method === 'contexts') {
        const ids = new Set((params.contexts as { id: string }[]).map(c => c.id));
        setContexts(params.contexts);
        setTabsByContext(prev => {
          const next: Record<string, TabInfo[]> = {};
          for (const [id, tabs] of Object.entries(prev)) {
            if (ids.has(id))
              next[id] = tabs;
          }
          return next;
        });
      }
      if (method === 'remoteSources')
        setRemoteSources(params.sources as RemoteSource[]);
    };

    transport.onclose = () => setStatus({ text: 'Disconnected', cls: 'error' });

    (window as any).connect = (urlOrWs: string, name = 'Remote') => {
      const u = new URL(urlOrWs);
      if (u.protocol === 'http:')
        u.protocol = 'ws:';
      else if (u.protocol === 'https:')
        u.protocol = 'wss:';
      if (!u.pathname.endsWith('/ws'))
        u.pathname = u.pathname.replace(/\/$/, '') + '/ws';
      const wsUrl = u.toString();
      return fetch('/sources?name=' + encodeURIComponent(name) + '&wsUrl=' + encodeURIComponent(wsUrl), { method: 'POST' });
    };

    return () => transport.close();
  }, []);

  function resizeToFit() {
    const { width: vw, height: vh } = viewportSizeRef.current;
    if (!vw || !vh || resizedRef.current)
      return;
    resizedRef.current = true;
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    const toolbar = document.querySelector('.toolbar') as HTMLElement;
    if (!sidebar || !toolbar)
      return;
    const chromeHeight = toolbar.offsetHeight;
    const sidebarWidth = sidebar.offsetWidth;
    const extraW = window.outerWidth - window.innerWidth;
    const extraH = window.outerHeight - window.innerHeight;
    const targetW = Math.min(vw + sidebarWidth + extraW, screen.availWidth);
    const targetH = Math.min(vh + chromeHeight + extraH, screen.availHeight);
    window.resizeTo(targetW, targetH);
  }

  function imgCoords(e: React.MouseEvent): { x: number; y: number } {
    const { width: vw, height: vh } = viewportSizeRef.current;
    if (!vw || !vh)
      return { x: 0, y: 0 };
    const display = displayRef.current;
    if (!display)
      return { x: 0, y: 0 };
    const rect = display.getBoundingClientRect();
    const imgAspect = display.naturalWidth / display.naturalHeight;
    const elemAspect = rect.width / rect.height;
    let renderW: number, renderH: number, offsetX: number, offsetY: number;
    if (imgAspect > elemAspect) {
      renderW = rect.width;
      renderH = rect.width / imgAspect;
      offsetX = 0;
      offsetY = (rect.height - renderH) / 2;
    } else {
      renderH = rect.height;
      renderW = rect.height * imgAspect;
      offsetX = (rect.width - renderW) / 2;
      offsetY = 0;
    }
    const fracX = (e.clientX - rect.left - offsetX) / renderW;
    const fracY = (e.clientY - rect.top - offsetY) / renderH;
    return {
      x: Math.round(fracX * vw),
      y: Math.round(fracY * vh),
    };
  }

  const BUTTONS: string[] = ['left', 'middle', 'right'];

  function onScreenMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    screenRef.current?.focus();
    if (!capturedRef.current) {
      setCaptured(true);
      setHintVisible(false);
      return;
    }
    const { x, y } = imgCoords(e);
    activeTransport()?.sendNoReply('mousedown', { x, y, button: BUTTONS[e.button] || 'left' });
  }

  function onScreenMouseUp(e: React.MouseEvent) {
    if (!capturedRef.current)
      return;
    e.preventDefault();
    const { x, y } = imgCoords(e);
    activeTransport()?.sendNoReply('mouseup', { x, y, button: BUTTONS[e.button] || 'left' });
  }

  function onScreenMouseMove(e: React.MouseEvent) {
    if (!capturedRef.current)
      return;
    const now = Date.now();
    if (now - moveThrottleRef.current < 32)
      return;
    moveThrottleRef.current = now;
    const { x, y } = imgCoords(e);
    activeTransport()?.sendNoReply('mousemove', { x, y });
  }

  function onScreenWheel(e: React.WheelEvent) {
    if (!capturedRef.current)
      return;
    e.preventDefault();
    activeTransport()?.sendNoReply('wheel', { deltaX: e.deltaX, deltaY: e.deltaY });
  }

  function onScreenKeyDown(e: React.KeyboardEvent) {
    if (!capturedRef.current)
      return;
    e.preventDefault();
    if (e.key === 'Escape' && !(e.metaKey || e.ctrlKey)) {
      setCaptured(false);
      return;
    }
    activeTransport()?.sendNoReply('keydown', { key: e.key });
  }

  function onScreenKeyUp(e: React.KeyboardEvent) {
    if (!capturedRef.current)
      return;
    e.preventDefault();
    activeTransport()?.sendNoReply('keyup', { key: e.key });
  }

  function onScreenBlur() {
    if (capturedRef.current)
      setCaptured(false);
  }

  function onOmniboxKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      let value = (e.target as HTMLInputElement).value.trim();
      if (!/^https?:\/\//i.test(value))
        value = 'https://' + value;
      setUrl(value);
      activeTransport()?.send('navigate', { url: value });
      omniboxRef.current?.blur();
    }
  }

  const hasPages = !!selectedPageId;

  return (<div className='app-layout'>
    {/* Sidebar */}
    <div className='sidebar'>
      <div className='sidebar-header'>
        <span className='sidebar-brand'>Playwright</span>
        <div id='status' className={'status ' + status.cls}>{status.text}</div>
      </div>
      <div id='sidebar-tree' className='sidebar-tree' role='tree'>
        {sourceGroups.map(group => (
          <div key={group.wsUrl || 'local'} className='source-group' role='treeitem' aria-label={group.name} aria-expanded={!collapsedSources.has(group.name)}>
            <div className='source-header' onClick={() => toggleSource(group.name)}>
              <svg className={'source-chevron' + (collapsedSources.has(group.name) ? ' collapsed' : '')} viewBox='0 0 16 16' fill='currentColor' aria-hidden='true'>
                <path d='M5.7 13.7L5 13l4.6-4.6L5 3.7l.7-.7 5 5.3z'/>
              </svg>
              <span className='source-name' aria-hidden='true'>{group.name}</span>
              <span className='source-count' aria-hidden='true'>{group.tabs.length}</span>
              <button
                className='source-add-btn'
                title='New Tab'
                onClick={e => {
                  e.stopPropagation();
                  if (group.wsUrl) {
                    const contextId = group.tabs[0]?.contextId ?? remoteContextsBySource[group.wsUrl]?.[0];
                    if (contextId)
                      remoteTransportsRef.current.get(group.wsUrl)?.sendNoReply('newTab', { contextId });
                  } else {
                    const contextId = group.tabs[0]?.contextId ?? contexts[0]?.id;
                    if (contextId)
                      transportRef.current?.sendNoReply('newTab', { contextId });
                  }
                }}
              >
                <svg viewBox='0 0 16 16' fill='currentColor'>
                  <path d='M8 3v10M3 8h10' stroke='currentColor' strokeWidth='1.5' fill='none' strokeLinecap='round'/>
                </svg>
              </button>
            </div>
            {!collapsedSources.has(group.name) && (
              <div className='source-tabs' role='group'>
                {group.tabs.map(tab => (
                  <div
                    key={(tab.sourceWsUrl || 'local') + ':' + tab.id}
                    className={'tree-tab' + (tab.id === selectedPageId && tab.sourceWsUrl === selectedSourceWsUrl ? ' active' : '')}
                    role='treeitem'
                    aria-selected={tab.id === selectedPageId && tab.sourceWsUrl === selectedSourceWsUrl}
                    title={tab.url || ''}
                    onClick={() => {
                      setSelectedSourceWsUrl(tab.sourceWsUrl);
                      selectedSourceRef.current = tab.sourceWsUrl;
                      setSelectedPageId(tab.id);
                      if (tab.sourceWsUrl)
                        remoteTransportsRef.current.get(tab.sourceWsUrl)?.sendNoReply('selectTab', { id: tab.id });
                      else
                        transportRef.current?.sendNoReply('selectTab', { id: tab.id });
                    }}
                  >
                    <span className='tree-tab-favicon' aria-hidden='true'>{tabFavicon(tab.url)}</span>
                    <span className='tree-tab-label'>{tab.title || 'New Tab'}</span>
                    <button
                      className='tree-tab-close'
                      title='Close tab'
                      onClick={e => {
                        e.stopPropagation();
                        if (tab.sourceWsUrl)
                          remoteTransportsRef.current.get(tab.sourceWsUrl)?.sendNoReply('closeTab', { id: tab.id });
                        else
                          transportRef.current?.sendNoReply('closeTab', { id: tab.id });
                      }}
                    >
                      <svg viewBox='0 0 12 12' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round'>
                        <line x1='2' y1='2' x2='10' y2='10'/>
                        <line x1='10' y1='2' x2='2' y2='10'/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>

    {/* Main content */}
    <div className='main-content'>
      {/* Toolbar */}
      <div className='toolbar'>
        <button className='nav-btn' title='Back' onClick={() => activeTransport()?.sendNoReply('back')}>
          <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
            <polyline points='15 18 9 12 15 6'/>
          </svg>
        </button>
        <button className='nav-btn' title='Forward' onClick={() => activeTransport()?.sendNoReply('forward')}>
          <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
            <polyline points='9 18 15 12 9 6'/>
          </svg>
        </button>
        <button className='nav-btn' title='Reload' onClick={() => activeTransport()?.sendNoReply('reload')}>
          <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
            <polyline points='23 4 23 10 17 10'/>
            <path d='M20.49 15a9 9 0 1 1-2.12-9.36L23 10'/>
          </svg>
        </button>
        <input
          ref={omniboxRef}
          id='omnibox'
          className='omnibox'
          type='text'
          placeholder='Search or enter URL'
          spellCheck={false}
          autoComplete='off'
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={onOmniboxKeyDown}
          onFocus={e => e.target.select()}
        />
      </div>

      {/* Viewport */}
      <div className='viewport-wrapper'>
        <div
          ref={screenRef}
          className={'screen' + (captured ? ' captured' : '')}
          tabIndex={0}
          style={{ display: hasPages ? '' : 'none' }}
          onMouseDown={onScreenMouseDown}
          onMouseUp={onScreenMouseUp}
          onMouseMove={onScreenMouseMove}
          onWheel={onScreenWheel}
          onKeyDown={onScreenKeyDown}
          onKeyUp={onScreenKeyUp}
          onBlur={onScreenBlur}
          onContextMenu={e => e.preventDefault()}
          onMouseEnter={() => {
            if (!capturedRef.current)
              setHintVisible(true);
          }}
          onMouseLeave={() => setHintVisible(false)}
        >
          <img ref={displayRef} id='display' className='display' alt='screencast' src={frameSrc}/>
          <div className={'capture-hint' + (hintVisible ? ' visible' : '')}>Click to interact &middot; Esc to release</div>
        </div>
        <div id='no-pages' className={'no-pages' + (!hasPages ? ' visible' : '')}>No tabs open</div>
      </div>
    </div>
  </div>);
};
