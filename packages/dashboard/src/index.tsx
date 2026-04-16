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
import { Dashboard } from './dashboard';
import { SessionModel } from './sessionModel';
import { DashboardClient } from './dashboardClient';
import { SessionSidebar } from './sessionSidebar';
import { SplitView } from '@web/components/splitView';

import type { DashboardChannelEvents } from './dashboardChannel';
import type { DashboardClientChannel } from './dashboardClient';

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
  const [revision, setRevision] = React.useState(0);
  const [sessionGuid, setSessionGuid] = React.useState<string | undefined>(parseHash());
  const [autoInteractiveBrowser, setAutoInteractiveBrowser] = React.useState<string | undefined>();

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
    };
    client.on('pickLocator', onPickLocator);
    return () => client.off('pickLocator', onPickLocator);
  }, []);

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

  return <DashboardClientContext.Provider value={client}>
    <SplitView
      orientation='horizontal'
      sidebarIsFirst
      sidebarSize={320}
      minSidebarSize={220}
      settingName='dashboardSessionSidebar'
      sidebar={<SessionSidebar
        model={model}
        activeBrowser={activeBrowser}
        onSelectTab={tab => {
          if (sessionGuid !== tab.browser)
            navigate('#session=' + encodeURIComponent(tab.browser));
          void client.selectTab({ browser: tab.browser, context: tab.context, page: tab.page });
        }}
        onCloseTab={tab => { void client.closeTab({ browser: tab.browser, context: tab.context, page: tab.page }); }}
        onNewTab={(browser, context) => {
          if (sessionGuid !== browser)
            navigate('#session=' + encodeURIComponent(browser));
          void client.newTab({ browser, context });
        }}
      />}
      main={<div className='dashboard-shell-main'>
        {activeBrowser
          ? <Dashboard
            browser={activeBrowser}
            autoInteractive={autoInteractiveBrowser === activeBrowser}
            onAutoInteractiveConsumed={() => setAutoInteractiveBrowser(undefined)}
          />
          : <div className='dashboard-shell-empty'>Select an open tab in the sidebar.</div>}
      </div>}
    />
  </DashboardClientContext.Provider>;
};

ReactDOM.createRoot(document.querySelector('#root')!).render(<App />);
