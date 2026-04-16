/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import * as ReactDOM from 'react-dom/client';
import './colors.css';
import '@web/common.css';
import './common.css';
import { applyTheme } from '@web/theme';
import { SessionModel } from './sessionModel';
import { DashboardClient } from './dashboardClient';
import { SessionSidebar } from './sessionSidebar';
import { SplitView } from '@web/components/splitView';
import { ViewportPanel } from './viewportPanel';
import { TabbedPane } from '@web/components/tabbedPane';
import { ConsoleTab, useConsoleTabModel } from '@trace-viewer/ui/consoleTab';
import { InspectorTab } from '@trace-viewer/ui/inspectorTab';
import { NetworkTab, useNetworkTabModel } from '@trace-viewer/ui/networkTab';
import { TraceModel } from '@isomorphic/trace/traceModel';
import { TraceModelContext } from '@trace-viewer/ui/traceModelContext';
import { asLocator } from '@isomorphic/locatorGenerators';
import { useSetting } from '@web/uiUtils';
import { useIsMobile } from './useIsMobile';
import { MobilePanelSwitcher } from './mobilePanelSwitcher';

import type { DashboardChannelEvents } from './dashboardChannel';
import type { DashboardClientChannel } from './dashboardClient';
import type { TabbedPaneTabModel } from '@web/components/tabbedPane';
import type { HighlightedElement } from '@trace-viewer/ui/snapshotTab';
import type { Mode } from './viewportPanel';
import type { PanelId } from './mobilePanelSwitcher';

applyTheme();

export function navigate(hash: string) {
  window.history.pushState(null, '', hash);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function parseHash(): string | undefined {
  const hash = window.location.hash;
  const prefix = '#session=';
  if (hash.startsWith(prefix))
    return decodeURIComponent(hash.slice(prefix.length));
  return undefined;
}

export const DashboardClientContext = React.createContext<DashboardClientChannel | undefined>(undefined);

const client = DashboardClient.create('/ws');
const model = new SessionModel(client);

const pushVisibility = () => client.setVisible({ visible: !document.hidden }).catch(() => {});
document.addEventListener('visibilitychange', pushVisibility);
if (document.hidden)
  pushVisibility();

const App: React.FC = () => {
  const isMobile = useIsMobile();

  // --- Session routing state (existing) ---
  const [revision, setRevision] = React.useState(0);
  const [sessionGuid, setSessionGuid] = React.useState<string | undefined>(parseHash());
  const [autoInteractiveBrowser, setAutoInteractiveBrowser] = React.useState<string | undefined>();

  // --- Browser-scoped state (moved from Dashboard) ---
  const [tabs, setTabs] = React.useState<DashboardChannelEvents['tabs']['tabs'] | null>(null);
  const [url, setUrl] = React.useState('');
  const [frame, setFrame] = React.useState<DashboardChannelEvents['frame']>();
  const [mode, setMode] = React.useState<Mode>('readonly');
  const [pickingPage, setPickingPage] = React.useState<string | null>(null);
  const [highlightedElement, setHighlightedElement] = React.useState<HighlightedElement>({ locator: undefined, ariaSnapshot: undefined, lastEdited: 'none' });
  const [context, setContext] = React.useState<string | undefined>();
  const [recording, setRecording] = React.useState(false);
  const [screenshotIcon, setScreenshotIcon] = React.useState<'device-camera' | 'clippy'>('device-camera');
  const [showInteractiveHint, setShowInteractiveHint] = React.useState(false);
  const [sidebarVisible, setSidebarVisible] = useSetting<boolean>('propertiesSidebarVisible', false);
  const [sidebarLocation] = useSetting<'bottom' | 'right'>('propertiesSidebarLocation', 'bottom');
  const [traceModel, setTraceModel] = React.useState<TraceModel | undefined>();
  const [selectedSidebarTab, setSelectedSidebarTab] = useSetting<string>('dashboardPropertiesTab', 'inspector');

  const screenRef = React.useRef<HTMLDivElement>(null);
  const hintTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const modeRef = React.useRef<Mode>('readonly');

  // --- Mobile panel state ---
  const [activePanel, setActivePanel] = useSetting<PanelId>('mobilePanelSwitcherActivePanel', 'viewport');

  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // --- Session routing effects (existing) ---
  React.useEffect(() => model.subscribe(() => setRevision(r => r + 1)), []);

  React.useEffect(() => {
    const onPopState = () => setSessionGuid(parseHash());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  React.useEffect(() => {
    const onPickLocator = (params: DashboardChannelEvents['pickLocator']) => {
      setAutoInteractiveBrowser(params.target.browser);
      if (parseHash() !== params.target.browser)
        navigate('#session=' + encodeURIComponent(params.target.browser));
      if (isMobile)
        setActivePanel('viewport');
    };
    client.on('pickLocator', onPickLocator);
    return () => client.off('pickLocator', onPickLocator);
  }, [isMobile, setActivePanel]);

  React.useEffect(() => {
    if (!sessionGuid || model.loading)
      return;
    const session = model.sessionByGuid(sessionGuid);
    if (!session || !session.canConnect)
      navigate('#');
  }, [sessionGuid, revision]);

  React.useEffect(() => {
    if (sessionGuid || model.loading)
      return;
    const firstOpenSession = model.sessions.find(session => session.canConnect);
    if (firstOpenSession)
      navigate('#session=' + encodeURIComponent(firstOpenSession.browser.guid));
  }, [sessionGuid, revision]);

  const activeSession = sessionGuid ? model.sessionByGuid(sessionGuid) : undefined;
  const activeBrowser = activeSession?.canConnect ? activeSession.browser.guid : undefined;

  // --- Auto-interactive effect (from Dashboard) ---
  React.useEffect(() => {
    if (!autoInteractiveBrowser || autoInteractiveBrowser !== activeBrowser)
      return;
    setMode('interactive');
    setAutoInteractiveBrowser(undefined);
  }, [autoInteractiveBrowser, activeBrowser]);

  // --- Browser event subscriptions (from Dashboard) ---
  React.useEffect(() => {
    if (!activeBrowser)
      return;
    let disposed = false;

    const onTabs = (params: DashboardChannelEvents['tabs']) => {
      if (params.target.browser !== activeBrowser)
        return;
      setTabs(params.tabs);
      const selected = params.tabs.find(t => t.selected);
      if (selected)
        setUrl(selected.url);
    };
    const onFrame = (params: DashboardChannelEvents['frame']) => {
      if (params.target.browser !== activeBrowser)
        return;
      if (modeRef.current === 'annotate')
        return;
      setFrame(params);
    };
    const onElementPicked = (params: DashboardChannelEvents['elementPicked']) => {
      if (params.target.browser !== activeBrowser)
        return;
      const locator = asLocator('javascript', params.selector);
      navigator.clipboard?.writeText(locator).catch(() => {});
      setPickingPage(null);
      setHighlightedElement({ locator, ariaSnapshot: params.ariaSnapshot, lastEdited: 'locator' });
      if (isMobile)
        setActivePanel('tools');
    };

    client.on('tabs', onTabs);
    client.on('frame', onFrame);
    client.on('elementPicked', onElementPicked);

    client.attach({ browser: activeBrowser }).then(result => {
      if (!disposed)
        setContext(result.context);
    }).catch(() => {});

    return () => {
      disposed = true;
      client.off('tabs', onTabs);
      client.off('frame', onFrame);
      client.off('elementPicked', onElementPicked);
      setContext(undefined);
      setTabs(null);
      setFrame(undefined);
      setTraceModel(undefined);
      setMode('readonly');
      setPickingPage(null);
      setRecording(false);
    };
  }, [activeBrowser, isMobile, setActivePanel]);

  // --- Derived values ---
  const selectedTab = tabs?.find(t => t.selected);
  const ready = !!activeBrowser && !!context && !!selectedTab;
  const pageTarget = React.useMemo(
      () => ready && selectedTab && activeBrowser
        ? { browser: activeBrowser, context: context!, page: selectedTab.page }
        : undefined,
      [ready, selectedTab, activeBrowser, context]
  );
  const picking = selectedTab?.page === pickingPage;

  React.useEffect(() => {
    setRecording(false);
  }, [selectedTab?.page]);

  // --- Tracing ---
  React.useEffect(() => {
    if (!activeBrowser || !context || !sidebarVisible)
      return;
    client.startTracing({ browser: activeBrowser }).catch(() => {});
  }, [activeBrowser, context, sidebarVisible]);

  React.useEffect(() => {
    if (!activeBrowser || !context || !sidebarVisible) {
      setTraceModel(undefined);
      return;
    }

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const { tracesDir, contextEntries } = await client.traceContextEntries({ browser: activeBrowser });
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
  }, [activeBrowser, context, sidebarVisible]);

  // --- Interactive hint ---
  React.useEffect(() => {
    if (mode === 'interactive')
      setShowInteractiveHint(false);
  }, [mode]);

  React.useEffect(() => {
    return () => clearTimeout(hintTimerRef.current);
  }, []);

  const flashInteractiveHint = React.useCallback(() => {
    clearTimeout(hintTimerRef.current);
    setShowInteractiveHint(true);
    hintTimerRef.current = setTimeout(() => setShowInteractiveHint(false), 2000);
  }, []);

  // --- Overlay text ---
  let overlayText: string | undefined;
  if (!context)
    overlayText = 'Disconnected';
  else if (tabs === null)
    overlayText = 'Loading...';
  else if (tabs.length === 0)
    overlayText = 'No tabs open';

  // --- Inspector tabs (from Dashboard) ---
  const boundaries = React.useMemo(() => ({ minimum: 0, maximum: Number.POSITIVE_INFINITY }), []);
  const consoleModel = useConsoleTabModel(traceModel, undefined, selectedTab?.page);
  const networkModel = useNetworkTabModel(traceModel, undefined, selectedTab?.page);

  const inspectorTabs: TabbedPaneTabModel[] = React.useMemo(() => [
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
            if (isMobile)
              setActivePanel('viewport');
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
  ], [picking, pageTarget, selectedTab, highlightedElement, isMobile, setActivePanel, consoleModel, networkModel, boundaries]);

  // --- Session sidebar callbacks ---
  const onSelectTab = React.useCallback((tab: { browser: string; context: string; page: string }) => {
    if (sessionGuid !== tab.browser)
      navigate('#session=' + encodeURIComponent(tab.browser));
    void client.selectTab({ browser: tab.browser, context: tab.context, page: tab.page });
    if (isMobile)
      setActivePanel('viewport');
  }, [sessionGuid, isMobile, setActivePanel]);

  const onCloseTab = React.useCallback((tab: { browser: string; context: string; page: string }) => {
    void client.closeTab({ browser: tab.browser, context: tab.context, page: tab.page });
  }, []);

  const onNewTab = React.useCallback((browser: string, ctx: string) => {
    if (sessionGuid !== browser)
      navigate('#session=' + encodeURIComponent(browser));
    void client.newTab({ browser, context: ctx });
    if (isMobile)
      setActivePanel('viewport');
  }, [sessionGuid, isMobile, setActivePanel]);

  // --- Shared sub-components ---
  const sessionSidebar = <SessionSidebar
    model={model}
    activeBrowser={activeBrowser}
    onSelectTab={onSelectTab}
    onCloseTab={onCloseTab}
    onNewTab={onNewTab}
  />;

  const viewportPanel = activeBrowser
    ? <ViewportPanel
      client={client}
      browser={activeBrowser}
      context={context}
      tabs={tabs}
      frame={frame}
      url={url}
      setUrl={setUrl}
      mode={mode}
      setMode={setMode}
      pickingPage={pickingPage}
      setPickingPage={setPickingPage}
      recording={recording}
      setRecording={setRecording}
      screenshotIcon={screenshotIcon}
      setScreenshotIcon={setScreenshotIcon}
      showInteractiveHint={showInteractiveHint}
      flashInteractiveHint={flashInteractiveHint}
      sidebarVisible={sidebarVisible}
      setSidebarVisible={setSidebarVisible}
      sidebarLocation={sidebarLocation}
      overlayText={overlayText}
      screenRef={screenRef}
      isMobile={isMobile}
    />
    : <div className='dashboard-shell-empty'>Select an open tab in the sidebar.</div>;

  const toolsPanel = <TabbedPane
    tabs={inspectorTabs}
    selectedTab={selectedSidebarTab}
    setSelectedTab={setSelectedSidebarTab}
    mode='default'
  />;

  if (isMobile) {
    return <DashboardClientContext.Provider value={client}>
      <TraceModelContext.Provider value={traceModel}>
      <MobilePanelSwitcher
        sessions={sessionSidebar}
        viewport={viewportPanel}
        tools={toolsPanel}
        activePanel={activePanel}
        setActivePanel={setActivePanel}
      />
      </TraceModelContext.Provider>
    </DashboardClientContext.Provider>;
  }

  return <DashboardClientContext.Provider value={client}>
    <TraceModelContext.Provider value={traceModel}>
    <SplitView
      orientation='horizontal'
      sidebarIsFirst
      sidebarSize={320}
      minSidebarSize={220}
      settingName='dashboardSessionSidebar'
      sidebar={sessionSidebar}
      main={<div className='dashboard-shell-main'>
        {activeBrowser
          ? <div className='vbox'>
            <SplitView
              sidebarHidden={!sidebarVisible}
              orientation={sidebarLocation === 'bottom' ? 'vertical' : 'horizontal'}
              sidebarSize={500}
              minSidebarSize={300}
              settingName='devtoolsInspector'
              main={viewportPanel}
              sidebar={toolsPanel}
            />
          </div>
          : <div className='dashboard-shell-empty'>Select an open tab in the sidebar.</div>}
      </div>}
    />
    </TraceModelContext.Provider>
  </DashboardClientContext.Provider>;
};

ReactDOM.createRoot(document.querySelector('#root')!).render(<App />);
