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
import { TraceModel } from '@isomorphic/trace/traceModel';
import { SplitView } from '@web/components/splitView';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, PlusIcon, ReloadIcon } from './icons';
import { SettingsButton } from './settingsView';
import { Annotations, getImageLayout, clientToViewport } from './annotations';
import { ToolbarButton } from '@web/components/toolbarButton';
import { TabbedPaneTabModel, TabbedPane } from '@web/components/tabbedPane';
import { ConsoleTab, useConsoleTabModel } from '@trace-viewer/ui/consoleTab';
import { InspectorTab } from '@trace-viewer/ui/inspectorTab';
import { NetworkTab, useNetworkTabModel } from '@trace-viewer/ui/networkTab';
import { useSetting } from '@web/uiUtils';

import type { Tab, DashboardChannelEvents } from './dashboardChannel';
import { HighlightedElement } from '@trace-viewer/ui/snapshotTab';
import { TraceModelContext } from '@trace-viewer/ui/traceModelContext';

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

export const Dashboard: React.FC<{
  browser: string;
  autoInteractive?: boolean;
  onAutoInteractiveConsumed?: () => void;
}> = ({ browser, autoInteractive, onAutoInteractiveConsumed }) => {
  const [sidebarLocation, setSidebarLocation] = useSetting<'bottom' | 'right'>('propertiesSidebarLocation', 'bottom');
  const client = React.useContext(DashboardClientContext);
  const [mode, setMode] = React.useState<Mode>('readonly');
  const [sidebarVisible, setSidebarVisible] = useSetting<boolean>('propertiesSidebarVisible', false);

  React.useEffect(() => {
    if (!autoInteractive)
      return;
    setMode('interactive');
    onAutoInteractiveConsumed?.();
  }, [autoInteractive, onAutoInteractiveConsumed]);
  const [tabs, setTabs] = React.useState<Tab[] | null>(null);
  const [url, setUrl] = React.useState('');
  const [frame, setFrame] = React.useState<DashboardChannelEvents['frame']>();
  const [pickingPage, setPickingPage] = React.useState<string | null>(null);
  const [highlightedElement, setHighlightedElement] = React.useState<HighlightedElement>({ locator: undefined, ariaSnapshot: undefined, lastEdited: 'none' });
  const [context, setContext] = React.useState<string | undefined>();
  const [recording, setRecording] = React.useState(false);
  const [screenshotIcon, setScreenshotIcon] = React.useState<'device-camera' | 'clippy'>('device-camera');
  const [showInteractiveHint, setShowInteractiveHint] = React.useState(false);
  const [traceModel, setTraceModel] = React.useState<TraceModel | undefined>();
  const [selectedSidebarTab, setSelectedSidebarTab] = useSetting<string>('dashboardPropertiesTab', 'inspector');

  const displayRef = React.useRef<HTMLImageElement>(null);
  const screenRef = React.useRef<HTMLDivElement>(null);
  const tabbarRef = React.useRef<HTMLDivElement>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const moveThrottleRef = React.useRef(0);
  const hintTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const modeRef = React.useRef<Mode>('readonly');

  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const interactive = mode === 'interactive';
  const annotating = mode === 'annotate';

  React.useEffect(() => {
    if (interactive)
      setShowInteractiveHint(false);
  }, [interactive]);

  React.useEffect(() => {
    return () => clearTimeout(hintTimerRef.current);
  }, []);

  function flashInteractiveHint() {
    clearTimeout(hintTimerRef.current);
    setShowInteractiveHint(true);
    hintTimerRef.current = setTimeout(() => setShowInteractiveHint(false), 2000);
  }

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
      setHighlightedElement({ locator, ariaSnapshot: params.ariaSnapshot, lastEdited: 'locator' });
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
      setTraceModel(undefined);
      setMode('readonly');
      setPickingPage(null);
      setRecording(false);
    };
  }, [client, browser]);

  const selectedTab = tabs?.find(t => t.selected);
  const ready = !!client && !!context && !!selectedTab;
  const pageTarget = ready && selectedTab
    ? { browser, context: context!, page: selectedTab.page }
    : undefined;

  React.useEffect(() => {
    setRecording(false);
  }, [selectedTab?.page]);

  React.useEffect(() => {
    if (!client || !context || !sidebarVisible)
      return;
    client.startTracing({ browser }).catch(() => {});
  }, [client, browser, context, sidebarVisible]);

  React.useEffect(() => {
    if (!client || !context || !sidebarVisible) {
      setTraceModel(undefined);
      return;
    }

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const { tracesDir, contextEntries } = await client.traceContextEntries({ browser });
        if (disposed)
          return;
        setTraceModel(new TraceModel(tracesDir, contextEntries));
      } catch {
        if (!disposed)
          setTraceModel(undefined);
      } finally {
        if (!disposed)
          timer = setTimeout(poll, 500);
      }
    };

    poll().catch(() => {});
    return () => {
      disposed = true;
      if (timer)
        clearTimeout(timer);
    };
  }, [client, browser, context, sidebarVisible]);

  function imgCoords(e: React.MouseEvent): { x: number; y: number } {
    const vw = frame?.viewportWidth ?? 0;
    const vh = frame?.viewportHeight ?? 0;
    if (!vw || !vh)
      return { x: 0, y: 0 };
    const layout = getImageLayout(displayRef.current);
    if (!layout)
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
      flashInteractiveHint();
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
  const boundaries = React.useMemo(() => ({ minimum: 0, maximum: Number.POSITIVE_INFINITY }), []);
  const consoleModel = useConsoleTabModel(traceModel, undefined, selectedTab?.page);
  const networkModel = useNetworkTabModel(traceModel, undefined, selectedTab?.page);

  const inspectorTabs: TabbedPaneTabModel[] = [
    {
      id: 'inspector',
      title: 'Locator',
      render: () => <InspectorTab
        sdkLanguage='javascript'
        isInspecting={picking}
        setIsInspecting={isInspecting => {
          if (isInspecting) {
            if (!pageTarget || !selectedTab)
              return;
            setMode('interactive');
            setPickingPage(selectedTab.page);
            screenRef.current?.focus();
            client?.pickLocator(pageTarget);
          } else {
            if (pageTarget)
              client?.cancelPickLocator(pageTarget);
            setPickingPage(null);
          }
        }}
        highlightedElement={highlightedElement}
        setHighlightedElement={setHighlightedElement}
      />,
    },
    {
      id: 'console',
      title: 'Console',
      count: consoleModel.entries.length,
      render: () => <ConsoleTab
        consoleModel={consoleModel}
        boundaries={boundaries}
      />,
    },
    {
      id: 'network',
      title: 'Network',
      count: networkModel.resources.length,
      render: () => <NetworkTab
        boundaries={boundaries}
        networkModel={networkModel}
        sdkLanguage='javascript'
      />,
    },
  ];

  let overlayText: string | undefined;
  if (!client || !context)
    overlayText = 'Disconnected';
  else if (tabs === null)
    overlayText = 'Loading...';
  else if (tabs.length === 0)
    overlayText = 'No tabs open';

  return (
    <TraceModelContext.Provider value={traceModel}>
      <div className='vbox'>
        <SplitView
          sidebarHidden={!sidebarVisible}
          orientation={sidebarLocation === 'bottom' ? 'vertical' : 'horizontal'}
          sidebarSize={500}
          minSidebarSize={300}
          settingName='devtoolsInspector'
          main={<div className={'dashboard-view' + (interactive ? ' interactive' : '') + (annotating ? ' annotate' : '')}>
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
                    {tab.faviconUrl
                      ? <img className='tab-favicon' src={tab.faviconUrl} alt='' aria-hidden='true' />
                      : <span className='tab-favicon placeholder' aria-hidden='true'>{tabFavicon(tab.url)}</span>}
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
              <div className='interactive-controls' />
            </div>

            {/* Toolbar */}
            <div ref={toolbarRef} className='toolbar'>
              <button className='nav-btn' title='Back' aria-disabled={!interactive || undefined} onClick={() => {
                if (!interactive) {
                  flashInteractiveHint();
                  return;
                }
                pageTarget && client?.back(pageTarget);
              }}>
                <ChevronLeftIcon />
              </button>
              <button className='nav-btn' title='Forward' aria-disabled={!interactive || undefined} onClick={() => {
                if (!interactive) {
                  flashInteractiveHint();
                  return;
                }
                pageTarget && client?.forward(pageTarget);
              }}>
                <ChevronRightIcon />
              </button>
              <button className='nav-btn' title='Reload' aria-disabled={!interactive || undefined} onClick={() => {
                if (!interactive) {
                  flashInteractiveHint();
                  return;
                }
                pageTarget && client?.reload(pageTarget);
              }}>
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
                onChange={e => {
                  if (!interactive)
                    return;
                  setUrl(e.target.value);
                }}
                onKeyDown={e => {
                  if (!interactive)
                    return;
                  onOmniboxKeyDown(e);
                }}
                onFocus={e => {
                  if (!interactive) {
                    flashInteractiveHint();
                    e.target.blur();
                    return;
                  }
                  e.target.select();
                }}
                aria-disabled={!interactive || undefined}
                readOnly={!interactive}
              />
              <ToolbarButton
                className='recording'
                title={recording ? 'Stop recording' : 'Record video'}
                icon='record'
                toggled={recording}
                style={{ color: recording ? (interactive ? 'var(--color-fg-on-emphasis)' : 'var(--color-scale-red-5)') : undefined }}
                disabled={!ready}
                onClick={async () => {
                  if (!client || !pageTarget)
                    return;
                  if (recording) {
                    const { path } = await client.stopRecording(pageTarget);
                    await client.reveal({ path });
                    setRecording(false);
                  } else {
                    await client.startRecording(pageTarget);
                    setRecording(true);
                  }
                }}>
                {recording && <span className='recording-label'>Recording...</span>}
              </ToolbarButton>
              <ToolbarButton
                className='screenshot'
                title='Copy screenshot to clipboard'
                icon={screenshotIcon}
                disabled={!ready}
                onClick={async () => {
                  if (!client || !pageTarget)
                    return;
                  const screenshot = await client.screenshot(pageTarget);
                  const blob = await (await fetch('data:image/png;base64,' + screenshot)).blob();
                  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                  setScreenshotIcon('clippy');
                  setTimeout(() => setScreenshotIcon('device-camera'), 3000);
                }}
              />
              <div style={{ marginLeft: 8, borderLeft: '1px solid var(--color-border-default)', paddingLeft: 8, display: 'flex', gap: 4 }}>
                <div style={{ position: 'relative' }}>
                  <ToolbarButton
                    title={interactive ? 'Disable interactive mode' : 'Enable interactive mode'}
                    icon='inspect'
                    toggled={interactive}
                    disabled={!ready}
                    onClick={() => {
                      if (interactive) {
                        if (pageTarget)
                          client?.cancelPickLocator(pageTarget);
                        setPickingPage(null);
                        setMode('readonly');
                        return;
                      }
                      if (pageTarget)
                        client?.cancelPickLocator(pageTarget);
                      setPickingPage(null);
                      setMode('interactive');
                    }}
                  />
                  {showInteractiveHint && <div className='interactive-hint-popover'>Enable interactive mode</div>}
                </div>
                <ToolbarButton
                  title={annotating ? 'Disable annotation mode' : 'Enable annotation mode'}
                  icon='edit'
                  toggled={annotating}
                  disabled={!ready || !frame}
                  onClick={() => {
                    if (annotating) {
                      setMode('readonly');
                      return;
                    }
                    if (pageTarget)
                      client?.cancelPickLocator(pageTarget);
                    setPickingPage(null);
                    setMode('annotate');
                  }}
                />
                <ToolbarButton
                  title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
                  icon={sidebarLocation === 'bottom' ? 'layout-panel' : 'layout-sidebar-right'}
                  toggled={sidebarVisible}
                  onClick={() => setSidebarVisible(!sidebarVisible)}
                  disabled={!ready}
                />
              </div>
            </div>

            {/* Viewport */}
            <div className='viewport-wrapper'>
              <div className='viewport-main'>
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
                </div>
                {overlayText && <div className={'screen-overlay' + (frame ? ' has-frame' : '')}><span>{overlayText}</span></div>}
              </div>
            </div>
          </div>}
          sidebar={<TabbedPane
            tabs={inspectorTabs}
            selectedTab={selectedSidebarTab}
            setSelectedTab={setSelectedSidebarTab}
            rightToolbar={[
              <SettingsButton key='settings' sidebarLocation={sidebarLocation} setSidebarLocation={setSidebarLocation} />,
            ]}
            mode='default'
          />}
        />
      </div>
    </TraceModelContext.Provider>
  );
};
