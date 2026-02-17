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
import { SplitView } from '@web/components/splitView';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, PlusIcon, ReloadIcon, PickLocatorIcon, InspectorPanelIcon } from './icons';

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
  const [connected, setConnected] = React.useState(false);
  const [interactive, setInteractive] = React.useState(false);
  const [tabs, setTabs] = React.useState<Tab[]>([]);
  const [url, setUrl] = React.useState('');
  const [frameSrc, setFrameSrc] = React.useState('');
  const [consentHintVisible, setConsentHintVisible] = React.useState(false);
  const [showInspector, setShowInspector] = React.useState(false);
  const [picking, setPicking] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const channelRef = React.useRef<DevToolsClientChannel | null>(null);
  const displayRef = React.useRef<HTMLImageElement>(null);
  const screenRef = React.useRef<HTMLDivElement>(null);
  const omniboxRef = React.useRef<HTMLInputElement>(null);
  const viewportSizeRef = React.useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const resizedRef = React.useRef(false);
  const moveThrottleRef = React.useRef(0);
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout>>(0 as any);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!wsUrl)
      return;
    const channel = DevToolsClient.create(wsUrl);
    channelRef.current = channel;

    channel.onopen = () => {
      setConnected(true);
      setInteractive(false);
      setPicking(false);
      setConsentHintVisible(false);
    };

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

    channel.onclose = () => {
      setConnected(false);
      setInteractive(false);
      setPicking(false);
    };

    return () => {
      clearTimeout(toastTimerRef.current);
      channel.close();
    };
  }, [wsUrl]);

  function showConsentHint() {
    setConsentHintVisible(true);
  }

  function clearConsentHint() {
    setConsentHintVisible(false);
  }

  function toggleInteractive(nextValue?: boolean) {
    const nextConsent = nextValue ?? !interactive;
    if (!connected)
      return;
    if (!nextConsent && picking) {
      channelRef.current?.cancelPickLocator();
      setPicking(false);
    }
    setInteractive(nextConsent);
    clearConsentHint();
    if (nextConsent) {
      const el = rootRef.current;
      if (el) {
        el.classList.remove('consent-flow-active');
        // Force reflow so re-adding the class restarts animations.
        void el.offsetWidth;
        el.classList.add('consent-flow-active');
      }
    } else {
      rootRef.current?.classList.remove('consent-flow-active');
    }
  }

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

  function sendMouseEvent(method: 'mousedown' | 'mouseup', e: React.MouseEvent) {
    const { x, y } = imgCoords(e);
    channelRef.current?.[method]({ x, y, button: BUTTONS[e.button] || 'left' });
  }

  function onScreenMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    screenRef.current?.focus();
    if (!interactive) {
      showConsentHint();
      return;
    }
    sendMouseEvent('mousedown', e);
  }

  function onScreenMouseUp(e: React.MouseEvent) {
    if (!interactive)
      return;
    e.preventDefault();
    sendMouseEvent('mouseup', e);
  }

  function onScreenMouseMove(e: React.MouseEvent) {
    if (!interactive)
      return;
    const now = Date.now();
    if (now - moveThrottleRef.current < 32)
      return;
    moveThrottleRef.current = now;
    const { x, y } = imgCoords(e);
    channelRef.current?.mousemove({ x, y });
  }

  function onScreenWheel(e: React.WheelEvent) {
    if (!interactive) {
      showConsentHint();
      return;
    }
    if (!interactive)
      return;
    e.preventDefault();
    channelRef.current?.wheel({ deltaX: e.deltaX, deltaY: e.deltaY });
  }

  function onScreenKeyDown(e: React.KeyboardEvent) {
    if (picking && e.key === 'Escape') {
      e.preventDefault();
      channelRef.current?.cancelPickLocator();
      setPicking(false);
      return;
    }
    if (!interactive) {
      showConsentHint();
      return;
    }
    e.preventDefault();
    channelRef.current?.keydown({ key: e.key });
  }

  function onScreenKeyUp(e: React.KeyboardEvent) {
    if (!interactive)
      return;
    e.preventDefault();
    channelRef.current?.keyup({ key: e.key });
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
  const interactionModeTitle = interactive
    ? 'Interactive mode: page input is forwarded'
    : 'Read-only mode: page input is blocked';

  return (<div ref={rootRef} className={'devtools-view' + (interactive ? ' consent-active' : '')}
    onAnimationEnd={() => rootRef.current?.classList.remove('consent-flow-active')}
  >
    {/* Tab bar */}
    <div className='tabbar'>
      <a className='tabbar-back' href='#' title='Back to sessions' onClick={e => { e.preventDefault(); navigate('#'); }}>
        <ChevronLeftIcon />
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
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
      <button id='new-tab-btn' className='new-tab-btn' title='New Tab' onClick={() => channelRef.current?.newTab()}>
        <PlusIcon />
      </button>
      <div className='consent-controls'>
        <div className={'consent-segmented' + (interactive ? ' interactive' : '')} role='group' aria-label='Interaction mode' title={interactionModeTitle}>
          <button
            className={'consent-segment' + (!interactive ? ' active' : '')}
            disabled={!connected}
            title='Read-only mode'
            onClick={() => toggleInteractive(false)}
          >
            Read-only
          </button>
          <button
            className={'consent-segment' + (interactive ? ' active' : '')}
            disabled={!connected}
            title='Interactive mode'
            onClick={() => toggleInteractive(true)}
          >
            Interactive
          </button>
        </div>
      </div>
    </div>

    {/* Toolbar */}
    <div className='toolbar'>
      <button className='nav-btn' title='Back' onClick={() => channelRef.current?.back()}>
        <ChevronLeftIcon />
      </button>
      <button className='nav-btn' title='Forward' onClick={() => channelRef.current?.forward()}>
        <ChevronRightIcon />
      </button>
      <button className='nav-btn' title='Reload' onClick={() => channelRef.current?.reload()}>
        <ReloadIcon />
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
      <button
        className={'nav-btn' + (picking ? ' active-toggle' : '')}
        title={picking ? 'Cancel pick locator' : 'Pick locator'}
        disabled={!connected}
        onClick={() => {
          if (picking) {
            channelRef.current?.cancelPickLocator();
            setPicking(false);
          } else {
            if (!interactive)
              toggleInteractive(true);
            channelRef.current?.pickLocator();
            setPicking(true);
          }
        }}
      >
        <PickLocatorIcon />
      </button>
      {selectedTab?.inspectorUrl && (
        <button
          className={'nav-btn' + (showInspector ? ' active-toggle' : '')}
          title={showInspector ? 'Hide Chrome DevTools' : 'Show Chrome DevTools'}
          disabled={!connected}
          onClick={() => {
            if (!showInspector && !interactive)
              toggleInteractive(true);
            setShowInspector(!showInspector);
          }}
        >
          <InspectorPanelIcon />
        </button>
      )}
    </div>

    {/* Viewport */}
    <div className='viewport-wrapper'>
      <SplitView
        orientation='horizontal'
        sidebarSize={500}
        minSidebarSize={300}
        settingName='devtoolsInspector'
        sidebarHidden={!showInspector || !selectedTab?.inspectorUrl}
        main={<div className='viewport-main'>
          <div
            ref={screenRef}
            className='screen'
            tabIndex={0}
            style={{ display: hasPages ? '' : 'none' }}
            onMouseDown={onScreenMouseDown}
            onMouseUp={onScreenMouseUp}
            onMouseMove={onScreenMouseMove}
            onWheel={onScreenWheel}
            onKeyDown={onScreenKeyDown}
            onKeyUp={onScreenKeyUp}
            onContextMenu={e => e.preventDefault()}
            onMouseLeave={() => {
              clearConsentHint();
            }}
          >
            <img
              ref={displayRef}
              id='display'
              className='display'
              alt='screencast'
              src={frameSrc}
            />
            {toast
              ? <div className='capture-hint visible'>Copied: <code>{toast}</code></div>
              : picking
                ? <div className='capture-hint visible'>Click an element to pick its locator</div>
                : consentHintVisible
                  ? <div className='capture-hint visible'>Switch to Interactive mode to control the page</div>
                  : null
            }
          </div>
          <div id='no-pages' className={'no-pages' + (!hasPages ? ' visible' : '')}>No tabs open</div>
        </div>}
        sidebar={<iframe
          className='inspector-frame'
          src={selectedTab?.inspectorUrl || ''}
          title='Chrome DevTools'
        />}
      />
    </div>
  </div>);
};
