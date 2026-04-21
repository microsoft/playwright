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
import { DashboardClientContext } from './dashboardContext';
import { SessionModel } from './sessionModel';
import { DashboardClient } from './dashboardClient';
import { SessionSidebar } from './sessionSidebar';
import { SplitView } from '@web/components/splitView';

applyTheme();

const client = DashboardClient.create('/ws');
const model = new SessionModel(client);

const pushVisibility = () => client.setVisible({ visible: !document.hidden }).catch(() => {});
document.addEventListener('visibilitychange', pushVisibility);
if (document.hidden)
  pushVisibility();

const App: React.FC = () => {
  const [, setRevision] = React.useState(0);
  React.useEffect(() => model.subscribe(() => setRevision(r => r + 1)), []);

  return <DashboardClientContext.Provider value={client}>
    <SplitView
      orientation='horizontal'
      sidebarIsFirst
      sidebarSize={320}
      minSidebarSize={220}
      settingName='dashboardSessionSidebar'
      sidebar={<SessionSidebar
        model={model}
        onSelectTab={tab => { void client.selectTab({ browser: tab.browser, context: tab.context, page: tab.page }); }}
        onCloseTab={tab => { void client.closeTab({ browser: tab.browser, context: tab.context, page: tab.page }); }}
        onNewTab={(browser, context) => { void client.newTab({ browser, context }); }}
      />}
      main={<div className='dashboard-shell-main'>
        <Dashboard />
      </div>}
    />
  </DashboardClientContext.Provider>;
};

// HMR begin: cache the root on the DOM node so re-running this module during
// an HMR update reuses it instead of calling createRoot twice on the same container.
const rootElement = document.querySelector('#root')! as HTMLElement & { __dashboardRoot?: ReactDOM.Root };
const root = rootElement.__dashboardRoot ??= ReactDOM.createRoot(rootElement);
root.render(<App />);
// HMR end
