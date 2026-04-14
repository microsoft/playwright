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
import { navigate } from './index';
import { SplitView } from '@web/components/splitView';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, PlusIcon, ReloadIcon, PickLocatorIcon, InspectorPanelIcon } from './icons';
import { SettingsButton } from './settingsView';

import type { Page, Browser } from 'playwright-core';

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

// @ts-ignore polyfill means all Buffer types are actually base64 strings.
globalThis.Buffer = { from: v => v };

export function useBrowser(wsUrl?: string): Browser | null {
  // TODO: prevent multiple clients per URL
  const [browser, setBrowser] = React.useState<Browser | null>(null);
  React.useEffect(() => {
    if (!wsUrl)
      return;

    const dashboardBundle = new URL(wsUrl, window.location.href);
    dashboardBundle.pathname = '/dashboardBundle.js';
    const ws = new WebSocket(wsUrl);
    const transport = {
      send: (message: string) => {
        ws.send(message);
      }
    };
    ws.onmessage = event => {
      (transport as any).onmessage(event.data);
    };

    let browser: Browser;
    let unmounted = false;
    ws.onopen = async () => {
      try {
        const pwClient = await import(dashboardBundle.toString());
        if (unmounted)
          return;
        browser = await pwClient.connect(transport) as Browser;
        if (unmounted)
          return;
        setBrowser(browser);
      } catch (error) {
        console.error(error);
      }
    };
    ws.onerror = error => {
      (transport as any).onclose(`WebSocket error: ${error}`);
      setBrowser(current => current === browser ? null : current);
    };
    ws.onclose = event => {
      (transport as any).onclose(`WebSocket closed: ${event.reason}`);
      setBrowser(current => current === browser ? null : current);
    };

    return () => {
      unmounted = true;
      ws.close();
    };
  }, [wsUrl]);
  return browser;
}

function useTitles(browser: Browser | null) {
  const [map, setMap] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!browser)
      return;

    const disposables: (() => void)[] = [];
    const subscribePage = (page: Page) => {
      const listener = async () => {
        const title = await page.title();
        setMap(map => ({ ...map, [guid(page)]: title }));
      };
      page.on('framenavigated', listener);
      disposables.push(() => page.off('framenavigated', listener));
      void listener();
    };

    for (const context of browser.contexts()) {
      for (const page of context.pages())
        subscribePage(page);
      context.on('page', subscribePage);
    }

    return () => disposables.forEach(f => f());
  }, [browser]);

  return map;
}

export const Dashboard: React.FC<{ wsUrl?: string }> = ({ wsUrl }) => {
  const [selectedPage, setSelectedPage] = React.useState<Page | null>(null);
  const [interactive, setInteractive] = React.useState(false);
  const [url, setUrl] = React.useState('');
  const [frame, setFrame] = React.useState<{ data: string, height?: number, width?: number }>();
  const [showInspector, setShowInspector] = React.useState(false);
  const [pickingTabId, setPickingTabId] = React.useState<string | null>(null);
  const [locatorToast, setLocatorToast] = React.useState<{ text: string; timer: ReturnType<typeof setTimeout> }>();

  const browser = useBrowser(wsUrl);
  const titles = useTitles(browser);

  const displayRef = React.useRef<HTMLImageElement>(null);
  const screenRef = React.useRef<HTMLDivElement>(null);
  const tabbarRef = React.useRef<HTMLDivElement>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const moveThrottleRef = React.useRef(0);

  React.useEffect(() => {
    if (!selectedPage)
      return;
    const onClose = () => {
      setSelectedPage(page => {
        if (page !== selectedPage)
          return page;
        return browser?.contexts().flatMap(c => c.pages())[0] ?? null;
      });
    };
    selectedPage.on('close', onClose);

    const onFrameNavigate = () => {
      const url = selectedPage.url();
      setUrl(url === 'about:blank' ? '' : url);
    };
    selectedPage.on('framenavigated', onFrameNavigate);
    onFrameNavigate();

    return () => {
      selectedPage.off('close', onClose);
      selectedPage.off('framenavigated', onFrameNavigate);
    };
  }, [selectedPage, browser]);

  React.useEffect(() => {
    setSelectedPage(page => page ?? browser?.contexts().flatMap(c => c.pages())?.[0] ?? null);
  }, [browser]);

  React.useEffect(() => {
    if (!browser)
      return;

    const disposables: (() => void)[] = [];
    for (const context of browser.contexts()) {
      const populateSelectedPage = (page: Page) => setSelectedPage(current => current ?? page);
      context.on('page', populateSelectedPage);
      disposables.push(() => context.off('page', populateSelectedPage));
    }

    return () => {
      disposables.forEach(f => f());
    };
  }, [browser]);

  function imgCoords(e: React.MouseEvent): { x: number; y: number } {
    const vw = frame?.width ?? 0;
    const vh = frame?.height ?? 0;
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

  async function sendMouseEvent(method: 'mousedown' | 'mouseup', e: React.MouseEvent) {
    const { x, y } = imgCoords(e);
    await selectedPage?.mouse.move(x, y);
    const button = BUTTONS[e.button] || 'left';
    if (method === 'mousedown')
      await selectedPage?.mouse.down({ button });
    else if (method === 'mouseup')
      await selectedPage?.mouse.up({ button });
  }

  function onScreenMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    screenRef.current?.focus();
    if (!browser)
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
    selectedPage?.mouse.move(x, y);
  }

  function onScreenWheel(e: React.WheelEvent) {
    if (!interactive)
      return;
    e.preventDefault();
    selectedPage?.mouse.wheel(e.deltaX, e.deltaY);
  }

  function onScreenKeyDown(e: React.KeyboardEvent) {
    if (pickingTabId !== null && e.key === 'Escape') {
      e.preventDefault();
      selectedPage?.cancelPickLocator();
      setPickingTabId(null);
      return;
    }
    if (!interactive)
      return;
    e.preventDefault();
    selectedPage?.keyboard.down(e.key);
  }

  function onScreenKeyUp(e: React.KeyboardEvent) {
    if (!interactive)
      return;
    e.preventDefault();
    selectedPage?.keyboard.up(e.key);
  }

  function onOmniboxKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      let value = (e.target as HTMLInputElement).value.trim();
      if (!/^https?:\/\//i.test(value))
        value = 'https://' + value;
      setUrl(value);
      selectedPage?.goto(value);
      e.currentTarget.blur();
    }
  }

  const picking = guid(selectedPage) === pickingTabId;

  React.useEffect(() => {
    if (!selectedPage)
      return;

    const forceComposite = setTimeout(async () => {
      const session = await selectedPage.context().newCDPSession(selectedPage);
      await session.send('Page.captureScreenshot', { optimizeForSpeed: true, quality: 0, format: 'jpeg' });
      await session.detach();
    }, 100);

    let resized = false;
    void selectedPage.screencast.start({
      onFrame: ({ data }) => {
        clearTimeout(forceComposite);
        const viewportWidth = selectedPage.viewportSize()?.width;
        const viewportHeight = selectedPage.viewportSize()?.height;
        setFrame({ data: (data as any as string), width: viewportWidth, height: viewportHeight });
        const tabbar = tabbarRef.current;
        const toolbar = toolbarRef.current;
        if (!resized && tabbar && toolbar && viewportWidth && viewportHeight) {
          resized = true;
          const chromeHeight = tabbar.offsetHeight + toolbar.offsetHeight;
          const extraW = window.outerWidth - window.innerWidth;
          const extraH = window.outerHeight - window.innerHeight;
          const targetW = Math.min(viewportWidth + extraW, screen.availWidth);
          const targetH = Math.min(viewportHeight + chromeHeight + extraH, screen.availHeight);
          window.resizeTo(targetW, targetH);
        }
      },
      size: { width: 1280, height: 800 },
    });

    return () => {
      void selectedPage?.screencast.stop().catch(() => {});
    };
  }, [selectedPage]);

  const cdpUrl = new URL(wsUrl ?? '/', window.origin);
  cdpUrl.searchParams.set('cdpPageId', guid(selectedPage) ?? '');

  const supportsInspector = selectedPage?.context().browser()?.browserType().name() === 'chromium';

  let overlayText: string | undefined;
  if (browser === null)
    overlayText = 'Loading...';
  else if (browser.contexts().flatMap(c => c.pages()).length === 0)
    overlayText = 'No tabs open';

  return (<div className={'dashboard-view' + (interactive ? ' interactive' : '')}
  >
    {/* Tab bar */}
    <div ref={tabbarRef} className='tabbar'>
      <a className='tabbar-back' href='#' title='Back to sessions' onClick={e => { e.preventDefault(); navigate('#'); }}>
        <ChevronLeftIcon />
        Sessions
      </a>
      <div id='tabstrip' className='tabstrip' role='tablist'>
        {browser?.contexts().flatMap(c => c.pages())?.map(page => (
          <div
            key={guid(page)}
            className={'tab' + (page === selectedPage ? ' active' : '')}
            role='tab'
            aria-selected={page === selectedPage}
            title={titles[guid(page)] || page.url()}
            onClick={() => setSelectedPage(page)}
          >
            <span className='tab-favicon' aria-hidden='true'>{tabFavicon(page.url())}</span>
            <span className='tab-label'>{titles[guid(page)] || 'New Tab'}</span>
            <button
              className='tab-close'
              title='Close tab'
              onClick={e => {
                e.stopPropagation();
                page?.close({ reason: 'Closed in Dashboard' });
              }}
            >
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
      <button id='new-tab-btn' className='new-tab-btn' title='New Tab' onClick={() => selectedPage?.context()?.newPage().then(p => setSelectedPage(p)).catch(console.error)}>
        <PlusIcon />
      </button>
      <div className='interactive-controls'>
        <div className={'segmented-control' + (interactive ? ' interactive' : '')} role='group' aria-label='Interaction mode' title={interactive ? 'Interactive mode: page input is forwarded' : 'Read-only mode: page input is blocked'}>
          <button
            className={'segmented-control-option' + (!interactive ? ' active' : '')}
            disabled={!selectedPage}
            aria-pressed={!interactive}
            title='Read-only mode'
            onClick={() => {
              selectedPage?.cancelPickLocator();
              setPickingTabId(null);
              setShowInspector(false);
              setInteractive(false);
            }}
          >
            Read-only
          </button>
          <button
            className={'segmented-control-option' + (interactive ? ' active' : '')}
            disabled={!selectedPage}
            aria-pressed={interactive}
            title='Interactive mode'
            onClick={() => setInteractive(true)}
          >
            Interactive
          </button>
        </div>
        <SettingsButton />
      </div>
    </div>

    {/* Toolbar */}
    <div ref={toolbarRef} className='toolbar'>
      <button className='nav-btn' title='Back' onClick={() => selectedPage?.goBack()}>
        <ChevronLeftIcon />
      </button>
      <button className='nav-btn' title='Forward' onClick={() => selectedPage?.goForward()}>
        <ChevronRightIcon />
      </button>
      <button className='nav-btn' title='Reload' onClick={() => selectedPage?.reload()}>
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
        disabled={!selectedPage}
        onClick={() => {
          if (picking) {
            selectedPage?.cancelPickLocator();
            setPickingTabId(null);
          } else {
            setInteractive(true);
            setPickingTabId(guid(selectedPage) ?? null);
            screenRef.current?.focus();
            selectedPage?.pickLocator().then(locator => {
              navigator.clipboard?.writeText(locator.toString()).catch(() => {});
              setPickingTabId(null);
              setLocatorToast(old => {
                clearTimeout(old?.timer);
                return { text: locator.toString(), timer: setTimeout(() => setLocatorToast(undefined), 3000) };
              });
            });
          }
        }}
      >
        <PickLocatorIcon />
      </button>
      {/* Fix */}
      {supportsInspector && (
        <button
          className={'nav-btn' + (showInspector ? ' active-toggle' : '')}
          title='Chrome DevTools'
          aria-pressed={showInspector}
          disabled={!selectedPage}
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
        sidebarHidden={!showInspector || !supportsInspector}
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
          </div>
          {overlayText && <div className={'screen-overlay' + (frame ? ' has-frame' : '')}><span>{overlayText}</span></div>}
        </div>}
        sidebar={<iframe
          className='inspector-frame'
          src={selectedPage ? `/devtools/${guid(selectedPage?.context().browser())}/devtools_app.html?ws=${encodeURIComponent(cdpUrl.toString().replace('http://', ''))}` : undefined}
          title='Chrome DevTools'
        />}
      />
    </div>
  </div>);
};

function guid(object: Page | Browser | null): string {
  return (object as any)?._guid;
}
