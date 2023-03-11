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
import type { TabbedPaneTabModel } from '@web/components/tabbedPane';
import { Timeline } from './timeline';
import './workbench.css';
import { MetadataView } from './metadataView';

export const Workbench: React.FunctionComponent<{
  model?: MultiTraceModel,
  output?: React.ReactElement,
  rightToolbar?: React.ReactElement[],
  hideTimelineBars?: boolean,
  hideStackFrames?: boolean,
}> = ({ model, output, rightToolbar, hideTimelineBars, hideStackFrames }) => {
  const [selectedAction, setSelectedAction] = React.useState<ActionTraceEvent | undefined>(undefined);
  const [highlightedAction, setHighlightedAction] = React.useState<ActionTraceEvent | undefined>();
  const [selectedNavigatorTab, setSelectedNavigatorTab] = React.useState<string>('actions');
  const [selectedPropertiesTab, setSelectedPropertiesTab] = React.useState<string>(output ? 'output' : 'call');
  const activeAction = model ? highlightedAction || selectedAction : undefined;

  React.useEffect(() => {
    if (selectedAction)
      return;
    const failedAction = model?.actions.find(a => a.error);
    if (failedAction)
      setSelectedAction(failedAction);
    // In the UI mode, selecting the first error should reveal source.
    if (failedAction && output)
      setSelectedPropertiesTab('source');
  }, [model, output, selectedAction, setSelectedAction, setSelectedPropertiesTab]);

  const { errors, warnings } = activeAction ? modelUtil.stats(activeAction) : { errors: 0, warnings: 0 };
  const consoleCount = errors + warnings;
  const networkCount = activeAction ? modelUtil.resourcesForAction(activeAction).length : 0;
  const sdkLanguage = model?.sdkLanguage || 'javascript';

  const tabs: TabbedPaneTabModel[] = [
    { id: 'call', title: 'Call', render: () => <CallTab action={activeAction} sdkLanguage={sdkLanguage} /> },
    { id: 'source', title: 'Source', count: 0, render: () => <SourceTab action={activeAction} hideStackFrames={hideStackFrames}/> },
    { id: 'console', title: 'Console', count: consoleCount, render: () => <ConsoleTab action={activeAction} /> },
    { id: 'network', title: 'Network', count: networkCount, render: () => <NetworkTab action={activeAction} /> },
  ];

  if (output)
    tabs.unshift({ id: 'output', title: 'Output', component: output });

  return <div className='vbox'>
    <Timeline
      model={model}
      selectedAction={activeAction}
      onSelected={action => setSelectedAction(action)}
      hideTimelineBars={hideTimelineBars}
    />
    <SplitView sidebarSize={output ? 250 : 350} orientation={output ? 'vertical' : 'horizontal'}>
      <SplitView sidebarSize={250} orientation='horizontal' sidebarIsFirst={true}>
        <SnapshotTab action={activeAction} sdkLanguage={sdkLanguage} testIdAttributeName={model?.testIdAttributeName || 'data-testid'} />
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
      <TabbedPane tabs={tabs} selectedTab={selectedPropertiesTab} setSelectedTab={setSelectedPropertiesTab} rightToolbar={rightToolbar}/>
    </SplitView>
  </div>;
};
