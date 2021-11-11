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
import { msToString } from '../../uiUtils';

export const Workbench: React.FunctionComponent<{
}> = () => {
  const [traceURL, setTraceURL] = React.useState<string>('');
  const [uploadedTraceName, setUploadedTraceName] = React.useState<string|null>(null);
  const [contextEntry, setContextEntry] = React.useState<ContextEntry>(emptyContext);
  const [selectedAction, setSelectedAction] = React.useState<ActionTraceEvent | undefined>();
  const [highlightedAction, setHighlightedAction] = React.useState<ActionTraceEvent | undefined>();
  const [selectedNavigatorTab, setSelectedNavigatorTab] = React.useState<string>('actions');
  const [selectedPropertiesTab, setSelectedPropertiesTab] = React.useState<string>('logs');
  const [progress, setProgress] = React.useState<{ done: number, total: number }>({ done: 0, total: 0 });
  const [dragOver, setDragOver] = React.useState<boolean>(false);
  const [processingErrorMessage, setProcessingErrorMessage] = React.useState<string|null>(null);

  const processTraceFile = (file: File) => {
    const blobTraceURL = URL.createObjectURL(file);
    const url = new URL(window.location.href);
    url.searchParams.set('trace', blobTraceURL);
    url.searchParams.set('traceFileName', file.name);
    const href = url.toString();
    // Snapshot loaders will inherit the trace url from the query parameters,
    // so set it here.
    window.history.pushState({}, '', href);
    setTraceURL(blobTraceURL);
    setUploadedTraceName(file.name);
    setSelectedAction(undefined);
    setDragOver(false);
    setProcessingErrorMessage(null);
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
    const newTraceURL = new URL(window.location.href).searchParams.get('trace');
    // Don't re-use blob file URLs on page load (results in Fetch error)
    if (newTraceURL && !newTraceURL.startsWith('blob:'))
      setTraceURL(newTraceURL);
  }, [setTraceURL]);

  React.useEffect(() => {
    (async () => {
      if (traceURL) {
        const swListener = (event: any) => {
          if (event.data.method === 'progress')
            setProgress(event.data.params);
        };
        navigator.serviceWorker.addEventListener('message', swListener);
        setProgress({ done: 0, total: 1 });
        const params = new URLSearchParams();
        params.set('trace', traceURL);
        if (uploadedTraceName)
          params.set('traceFileName', uploadedTraceName);
        const response = await fetch(`context?${params.toString()}`);
        if (!response.ok) {
          setTraceURL('');
          setProcessingErrorMessage((await response.json()).error);
          return;
        }
        const contextEntry = await response.json() as ContextEntry;
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
        <TabbedPane tabs={tabs} selectedTab={selectedPropertiesTab} setSelectedTab={setSelectedPropertiesTab}/>
      </SplitView>
      <TabbedPane tabs={
        [
          { id: 'actions', title: 'Actions', count: 0, render: () => <ActionList
            actions={contextEntry.actions}
            selectedAction={selectedAction}
            highlightedAction={highlightedAction}
            onSelected={action => {
              setSelectedAction(action);
            }}
            onHighlighted={action => setHighlightedAction(action)}
            setSelectedTab={setSelectedPropertiesTab}
          /> },
          { id: 'metadata', title: 'Metadata', count: 0, render: () => <div className='vbox'>
            <div className='call-section' style={{ paddingTop: 2 }}>Time</div>
            {contextEntry.wallTime && <div className='call-line'>start time: <span className='datetime' title={new Date(contextEntry.wallTime).toLocaleString()}>{new Date(contextEntry.wallTime).toLocaleString()}</span></div>}
            <div className='call-line'>duration: <span className='number' title={msToString(contextEntry.endTime - contextEntry.startTime)}>{msToString(contextEntry.endTime - contextEntry.startTime)}</span></div>
            <div className='call-section'>Browser</div>
            <div className='call-line'>engine: <span className='string' title={contextEntry.browserName}>{contextEntry.browserName}</span></div>
            {contextEntry.platform && <div className='call-line'>platform: <span className='string' title={contextEntry.platform}>{contextEntry.platform}</span></div>}
            {contextEntry.options.userAgent && <div className='call-line'>user agent: <span className='datetime' title={contextEntry.options.userAgent}>{contextEntry.options.userAgent}</span></div>}
            <div className='call-section'>Viewport</div>
            {contextEntry.options.viewport && <div className='call-line'>width: <span className='number' title={String(!!contextEntry.options.viewport?.width)}>{contextEntry.options.viewport.width}</span></div>}
            {contextEntry.options.viewport && <div className='call-line'>height: <span className='number' title={String(!!contextEntry.options.viewport?.height)}>{contextEntry.options.viewport.height}</span></div>}
            <div className='call-line'>is mobile: <span className='boolean' title={String(!!contextEntry.options.isMobile)}>{String(!!contextEntry.options.isMobile)}</span></div>
            {contextEntry.options.deviceScaleFactor && <div className='call-line'>device scale: <span className='number' title={String(contextEntry.options.deviceScaleFactor)}>{String(contextEntry.options.deviceScaleFactor)}</span></div>}
            <div className='call-section'>Counts</div>
            <div className='call-line'>pages: <span className='number'>{contextEntry.pages.length}</span></div>
            <div className='call-line'>actions: <span className='number'>{contextEntry.actions.length}</span></div>
            <div className='call-line'>events: <span className='number'>{contextEntry.events.length}</span></div>
          </div> },
        ]
      } selectedTab={selectedNavigatorTab} setSelectedTab={setSelectedNavigatorTab}/>
    </SplitView>
    {!!progress.total && <div className='progress'>
      <div className='inner-progress' style={{ width: (100 * progress.done / progress.total) + '%' }}></div>
    </div>}
    {!dragOver && (!traceURL || processingErrorMessage) && <div className='drop-target'>
      <div className='processing-error'>{processingErrorMessage}</div>
      <div className='title'>Drop Playwright Trace to load</div>
      <div>or</div>
      <button onClick={() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.click();
        input.addEventListener('change', e => handleFileInputChange(e));
      }}>Select file</button>
      <div style={{ maxWidth: 400 }}>Playwright Trace Viewer is a Progressive Web App, it does not send your trace anywhere,
        it opens it locally.</div>
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
