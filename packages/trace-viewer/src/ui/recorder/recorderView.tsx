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

import type * as actionTypes from '@recorder/actions';
import { SourceChooser } from '@web/components/sourceChooser';
import { SplitView } from '@web/components/splitView';
import type { TabbedPaneTabModel } from '@web/components/tabbedPane';
import { TabbedPane } from '@web/components/tabbedPane';
import { Toolbar } from '@web/components/toolbar';
import { ToolbarButton, ToolbarSeparator } from '@web/components/toolbarButton';
import { toggleTheme } from '@web/theme';
import { copy, useSetting } from '@web/uiUtils';
import * as React from 'react';
import { ConsoleTab, useConsoleTabModel } from '../consoleTab';
import type { Boundaries } from '../geometry';
import { InspectorTab } from '../inspectorTab';
import type * as modelUtil from '../modelUtil';
import type { SourceLocation } from '../modelUtil';
import { NetworkTab, useNetworkTabModel } from '../networkTab';
import { collectSnapshots, extendSnapshot, SnapshotView } from '../snapshotTab';
import { SourceTab } from '../sourceTab';
import { ModelContext, ModelProvider } from './modelContext';
import './recorderView.css';
import { ActionListView } from './actionListView';
import { BackendContext, BackendProvider } from './backendContext';
import type { Language } from '@isomorphic/locatorGenerators';

export const RecorderView: React.FunctionComponent = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const guid = searchParams.get('ws')!;
  const trace = searchParams.get('trace') + '.json';

  return <BackendProvider guid={guid}>
    <ModelProvider trace={trace}>
      <Workbench />
    </ModelProvider>
  </BackendProvider>;
};

export const Workbench: React.FunctionComponent = () => {
  const backend = React.useContext(BackendContext);
  const model = React.useContext(ModelContext);
  const [fileId, setFileId] = React.useState<string | undefined>();
  const [selectedStartTime, setSelectedStartTime] = React.useState<number | undefined>(undefined);
  const [isInspecting, setIsInspecting] = React.useState(false);
  const [highlightedLocatorInProperties, setHighlightedLocatorInProperties] = React.useState<string>('');
  const [highlightedLocatorInTrace, setHighlightedLocatorInTrace] = React.useState<string>('');
  const [traceCallId, setTraceCallId] = React.useState<string | undefined>();

  const setSelectedAction = React.useCallback((action: actionTypes.ActionInContext | undefined) => {
    setSelectedStartTime(action?.startTime);
  }, []);

  const selectedAction = React.useMemo(() => {
    return backend?.actions.find(a => a.startTime === selectedStartTime);
  }, [backend?.actions, selectedStartTime]);

  React.useEffect(() => {
    const callId = model?.actions.find(a => a.endTime && a.endTime === selectedAction?.endTime)?.callId;
    if (callId)
      setTraceCallId(callId);
  }, [model, selectedAction]);

  const source = React.useMemo(() => backend?.sources.find(s => s.id === fileId) || backend?.sources[0], [backend?.sources, fileId]);
  const sourceLocation = React.useMemo(() => {
    if (!source)
      return undefined;
    const sourceLocation: SourceLocation = {
      file: '',
      line: 0,
      column: 0,
      source: {
        errors: [],
        content: source.text
      }
    };
    return sourceLocation;
  }, [source]);

  const sdkLanguage: Language = source?.language || 'javascript';

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

  const locatorPickedInTrace = React.useCallback((locator: string) => {
    setHighlightedLocatorInProperties(locator);
    setHighlightedLocatorInTrace('');
    setIsInspecting(false);
  }, []);

  const locatorTypedInProperties = React.useCallback((locator: string) => {
    setHighlightedLocatorInTrace(locator);
    setHighlightedLocatorInProperties(locator);
  }, []);

  const actionList = <ActionListView
    sdkLanguage={sdkLanguage}
    actions={backend?.actions || []}
    selectedAction={selectedAction}
    onSelectedAction={setSelectedAction}
  />;

  const actionsTab: TabbedPaneTabModel = {
    id: 'actions',
    title: 'Actions',
    component: actionList,
  };

  const toolbar = <Toolbar sidebarBackground>
    <div style={{ width: 4 }}></div>
    <ToolbarButton icon='inspect' title='Pick locator' toggled={isInspecting} onClick={() => {
      setIsInspecting(!isInspecting);
    }} />
    <ToolbarButton icon='eye' title='Assert visibility' onClick={() => {
    }} />
    <ToolbarButton icon='whole-word' title='Assert text' onClick={() => {
    }} />
    <ToolbarButton icon='symbol-constant' title='Assert value' onClick={() => {
    }} />
    <ToolbarSeparator />
    <ToolbarButton icon='files' title='Copy' disabled={!source || !source.text} onClick={() => {
      if (source?.text)
        copy(source.text);
    }}></ToolbarButton>
    <div style={{ flex: 'auto' }}></div>
    <div>Target:</div>
    <SourceChooser fileId={fileId} sources={backend?.sources || []} setFileId={fileId => {
      setFileId(fileId);
    }} />
    <ToolbarButton icon='color-mode' title='Toggle color mode' toggled={false} onClick={() => toggleTheme()}></ToolbarButton>
  </Toolbar>;

  const sidebarTabbedPane = <TabbedPane tabs={[actionsTab]} />;
  const traceView = <TraceView
    sdkLanguage={sdkLanguage}
    callId={traceCallId}
    isInspecting={isInspecting}
    setIsInspecting={setIsInspecting}
    highlightedLocator={highlightedLocatorInTrace}
    setHighlightedLocator={locatorPickedInTrace} />;
  const propertiesView = <PropertiesView
    sdkLanguage={sdkLanguage}
    boundaries={boundaries}
    setIsInspecting={setIsInspecting}
    highlightedLocator={highlightedLocatorInProperties}
    setHighlightedLocator={locatorTypedInProperties}
    sourceLocation={sourceLocation} />;

  return <div className='vbox workbench'>
    <SplitView
      sidebarSize={250}
      orientation={'horizontal'}
      settingName='recorderActionListSidebar'
      sidebarIsFirst
      main={<SplitView
        sidebarSize={250}
        orientation='vertical'
        settingName='recorderPropertiesSidebar'
        main={<div className='vbox'>
          {toolbar}
          {traceView}
        </div>}
        sidebar={propertiesView}
      />}
      sidebar={sidebarTabbedPane}
    />
  </div>;
};

const PropertiesView: React.FunctionComponent<{
  sdkLanguage: Language,
  boundaries: Boundaries,
  setIsInspecting: (value: boolean) => void,
  highlightedLocator: string,
  setHighlightedLocator: (locator: string) => void,
  sourceLocation: modelUtil.SourceLocation | undefined,
}> = ({
  sdkLanguage,
  boundaries,
  setIsInspecting,
  highlightedLocator,
  setHighlightedLocator,
  sourceLocation,
}) => {
  const model = React.useContext(ModelContext);
  const consoleModel = useConsoleTabModel(model, boundaries);
  const networkModel = useNetworkTabModel(model, boundaries);
  const sourceModel = React.useRef(new Map<string, modelUtil.SourceModel>());
  const [selectedPropertiesTab, setSelectedPropertiesTab] = useSetting<string>('recorderPropertiesTab', 'source');

  const inspectorTab: TabbedPaneTabModel = {
    id: 'inspector',
    title: 'Locator',
    render: () => <InspectorTab
      showScreenshot={false}
      sdkLanguage={sdkLanguage}
      setIsInspecting={setIsInspecting}
      highlightedLocator={highlightedLocator}
      setHighlightedLocator={setHighlightedLocator} />,
  };

  const sourceTab: TabbedPaneTabModel = {
    id: 'source',
    title: 'Source',
    render: () => <SourceTab
      sources={sourceModel.current}
      stackFrameLocation={'right'}
      fallbackLocation={sourceLocation}
    />
  };
  const consoleTab: TabbedPaneTabModel = {
    id: 'console',
    title: 'Console',
    count: consoleModel.entries.length,
    render: () => <ConsoleTab boundaries={boundaries} consoleModel={consoleModel} />
  };
  const networkTab: TabbedPaneTabModel = {
    id: 'network',
    title: 'Network',
    count: networkModel.resources.length,
    render: () => <NetworkTab boundaries={boundaries} networkModel={networkModel} />
  };

  const tabs: TabbedPaneTabModel[] = [
    sourceTab,
    inspectorTab,
    consoleTab,
    networkTab,
  ];

  return <TabbedPane
    tabs={tabs}
    selectedTab={selectedPropertiesTab}
    setSelectedTab={setSelectedPropertiesTab}
  />;
};

const TraceView: React.FunctionComponent<{
  sdkLanguage: Language,
  callId: string | undefined,
  isInspecting: boolean;
  setIsInspecting: (value: boolean) => void;
  highlightedLocator: string;
  setHighlightedLocator: (locator: string) => void;
}> = ({
  sdkLanguage,
  callId,
  isInspecting,
  setIsInspecting,
  highlightedLocator,
  setHighlightedLocator,
}) => {
  const model = React.useContext(ModelContext);
  const action = React.useMemo(() => {
    return model?.actions.find(a => a.callId === callId);
  }, [model, callId]);

  const snapshot = React.useMemo(() => {
    const snapshot = collectSnapshots(action);
    return snapshot.action || snapshot.after || snapshot.before;
  }, [action]);
  const snapshotUrls = React.useMemo(() => {
    return snapshot ? extendSnapshot(snapshot) : undefined;
  }, [snapshot]);

  return <SnapshotView
    sdkLanguage={sdkLanguage}
    testIdAttributeName='data-testid'
    isInspecting={isInspecting}
    setIsInspecting={setIsInspecting}
    highlightedLocator={highlightedLocator}
    setHighlightedLocator={setHighlightedLocator}
    snapshotUrls={snapshotUrls} />;
};
