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

import { ActionEntry, ContextEntry, TraceModel } from '../../../server/trace/viewer/traceModel';
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

export const Workbench: React.FunctionComponent<{
  contexts: ContextEntry[],
}> = ({ contexts }) => {
  const [context, setContext] = React.useState(contexts[0]);
  const [selectedAction, setSelectedAction] = React.useState<ActionEntry | undefined>();
  const [highlightedAction, setHighlightedAction] = React.useState<ActionEntry | undefined>();
  const [selectedTime, setSelectedTime] = React.useState<number | undefined>();

  const actions = React.useMemo(() => {
    const actions: ActionEntry[] = [];
    for (const page of context.pages)
      actions.push(...page.actions);
    return actions;
  }, [context]);

  const snapshotSize = context.created.viewportSize || { width: 1280, height: 720 };
  const boundaries = { minimum: context.startTime, maximum: context.endTime };
  const snapshotSelection = context.pages.length && selectedTime !== undefined ? { pageId: context.pages[0].created.pageId, time: selectedTime } : undefined;

  return <div className='vbox workbench'>
    <div className='hbox header'>
      <div className='logo'>🎭</div>
      <div className='product'>Playwright</div>
      <div className='spacer'></div>
      <ContextSelector
        contexts={contexts}
        context={context}
        onChange={context => {
          setContext(context);
          setSelectedAction(undefined);
          setSelectedTime(undefined);
        }}
      />
    </div>
    <div style={{ background: 'white', paddingLeft: '20px', flex: 'none' }}>
      <Timeline
        context={context}
        boundaries={boundaries}
        selectedAction={selectedAction}
        highlightedAction={highlightedAction}
        onSelected={action => setSelectedAction(action)}
        onTimeSelected={time => setSelectedTime(time)}
      />
    </div>
    <div className='hbox'>
      <div style={{ display: 'flex', flex: 'none', overflow: 'auto' }}>
        <ActionList
          actions={actions}
          selectedAction={selectedAction}
          highlightedAction={highlightedAction}
          onSelected={action => {
            setSelectedAction(action);
            setSelectedTime(undefined);
          }}
          onHighlighted={action => setHighlightedAction(action)}
        />
      </div>
      <TabbedPane tabs={[
        { id: 'snapshot', title: 'Snapshot', render: () => <SnapshotTab actionEntry={selectedAction} snapshotSize={snapshotSize} selection={snapshotSelection} boundaries={boundaries} /> },
        { id: 'source', title: 'Source', render: () => <SourceTab actionEntry={selectedAction} /> },
        { id: 'network', title: 'Network', render: () => <NetworkTab actionEntry={selectedAction} /> },
        { id: 'logs', title: 'Logs', render: () => <LogsTab actionEntry={selectedAction} /> },
      ]}/>
    </div>
  </div>;
};
