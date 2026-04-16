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
import './dashboard.css';
import { navigate, DashboardClientContext } from './index';
import { asLocator } from '@isomorphic/locatorGenerators';
import { SplitView } from '@web/components/splitView';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, PlusIcon, ReloadIcon, PickLocatorIcon, InspectorPanelIcon } from './icons';
import { SettingsButton } from './settingsView';
import { Annotations, getImageLayout, clientToViewport } from './annotations';

import type { Tab, DashboardChannelEvents } from './dashboardChannel';

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

type Mode = 'readonly' | 'interactive' | 'annotate';

export const Dashboard: React.FC<{ browser: string }> = ({ browser }) => {
  const client = React.useContext(DashboardClientContext);
  const [mode, setMode] = React.useState<Mode>('readonly');
  const [tabs, setTabs] = React.useState<Tab[] | null>(null);
  const [url, setUrl] = React.useState('');
  const [frame, setFrame] = React.useState<DashboardChannelEvents['frame']>();
  const [showInspector, setShowInspector] = React.useState(false);
  const [pickingPage, setPickingPage] = React.useState<string | null>(null);
  const [locatorToast, setLocatorToast] = React.useState<{ text: string; timer: ReturnType<typeof setTimeout> }>();
  const [context, setContext] = React.useState<string | undefined>();

  const displayRef = React.useRef<HTMLImageElement>(null);
  const screenRef = React.useRef<HTMLDivElement>(null);
  const tabbarRef = React.useRef<HTMLDivElement>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const moveThrottleRef = React.useRef(0);
  const modeRef = React.useRef<Mode>('readonly');

  React.useEffect(() => { modeRef.current = mode; }, [mode]);

  const interactive = mode === 'interactive';
  const annotating = mode === 'annotate';

  React.useEffect(() => {
    if (!client)
      return;
    let disposed = false;
    let resized = false;

    const onTabs = (params: DashboardChannelEvents['tabs']) => {
      if (params.target.browser !== browser)
        return;
      setTabs(params.tabs);
      const selected = params.tabs.find(t => t.selected);
      if (selected)
        setUrl(selected.url);
    };
    const onFrame = (params: DashboardChannelEvents['frame']) => {
      if (params.target.browser !== browser)
        return;
      if (modeRef.current === 'annotate')
        return;
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
    };
    const onElementPicked = (params: DashboardChannelEvents['elementPicked']) => {
      if (params.target.browser !== browser)
        return;
      const locator = asLocator('javascript', params.selector);
      navigator.clipboard?.writeText(locator).catch(() => {});
      setPickingPage(null);
      setLocatorToast(old => {
        clearTimeout(old?.timer);
        return { text: locator, timer: setTimeout(() => setLocatorToast(undefined), 3000) };
      });
    };

    client.on('tabs', onTabs);
    client.on('frame', onFrame);
    client.on('elementPicked', onElementPicked);

    client.attach({ browser }).then(result => {
      if (!disposed)
        setContext(result.context);
    }).catch(() => {});

    return () => {
      disposed = true;
      client.off('tabs', onTabs);
      client.off('frame', onFrame);
      client.off('elementPicked', onElementPicked);
      client.detach({ browser }).catch(() => {});
      setContext(undefined);
      setTabs(null);
      setFrame(undefined);
      setMode('readonly');
      setPickingPage(null);
      setShowInspector(false);
    };
  }, [client, browser]);

  const selectedTab = tabs?.find(t => t.selected);
  const ready = !!client && !!context && !!selectedTab;
  const pageTarget = ready && selectedTab
    ? { browser, context: context!, page: selectedTab.page }
    : undefined;

  function imgCoords(e: React.MouseEvent): { x: number; y: number } {
    const vw = frame?.viewportWidth ?? 0;
    const vh = frame?.viewportHeight ?? 0;
    const layout = getImageLayout(displayRef.current);
    if (!vw || !vh || !layout)
      return { x: 0, y: 0 };
    return clientToViewport(layout, vw, vh, e.clientX, e.clientY);
  }

  function sendMouseEvent(method: 'mousedown' | 'mouseup', e: React.MouseEvent) {
    if (!pageTarget)
      return;
    const { x, y } = imgCoords(e);
    client?.[method]({ ...pageTarget, x, y, button: BUTTONS[e.button] || 'left' });
  }

  function onScreenMouseDown(e: React.MouseEvent) {
    if (annotating)
      return;
    e.preventDefault();
    screenRef.current?.focus();
    if (!ready)
      return;
    if (!interactive) {
      setMode('interactive');
      return;
    }
    sendMouseEvent('mousedown', e);
  }

  function onScreenMouseUp(e: React.MouseEvent) {
    if (annotating || !interactive)
      return;
    e.preventDefault();
    sendMouseEvent('mouseup', e);
  }

  function onScreenMouseMove(e: React.MouseEvent) {
    if (annotating || !interactive || !pageTarget)
      return;
    const now = Date.now();
    if (now - moveThrottleRef.current < 32)
      return;
    moveThrottleRef.current = now;
    const { x, y } = imgCoords(e);
    client?.mousemove({ ...pageTarget, x, y });
  }

  function onScreenWheel(e: React.WheelEvent) {
    if (annotating || !interactive || !pageTarget)
      return;
    e.preventDefault();
    client?.wheel({ ...pageTarget, deltaX: e.deltaX, deltaY: e.deltaY });
  }

  function onScreenKeyDown(e: React.KeyboardEvent) {
    if (annotating)
      return;
    if (pickingPage !== null && e.key === 'Escape') {
      e.preventDefault();
      if (pageTarget)
        client?.cancelPickLocator(pageTarget);
      setPickingPage(null);
      return;
    }
    if (!interactive || !pageTarget)
      return;
    e.preventDefault();
    client?.keydown({ ...pageTarget, key: e.key });
  }

  function onScreenKeyUp(e: React.KeyboardEvent) {
    if (annotating || !interactive || !pageTarget)
      return;
    e.preventDefault();
    client?.keyup({ ...pageTarget, key: e.key });
  }

  function onOmniboxKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      let value = (e.target as HTMLInputElement).value.trim();
      if (!/^https?:\/\//i.test(value))
        value = 'https://' + value;
      setUrl(value);
      if (pageTarget)
        client?.navigate({ ...pageTarget, url: value });
      e.currentTarget.blur();
    }
  }

  const picking = selectedTab?.page === pickingPage;

  let overlayText: string | undefined;
  if (!client || !context)
    overlayText = 'Disconnected';
  else if (tabs === null)
    overlayText = 'Loading...';
  else if (tabs.length === 0)
    overlayText = 'No tabs open';

  return (<div className={'dashboard-view' + (interactive ? ' interactive' : '') + (annotating ? ' annotate' : '')}
  >
    {/* Tab bar */}
    <div ref={tabbarRef} className='tabbar'>
      <a className='tabbar-back' href='#' title='Back to sessions' onClick={e => { e.preventDefault(); navigate('#'); }}>
        <ChevronLeftIcon />
        Sessions
      </a>
      <div id='tabstrip' className='tabstrip' role='tablist'>
        {tabs?.map(tab => (
          <div
            key={tab.page}
            className={'tab' + (tab.selected ? ' active' : '')}
            role='tab'
            aria-selected={tab.selected}
            title={tab.url || ''}
            onClick={() => client?.selectTab({ browser, context: tab.context, page: tab.page })}
          >
            <span className='tab-favicon' aria-hidden='true'>{tabFavicon(tab.url)}</span>
            <span className='tab-label'>{tab.title || 'New Tab'}</span>
            <button
              className='tab-close'
              title='Close tab'
              onClick={e => {
                e.stopPropagation();
                client?.closeTab({ browser, context: tab.context, page: tab.page });
              }}
            >
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
      <button id='new-tab-btn' className='new-tab-btn' title='New Tab' onClick={() => {
        if (context)
          client?.newTab({ browser, context });
      }}>
        <PlusIcon />
      </button>
      <div className='interactive-controls'>
        <div
          className={'segmented-control segmented-control-3' + (interactive ? ' interactive' : '') + (annotating ? ' annotate' : '')}
          role='group'
          aria-label='Interaction mode'
          title={annotating ? 'Annotate mode: draw rectangular regions and add comments' : interactive ? 'Interactive mode: page input is forwarded' : 'Read-only mode: page input is blocked'}
        >
          <button
            className={'segmented-control-option' + (mode === 'readonly' ? ' active' : '')}
            disabled={!ready}
            aria-pressed={mode === 'readonly'}
            title='Read-only mode'
            onClick={() => {
              if (pageTarget)
                client?.cancelPickLocator(pageTarget);
              setPickingPage(null);
              setShowInspector(false);
              setMode('readonly');
            }}
          >
            Read-only
          </button>
          <button
            className={'segmented-control-option' + (mode === 'interactive' ? ' active' : '')}
            disabled={!ready}
            aria-pressed={mode === 'interactive'}
            title='Interactive mode'
            onClick={() => setMode('interactive')}
          >
            Interactive
          </button>
          <button
            className={'segmented-control-option' + (mode === 'annotate' ? ' active' : '')}
            disabled={!ready || !frame}
            aria-pressed={mode === 'annotate'}
            title='Annotate mode'
            onClick={() => {
              if (pageTarget)
                client?.cancelPickLocator(pageTarget);
              setPickingPage(null);
              setShowInspector(false);
              setMode('annotate');
            }}
          >
            Annotate
          </button>
        </div>
        <SettingsButton />
      </div>
    </div>

    {/* Toolbar */}
    <div ref={toolbarRef} className='toolbar'>
      <button className='nav-btn' title='Back' onClick={() => pageTarget && client?.back(pageTarget)}>
        <ChevronLeftIcon />
      </button>
      <button className='nav-btn' title='Forward' onClick={() => pageTarget && client?.forward(pageTarget)}>
        <ChevronRightIcon />
      </button>
      <button className='nav-btn' title='Reload' onClick={() => pageTarget && client?.reload(pageTarget)}>
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
        disabled={!ready}
        onClick={() => {
          if (!pageTarget)
            return;
          if (picking) {
            client?.cancelPickLocator(pageTarget);
            setPickingPage(null);
          } else {
            setMode('interactive');
            setPickingPage(selectedTab?.page ?? null);
            screenRef.current?.focus();
            client?.pickLocator(pageTarget);
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
          disabled={!ready}
          onClick={() => {
            setMode('interactive');
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
            <Annotations
              active={annotating}
              displayRef={displayRef}
              screenRef={screenRef}
              viewportWidth={frame?.viewportWidth ?? 0}
              viewportHeight={frame?.viewportHeight ?? 0}
            />
            {locatorToast
              ? <div className='screen-toast visible'>Copied: <code>{locatorToast.text}</code></div>
              : picking
                ? <div className='screen-toast visible'>Click an element to pick its locator</div>
                : null
            }
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
