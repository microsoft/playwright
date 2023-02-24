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

import type { ActionTraceEvent } from '@trace/trace';
import { SplitView } from '@web/components/splitView';
import { msToString } from '@web/uiUtils';
import { ToolbarButton } from '@web/components/toolbarButton';
import * as React from 'react';
import type { ContextEntry } from '../entries';
import { ActionList } from './actionList';
import { CallTab } from './callTab';
import { ConsoleTab } from './consoleTab';
import * as modelUtil from './modelUtil';
import { MultiTraceModel } from './modelUtil';
import { NetworkTab } from './networkTab';
import { SnapshotTab } from './snapshotTab';
import { SourceTab } from './sourceTab';
import { TabbedPane } from '@web/components/tabbedPane';
import { Timeline } from './timeline';
import './workbench.css';
import { toggleTheme } from '@web/theme';

export const WorkbenchLoader: React.FunctionComponent<{
}> = () => {
  const [traceURLs, setTraceURLs] = React.useState<string[]>([]);
  const [uploadedTraceNames, setUploadedTraceNames] = React.useState<string[]>([]);
  const [model, setModel] = React.useState<MultiTraceModel>(emptyModel);
  const [progress, setProgress] = React.useState<{ done: number, total: number }>({ done: 0, total: 0 });
  const [dragOver, setDragOver] = React.useState<boolean>(false);
  const [processingErrorMessage, setProcessingErrorMessage] = React.useState<string | null>(null);
  const [fileForLocalModeError, setFileForLocalModeError] = React.useState<string | null>(null);

  const processTraceFiles = (files: FileList) => {
    const blobUrls = [];
    const fileNames = [];
    const url = new URL(window.location.href);
    for (let i = 0; i < files.length; i++) {
      const file = files.item(i);
      if (!file)
        continue;
      const blobTraceURL = URL.createObjectURL(file);
      blobUrls.push(blobTraceURL);
      fileNames.push(file.name);
      url.searchParams.append('trace', blobTraceURL);
      url.searchParams.append('traceFileName', file.name);
    }
    const href = url.toString();
    // Snapshot loaders will inherit the trace url from the query parameters,
    // so set it here.
    window.history.pushState({}, '', href);
    setTraceURLs(blobUrls);
    setUploadedTraceNames(fileNames);
    setDragOver(false);
    setProcessingErrorMessage(null);
  };

  const handleDropEvent = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    processTraceFiles(event.dataTransfer.files);
  };

  const handleFileInputChange = (event: any) => {
    event.preventDefault();
    if (!event.target.files)
      return;
    processTraceFiles(event.target.files);
  };

  React.useEffect(() => {
    const newTraceURLs = new URL(window.location.href).searchParams.getAll('trace');
    // Don't accept file:// URLs - this means we re opened locally.
    for (const url of newTraceURLs) {
      if (url.startsWith('file:')) {
        setFileForLocalModeError(url || null);
        return;
      }
    }

    // Don't re-use blob file URLs on page load (results in Fetch error)
    if (!newTraceURLs.some(url => url.startsWith('blob:')))
      setTraceURLs(newTraceURLs);
  }, [setTraceURLs]);

  React.useEffect(() => {
    (async () => {
      if (traceURLs.length) {
        const swListener = (event: any) => {
          if (event.data.method === 'progress')
            setProgress(event.data.params);
        };
        navigator.serviceWorker.addEventListener('message', swListener);
        setProgress({ done: 0, total: 1 });
        const contextEntries: ContextEntry[] = [];
        for (let i = 0; i < traceURLs.length; i++) {
          const url = traceURLs[i];
          const params = new URLSearchParams();
          params.set('trace', url);
          if (uploadedTraceNames.length)
            params.set('traceFileName', uploadedTraceNames[i]);
          const response = await fetch(`context?${params.toString()}`);
          if (!response.ok) {
            setTraceURLs([]);
            setProcessingErrorMessage((await response.json()).error);
            return;
          }
          const contextEntry = await response.json() as ContextEntry;
          contextEntries.push(contextEntry);
        }
        navigator.serviceWorker.removeEventListener('message', swListener);
        const model = new MultiTraceModel(contextEntries);
        setProgress({ done: 0, total: 0 });
        setModel(model);
      } else {
        setModel(emptyModel);
      }
    })();
  }, [traceURLs, uploadedTraceNames]);

  return <div className='vbox workbench' onDragOver={event => { event.preventDefault(); setDragOver(true); }}>
    <div className='hbox header'>
      <div className='logo'>🎭</div>
      <div className='product'>Playwright</div>
      {model.title && <div className='title'>{model.title}</div>}
      <div className='spacer'></div>
      <ToolbarButton icon='color-mode' title='Toggle color mode' toggled={false} onClick={() => toggleTheme()}></ToolbarButton>
    </div>
    <Workbench model={model} view='standalone'></Workbench>
    {!!progress.total && <div className='progress'>
      <div className='inner-progress' style={{ width: (100 * progress.done / progress.total) + '%' }}></div>
    </div>}
    {fileForLocalModeError && <div className='drop-target'>
      <div>Trace Viewer uses Service Workers to show traces. To view trace:</div>
      <div style={{ paddingTop: 20 }}>
        <div>1. Click <a href={fileForLocalModeError}>here</a> to put your trace into the download shelf</div>
        <div>2. Go to <a href='https://trace.playwright.dev'>trace.playwright.dev</a></div>
        <div>3. Drop the trace from the download shelf into the page</div>
      </div>
    </div>}
    {!dragOver && !fileForLocalModeError && (!traceURLs.length || processingErrorMessage) && <div className='drop-target'>
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

export const Workbench: React.FunctionComponent<{
  model: MultiTraceModel,
  view: 'embedded' | 'standalone'
}> = ({ model, view }) => {
  const [selectedAction, setSelectedAction] = React.useState<ActionTraceEvent | undefined>();
  const [highlightedAction, setHighlightedAction] = React.useState<ActionTraceEvent | undefined>();
  const [selectedNavigatorTab, setSelectedNavigatorTab] = React.useState<string>('actions');
  const [selectedPropertiesTab, setSelectedPropertiesTab] = React.useState<string>('logs');

  const activeAction = highlightedAction || selectedAction;
  const boundaries = { minimum: model.startTime, maximum: model.endTime };

  // Leave some nice free space on the right hand side.
  boundaries.maximum += (boundaries.maximum - boundaries.minimum) / 20;
  const { errors, warnings } = activeAction ? modelUtil.stats(activeAction) : { errors: 0, warnings: 0 };
  const consoleCount = errors + warnings;
  const networkCount = activeAction ? modelUtil.resourcesForAction(activeAction).length : 0;

  const tabs = [
    { id: 'logs', title: 'Call', count: 0, render: () => <CallTab action={activeAction} sdkLanguage={model.sdkLanguage} /> },
    { id: 'console', title: 'Console', count: consoleCount, render: () => <ConsoleTab action={activeAction} /> },
    { id: 'network', title: 'Network', count: networkCount, render: () => <NetworkTab action={activeAction} /> },
  ];

  if (model.hasSource)
    tabs.push({ id: 'source', title: 'Source', count: 0, render: () => <SourceTab action={selectedAction} /> });

  return <div className='vbox'>
    <div style={{ paddingLeft: '20px', flex: 'none', borderBottom: '1px solid var(--vscode-panel-border)' }}>
      <Timeline
        context={model}
        boundaries={boundaries}
        selectedAction={activeAction}
        onSelected={action => setSelectedAction(action)}
      />
    </div>
    <SplitView sidebarSize={300} orientation='horizontal' sidebarIsFirst={true}>
      <SplitView sidebarSize={300} orientation='vertical'>
        <SnapshotTab action={activeAction} sdkLanguage={model.sdkLanguage || 'javascript'} testIdAttributeName={model.testIdAttributeName || 'data-testid'} />
        <TabbedPane tabs={tabs} selectedTab={selectedPropertiesTab} setSelectedTab={setSelectedPropertiesTab}/>
      </SplitView>
      <TabbedPane tabs={
        [
          { id: 'actions', title: 'Actions', count: 0, render: () => <ActionList
            sdkLanguage={model.sdkLanguage}
            actions={model.actions}
            selectedAction={selectedAction}
            onSelected={action => {
              setSelectedAction(action);
            }}
            onHighlighted={action => {
              setHighlightedAction(action);
            }}
            setSelectedTab={setSelectedPropertiesTab}
          /> },
          { id: 'metadata', title: 'Metadata', count: 0, render: () => <div className='vbox'>
            <div className='call-section' style={{ paddingTop: 2 }}>Time</div>
            {model.wallTime && <div className='call-line'>start time:<span className='call-value datetime' title={new Date(model.wallTime).toLocaleString()}>{new Date(model.wallTime).toLocaleString()}</span></div>}
            <div className='call-line'>duration:<span className='call-value number' title={msToString(model.endTime - model.startTime)}>{msToString(model.endTime - model.startTime)}</span></div>
            <div className='call-section'>Browser</div>
            <div className='call-line'>engine:<span className='call-value string' title={model.browserName}>{model.browserName}</span></div>
            {model.platform && <div className='call-line'>platform:<span className='call-value string' title={model.platform}>{model.platform}</span></div>}
            {model.options.userAgent && <div className='call-line'>user agent:<span className='call-value datetime' title={model.options.userAgent}>{model.options.userAgent}</span></div>}
            <div className='call-section'>Viewport</div>
            {model.options.viewport && <div className='call-line'>width:<span className='call-value number' title={String(!!model.options.viewport?.width)}>{model.options.viewport.width}</span></div>}
            {model.options.viewport && <div className='call-line'>height:<span className='call-value number' title={String(!!model.options.viewport?.height)}>{model.options.viewport.height}</span></div>}
            <div className='call-line'>is mobile:<span className='call-value boolean' title={String(!!model.options.isMobile)}>{String(!!model.options.isMobile)}</span></div>
            {model.options.deviceScaleFactor && <div className='call-line'>device scale:<span className='call-value number' title={String(model.options.deviceScaleFactor)}>{String(model.options.deviceScaleFactor)}</span></div>}
            <div className='call-section'>Counts</div>
            <div className='call-line'>pages:<span className='call-value number'>{model.pages.length}</span></div>
            <div className='call-line'>actions:<span className='call-value number'>{model.actions.length}</span></div>
            <div className='call-line'>events:<span className='call-value number'>{model.events.length}</span></div>
          </div> },
        ]
      } selectedTab={selectedNavigatorTab} setSelectedTab={setSelectedNavigatorTab}/>
    </SplitView>
  </div>;
};

export const emptyModel = new MultiTraceModel([]);

export async function loadSingleTraceFile(url: string): Promise<MultiTraceModel> {
  const params = new URLSearchParams();
  params.set('trace', url);
  const response = await fetch(`context?${params.toString()}`);
  const contextEntry = await response.json() as ContextEntry;
  return new MultiTraceModel([contextEntry]);
}
