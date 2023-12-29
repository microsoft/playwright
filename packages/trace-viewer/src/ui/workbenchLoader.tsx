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

import { ToolbarButton } from '@web/components/toolbarButton';
import * as React from 'react';
import type { ContextEntry } from '../entries';
import { MultiTraceModel } from './modelUtil';
import './workbenchLoader.css';
import { toggleTheme } from '@web/theme';
import { Workbench } from './workbench';
import { connect } from './wsPort';

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
      connect({
        onEvent(method: string, params?: any) {
          if (method === 'loadTrace') {
            setTraceURLs(params!.url ? [params!.url] : []);
            setDragOver(false);
            setProcessingErrorMessage(null);
          }
        },
        onClose() {}
      }).then(sendMessage => {
        sendMessage('ready');
      });
    } else if (!newTraceURLs.some(url => url.startsWith('blob:'))) {
      // Don't re-use blob file URLs on page load (results in Fetch error)
      setTraceURLs(newTraceURLs);
    }
  }, []);

  // Theme setter
  React.useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    const desiredTheme = params.get("theme");
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");

    if (
      desiredTheme === "dark-mode" ||
      (desiredTheme === undefined && prefersDarkScheme.matches)
    ) {
      document.body.classList.add("dark-mode");
    }
  }, [window.location.href]);

  const showTitle = React.useMemo(() => {
    const params = new URL(window.location.href).searchParams;
    return params.has("showTitle");
  }, [window.location.href]);

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

  return <div className='vbox workbench-loader' onDragOver={event => { event.preventDefault(); setDragOver(true); }}>
    <div className='hbox header'>
      <div className='logo'>
        <img src='playwright-logo.svg' alt='Playwright logo' />
      </div>
      <div className='product'>Playwright</div>
      {model.title && <div className='title'>{model.title}</div>}
      <div className='spacer'></div>
      <ToolbarButton icon='color-mode' title='Toggle color mode' toggled={false} onClick={() => toggleTheme()}></ToolbarButton>
    </div>
    <div className='progress'>
      <div className='inner-progress' style={{ width: progress.total ? (100 * progress.done / progress.total) + '%' : 0 }}></div>
    </div>
    <Workbench model={model} />
    {fileForLocalModeError && <div className='drop-target'>
      <div>Trace Viewer uses Service Workers to show traces. To view trace:</div>
      <div style={{ paddingTop: 20 }}>
        <div>1. Click <a href={fileForLocalModeError}>here</a> to put your trace into the download shelf</div>
        <div>2. Go to <a href='https://trace.playwright.dev'>trace.playwright.dev</a></div>
        <div>3. Drop the trace from the download shelf into the page</div>
      </div>
    </div>}
    {!isServer && !dragOver && !fileForLocalModeError && (!traceURLs.length || processingErrorMessage) && <div className='drop-target'>
      <div className='processing-error'>{processingErrorMessage}</div>
      <div className='title'>Drop Playwright Trace to load</div>
      <div>or</div>
      <button onClick={() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.click();
        input.addEventListener('change', e => handleFileInputChange(e));
      }}>Select file(s)</button>
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
