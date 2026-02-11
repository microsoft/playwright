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
import { navigate } from './index';
import { DevToolsTransport } from './transport';

type TabInfo = { id: string; title: string; url: string };

function tabFavicon(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    return host ? host[0].toUpperCase() : '';
  } catch {
    return '';
  }
}

export const DevTools: React.FC<{ wsUrl: string }> = ({ wsUrl }) => {
  const [status, setStatus] = React.useState<{ text: string; cls: string }>({ text: 'Connecting', cls: '' });
  const [tabs, setTabs] = React.useState<TabInfo[]>([]);
  const [selectedPageId, setSelectedPageId] = React.useState<string | undefined>();
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

  // Keep capturedRef in sync with state.
  React.useEffect(() => {
    capturedRef.current = captured;
  }, [captured]);

  React.useEffect(() => {
    const transport = new DevToolsTransport(wsUrl);
    transportRef.current = transport;

    transport.onopen = () => setStatus({ text: 'Connected', cls: 'connected' });

    transport.onevent = (method: string, params: any) => {
      if (method === 'selectPage') {
        setSelectedPageId(params.pageId);
        if (params.pageId)
          omniboxRef.current?.focus();
      }
      if (method === 'frame') {
        setFrameSrc('data:image/jpeg;base64,' + params.data);
        if (params.viewportWidth)
          viewportSizeRef.current.width = params.viewportWidth;
        if (params.viewportHeight)
          viewportSizeRef.current.height = params.viewportHeight;
        resizeToFit();
      }
      if (method === 'url')
        setUrl(params.url);
      if (method === 'tabs')
        setTabs(params.tabs);
    };

    transport.onclose = () => setStatus({ text: 'Disconnected', cls: 'error' });

    return () => transport.close();
  }, [wsUrl]);

  function resizeToFit() {
    const { width: vw, height: vh } = viewportSizeRef.current;
    if (!vw || !vh || resizedRef.current)
      return;
    resizedRef.current = true;
    const tabbar = document.querySelector('.tabbar') as HTMLElement;
    const toolbar = document.querySelector('.toolbar') as HTMLElement;
    if (!tabbar || !toolbar)
      return;
    const chromeHeight = tabbar.offsetHeight + toolbar.offsetHeight;
    const extraW = window.outerWidth - window.innerWidth;
    const extraH = window.outerHeight - window.innerHeight;
    const targetW = Math.min(vw + extraW, screen.availWidth);
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
    transportRef.current?.sendNoReply('mousedown', { x, y, button: BUTTONS[e.button] || 'left' });
  }

  function onScreenMouseUp(e: React.MouseEvent) {
    if (!capturedRef.current)
      return;
    e.preventDefault();
    const { x, y } = imgCoords(e);
    transportRef.current?.sendNoReply('mouseup', { x, y, button: BUTTONS[e.button] || 'left' });
  }

  function onScreenMouseMove(e: React.MouseEvent) {
    if (!capturedRef.current)
      return;
    const now = Date.now();
    if (now - moveThrottleRef.current < 32)
      return;
    moveThrottleRef.current = now;
    const { x, y } = imgCoords(e);
    transportRef.current?.sendNoReply('mousemove', { x, y });
  }

  function onScreenWheel(e: React.WheelEvent) {
    if (!capturedRef.current)
      return;
    e.preventDefault();
    transportRef.current?.sendNoReply('wheel', { deltaX: e.deltaX, deltaY: e.deltaY });
  }

  function onScreenKeyDown(e: React.KeyboardEvent) {
    if (!capturedRef.current)
      return;
    e.preventDefault();
    if (e.key === 'Escape' && !(e.metaKey || e.ctrlKey)) {
      setCaptured(false);
      return;
    }
    transportRef.current?.sendNoReply('keydown', { key: e.key });
  }

  function onScreenKeyUp(e: React.KeyboardEvent) {
    if (!capturedRef.current)
      return;
    e.preventDefault();
    transportRef.current?.sendNoReply('keyup', { key: e.key });
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
      transportRef.current?.send('navigate', { url: value });
      omniboxRef.current?.blur();
    }
  }

  const hasPages = !!selectedPageId;

  return (<div className='devtools-view'>
    {/* Tab bar */}
    <div className='tabbar'>
      <a className='tabbar-back' href='#' title='Back to sessions' onClick={e => { e.preventDefault(); navigate('#'); }}>
        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <polyline points='15 18 9 12 15 6'/>
        </svg>
      </a>
      <div id='tabstrip' className='tabstrip' role='tablist'>
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={'tab' + (tab.id === selectedPageId ? ' active' : '')}
            role='tab'
            aria-selected={tab.id === selectedPageId}
            title={tab.url || ''}
            onClick={() => transportRef.current?.sendNoReply('selectTab', { id: tab.id })}
          >
            <span className='tab-favicon' aria-hidden='true'>{tabFavicon(tab.url)}</span>
            <span className='tab-label'>{tab.title || 'New Tab'}</span>
            <button
              className='tab-close'
              title='Close tab'
              onClick={e => {
                e.stopPropagation();
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
      <button id='new-tab-btn' className='new-tab-btn' title='New Tab' onClick={() => transportRef.current?.sendNoReply('newTab')}>
        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'>
          <line x1='12' y1='5' x2='12' y2='19'/>
          <line x1='5' y1='12' x2='19' y2='12'/>
        </svg>
      </button>
      <div id='status' className={'status ' + status.cls}>{status.text}</div>
    </div>

    {/* Toolbar */}
    <div className='toolbar'>
      <button className='nav-btn' title='Back' onClick={() => transportRef.current?.sendNoReply('back')}>
        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <polyline points='15 18 9 12 15 6'/>
        </svg>
      </button>
      <button className='nav-btn' title='Forward' onClick={() => transportRef.current?.sendNoReply('forward')}>
        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <polyline points='9 18 15 12 9 6'/>
        </svg>
      </button>
      <button className='nav-btn' title='Reload' onClick={() => transportRef.current?.sendNoReply('reload')}>
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
  </div>);
};
