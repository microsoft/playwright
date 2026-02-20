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
import { DevToolsClient } from './devtoolsClient';
import { asLocator } from '@isomorphic/locatorGenerators';

import type { DevToolsClientChannel } from './devtoolsClient';
import type { Tab } from './devtoolsChannel';

function tabFavicon(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    return host ? host[0].toUpperCase() : '';
  } catch {
    return '';
  }
}

const BUTTONS = ['left', 'middle', 'right'] as const;

export const DevTools: React.FC<{ wsUrl?: string }> = ({ wsUrl }) => {
  const [status, setStatus] = React.useState<{ text: string; cls: string }>({ text: 'Connecting', cls: '' });
  const [tabs, setTabs] = React.useState<Tab[]>([]);
  const [url, setUrl] = React.useState('');
  const [frameSrc, setFrameSrc] = React.useState('');
  const [captured, setCaptured] = React.useState(false);
  const [hintVisible, setHintVisible] = React.useState(false);
  const [showInspector, setShowInspector] = React.useState(false);
  const [picking, setPicking] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const channelRef = React.useRef<DevToolsClientChannel | null>(null);
  const displayRef = React.useRef<HTMLImageElement>(null);
  const screenRef = React.useRef<HTMLDivElement>(null);
  const viewportWrapperRef = React.useRef<HTMLDivElement>(null);
  const omniboxRef = React.useRef<HTMLInputElement>(null);
  const viewportSizeRef = React.useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const resizedRef = React.useRef(false);
  const capturedRef = React.useRef(false);
  const moveThrottleRef = React.useRef(0);
  const pickingRef = React.useRef(false);
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout>>(0 as any);
  const [inspectorWidth, setInspectorWidth] = React.useState<number | undefined>();

  // Keep capturedRef in sync with state.
  React.useEffect(() => {
    capturedRef.current = captured;
  }, [captured]);

  React.useEffect(() => {
    pickingRef.current = picking;
  }, [picking]);

  React.useEffect(() => {
    if (!wsUrl)
      return;
    const channel = DevToolsClient.create(wsUrl);
    channelRef.current = channel;

    channel.onopen = () => setStatus({ text: 'Connected', cls: 'connected' });

    channel.on('tabs', params => {
      setTabs(params.tabs);
      const selected = params.tabs.find(t => t.selected);
      if (selected)
        setUrl(selected.url);
      if (!selected?.inspectorUrl)
        setShowInspector(false);
    });

    channel.on('frame', params => {
      setFrameSrc('data:image/jpeg;base64,' + params.data);
      if (params.viewportWidth)
        viewportSizeRef.current.width = params.viewportWidth;
      if (params.viewportHeight)
        viewportSizeRef.current.height = params.viewportHeight;
      resizeToFit();
    });

    channel.on('elementPicked', params => {
      const locator = asLocator('javascript', params.selector);
      navigator.clipboard?.writeText(locator).catch(() => {});
      setPicking(false);
      setToast(locator);
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 3000);
    });

    channel.onclose = () => setStatus({ text: 'Disconnected', cls: 'error' });

    return () => {
      clearTimeout(toastTimerRef.current);
      channel.close();
    };
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

  const isForwardingInput = () => showInspector || capturedRef.current;

  function sendMouseEvent(method: 'mousedown' | 'mouseup', e: React.MouseEvent) {
    const { x, y } = imgCoords(e);
    channelRef.current?.[method]({ x, y, button: BUTTONS[e.button] || 'left' });
  }

  function onScreenMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    screenRef.current?.focus();
    if (!pickingRef.current && !isForwardingInput()) {
      setCaptured(true);
      setHintVisible(false);
      return;
    }
    sendMouseEvent('mousedown', e);
  }

  function onScreenMouseUp(e: React.MouseEvent) {
    if (!pickingRef.current && !isForwardingInput())
      return;
    e.preventDefault();
    sendMouseEvent('mouseup', e);
  }

  function onScreenMouseMove(e: React.MouseEvent) {
    if (!pickingRef.current && !isForwardingInput())
      return;
    const now = Date.now();
    if (now - moveThrottleRef.current < 32)
      return;
    moveThrottleRef.current = now;
    const { x, y } = imgCoords(e);
    channelRef.current?.mousemove({ x, y });
  }

  function onScreenWheel(e: React.WheelEvent) {
    if (!isForwardingInput())
      return;
    e.preventDefault();
    channelRef.current?.wheel({ deltaX: e.deltaX, deltaY: e.deltaY });
  }

  function onScreenKeyDown(e: React.KeyboardEvent) {
    if (pickingRef.current && e.key === 'Escape') {
      e.preventDefault();
      channelRef.current?.cancelPickLocator();
      setPicking(false);
      return;
    }
    if (!isForwardingInput())
      return;
    e.preventDefault();
    if (e.key === 'Escape' && !(e.metaKey || e.ctrlKey)) {
      setCaptured(false);
      return;
    }
    channelRef.current?.keydown({ key: e.key });
  }

  function onScreenKeyUp(e: React.KeyboardEvent) {
    if (!isForwardingInput())
      return;
    e.preventDefault();
    channelRef.current?.keyup({ key: e.key });
  }

  function onScreenBlur() {
    setCaptured(false);
  }

  function onInspectorGripPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0)
      return;
    const wrapperRect = viewportWrapperRef.current?.getBoundingClientRect();
    if (!wrapperRect)
      return;
    e.preventDefault();
    const grip = e.currentTarget;
    grip.setPointerCapture(e.pointerId);
    const minWidth = 300;
    const maxWidth = Math.max(minWidth, wrapperRect.width - 320);
    const startX = e.clientX;
    const startWidth = inspectorWidth ?? wrapperRect.width * 0.5;
    const onPointerMove = (event: PointerEvent) => {
      const delta = startX - event.clientX;
      const nextWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + delta));
      setInspectorWidth(nextWidth);
    };
    const onPointerUp = () => {
      grip.removeEventListener('pointermove', onPointerMove);
      grip.removeEventListener('pointerup', onPointerUp);
      grip.removeEventListener('lostpointercapture', onPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    grip.addEventListener('pointermove', onPointerMove);
    grip.addEventListener('pointerup', onPointerUp);
    grip.addEventListener('lostpointercapture', onPointerUp);
  }

  function onOmniboxKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      let value = (e.target as HTMLInputElement).value.trim();
      if (!/^https?:\/\//i.test(value))
        value = 'https://' + value;
      setUrl(value);
      channelRef.current?.navigate({ url: value });
      omniboxRef.current?.blur();
    }
  }

  const selectedTab = tabs.find(t => t.selected);
  const hasPages = !!selectedTab;

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
            key={tab.pageId}
            className={'tab' + (tab.selected ? ' active' : '')}
            role='tab'
            aria-selected={tab.selected}
            title={tab.url || ''}
            onClick={() => channelRef.current?.selectTab({ pageId: tab.pageId })}
          >
            <span className='tab-favicon' aria-hidden='true'>{tabFavicon(tab.url)}</span>
            <span className='tab-label'>{tab.title || 'New Tab'}</span>
            <button
              className='tab-close'
              title='Close tab'
              onClick={e => {
                e.stopPropagation();
                channelRef.current?.closeTab({ pageId: tab.pageId });
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
      <button id='new-tab-btn' className='new-tab-btn' title='New Tab' onClick={() => channelRef.current?.newTab()}>
        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'>
          <line x1='12' y1='5' x2='12' y2='19'/>
          <line x1='5' y1='12' x2='19' y2='12'/>
        </svg>
      </button>
      <div id='status' className={'status ' + status.cls}>{status.text}</div>
    </div>

    {/* Toolbar */}
    <div className='toolbar'>
      <button className='nav-btn' title='Back' onClick={() => channelRef.current?.back()}>
        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <polyline points='15 18 9 12 15 6'/>
        </svg>
      </button>
      <button className='nav-btn' title='Forward' onClick={() => channelRef.current?.forward()}>
        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <polyline points='9 18 15 12 9 6'/>
        </svg>
      </button>
      <button className='nav-btn' title='Reload' onClick={() => channelRef.current?.reload()}>
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
      {false && <button
        className={'nav-btn' + (picking ? ' active-toggle' : '')}
        title={picking ? 'Cancel pick locator' : 'Pick locator'}
        onClick={() => {
          if (picking) {
            channelRef.current?.cancelPickLocator();
            setPicking(false);
          } else {
            channelRef.current?.pickLocator();
            setPicking(true);
          }
        }}
      >
        <svg viewBox='0 0 48 48' fill='currentColor'>
          <path d='M18 42h-7.5c-3 0-4.5-1.5-4.5-4.5v-27C6 7.5 7.5 6 10.5 6h27C42 6 42 10.404 42 10.5V18h-3V9H9v30h9v3Zm27-15-9 6 9 9-3 3-9-9-6 9-6-24 24 6Z'/>
        </svg>
      </button>
      }
      {false && selectedTab?.inspectorUrl && (
        <button
          className={'nav-btn' + (showInspector ? ' active-toggle' : '')}
          title={showInspector ? 'Hide Chrome DevTools' : 'Show Chrome DevTools'}
          onClick={() => setShowInspector(!showInspector)}
        >
          <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
            <rect x='3' y='3' width='18' height='18' rx='2'/>
            <line x1='9' y1='3' x2='9' y2='21'/>
          </svg>
        </button>
      )}
    </div>

    {/* Viewport */}
    <div ref={viewportWrapperRef} className='viewport-wrapper'>
      <div className='viewport-main'>
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
            if (!showInspector && !capturedRef.current)
              setHintVisible(true);
          }}
          onMouseLeave={() => setHintVisible(false)}
        >
          <img ref={displayRef} id='display' className='display' alt='screencast' src={frameSrc}/>
          {toast
            ? <div className='capture-hint visible'>Copied: <code>{toast}</code></div>
            : picking
              ? <div className='capture-hint visible'>Click an element to pick its locator</div>
              : !showInspector && <div className={'capture-hint' + (hintVisible ? ' visible' : '')}>Click to interact &middot; Esc to release</div>
          }
        </div>
        <div id='no-pages' className={'no-pages' + (!hasPages ? ' visible' : '')}>No tabs open</div>
      </div>
      {showInspector && selectedTab?.inspectorUrl && (
        <div className='inspector-panel' style={inspectorWidth ? { width: `${inspectorWidth}px` } : undefined}>
          <div className='inspector-grip' onPointerDown={onInspectorGripPointerDown} />
          <iframe
            className='inspector-frame'
            src={selectedTab.inspectorUrl}
            title='Chrome DevTools'
          />
        </div>
      )}
    </div>
  </div>);
};
