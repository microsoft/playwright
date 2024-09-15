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

import { TestServerConnection, WebSocketTestServerTransport } from '@testIsomorphic/testServerConnection';
import { ToolbarButton } from '@web/components/toolbarButton';
import { toggleTheme } from '@web/theme';
import * as React from 'react';
import type { ContextEntry } from '../entries';
import './ideModeView.css';
import type { ActionTraceEventInContext } from './modelUtil';
import { MultiTraceModel } from './modelUtil';
import { Workbench } from './workbench';

export const IDEModeView: React.FunctionComponent = () => {
  const [traceURLs, setTraceURLs] = React.useState<string[]>([]);
  const [model, setModel] = React.useState<MultiTraceModel>(emptyModel);
  const [progress, setProgress] = React.useState<{ done: number, total: number }>({ done: 0, total: 0 });
  const [testServerConnection, setTestServerConnection] = React.useState<TestServerConnection>();

  const selectionChanged = React.useCallback((action: ActionTraceEventInContext) => {
    if (!testServerConnection || !action?.stack || action.stack.length === 0)
      return;
    const [{ file, line, column }] = action.stack;
    testServerConnection.dispatchTraceViewerEventNoReply({ method: 'openSourceLocation', params: { file, line, column } });
  }, [testServerConnection]);

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
          const response = await fetch(`contexts?${params.toString()}`);
          if (!response.ok)
            return;
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
  }, [traceURLs]);

  React.useEffect(() => {
    const guid = new URLSearchParams(window.location.search).get('ws');
    const wsURL = new URL(`../${guid}`, window.location.toString());
    wsURL.protocol = (window.location.protocol === 'https:' ? 'wss:' : 'ws:');
    const testServerConnection = new TestServerConnection(new WebSocketTestServerTransport(wsURL));
    testServerConnection.onLoadTraceRequested(async params => {
      setTraceURLs(params.traceUrl ? [params.traceUrl] : []);
    });
    testServerConnection.dispatchTraceViewerEventNoReply({ method: 'loaded', params: {} });
    setTestServerConnection(testServerConnection);
  }, []);

  return <div className='vbox ide-mode'>
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
    <Workbench model={model} onSelectionChanged={selectionChanged} showSettings excludeSidebarTabs={['source']} />
    {!traceURLs.length && <div className='empty-state'>
      <div className='title'>Select test to see the trace</div>
    </div>}
  </div>;
};

export const emptyModel = new MultiTraceModel([]);
