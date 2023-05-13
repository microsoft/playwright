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
import { AttachmentsTab } from './attachmentsTab';

export const Workbench: React.FunctionComponent<{
  model?: MultiTraceModel,
  hideTimelineBars?: boolean,
  hideStackFrames?: boolean,
  showSourcesFirst?: boolean,
  rootDir?: string,
  fallbackLocation?: modelUtil.SourceLocation,
  initialSelection?: ActionTraceEvent,
  onSelectionChanged?: (action: ActionTraceEvent) => void,
}> = ({ model, hideTimelineBars, hideStackFrames, showSourcesFirst, rootDir, fallbackLocation, initialSelection, onSelectionChanged }) => {
  const [selectedAction, setSelectedAction] = React.useState<ActionTraceEvent | undefined>(undefined);
  const [highlightedAction, setHighlightedAction] = React.useState<ActionTraceEvent | undefined>();
  const [selectedNavigatorTab, setSelectedNavigatorTab] = React.useState<string>('actions');
  const [selectedPropertiesTab, setSelectedPropertiesTab] = React.useState<string>(showSourcesFirst ? 'source' : 'call');
  const activeAction = model ? highlightedAction || selectedAction : undefined;

  const sources = React.useMemo(() => model?.sources || new Map(), [model]);

  React.useEffect(() => {
    if (selectedAction && model?.actions.includes(selectedAction))
      return;
    const failedAction = model?.actions.find(a => a.error);
    if (initialSelection && model?.actions.includes(initialSelection))
      setSelectedAction(initialSelection);
    else if (failedAction)
      setSelectedAction(failedAction);
    else if (model?.actions.length)
      setSelectedAction(model.actions[model.actions.length - 1]);
  }, [model, selectedAction, setSelectedAction, setSelectedPropertiesTab, initialSelection]);

  const onActionSelected = React.useCallback((action: ActionTraceEvent) => {
    setSelectedAction(action);
    onSelectionChanged?.(action);
  }, [setSelectedAction, onSelectionChanged]);

  const { errors, warnings } = activeAction ? modelUtil.stats(activeAction) : { errors: 0, warnings: 0 };
  const consoleCount = errors + warnings;
  const networkCount = activeAction ? modelUtil.resourcesForAction(activeAction).length : 0;
  const sdkLanguage = model?.sdkLanguage || 'javascript';

  const callTab: TabbedPaneTabModel = {
    id: 'call',
    title: 'Call',
    render: () => <CallTab action={activeAction} sdkLanguage={sdkLanguage} />
  };
  const sourceTab: TabbedPaneTabModel = {
    id: 'source',
    title: 'Source',
    render: () => <SourceTab
      action={activeAction}
      sources={sources}
      hideStackFrames={hideStackFrames}
      rootDir={rootDir}
      fallbackLocation={fallbackLocation} />
  };
  const consoleTab: TabbedPaneTabModel = {
    id: 'console',
    title: 'Console',
    count: consoleCount,
    render: () => <ConsoleTab action={activeAction} />
  };
  const networkTab: TabbedPaneTabModel = {
    id: 'network',
    title: 'Network',
    count: networkCount,
    render: () => <NetworkTab action={activeAction} />
  };
  const attachmentsTab: TabbedPaneTabModel = {
    id: 'attachments',
    title: 'Attachments',
    render: () => <AttachmentsTab action={activeAction} />
  };

  const tabs: TabbedPaneTabModel[] = showSourcesFirst ? [
    sourceTab,
    consoleTab,
    networkTab,
    callTab,
    attachmentsTab,
  ] : [
    callTab,
    consoleTab,
    networkTab,
    sourceTab,
    attachmentsTab,
  ];

  return <div className='vbox'>
    <Timeline
      model={model}
      selectedAction={activeAction}
      onSelected={onActionSelected}
      hideTimelineBars={hideTimelineBars}
    />
    <SplitView sidebarSize={250} orientation='vertical'>
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
                onSelected={onActionSelected}
                onHighlighted={setHighlightedAction}
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
      <TabbedPane tabs={tabs} selectedTab={selectedPropertiesTab} setSelectedTab={setSelectedPropertiesTab} />
    </SplitView>
  </div>;
};
