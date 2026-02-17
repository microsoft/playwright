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
import type { Tab, DevToolsChannelEvents } from './devtoolsChannel';

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
  const [interactive, setInteractive] = React.useState(false);
  const [tabs, setTabs] = React.useState<Tab[]>([]);
  const [url, setUrl] = React.useState('');
  const [frame, setFrame] = React.useState<DevToolsChannelEvents['frame']>();
  const [showInspector, setShowInspector] = React.useState(false);
  const [picking, setPicking] = React.useState(false);
  const [locatorToast, setLocatorToast] = React.useState<{ text: string; timer: ReturnType<typeof setTimeout> }>();
  const [actionLog, setActionLog] = React.useState<Array<{ title: string; error?: string; id: number }>>([]);

  const [channel, setChannel] = React.useState<DevToolsClientChannel | undefined>();
  const displayRef = React.useRef<HTMLImageElement>(null);
  const screenRef = React.useRef<HTMLDivElement>(null);
  const tabbarRef = React.useRef<HTMLDivElement>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const moveThrottleRef = React.useRef(0);

  React.useEffect(() => {
    if (!wsUrl)
      return;
    const channel = DevToolsClient.create(wsUrl);

    channel.onopen = () => {
      setChannel(channel);
      setInteractive(false);
      setPicking(false);
    };

    channel.on('tabs', params => {
      setTabs(params.tabs);
      const selected = params.tabs.find(t => t.selected);
      if (selected)
        setUrl(selected.url);
    });

    let resized = false;

    channel.on('frame', params => {
      setFrame(params);
      const tabbar = tabbarRef.current;
      const toolbar = toolbarRef.current;
      if (!resized && tabbar && toolbar && params.viewportWidth && params.viewportHeight) {
        resized = true;
        const chromeHeight = tabbar.offsetHeight + toolbar.offsetHeight;
        const extraW = window.outerWidth - window.innerWidth;
        const extraH = window.outerHeight - window.innerHeight;
        const targetW = Math.min(params.viewportWidth + extraW, screen.availWidth);
        const targetH = Math.min(params.viewportHeight + chromeHeight + extraH, screen.availHeight);
        window.resizeTo(targetW, targetH);
      }
    });

    channel.on('elementPicked', params => {
      const locator = asLocator('javascript', params.selector);
      navigator.clipboard?.writeText(locator).catch(() => {});
      setPicking(false);
      setLocatorToast(old => {
        clearTimeout(old?.timer);
        return { text: locator, timer: setTimeout(() => setLocatorToast(undefined), 3000) };
      });
    });

    let logId = 0;
    channel.on('log', params => {
      const id = ++logId;
      setActionLog(prev => [...prev.slice(-9), { ...params, id }]);
    });

    channel.onclose = () => {
      setChannel(undefined);
      setInteractive(false);
      setPicking(false);
      setShowInspector(false);
    };

    return () => {
      channel.close();
    };
  }, [wsUrl]);

  function imgCoords(e: React.MouseEvent): { x: number; y: number } {
    const vw = frame?.viewportWidth ?? 0;
    const vh = frame?.viewportHeight ?? 0;
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
    channel?.[method]({ x, y, button: BUTTONS[e.button] || 'left' });
  }

  function onScreenMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    screenRef.current?.focus();
    if (!channel)
      return;
    if (!interactive) {
      setInteractive(true);
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
    channel?.mousemove({ x, y });
  }

  function onScreenWheel(e: React.WheelEvent) {
    if (!interactive)
      return;
    e.preventDefault();
    channel?.wheel({ deltaX: e.deltaX, deltaY: e.deltaY });
  }

  function onScreenKeyDown(e: React.KeyboardEvent) {
    if (picking && e.key === 'Escape') {
      e.preventDefault();
      channel?.cancelPickLocator();
      setPicking(false);
      return;
    }
    if (!interactive)
      return;
    e.preventDefault();
    channel?.keydown({ key: e.key });
  }

  function onScreenKeyUp(e: React.KeyboardEvent) {
    if (!interactive)
      return;
    e.preventDefault();
    channel?.keyup({ key: e.key });
  }

  function onOmniboxKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      let value = (e.target as HTMLInputElement).value.trim();
      if (!/^https?:\/\//i.test(value))
        value = 'https://' + value;
      setUrl(value);
      channel?.navigate({ url: value });
      e.currentTarget.blur();
    }
  }

  const selectedTab = tabs.find(t => t.selected);
  const hasPages = !!selectedTab;

  let overlayText: string | undefined;
  if (!channel)
    overlayText = 'Disconnected';
  if (channel && !hasPages)
    overlayText = 'No tabs open';

  return (<div className={'devtools-view' + (interactive ? ' interactive' : '')}
  >
    {/* Tab bar */}
    <div ref={tabbarRef} className='tabbar'>
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
            onClick={() => channel?.selectTab({ pageId: tab.pageId })}
          >
            <span className='tab-favicon' aria-hidden='true'>{tabFavicon(tab.url)}</span>
            <span className='tab-label'>{tab.title || 'New Tab'}</span>
            <button
              className='tab-close'
              title='Close tab'
              onClick={e => {
                e.stopPropagation();
                channel?.closeTab({ pageId: tab.pageId });
              }}
            >
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
      <button id='new-tab-btn' className='new-tab-btn' title='New Tab' onClick={() => channel?.newTab()}>
        <PlusIcon />
      </button>
      <div className='interactive-controls'>
        <div className={'segmented-control' + (interactive ? ' interactive' : '')} role='group' aria-label='Interaction mode' title={interactive ? 'Interactive mode: page input is forwarded' : 'Read-only mode: page input is blocked'}>
          <button
            className={'segmented-control-option' + (!interactive ? ' active' : '')}
            disabled={!channel}
            aria-pressed={!interactive}
            title='Read-only mode'
            onClick={() => {
              channel?.cancelPickLocator();
              setPicking(false);
              setInteractive(false);
            }}
          >
            Read-only
          </button>
          <button
            className={'segmented-control-option' + (interactive ? ' active' : '')}
            disabled={!channel}
            aria-pressed={interactive}
            title='Interactive mode'
            onClick={() => setInteractive(true)}
          >
            Interactive
          </button>
        </div>
      </div>
    </div>

    {/* Toolbar */}
    <div ref={toolbarRef} className='toolbar'>
      <button className='nav-btn' title='Back' onClick={() => channel?.back()}>
        <ChevronLeftIcon />
      </button>
      <button className='nav-btn' title='Forward' onClick={() => channel?.forward()}>
        <ChevronRightIcon />
      </button>
      <button className='nav-btn' title='Reload' onClick={() => channel?.reload()}>
        <ReloadIcon />
      </button>
      <input
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
        title='Pick locator'
        aria-pressed={picking}
        disabled={!channel}
        onClick={async () => {
          if (picking) {
            await channel?.cancelPickLocator();
            setPicking(false);
          } else {
            setInteractive(true);
            await channel?.pickLocator();
            setPicking(true);
            screenRef.current?.focus();
          }
        }}
      >
        <PickLocatorIcon />
      </button>
      {selectedTab?.inspectorUrl && (
        <button
          className={'nav-btn' + (showInspector ? ' active-toggle' : '')}
          title='Chrome DevTools'
          aria-pressed={showInspector}
          disabled={!channel}
          onClick={() => {
            setInteractive(true);
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
            style={{ display: frame ? '' : 'none' }}
            onMouseDown={onScreenMouseDown}
            onMouseUp={onScreenMouseUp}
            onMouseMove={onScreenMouseMove}
            onWheel={onScreenWheel}
            onKeyDown={onScreenKeyDown}
            onKeyUp={onScreenKeyUp}
            onContextMenu={e => e.preventDefault()}
          >
            <img
              ref={displayRef}
              id='display'
              className='display'
              alt='screencast'
              src={frame ? 'data:image/jpeg;base64,' + frame.data : undefined}
            />
            {locatorToast
              ? <div className='screen-toast visible'>Copied: <code>{locatorToast.text}</code></div>
              : picking
                ? <div className='screen-toast visible'>Click an element to pick its locator</div>
                : null
            }
            <div className='action-log'>
              {actionLog.map(entry => (
                <div key={entry.id} className={'action-log-entry' + (entry.error ? ' error' : '')}>
                  {entry.title}{entry.error ? ': ' + entry.error : ''}
                </div>
              ))}
            </div>
          </div>
          {overlayText && <div className={'screen-overlay' + (frame ? ' has-frame' : '')}><span>{overlayText}</span></div>}
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
