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
import { ConsoleTab } from './consoleTab';
import type * as modelUtil from './modelUtil';
import type { ActionTraceEventInContext, MultiTraceModel } from './modelUtil';
import { NetworkTab } from './networkTab';
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
  const [selectedNavigatorTab, setSelectedNavigatorTab] = React.useState<string>('actions');
  const [selectedPropertiesTab, setSelectedPropertiesTab] = React.useState<string>(showSourcesFirst ? 'source' : 'call');
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
    const failedAction = model?.actions.find(a => a.error);
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
  }, []);

  const locatorPicked = React.useCallback((locator: string) => {
    setHighlightedLocator(locator);
    selectPropertiesTab('inspector');
  }, [selectPropertiesTab]);

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
    render: () => <ConsoleTab model={model} boundaries={boundaries} selectedTime={selectedTime} />
  };
  const networkTab: TabbedPaneTabModel = {
    id: 'network',
    title: 'Network',
    render: () => <NetworkTab model={model} selectedTime={selectedTime} />
  };
  const attachmentsTab: TabbedPaneTabModel = {
    id: 'attachments',
    title: 'Attachments',
    render: () => <AttachmentsTab model={model} />
  };

  const tabs: TabbedPaneTabModel[] = showSourcesFirst ? [
    inspectorTab,
    sourceTab,
    consoleTab,
    networkTab,
    callTab,
    attachmentsTab,
  ] : [
    inspectorTab,
    callTab,
    consoleTab,
    networkTab,
    sourceTab,
    attachmentsTab,
  ];

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
      onSelected={onActionSelected}
      sdkLanguage={sdkLanguage}
      selectedTime={selectedTime}
      setSelectedTime={setSelectedTime}
    />
    <SplitView sidebarSize={250} orientation='horizontal' sidebarIsFirst={true}>
      <SplitView sidebarSize={250} orientation={sidebarLocation === 'bottom' ? 'vertical' : 'horizontal'} settingName='propertiesSidebar'>
        <SnapshotTab
          action={activeAction}
          sdkLanguage={sdkLanguage}
          testIdAttributeName={model?.testIdAttributeName || 'data-testid'}
          isInspecting={isInspecting}
          setIsInspecting={setIsInspecting}
          highlightedLocator={highlightedLocator}
          setHighlightedLocator={locatorPicked} />
        <TabbedPane
          tabs={tabs}
          selectedTab={selectedPropertiesTab}
          setSelectedTab={selectPropertiesTab}
          leftToolbar={[
            <ToolbarButton title='Pick locator' toggled={isInspecting} onClick={() => {
              if (!isInspecting)
                selectPropertiesTab('inspector');
              setIsInspecting(!isInspecting);
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20"><path d="M444-48v-98q-121-14-202.5-96T146-444H48v-72h98q14-120 95.5-202T444-814v-98h72v98q121 14 202.5 96T814-516h98v72h-98q-14 120-95.5 202T516-146v98h-72Zm36-168q110 0 187-77t77-187q0-110-77-187t-187-77q-110 0-187 77t-77 187q0 110 77 187t187 77Zm0-120q-60 0-102-42t-42-102q0-60 42-102t102-42q60 0 102 42t42 102q0 60-42 102t-102 42Z"/></svg>
            </ToolbarButton>
          ]}
          rightToolbar={[
            sidebarLocation === 'bottom' ? <ToolbarButton title='Dock to right' onClick={() => {
              setSidebarLocation('right');
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20"><path d="M211-144q-27.637 0-47.319-19.681Q144-183.363 144-211v-538q0-27.638 19.681-47.319Q183.363-816 211-816h538q27.638 0 47.319 19.681T816-749v538q0 27.637-19.681 47.319Q776.638-144 749-144H211Zm413-72h120v-528H624v528Zm-72 0v-528H216v528h336Zm72 0h120-120Z"/></svg>
            </ToolbarButton> : <ToolbarButton title='Dock to bottom' onClick={() => {
              setSidebarLocation('bottom');
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20"><path d="M211-144q-27.637 0-47.319-19.681Q144-183.363 144-211v-538q0-27.638 19.681-47.319Q183.363-816 211-816h538q27.638 0 47.319 19.681T816-749v538q0 27.637-19.681 47.319Q776.638-144 749-144H211Zm5-192v120h528v-120H216Zm0-72h528v-336H216v336Zm0 72v120-120Z"/></svg>
            </ToolbarButton>
          ]}
        />
      </SplitView>
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
  </div>;
};
