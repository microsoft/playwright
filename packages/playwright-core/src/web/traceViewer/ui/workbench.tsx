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
import { ContextEntry, createEmptyContext } from '../entries';
import { ActionList } from './actionList';
import { TabbedPane } from './tabbedPane';
import { Timeline } from './timeline';
import './workbench.css';
import * as React from 'react';
import { NetworkTab } from './networkTab';
import { SourceTab } from './sourceTab';
import { SnapshotTab } from './snapshotTab';
import { CallTab } from './callTab';
import { SplitView } from '../../components/splitView';
import { ConsoleTab } from './consoleTab';
import * as modelUtil from './modelUtil';

export const Workbench: React.FunctionComponent<{
}> = () => {
  const [traceURL, setTraceURL] = React.useState<string>(new URL(window.location.href).searchParams.get('trace')!);
  const [contextEntry, setContextEntry] = React.useState<ContextEntry>(emptyContext);
  const [selectedAction, setSelectedAction] = React.useState<ActionTraceEvent | undefined>();
  const [highlightedAction, setHighlightedAction] = React.useState<ActionTraceEvent | undefined>();
  const [selectedTab, setSelectedTab] = React.useState<string>('logs');
  const [progress, setProgress] = React.useState<{ done: number, total: number }>({ done: 0, total: 0 });
  const [dragOver, setDragOver] = React.useState<boolean>(false);

  const processTraceFile = (file: File) => {
    const blobTraceURL = URL.createObjectURL(file);
    const url = new URL(window.location.href);
    url.searchParams.set('trace', blobTraceURL);
    const href = url.toString();
    // Snapshot loaders will inherit the trace url from the query parameters,
    // so set it here.
    window.history.pushState({}, '', href);
    setTraceURL(blobTraceURL);
    setDragOver(false);
  };

  const handleDropEvent = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    processTraceFile(event.dataTransfer.files[0]);
  };

  const handleFileInputChange = (event: any) => {
    event.preventDefault();
    if (!event.target.files)
      return;
    processTraceFile(event.target.files[0]);
  };

  React.useEffect(() => {
    (async () => {
      if (traceURL) {
        const swListener = (event: any) => {
          if (event.data.method === 'progress')
            setProgress(event.data.params);
        };
        navigator.serviceWorker.addEventListener('message', swListener);
        setProgress({ done: 0, total: 1 });
        const contextEntry = (await fetch(`context?trace=${traceURL}`).then(response => response.json())) as ContextEntry;
        navigator.serviceWorker.removeEventListener('message', swListener);
        setProgress({ done: 0, total: 0 });
        modelUtil.indexModel(contextEntry);
        setContextEntry(contextEntry);
      } else {
        setContextEntry(emptyContext);
      }
    })();
  }, [traceURL]);

  const defaultSnapshotInfo = { viewport: contextEntry.options.viewport || { width: 1280, height: 720 }, url: '' };
  const boundaries = { minimum: contextEntry.startTime, maximum: contextEntry.endTime };


  // Leave some nice free space on the right hand side.
  boundaries.maximum += (boundaries.maximum - boundaries.minimum) / 20;
  const { errors, warnings } = selectedAction ? modelUtil.stats(selectedAction) : { errors: 0, warnings: 0 };
  const consoleCount = errors + warnings;
  const networkCount = selectedAction ? modelUtil.resourcesForAction(selectedAction).length : 0;

  const tabs = [
    { id: 'logs', title: 'Call', count: 0, render: () => <CallTab action={selectedAction} /> },
    { id: 'console', title: 'Console', count: consoleCount, render: () => <ConsoleTab action={selectedAction} /> },
    { id: 'network', title: 'Network', count: networkCount, render: () => <NetworkTab action={selectedAction} /> },
  ];

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    tabs.push({ id: 'source', title: 'Source', count: 0, render: () => <SourceTab action={selectedAction} /> });

  return <div className='vbox workbench' onDragOver={event => { event.preventDefault(); setDragOver(true); }}>
    <div className='hbox header'>
      <div className='logo'>🎭</div>
      <div className='product'>Playwright</div>
      {contextEntry.title && <div className='title'>{contextEntry.title}</div>}
      <div className='spacer'></div>
    </div>
    <div style={{ background: 'white', paddingLeft: '20px', flex: 'none', borderBottom: '1px solid #ddd' }}>
      <Timeline
        context={contextEntry}
        boundaries={boundaries}
        selectedAction={selectedAction}
        highlightedAction={highlightedAction}
        onSelected={action => setSelectedAction(action)}
        onHighlighted={action => setHighlightedAction(action)}
      />
    </div>
    <SplitView sidebarSize={300} orientation='horizontal' sidebarIsFirst={true}>
      <SplitView sidebarSize={300} orientation='horizontal'>
        <SnapshotTab action={selectedAction} defaultSnapshotInfo={defaultSnapshotInfo} />
        <TabbedPane tabs={tabs} selectedTab={selectedTab} setSelectedTab={setSelectedTab}/>
      </SplitView>
      <ActionList
        actions={contextEntry.actions}
        selectedAction={selectedAction}
        highlightedAction={highlightedAction}
        onSelected={action => {
          setSelectedAction(action);
        }}
        onHighlighted={action => setHighlightedAction(action)}
        setSelectedTab={setSelectedTab}
      />
    </SplitView>
    {!!progress.total && <div className='progress'>
      <div className='inner-progress' style={{ width: (100 * progress.done / progress.total) + '%' }}></div>
    </div>}
    {!dragOver && !traceURL && <div className='drop-target'>
      <div className='title'>Drop Playwright Trace to load</div>
      <button onClick={() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.click();
        input.addEventListener('change', e => handleFileInputChange(e));
      }}>...or select file</button>
      <div>Playwright Trace Viewer is a progressive web app, it does not send your trace anywhere,
        it opens it locally instead.</div>
    </div>}
    {dragOver && <div className='drop-target'
      onDragLeave={() => { setDragOver(false); }}
      onDrop={event => handleDropEvent(event)}>
      <div className='title'>Release to analyse the Playwright Trace</div>
    </div>}
  </div>;
};

const emptyContext = createEmptyContext();
emptyContext.startTime = performance.now();
emptyContext.endTime = emptyContext.startTime;
