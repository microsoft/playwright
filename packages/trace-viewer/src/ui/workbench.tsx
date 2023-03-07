/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import type { ActionTraceEvent } from '@trace/trace';
import { SplitView } from '@web/components/splitView';
import * as React from 'react';
import { ActionList } from './actionList';
import { CallTab } from './callTab';
import { ConsoleTab } from './consoleTab';
import * as modelUtil from './modelUtil';
import type { MultiTraceModel } from './modelUtil';
import { NetworkTab } from './networkTab';
import { SnapshotTab } from './snapshotTab';
import { SourceTab } from './sourceTab';
import { TabbedPane } from '@web/components/tabbedPane';
import { Timeline } from './timeline';
import './workbench.css';
import { MetadataView } from './metadataView';

export const Workbench: React.FunctionComponent<{
  model?: MultiTraceModel,
}> = ({ model }) => {
  const [selectedAction, setSelectedAction] = React.useState<ActionTraceEvent | undefined>();
  const [highlightedAction, setHighlightedAction] = React.useState<ActionTraceEvent | undefined>();
  const [selectedNavigatorTab, setSelectedNavigatorTab] = React.useState<string>('actions');
  const [selectedPropertiesTab, setSelectedPropertiesTab] = React.useState<string>('logs');
  const activeAction = model ? highlightedAction || selectedAction : undefined;

  const { errors, warnings } = activeAction ? modelUtil.stats(activeAction) : { errors: 0, warnings: 0 };
  const consoleCount = errors + warnings;
  const networkCount = activeAction ? modelUtil.resourcesForAction(activeAction).length : 0;
  const sdkLanguage = model?.sdkLanguage || 'javascript';

  const tabs = [
    { id: 'logs', title: 'Call', count: 0, render: () => <CallTab action={activeAction} sdkLanguage={sdkLanguage} /> },
    { id: 'console', title: 'Console', count: consoleCount, render: () => <ConsoleTab action={activeAction} /> },
    { id: 'network', title: 'Network', count: networkCount, render: () => <NetworkTab action={activeAction} /> },
  ];

  if (model?.hasSource)
    tabs.push({ id: 'source', title: 'Source', count: 0, render: () => <SourceTab action={activeAction} /> });

  return <div className='vbox'>
    <Timeline
      model={model}
      selectedAction={activeAction}
      onSelected={action => setSelectedAction(action)}
    />
    <SplitView sidebarSize={300} orientation='horizontal' sidebarIsFirst={true}>
      <SplitView sidebarSize={300} orientation='vertical'>
        <SnapshotTab action={activeAction} sdkLanguage={sdkLanguage} testIdAttributeName={model?.testIdAttributeName || 'data-testid'} />
        <TabbedPane tabs={tabs} selectedTab={selectedPropertiesTab} setSelectedTab={setSelectedPropertiesTab}/>
      </SplitView>
      <TabbedPane tabs={
        [
          {
            id: 'actions',
            title: 'Actions',
            count: 0,
            component: <ActionList
              sdkLanguage={sdkLanguage}
              actions={model?.actions || []}
              selectedAction={model ? selectedAction : undefined}
              onSelected={action => {
                setSelectedAction(action);
              }}
              onHighlighted={action => {
                setHighlightedAction(action);
              }}
              revealConsole={() => setSelectedPropertiesTab('console')}
            />
          },
          {
            id: 'metadata',
            title: 'Metadata',
            count: 0,
            component: <MetadataView model={model}/>
          },
        ]
      } selectedTab={selectedNavigatorTab} setSelectedTab={setSelectedNavigatorTab}/>
    </SplitView>
  </div>;
};
