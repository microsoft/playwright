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

import * as React from 'react';
import type { ContextEntry } from '../types/entries';
import { MultiTraceModel } from './modelUtil';
import './workbenchLoader.css';
import { Workbench } from './workbench';
import { TestServerConnection, WebSocketTestServerTransport } from '@testIsomorphic/testServerConnection';
import { SettingsToolbarButton } from './settingsToolbarButton';
import { Dialog } from './shared/dialog';

export const WorkbenchLoader: React.FunctionComponent<{
}> = () => {
  const [isServer, setIsServer] = React.useState<boolean>(false);
  const [traceURLs, setTraceURLs] = React.useState<string[]>([]);
  const [uploadedTraceNames, setUploadedTraceNames] = React.useState<string[]>([]);
  const [model, setModel] = React.useState<MultiTraceModel>(emptyModel);
  const [progress, setProgress] = React.useState<{ done: number, total: number }>({ done: 0, total: 0 });
  const [dragOver, setDragOver] = React.useState<boolean>(false);
  const [processingErrorMessage, setProcessingErrorMessage] = React.useState<string | null>(null);
  const [fileForLocalModeError, setFileForLocalModeError] = React.useState<string | null>(null);
  const [showProgressDialog, setShowProgressDialog] = React.useState<boolean>(false);

  const processTraceFiles = React.useCallback((files: FileList) => {
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
  }, []);

  React.useEffect(() => {
    const listener = async (e: ClipboardEvent) => {
      if (!e.clipboardData?.files.length)
        return;
      for (const file of e.clipboardData.files) {
        if (file.type !== 'application/zip')
          return;
      }
      e.preventDefault();
      processTraceFiles(e.clipboardData.files);
    };
    document.addEventListener('paste', listener);
    return () => document.removeEventListener('paste', listener);
  });
  React.useEffect(() => {
    const listener = (e: MessageEvent) => {
      const { method, params } = e.data;

      if (method !== 'load' || !(params?.trace instanceof Blob))
        return;

      const traceFile = new File([params.trace], 'trace.zip', { type: 'application/zip' });
      const dataTransfer = new DataTransfer();

      dataTransfer.items.add(traceFile);

      processTraceFiles(dataTransfer.files);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  });

  const handleDropEvent = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    processTraceFiles(event.dataTransfer.files);
  }, [processTraceFiles]);

  const handleFileInputChange = React.useCallback((event: any) => {
    event.preventDefault();
    if (!event.target.files)
      return;
    processTraceFiles(event.target.files);
  }, [processTraceFiles]);

  React.useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    const newTraceURLs = params.getAll('trace');
    setIsServer(params.has('isServer'));

    // Don't accept file:// URLs - this means we re opened locally.
    for (const url of newTraceURLs) {
      if (url.startsWith('file:')) {
        setFileForLocalModeError(url || null);
        return;
      }
    }

    if (params.has('isServer')) {
      const guid = new URLSearchParams(window.location.search).get('ws');
      const wsURL = new URL(`../${guid}`, window.location.toString());
      wsURL.protocol = (window.location.protocol === 'https:' ? 'wss:' : 'ws:');
      const testServerConnection = new TestServerConnection(new WebSocketTestServerTransport(wsURL));
      testServerConnection.onLoadTraceRequested(async params => {
        setTraceURLs(params.traceUrl ? [params.traceUrl] : []);
        setDragOver(false);
        setProcessingErrorMessage(null);
      });
      testServerConnection.initialize({}).catch(() => {});
    } else if (!newTraceURLs.some(url => url.startsWith('blob:'))) {
      // Don't re-use blob file URLs on page load (results in Fetch error)
      setTraceURLs(newTraceURLs);
    }
  }, []);

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
          params.set('limit', String(traceURLs.length));
          const response = await fetch(`contexts?${params.toString()}`);
          if (!response.ok) {
            if (!isServer)
              setTraceURLs([]);
            setProcessingErrorMessage((await response.json()).error);
            return;
          }
          contextEntries.push(...(await response.json()));
        }
        navigator.serviceWorker.removeEventListener('message', swListener);
        const model = new MultiTraceModel(contextEntries);
        setProgress({ done: 0, total: 0 });
        setModel(model);
      } else {
        setModel(emptyModel);
      }
    })();
  }, [isServer, traceURLs, uploadedTraceNames]);

  const showLoading = progress.done !== progress.total && progress.total !== 0;

  React.useEffect(() => {
    if (showLoading) {
      const timeout = setTimeout(() => {
        setShowProgressDialog(true);
      }, 200);

      return () => clearTimeout(timeout);
    } else {
      setShowProgressDialog(false);
    }
  }, [showLoading]);

  const showFileUploadDropArea = !!(!isServer && !dragOver && !fileForLocalModeError && (!traceURLs.length || processingErrorMessage));

  return <div className='vbox workbench-loader' onDragOver={event => { event.preventDefault(); setDragOver(true); }}>
    <div className='hbox header' {...(showFileUploadDropArea ? { inert: 'true' } : {})}>
      <div className='logo'>
        <img src='playwright-logo.svg' alt='Playwright logo' />
      </div>
      <div className='product'>Playwright</div>
      {model.title && <div className='title'>{model.title}</div>}
      <div className='spacer'></div>
      <SettingsToolbarButton />
    </div>
    <Workbench model={model} inert={showFileUploadDropArea} />
    {fileForLocalModeError && <div className='drop-target'>
      <div>Trace Viewer uses Service Workers to show traces. To view trace:</div>
      <div style={{ paddingTop: 20 }}>
        <div>1. Click <a href={fileForLocalModeError}>here</a> to put your trace into the download shelf</div>
        <div>2. Go to <a href='https://trace.playwright.dev'>trace.playwright.dev</a></div>
        <div>3. Drop the trace from the download shelf into the page</div>
      </div>
    </div>}
    <Dialog open={showProgressDialog} isModal={true} className='progress-dialog'>
      <div className='progress-content'>
        <div className='title' role='heading' aria-level={1}>Loading Playwright Trace...</div>
        <div className='progress-wrapper'>
          <div className='inner-progress' style={{ width: progress.total ? (100 * progress.done / progress.total) + '%' : 0 }}></div>
        </div>
      </div>
    </Dialog>
    {showFileUploadDropArea && <div className='drop-target'>
      <div className='processing-error' role='alert'>{processingErrorMessage}</div>
      <div className='title' role='heading' aria-level={1}>Drop Playwright Trace to load</div>
      <div>or</div>
      <button onClick={() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.click();
        input.addEventListener('change', e => handleFileInputChange(e));
      }} type='button'>Select file(s)</button>
      <div style={{ maxWidth: 400 }}>Playwright Trace Viewer is a Progressive Web App, it does not send your trace anywhere,
        it opens it locally.</div>
    </div>}
    {isServer && !traceURLs.length && <div className='drop-target'>
      <div className='title'>Select test to see the trace</div>
    </div>}
    {dragOver && <div className='drop-target'
      onDragLeave={() => { setDragOver(false); }}
      onDrop={event => handleDropEvent(event)}>
      <div className='title'>Release to analyse the Playwright Trace</div>
    </div>}
  </div>;
};

export const emptyModel = new MultiTraceModel([]);
