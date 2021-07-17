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
import { JSONReportSTDIOEntry } from '../../../server/trace/viewer/testModel';
import { ActionList } from './actionList';
import { TabbedPane, TabbedPaneTab } from './tabbedPane';
import { Timeline } from './timeline';
import './workbench.css';
import * as React from 'react';
import { NetworkTab } from './networkTab';
import { SourceTab } from './sourceTab';
import { SnapshotTab } from './snapshotTab';
import { CallTab } from './callTab';
import { SplitView } from '../../components/splitView';
import { highlightANSIText, renderTestStatus, useAsyncMemo } from './helpers';
import { ConsoleTab } from './consoleTab';
import * as modelUtil from './modelUtil';
import { TestReport } from './testReport';

type TraceSelection = {
  tracePath: string | undefined;
  output: JSONReportSTDIOEntry[];
  title: string;
  status: string;
};

export const Workbench: React.FunctionComponent<{
  report: modelUtil.TestReportOrStandalone,
}> = ({ report }) => {
  const [testReportIsVisible, setTestReportIsVisible] = React.useState(!!report.report);
  const [traceSelection, setTraceSelection] = React.useState<TraceSelection | undefined>(report.standalone ? { ...report.standalone, output: [], status: '' } : undefined);
  const [selectedAction, setSelectedAction] = React.useState<ActionTraceEvent | undefined>();
  const [highlightedAction, setHighlightedAction] = React.useState<ActionTraceEvent | undefined>();
  const [selectedRightTab, setSelectedRightTab] = React.useState<string>('logs');
  const [selectedLeftTab, setSelectedLeftTab] = React.useState<string>('actions');

  let context = useAsyncMemo(async () => {
    if (!traceSelection || !traceSelection.tracePath)
      return emptyContext;
    const context = (await fetch(`/context?${traceSelection.tracePath}`).then(response => response.json())) as ContextEntry;
    modelUtil.indexModel(context);
    return context;
  }, [traceSelection], emptyContext);

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

  const leftTabs: TabbedPaneTab[] = [{
    id: 'actions',
    title: 'Actions',
    count: 0,
    render: () => <ActionList
      actions={actions}
      selectedAction={selectedAction}
      highlightedAction={highlightedAction}
      onSelected={action => {
        setSelectedAction(action);
      }}
      onHighlighted={action => setHighlightedAction(action)}
      setSelectedTab={setSelectedRightTab}
    />
  }];
  if (report.report) {
    leftTabs.push({
      id: 'output',
      title: 'Output',
      count: 0,
      render: () => <div className='vbox' style={{ paddingTop: '6px', whiteSpace: 'pre', fontFamily: 'var(--monospace-font)' }}>
        { (traceSelection ? traceSelection.output : []).map((item, index) => <div
          key={index} style={{ padding: '0 0 2px 6px' }}>
          {'text' in item ? highlightANSIText(item.text) : ''}
          {'buffer' in item ? highlightANSIText(btoa(item.buffer)) : ''}
        </div>)}
      </div>,
    });
  }

  return <div className='vbox workbench'>
    <SplitView sidebarSize={300} orientation='horizontal' sidebarIsFirst={true} sidebarHidden={!testReportIsVisible}>
      <div className='vbox'>
        <div className='tab-strip'>
          <div
            className={'tab-element workbench-title' + (report.report && !testReportIsVisible ? ' workbench-title-closed' : '')}
            onClick={() => report.report && setTestReportIsVisible(true)}
          >
            <div className='codicon codicon-chevron-right' style={{ color: 'var(--color)', marginRight: '10px' }} />
            { !testReportIsVisible && <div style={{ marginRight: '10px' }}>🎭</div> }
            <div>{traceSelection?.title}</div>
            {traceSelection?.status && renderTestStatus(traceSelection.status, { marginLeft: '5px', marginTop: '2px' })}
          </div>
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
            ]} selectedTab={selectedRightTab} setSelectedTab={setSelectedRightTab}/>
          </SplitView>
          <TabbedPane tabs={leftTabs} selectedTab={selectedLeftTab} setSelectedTab={setSelectedLeftTab}/>
        </SplitView>
      </div>
      {
        report.report && <TestReport
          report={report.report}
          onSelected={selection => {
            setTraceSelection({
              tracePath: selection.result.data['playwrightTrace'],
              title: selection.title,
              output: [...selection.result.stdout, ...selection.result.stderr],
              status: selection.status,
            });
            setSelectedAction(undefined);
          }}
          onHide={() => setTestReportIsVisible(false)}
        />
      }
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
