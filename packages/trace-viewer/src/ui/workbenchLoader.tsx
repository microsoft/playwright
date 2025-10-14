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
import { MultiTraceModel } from './modelUtil';
import './workbenchLoader.css';
import { Workbench } from './workbench';
import { TestServerConnection, WebSocketTestServerTransport } from '@testIsomorphic/testServerConnection';
import { DialogToolbarButton } from '@web/components/dialogToolbarButton';
import { Dialog } from '@web/shared/dialog';
import { DefaultSettingsView } from './defaultSettingsView';
import { TraceModelContext } from './traceModelContext';

export const WorkbenchLoader: React.FunctionComponent<{
}> = () => {
  const [isServer, setIsServer] = React.useState<boolean>(false);
  const [traceURL, setTraceURL] = React.useState<string>();
  const [uploadedTraceName, setUploadedTraceName] = React.useState<string>();
  const [model, setModel] = React.useState<MultiTraceModel>(emptyModel);
  const [progress, setProgress] = React.useState<{ done: number, total: number }>({ done: 0, total: 0 });
  const [dragOver, setDragOver] = React.useState<boolean>(false);
  const [processingErrorMessage, setProcessingErrorMessage] = React.useState<string | null>(null);
  const [fileForLocalModeError, setFileForLocalModeError] = React.useState<string | null>(null);
  const [showProgressDialog, setShowProgressDialog] = React.useState<boolean>(false);

  const processTraceFiles = React.useCallback((files: FileList) => {
    const url = new URL(window.location.href);
    if (!files.length)
      return;
    const file = files.item(0)!;
    const blobTraceURL = URL.createObjectURL(file);
    url.searchParams.append('trace', blobTraceURL);
    const href = url.toString();
    // Snapshot loaders will inherit the trace url from the query parameters,
    // so set it here.
    window.history.pushState({}, '', href);
    setTraceURL(blobTraceURL);
    setUploadedTraceName(file.name);
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
    const url = params.get('trace');
    setIsServer(params.has('isServer'));

    // Don't accept file:// URLs - this means we re opened locally.
    if (url?.startsWith('file:')) {
      setFileForLocalModeError(url || null);
      return;
    }

    if (params.has('isServer')) {
      const guid = new URLSearchParams(window.location.search).get('ws');
      const wsURL = new URL(`../${guid}`, window.location.toString());
      wsURL.protocol = (window.location.protocol === 'https:' ? 'wss:' : 'ws:');
      const testServerConnection = new TestServerConnection(new WebSocketTestServerTransport(wsURL));
      testServerConnection.onLoadTraceRequested(async params => {
        setTraceURL(params.traceUrl);
        setDragOver(false);
        setProcessingErrorMessage(null);
      });
      testServerConnection.initialize({}).catch(() => {});
    } else if (url && !url.startsWith('blob:')) {
      // Don't re-use blob file URLs on page load (results in Fetch error)
      setTraceURL(url);
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      if (!traceURL) {
        setModel(emptyModel);
        return;
      }

      const swListener = (event: any) => {
        if (event.data.method === 'progress')
          setProgress(event.data.params);
      };
      try {
        navigator.serviceWorker.addEventListener('message', swListener);
        setProgress({ done: 0, total: 1 });

        const params = new URLSearchParams();
        params.set('trace', traceURL);
        const response = await fetch(`contexts?${params.toString()}`);
        if (!response.ok) {
          if (!isServer)
            setTraceURL(undefined);
          setProcessingErrorMessage((await response.json()).error);
          return;
        }
        const contextEntries = await response.json();
        const model = new MultiTraceModel(traceURL, contextEntries);
        setProgress({ done: 0, total: 0 });
        setModel(model);
      } finally {
        navigator.serviceWorker.removeEventListener('message', swListener);
      }
    })();
  }, [isServer, traceURL, uploadedTraceName]);

  const showLoading = progress.done !== progress.total && progress.total !== 0 && !processingErrorMessage;

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

  const showFileUploadDropArea = !!(!isServer && !dragOver && !fileForLocalModeError && (!traceURL || processingErrorMessage));

  return <div className='vbox workbench-loader' onDragOver={event => { event.preventDefault(); setDragOver(true); }}>
    <div className='hbox header' {...(showFileUploadDropArea ? { inert: true } : {})}>
      <div className='logo'>
        <img src='playwright-logo.svg' alt='Playwright logo' />
      </div>
      <div className='product'>Playwright</div>
      {model.title && <div className='title'>{model.title}</div>}
      <div className='spacer'></div>
      <DialogToolbarButton icon='settings-gear' title='Settings' dialogDataTestId='settings-toolbar-dialog'>
        <DefaultSettingsView />
      </DialogToolbarButton>
    </div>
    <TraceModelContext.Provider value={model}>
      <Workbench inert={showFileUploadDropArea} />
    </TraceModelContext.Provider>
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
        input.click();
        input.addEventListener('change', e => handleFileInputChange(e));
      }} type='button'>Select file(s)</button>
      <div style={{ maxWidth: 400 }}>Playwright Trace Viewer is a Progressive Web App, it does not send your trace anywhere,
        it opens it locally.</div>
    </div>}
    {isServer && !traceURL && <div className='drop-target'>
      <div className='title'>Select test to see the trace</div>
    </div>}
    {dragOver && <div className='drop-target'
      onDragLeave={() => { setDragOver(false); }}
      onDrop={event => handleDropEvent(event)}>
      <div className='title'>Release to analyse the Playwright Trace</div>
    </div>}
  </div>;
};

export const emptyModel = new MultiTraceModel('', []);
