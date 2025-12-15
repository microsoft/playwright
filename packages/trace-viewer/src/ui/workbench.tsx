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
import type { TraceModel, SourceLocation, ActionTraceEventInContext, SourceModel } from '@isomorphic/trace/traceModel';
import { NetworkTab, useNetworkTabModel } from './networkTab';
import { SnapshotTabsView } from './snapshotTab';
import { SourceTab } from './sourceTab';
import { TabbedPane } from '@web/components/tabbedPane';
import type { TabbedPaneTabModel } from '@web/components/tabbedPane';
import { Timeline } from './timeline';
import { MetadataView } from './metadataView';
import { AttachmentsTab } from './attachmentsTab';
import { AnnotationsTab } from './annotationsTab';
import type { Boundaries } from './geometry';
import { InspectorTab } from './inspectorTab';
import { ToolbarButton } from '@web/components/toolbarButton';
import { useSetting, msToString, clsx, usePartitionedState, togglePartition } from '@web/uiUtils';
import './workbench.css';
import { testStatusIcon, testStatusText } from './testUtils';
import type { UITestStatus } from './testUtils';
import type { HighlightedElement } from './snapshotTab';
import type { TestAnnotation } from '@playwright/test';
import { MetadataWithCommitInfo } from '@testIsomorphic/types';
import type { ActionGroup } from '@isomorphic/protocolFormatter';
import { DialogToolbarButton } from '@web/components/dialogToolbarButton';
import { SettingsView } from './settingsView';
import { TraceModelContext } from './traceModelContext';
import type { TreeState } from '@web/components/treeView';

export type WorkbenchProps = {
  model: TraceModel | undefined;
  showSourcesFirst?: boolean;
  rootDir?: string;
  fallbackLocation?: SourceLocation;
  isLive?: boolean;
  hideTimeline?: boolean;
  status?: UITestStatus;
  annotations?: TestAnnotation[];
  inert?: boolean;
  onOpenExternally?: (location: SourceLocation) => void;
  revealSource?: boolean;
  testRunMetadata?: MetadataWithCommitInfo;
};

export const Workbench: React.FunctionComponent<WorkbenchProps> = props => {
  const partition = traceUriToPartition(props.model?.traceUri);
  return <TraceModelContext.Provider value={props.model}>
    <PartitionedWorkbench partition={partition} {...props} />
  </TraceModelContext.Provider>;
};

const PartitionedWorkbench: React.FunctionComponent<WorkbenchProps & { partition: string }> = props => {
  const { partition, model, showSourcesFirst, rootDir, fallbackLocation, isLive, hideTimeline, status, annotations, inert, onOpenExternally, revealSource, testRunMetadata } = props;

  // UI settings, shared for all models.
  const [selectedNavigatorTab, setSelectedNavigatorTab] = useSetting<string>('navigatorTab',  'actions');
  const [selectedPropertiesTab, setSelectedPropertiesTab] = useSetting<string>('propertiesTab', showSourcesFirst ? 'source' : 'call');
  const [sidebarLocation, setSidebarLocation] = useSetting<'bottom' | 'right'>('propertiesSidebarLocation', 'bottom');
  const [actionsFilter] = useSetting<ActionGroup[]>('actionsFilter', []);

  // Per-model settings, should be primitive non-retaining types.
  // These will be turned into per-model state in the following patches.
  const [selectedCallId, setSelectedCallId] = usePartitionedState<string | undefined>('selectedCallId');
  const [selectedTime, setSelectedTime] = usePartitionedState<Boundaries | undefined>('selectedTime');
  const [highlightedCallId, setHighlightedCallId] = usePartitionedState<string | undefined>('highlightedCallId');
  const [revealedErrorKey, setRevealedErrorKey] = usePartitionedState<string | undefined>('revealedErrorKey');
  const [highlightedConsoleMessageOrdinal, setHighlightedConsoleMessageOrdinal] = usePartitionedState<number | undefined>('highlightedConsoleMessageOrdinal');
  const [revealedAttachmentCallId, setRevealedAttachmentCallId] = usePartitionedState<{ callId: string } | undefined>('revealedAttachmentCallId');
  const [highlightedResourceOrdinal, setHighlightedResourceOrdinal] = usePartitionedState<number | undefined>('highlightedResourceOrdinal');
  const [treeState, setTreeState] = usePartitionedState<TreeState>('treeState', { expandedItems: new Map() });

  togglePartition(partition);

  // Transient state
  const [highlightedElement, setHighlightedElement] = React.useState<HighlightedElement>({ lastEdited: 'none' });
  const [isInspecting, setIsInspectingState] = React.useState(false);

  const setSelectedAction = React.useCallback((action: ActionTraceEventInContext | undefined) => {
    setSelectedCallId(action?.callId);
    setRevealedErrorKey(undefined);
  }, [setSelectedCallId, setRevealedErrorKey]);

  const actions = React.useMemo(() => model?.filteredActions(actionsFilter), [model, actionsFilter]);
  const hiddenActionsCount = (model?.actions.length ?? 0) - (actions?.length ?? 0);

  const highlightedAction = React.useMemo(() => {
    return actions?.find(a => a.callId === highlightedCallId);
  }, [actions, highlightedCallId]);

  const setHighlightedAction = React.useCallback((highlightedAction: ActionTraceEventInContext | undefined) => {
    setHighlightedCallId(highlightedAction?.callId);
  }, [setHighlightedCallId]);

  const sources = React.useMemo(() => model?.sources || new Map<string, SourceModel>(), [model]);

  React.useEffect(() => {
    setSelectedTime(undefined);
    setRevealedErrorKey(undefined);
  }, [model, setSelectedTime, setRevealedErrorKey]);

  const selectedAction = React.useMemo(() => {
    if (selectedCallId) {
      const action = actions?.find(a => a.callId === selectedCallId);
      if (action)
        return action;
    }

    const failedAction = model?.failedAction();
    if (failedAction)
      return failedAction;

    if (actions?.length) {
      // Select the last non-after hooks item.
      let index = actions.length - 1;
      for (let i = 0; i < actions.length; ++i) {
        if (actions[i].title === 'After Hooks' && i) {
          index = i - 1;
          break;
        }
      }
      return actions[index];
    }
  }, [model, actions, selectedCallId]);

  const activeAction = React.useMemo(() => {
    return highlightedAction || selectedAction;
  }, [selectedAction, highlightedAction]);

  const onActionSelected = React.useCallback((action: ActionTraceEventInContext) => {
    setSelectedAction(action);
    setHighlightedAction(undefined);
  }, [setSelectedAction, setHighlightedAction]);

  const selectPropertiesTab = React.useCallback((tab: string) => {
    setSelectedPropertiesTab(tab);
    if (tab !== 'inspector')
      setIsInspectingState(false);
  }, [setSelectedPropertiesTab]);

  const setIsInspecting = React.useCallback((value: boolean) => {
    if (!isInspecting && value)
      selectPropertiesTab('inspector');
    setIsInspectingState(value);
  }, [setIsInspectingState, selectPropertiesTab, isInspecting]);

  const elementPicked = React.useCallback((element: HighlightedElement) => {
    setHighlightedElement(element);
    selectPropertiesTab('inspector');
  }, [selectPropertiesTab]);

  const revealActionAttachment = React.useCallback((callId: string) => {
    selectPropertiesTab('attachments');
    setRevealedAttachmentCallId({ callId });
  }, [selectPropertiesTab, setRevealedAttachmentCallId]);

  React.useEffect(() => {
    if (revealSource)
      selectPropertiesTab('source');
  }, [revealSource, selectPropertiesTab]);

  const consoleModel = useConsoleTabModel(model, selectedTime);
  const networkModel = useNetworkTabModel(model, selectedTime);
  const errorsModel = useErrorsTabModel(model);

  const revealedStack = React.useMemo(() => {
    if (revealedErrorKey !== undefined)
      return errorsModel.errors.get(revealedErrorKey)?.stack;
    return activeAction?.stack;
  }, [activeAction, revealedErrorKey, errorsModel]);

  const sdkLanguage = model?.sdkLanguage || 'javascript';

  const inspectorTab: TabbedPaneTabModel = {
    id: 'inspector',
    title: 'Locator',
    render: () => <InspectorTab
      sdkLanguage={sdkLanguage}
      isInspecting={isInspecting}
      setIsInspecting={setIsInspecting}
      highlightedElement={highlightedElement}
      setHighlightedElement={setHighlightedElement} />,
  };
  const callTab: TabbedPaneTabModel = {
    id: 'call',
    title: 'Call',
    render: () => <CallTab action={activeAction} startTimeOffset={model?.startTime ?? 0} sdkLanguage={sdkLanguage} />
  };
  const logTab: TabbedPaneTabModel = {
    id: 'log',
    title: 'Log',
    render: () => <LogTab action={activeAction} isLive={isLive} />
  };
  const errorsTab: TabbedPaneTabModel = {
    id: 'errors',
    title: 'Errors',
    errorCount: errorsModel.errors.size,
    render: () => <ErrorsTab errorsModel={errorsModel} testRunMetadata={testRunMetadata} sdkLanguage={sdkLanguage} revealInSource={error => {
      if (error.action)
        setSelectedAction(error.action);
      else
        setRevealedErrorKey(error.message);
      selectPropertiesTab('source');
    }} wallTime={model?.wallTime ?? 0} />
  };

  // Fallback location w/o action stands for file / test.
  // Render error count on Source tab for that case.
  let fallbackSourceErrorCount: number | undefined = undefined;
  if (!selectedAction && fallbackLocation)
    fallbackSourceErrorCount = fallbackLocation.source?.errors.length;

  const sourceTab: TabbedPaneTabModel = {
    id: 'source',
    title: 'Source',
    errorCount: fallbackSourceErrorCount,
    render: () => <SourceTab
      stack={revealedStack}
      sources={sources}
      rootDir={rootDir}
      stackFrameLocation={sidebarLocation === 'bottom' ? 'right' : 'bottom'}
      fallbackLocation={fallbackLocation}
      onOpenExternally={onOpenExternally}
    />
  };
  const consoleTab: TabbedPaneTabModel = {
    id: 'console',
    title: 'Console',
    count: consoleModel.entries.length,
    render: () => <ConsoleTab
      consoleModel={consoleModel}
      boundaries={boundaries}
      selectedTime={selectedTime}
      onAccepted={m => setSelectedTime({ minimum: m.timestamp, maximum: m.timestamp })}
      onEntryHovered={setHighlightedConsoleMessageOrdinal}
    />
  };
  const networkTab: TabbedPaneTabModel = {
    id: 'network',
    title: 'Network',
    count: networkModel.resources.length,
    render: () => <NetworkTab boundaries={boundaries} networkModel={networkModel} onResourceHovered={setHighlightedResourceOrdinal} sdkLanguage={model?.sdkLanguage ?? 'javascript'} />
  };
  const attachmentsTab: TabbedPaneTabModel = {
    id: 'attachments',
    title: 'Attachments',
    count: model?.visibleAttachments.length,
    render: () => <AttachmentsTab revealedAttachmentCallId={revealedAttachmentCallId} />
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

  if (annotations !== undefined) {
    const annotationsTab: TabbedPaneTabModel = {
      id: 'annotations',
      title: 'Annotations',
      count: annotations.length,
      render: () => <AnnotationsTab annotations={annotations} />
    };
    tabs.push(annotationsTab);
  }

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

  let time: number = 0;
  if (!isLive && model && model.endTime >= 0)
    time = model.endTime - model.startTime;
  else if (model && model.wallTime)
    time = Date.now() - model.wallTime;

  const actionsTab: TabbedPaneTabModel = {
    id: 'actions',
    title: 'Actions',
    component: <div className='vbox'>
      {status && <div className='workbench-run-status'>
        <span className={clsx('codicon', testStatusIcon(status))}></span>
        <div>{testStatusText(status)}</div>
        <div className='spacer'></div>
        <div className='workbench-run-duration'>{time ? msToString(time) : ''}</div>
      </div>}
      <ActionList
        sdkLanguage={sdkLanguage}
        actions={actions || []}
        selectedAction={model ? selectedAction : undefined}
        selectedTime={selectedTime}
        setSelectedTime={setSelectedTime}
        treeState={treeState}
        setTreeState={setTreeState}
        onSelected={onActionSelected}
        onHighlighted={setHighlightedAction}
        revealActionAttachment={revealActionAttachment}
        revealConsole={() => selectPropertiesTab('console')}
        isLive={isLive}
      />
    </div>
  };
  const metadataTab: TabbedPaneTabModel = {
    id: 'metadata',
    title: 'Metadata',
    component: <MetadataView model={model}/>
  };

  const actionsFilterWithCount = selectedNavigatorTab === 'actions' && <ActionsFilterButton counters={model?.actionCounters} hiddenActionsCount={hiddenActionsCount} />;

  return <div className='vbox workbench' {...(inert ? { inert: true } : {})}>
    {!hideTimeline && <Timeline
      model={model}
      consoleEntries={consoleModel.entries}
      networkResources={networkModel.resources}
      boundaries={boundaries}
      highlightedAction={highlightedAction}
      highlightedResourceOrdinal={highlightedResourceOrdinal}
      highlightedConsoleEntryOrdinal={highlightedConsoleMessageOrdinal}
      onSelected={onActionSelected}
      sdkLanguage={sdkLanguage}
      selectedTime={selectedTime}
      setSelectedTime={setSelectedTime}
    />}
    <SplitView
      sidebarSize={250}
      orientation={sidebarLocation === 'bottom' ? 'vertical' : 'horizontal'} settingName='propertiesSidebar'
      main={<SplitView
        sidebarSize={250}
        orientation='horizontal'
        sidebarIsFirst
        settingName='actionListSidebar'
        main={<SnapshotTabsView
          action={activeAction}
          model={model}
          sdkLanguage={sdkLanguage}
          testIdAttributeName={model?.testIdAttributeName || 'data-testid'}
          isInspecting={isInspecting}
          setIsInspecting={setIsInspecting}
          highlightedElement={highlightedElement}
          setHighlightedElement={elementPicked} />}
        sidebar={
          <TabbedPane
            tabs={[actionsTab, metadataTab]}
            rightToolbar={[actionsFilterWithCount]}
            selectedTab={selectedNavigatorTab}
            setSelectedTab={setSelectedNavigatorTab}
          />
        }
      />}
      sidebar={<TabbedPane
        tabs={tabs}
        selectedTab={selectedPropertiesTab}
        setSelectedTab={selectPropertiesTab}
        rightToolbar={[
          sidebarLocation === 'bottom' ?
            <ToolbarButton title='Dock to right' icon='layout-sidebar-right-off' onClick={() => {
              setSidebarLocation('right');
            }} /> :
            <ToolbarButton title='Dock to bottom' icon='layout-panel-off' onClick={() => {
              setSidebarLocation('bottom');
            }} />
        ]}
        mode={sidebarLocation === 'bottom' ? 'default' : 'select'}
      />}
    />
  </div>;
};

const ActionsFilterButton: React.FC<{ counters?: Map<string, number>; hiddenActionsCount: number }> = ({ counters, hiddenActionsCount }) => {
  const [actionsFilter, setActionsFilter] = useSetting<ActionGroup[]>('actionsFilter', []);

  const iconRef = React.useRef<HTMLButtonElement>(null);
  const buttonChildren = <>
    {hiddenActionsCount > 0 && <span className='workbench-actions-hidden-count' title={hiddenActionsCount + ' actions hidden by filters'}>{hiddenActionsCount} hidden</span>}
    <span ref={iconRef} className='codicon codicon-filter'></span>
  </>;

  return <DialogToolbarButton title='Filter actions' dialogDataTestId='actions-filter-dialog' buttonChildren={buttonChildren} anchorRef={iconRef} >
    <SettingsView
      settings={[
        {
          type: 'check',
          value: actionsFilter.includes('getter'),
          set: value => setActionsFilter(value ? [...actionsFilter, 'getter'] : actionsFilter.filter(a => a !== 'getter')),
          name: 'Getters',
          count: counters?.get('getter'),
        },
        {
          type: 'check',
          value: actionsFilter.includes('route'),
          set: value => setActionsFilter(value ? [...actionsFilter, 'route'] : actionsFilter.filter(a => a !== 'route')),
          name: 'Network routes',
          count: counters?.get('route'),
        },
        {
          type: 'check',
          value: actionsFilter.includes('configuration'),
          set: value => setActionsFilter(value ? [...actionsFilter, 'configuration'] : actionsFilter.filter(a => a !== 'configuration')),
          name: 'Configuration',
          count: counters?.get('configuration'),
        },
      ]}
    />
  </DialogToolbarButton>;
};

function traceUriToPartition(traceUri: string | undefined): string {
  if (!traceUri)
    return 'default';
  const url = new URL(traceUri, 'http://localhost');
  url.searchParams.delete('timestamp');
  return url.toString();
}
