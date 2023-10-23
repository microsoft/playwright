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

import { SplitView } from '@web/components/splitView';
import * as React from 'react';
import { ActionList } from './actionList';
import { CallTab } from './callTab';
import { LogTab } from './logTab';
import { ErrorsTab, useErrorsTabModel } from './errorsTab';
import { ConsoleTab, useConsoleTabModel } from './consoleTab';
import type * as modelUtil from './modelUtil';
import type { ActionTraceEventInContext, MultiTraceModel } from './modelUtil';
import { NetworkTab, useNetworkTabModel } from './networkTab';
import { SnapshotTab } from './snapshotTab';
import { SourceTab } from './sourceTab';
import { TabbedPane } from '@web/components/tabbedPane';
import type { TabbedPaneTabModel } from '@web/components/tabbedPane';
import { Timeline } from './timeline';
import { MetadataView } from './metadataView';
import { AttachmentsTab } from './attachmentsTab';
import type { Boundaries } from '../geometry';
import { InspectorTab } from './inspectorTab';
import { ToolbarButton } from '@web/components/toolbarButton';
import { useSetting } from '@web/uiUtils';
import type { Entry } from '@trace/har';

export const Workbench: React.FunctionComponent<{
  model?: MultiTraceModel,
  hideStackFrames?: boolean,
  showSourcesFirst?: boolean,
  rootDir?: string,
  fallbackLocation?: modelUtil.SourceLocation,
  initialSelection?: ActionTraceEventInContext,
  onSelectionChanged?: (action: ActionTraceEventInContext) => void,
  isLive?: boolean,
}> = ({ model, hideStackFrames, showSourcesFirst, rootDir, fallbackLocation, initialSelection, onSelectionChanged, isLive }) => {
  const [selectedAction, setSelectedAction] = React.useState<ActionTraceEventInContext | undefined>(undefined);
  const [highlightedAction, setHighlightedAction] = React.useState<ActionTraceEventInContext | undefined>();
  const [highlightedEntry, setHighlightedEntry] = React.useState<Entry | undefined>();
  const [selectedNavigatorTab, setSelectedNavigatorTab] = React.useState<string>('actions');
  const [selectedPropertiesTab, setSelectedPropertiesTab] = useSetting<string>('propertiesTab', showSourcesFirst ? 'source' : 'call');
  const [isInspecting, setIsInspecting] = React.useState(false);
  const [highlightedLocator, setHighlightedLocator] = React.useState<string>('');
  const activeAction = model ? highlightedAction || selectedAction : undefined;
  const [selectedTime, setSelectedTime] = React.useState<Boundaries | undefined>();
  const [sidebarLocation, setSidebarLocation] = useSetting<'bottom' | 'right'>('propertiesSidebarLocation', 'bottom');

  const sources = React.useMemo(() => model?.sources || new Map(), [model]);

  React.useEffect(() => {
    setSelectedTime(undefined);
  }, [model]);

  React.useEffect(() => {
    if (selectedAction && model?.actions.includes(selectedAction))
      return;
    const failedAction = model?.failedAction();
    if (initialSelection && model?.actions.includes(initialSelection))
      setSelectedAction(initialSelection);
    else if (failedAction)
      setSelectedAction(failedAction);
    else if (model?.actions.length)
      setSelectedAction(model.actions[model.actions.length - 1]);
  }, [model, selectedAction, setSelectedAction, initialSelection]);

  const onActionSelected = React.useCallback((action: ActionTraceEventInContext) => {
    setSelectedAction(action);
    onSelectionChanged?.(action);
  }, [setSelectedAction, onSelectionChanged]);

  const selectPropertiesTab = React.useCallback((tab: string) => {
    setSelectedPropertiesTab(tab);
    if (tab !== 'inspector')
      setIsInspecting(false);
  }, [setSelectedPropertiesTab]);

  const locatorPicked = React.useCallback((locator: string) => {
    setHighlightedLocator(locator);
    selectPropertiesTab('inspector');
  }, [selectPropertiesTab]);

  const consoleModel = useConsoleTabModel(model, selectedTime);
  const networkModel = useNetworkTabModel(model, selectedTime);
  const errorsModel = useErrorsTabModel(model);
  const attachments = React.useMemo(() => {
    return model?.actions.map(a => a.attachments || []).flat() || [];
  }, [model]);

  const sdkLanguage = model?.sdkLanguage || 'javascript';

  const inspectorTab: TabbedPaneTabModel = {
    id: 'inspector',
    title: 'Locator',
    render: () => <InspectorTab
      sdkLanguage={sdkLanguage}
      setIsInspecting={setIsInspecting}
      highlightedLocator={highlightedLocator}
      setHighlightedLocator={setHighlightedLocator} />,
  };
  const callTab: TabbedPaneTabModel = {
    id: 'call',
    title: 'Call',
    render: () => <CallTab action={activeAction} sdkLanguage={sdkLanguage} />
  };
  const logTab: TabbedPaneTabModel = {
    id: 'log',
    title: 'Log',
    render: () => <LogTab action={activeAction} />
  };
  const errorsTab: TabbedPaneTabModel = {
    id: 'errors',
    title: 'Errors',
    errorCount: errorsModel.errors.size,
    render: () => <ErrorsTab errorsModel={errorsModel} sdkLanguage={sdkLanguage} revealInSource={action => {
      setSelectedAction(action);
      selectPropertiesTab('source');
    }} />
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
    count: consoleModel.entries.length,
    render: () => <ConsoleTab consoleModel={consoleModel} boundaries={boundaries} selectedTime={selectedTime} />
  };
  const networkTab: TabbedPaneTabModel = {
    id: 'network',
    title: 'Network',
    count: networkModel.resources.length,
    render: () => <NetworkTab boundaries={boundaries} networkModel={networkModel} onEntryHovered={setHighlightedEntry}/>
  };
  const attachmentsTab: TabbedPaneTabModel = {
    id: 'attachments',
    title: 'Attachments',
    count: attachments.length,
    render: () => <AttachmentsTab model={model} />
  };

  const tabs: TabbedPaneTabModel[] = [
    inspectorTab,
    callTab,
    logTab,
    errorsTab,
    consoleTab,
    networkTab,
    sourceTab,
    attachmentsTab,
  ];
  if (showSourcesFirst) {
    const sourceTabIndex = tabs.indexOf(sourceTab);
    tabs.splice(sourceTabIndex, 1);
    tabs.splice(1, 0, sourceTab);
  }

  const { boundaries } = React.useMemo(() => {
    const boundaries = { minimum: model?.startTime || 0, maximum: model?.endTime || 30000 };
    if (boundaries.minimum > boundaries.maximum) {
      boundaries.minimum = 0;
      boundaries.maximum = 30000;
    }
    // Leave some nice free space on the right hand side.
    boundaries.maximum += (boundaries.maximum - boundaries.minimum) / 20;
    return { boundaries };
  }, [model]);

  return <div className='vbox workbench'>
    <Timeline
      model={model}
      boundaries={boundaries}
      highlightedAction={highlightedAction}
      highlightedEntry={highlightedEntry}
      onSelected={onActionSelected}
      sdkLanguage={sdkLanguage}
      selectedTime={selectedTime}
      setSelectedTime={setSelectedTime}
    />
    <SplitView sidebarSize={250} orientation={sidebarLocation === 'bottom' ? 'vertical' : 'horizontal'} settingName='propertiesSidebar'>
      <SplitView sidebarSize={250} orientation='horizontal' sidebarIsFirst={true} settingName='actionListSidebar'>
        <SnapshotTab
          action={activeAction}
          sdkLanguage={sdkLanguage}
          testIdAttributeName={model?.testIdAttributeName || 'data-testid'}
          isInspecting={isInspecting}
          setIsInspecting={setIsInspecting}
          highlightedLocator={highlightedLocator}
          setHighlightedLocator={locatorPicked} />
        <TabbedPane
          tabs={[
            {
              id: 'actions',
              title: 'Actions',
              component: <ActionList
                sdkLanguage={sdkLanguage}
                actions={model?.actions || []}
                selectedAction={model ? selectedAction : undefined}
                selectedTime={selectedTime}
                setSelectedTime={setSelectedTime}
                onSelected={onActionSelected}
                onHighlighted={setHighlightedAction}
                revealConsole={() => selectPropertiesTab('console')}
                isLive={isLive}
              />
            },
            {
              id: 'metadata',
              title: 'Metadata',
              component: <MetadataView model={model}/>
            },
          ]}
          selectedTab={selectedNavigatorTab} setSelectedTab={setSelectedNavigatorTab}/>
      </SplitView>
      <TabbedPane
        tabs={tabs}
        selectedTab={selectedPropertiesTab}
        setSelectedTab={selectPropertiesTab}
        leftToolbar={[
          <ToolbarButton title='Pick locator' icon='target' toggled={isInspecting} onClick={() => {
            if (!isInspecting)
              selectPropertiesTab('inspector');
            setIsInspecting(!isInspecting);
          }} />
        ]}
        rightToolbar={[
          sidebarLocation === 'bottom' ?
            <ToolbarButton title='Dock to right' icon='layout-sidebar-right-off' onClick={() => {
              setSidebarLocation('right');
            }} /> :
            <ToolbarButton title='Dock to bottom' icon='layout-panel-off' onClick={() => {
              setSidebarLocation('bottom');
            }} />
        ]}
      />
    </SplitView>
  </div>;
};
