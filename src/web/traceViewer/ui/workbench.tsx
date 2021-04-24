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

import { ActionEntry, ContextEntry } from '../../../server/trace/viewer/traceModel';
import { ActionList } from './actionList';
import { TabbedPane } from './tabbedPane';
import { Timeline } from './timeline';
import './workbench.css';
import * as React from 'react';
import { ContextSelector } from './contextSelector';
import { NetworkTab } from './networkTab';
import { SourceTab } from './sourceTab';
import { SnapshotTab } from './snapshotTab';
import { LogsTab } from './logsTab';
import { SplitView } from '../../components/splitView';
import { useAsyncMemo } from './helpers';


export const Workbench: React.FunctionComponent<{
  debugNames: string[],
}> = ({ debugNames }) => {
  const [debugName, setDebugName] = React.useState(debugNames[0]);
  const [selectedAction, setSelectedAction] = React.useState<ActionEntry | undefined>();
  const [highlightedAction, setHighlightedAction] = React.useState<ActionEntry | undefined>();

  let context = useAsyncMemo(async () => {
    return (await fetch(`/context/${debugName}`).then(response => response.json())) as ContextEntry;
  }, [debugName], emptyContext);

  const actions = React.useMemo(() => {
    const actions: ActionEntry[] = [];
    for (const page of context.pages)
      actions.push(...page.actions);
    actions.sort((a, b) => a.timestamp - b.timestamp);
    return actions;
  }, [context]);

  const snapshotSize = context.created.viewportSize || { width: 1280, height: 720 };
  const boundaries = { minimum: context.startTime, maximum: context.endTime };

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
        <SnapshotTab actionEntry={selectedAction} snapshotSize={snapshotSize} />
        <TabbedPane tabs={[
          { id: 'logs', title: 'Log', render: () => <LogsTab actionEntry={selectedAction} /> },
          { id: 'source', title: 'Source', render: () => <SourceTab actionEntry={selectedAction} /> },
          { id: 'network', title: 'Network', render: () => <NetworkTab actionEntry={selectedAction} /> },
        ]}/>
      </SplitView>
      <ActionList
        actions={actions}
        selectedAction={selectedAction}
        highlightedAction={highlightedAction}
        onSelected={action => {
          setSelectedAction(action);
        }}
        onHighlighted={action => setHighlightedAction(action)}
      />
    </SplitView>
  </div>;
};

const now = performance.now();
const emptyContext: ContextEntry = {
  startTime: now,
  endTime: now,
  created: {
    timestamp: now,
    type: 'context-metadata',
    browserName: '',
    deviceScaleFactor: 1,
    isMobile: false,
    viewportSize: { width: 1280, height: 800 },
    debugName: '<empty>',
  },
  pages: []
};
