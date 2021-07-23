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

import { ActionTraceEvent } from '../../../server/trace/common/traceEvents';
import { ContextEntry } from '../../../server/trace/viewer/traceModel';
import { ActionList } from './actionList';
import { TabbedPane } from './tabbedPane';
import { Timeline } from './timeline';
import './workbench.css';
import * as React from 'react';
import { ContextSelector } from './contextSelector';
import { NetworkTab } from './networkTab';
import { SourceTab } from './sourceTab';
import { SnapshotTab } from './snapshotTab';
import { CallTab } from './callTab';
import { SplitView } from '../../components/splitView';
import { useAsyncMemo } from './helpers';
import { ConsoleTab } from './consoleTab';
import * as modelUtil from './modelUtil';

export const Workbench: React.FunctionComponent<{
  debugNames: string[],
}> = ({ debugNames }) => {
  const [debugName, setDebugName] = React.useState(debugNames[0]);
  const [selectedAction, setSelectedAction] = React.useState<ActionTraceEvent | undefined>();
  const [highlightedAction, setHighlightedAction] = React.useState<ActionTraceEvent | undefined>();
  const [selectedTab, setSelectedTab] = React.useState<string>('logs');

  let context = useAsyncMemo(async () => {
    if (!debugName)
      return emptyContext;
    const context = (await fetch(`/context/${debugName}`).then(response => response.json())) as ContextEntry;
    modelUtil.indexModel(context);
    return context;
  }, [debugName], emptyContext);

  const actions = React.useMemo(() => {
    const actions: ActionTraceEvent[] = [];
    for (const page of context.pages)
      actions.push(...page.actions);
    return actions;
  }, [context]);

  const snapshotSize = context.options.viewport || { width: 1280, height: 720 };
  const boundaries = { minimum: context.startTime, maximum: context.endTime };

  // Leave some nice free space on the right hand side.
  boundaries.maximum += (boundaries.maximum - boundaries.minimum) / 20;
  const { errors, warnings } = selectedAction ? modelUtil.stats(selectedAction) : { errors: 0, warnings: 0 };
  const consoleCount = errors + warnings;
  const networkCount = selectedAction ? modelUtil.resourcesForAction(selectedAction).length : 0;

  return <div className='vbox workbench'>
    <div className='hbox header'>
      <div className='logo'>🎭</div>
      <div className='product'>Playwright</div>
      <div className='spacer'></div>
      <ContextSelector
        debugNames={debugNames}
        debugName={debugName}
        onChange={debugName => {
          setDebugName(debugName);
          setSelectedAction(undefined);
        }}
      />
    </div>
    <div style={{ background: 'white', paddingLeft: '20px', flex: 'none', borderBottom: '1px solid #ddd' }}>
      <Timeline
        context={context}
        boundaries={boundaries}
        selectedAction={selectedAction}
        highlightedAction={highlightedAction}
        onSelected={action => setSelectedAction(action)}
        onHighlighted={action => setHighlightedAction(action)}
      />
    </div>
    <SplitView sidebarSize={300} orientation='horizontal' sidebarIsFirst={true}>
      <SplitView sidebarSize={300} orientation='horizontal'>
        <SnapshotTab action={selectedAction} snapshotSize={snapshotSize} />
        <TabbedPane tabs={[
          { id: 'logs', title: 'Call', count: 0, render: () => <CallTab action={selectedAction} /> },
          { id: 'console', title: 'Console', count: consoleCount, render: () => <ConsoleTab action={selectedAction} /> },
          { id: 'network', title: 'Network', count: networkCount, render: () => <NetworkTab action={selectedAction} /> },
          { id: 'source', title: 'Source', count: 0, render: () => <SourceTab action={selectedAction} /> },
        ]} selectedTab={selectedTab} setSelectedTab={setSelectedTab}/>
      </SplitView>
      <ActionList
        actions={actions}
        selectedAction={selectedAction}
        highlightedAction={highlightedAction}
        onSelected={action => {
          setSelectedAction(action);
        }}
        onHighlighted={action => setHighlightedAction(action)}
        setSelectedTab={setSelectedTab}
      />
    </SplitView>
  </div>;
};

const now = performance.now();
const emptyContext: ContextEntry = {
  startTime: now,
  endTime: now,
  browserName: '',
  options: {
    sdkLanguage: '',
    deviceScaleFactor: 1,
    isMobile: false,
    viewport: { width: 1280, height: 800 },
    _debugName: '<empty>',
  },
  pages: [],
  resources: []
};
