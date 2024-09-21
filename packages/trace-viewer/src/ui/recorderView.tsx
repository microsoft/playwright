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
import './recorderView.css';
import { MultiTraceModel } from './modelUtil';
import type { SourceLocation } from './modelUtil';
import { Workbench } from './workbench';
import type { Mode, Source } from '@recorder/recorderTypes';
import type { ContextEntry } from '../entries';
import { emptySource, SourceChooser } from '@web/components/sourceChooser';
import { Toolbar } from '@web/components/toolbar';
import { ToolbarButton, ToolbarSeparator } from '@web/components/toolbarButton';
import { toggleTheme } from '@web/theme';

const searchParams = new URLSearchParams(window.location.search);
const guid = searchParams.get('ws');
const trace = searchParams.get('trace') + '.json';

export const RecorderView: React.FunctionComponent = () => {
  const [connection, setConnection] = React.useState<Connection | null>(null);
  const [sources, setSources] = React.useState<Source[]>([]);
  const [mode, setMode] = React.useState<Mode>('none');
  const [fileId, setFileId] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (!fileId && sources.length > 0)
      setFileId(sources[0].id);
  }, [fileId, sources]);

  const source = React.useMemo(() => {
    if (fileId) {
      const source = sources.find(s => s.id === fileId);
      if (source)
        return source;
    }
    return emptySource();
  }, [sources, fileId]);

  React.useEffect(() => {
    const wsURL = new URL(`../${guid}`, window.location.toString());
    wsURL.protocol = (window.location.protocol === 'https:' ? 'wss:' : 'ws:');
    const webSocket = new WebSocket(wsURL.toString());
    setConnection(new Connection(webSocket, { setSources, setMode }));
    return () => {
      webSocket.close();
    };
  }, []);

  return <div className='vbox workbench-loader'>
    <Toolbar>
      <ToolbarButton icon='circle-large-filled' title='Record' toggled={mode === 'recording' || mode === 'recording-inspecting' || mode === 'assertingText' || mode === 'assertingVisibility'} onClick={() => {
        connection?.setMode(mode === 'none' || mode === 'standby' || mode === 'inspecting' ? 'recording' : 'standby');
      }}>Record</ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton icon='inspect' title='Pick locator' toggled={mode === 'inspecting' || mode === 'recording-inspecting'} onClick={() => {
        const newMode = ({
          'inspecting': 'standby',
          'none': 'inspecting',
          'standby': 'inspecting',
          'recording': 'recording-inspecting',
          'recording-inspecting': 'recording',
          'assertingText': 'recording-inspecting',
          'assertingVisibility': 'recording-inspecting',
          'assertingValue': 'recording-inspecting',
        } as Record<string, Mode>)[mode];
        connection?.setMode(newMode);
      }}></ToolbarButton>
      <ToolbarButton icon='eye' title='Assert visibility' toggled={mode === 'assertingVisibility'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        connection?.setMode(mode === 'assertingVisibility' ? 'recording' : 'assertingVisibility');
      }}></ToolbarButton>
      <ToolbarButton icon='whole-word' title='Assert text' toggled={mode === 'assertingText'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        connection?.setMode(mode === 'assertingText' ? 'recording' : 'assertingText');
      }}></ToolbarButton>
      <ToolbarButton icon='symbol-constant' title='Assert value' toggled={mode === 'assertingValue'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        connection?.setMode(mode === 'assertingValue' ? 'recording' : 'assertingValue');
      }}></ToolbarButton>
      <ToolbarSeparator />
      <div style={{ flex: 'auto' }}></div>
      <div>Target:</div>
      <SourceChooser fileId={fileId} sources={sources} setFileId={fileId => {
        setFileId(fileId);
      }} />
      <ToolbarButton icon='clear-all' title='Clear' disabled={!source || !source.text} onClick={() => {
      }}></ToolbarButton>
      <ToolbarButton icon='color-mode' title='Toggle color mode' toggled={false} onClick={() => toggleTheme()}></ToolbarButton>
    </Toolbar>
    <TraceView
      traceLocation={trace}
      source={source} />
  </div>;
};

export const TraceView: React.FC<{
  traceLocation: string,
  source: Source | undefined,
}> = ({ traceLocation, source }) => {
  const [model, setModel] = React.useState<{ model: MultiTraceModel, isLive: boolean } | undefined>();
  const [counter, setCounter] = React.useState(0);
  const pollTimer = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (pollTimer.current)
      clearTimeout(pollTimer.current);

    // Start polling running test.
    pollTimer.current = setTimeout(async () => {
      try {
        const model = await loadSingleTraceFile(traceLocation);
        setModel({ model, isLive: true });
      } catch {
        setModel(undefined);
      } finally {
        setCounter(counter + 1);
      }
    }, 500);
    return () => {
      if (pollTimer.current)
        clearTimeout(pollTimer.current);
    };
  }, [counter, traceLocation]);

  const fallbackLocation = React.useMemo(() => {
    if (!source)
      return undefined;
    const fallbackLocation: SourceLocation = {
      file: '',
      line: 0,
      column: 0,
      source: {
        errors: [],
        content: source.text
      }
    };
    return fallbackLocation;
  }, [source]);

  return <Workbench
    key='workbench'
    model={model?.model}
    showSourcesFirst={true}
    fallbackLocation={fallbackLocation}
    isLive={true}
    hideTimeline={true}
    hideMetatada={true}
  />;
};

async function loadSingleTraceFile(url: string): Promise<MultiTraceModel> {
  const params = new URLSearchParams();
  params.set('trace', url);
  const response = await fetch(`contexts?${params.toString()}`);
  const contextEntries = await response.json() as ContextEntry[];
  return new MultiTraceModel(contextEntries);
}


type ConnectionOptions = {
  setSources: (sources: Source[]) => void;
  setMode: (mode: Mode) => void;
};

class Connection {
  private _lastId = 0;
  private _webSocket: WebSocket;
  private _callbacks = new Map<number, { resolve: (arg: any) => void, reject: (arg: Error) => void }>();
  private _options: ConnectionOptions;

  constructor(webSocket: WebSocket, options: ConnectionOptions) {
    this._webSocket = webSocket;
    this._callbacks = new Map();
    this._options = options;

    this._webSocket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      const { id, result, error, method, params } = message;
      if (id) {
        const callback = this._callbacks.get(id);
        if (!callback)
          return;
        this._callbacks.delete(id);
        if (error)
          callback.reject(new Error(error));
        else
          callback.resolve(result);
      } else {
        this._dispatchEvent(method, params);
      }
    });
  }

  setMode(mode: Mode) {
    this._sendMessageNoReply('setMode', { mode });
  }

  private async _sendMessage(method: string, params?: any): Promise<any> {
    const id = ++this._lastId;
    const message = { id, method, params };
    this._webSocket.send(JSON.stringify(message));
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, { resolve, reject });
    });
  }

  private _sendMessageNoReply(method: string, params?: any) {
    this._sendMessage(method, params);
  }

  private _dispatchEvent(method: string, params?: any) {
    if (method === 'setSources') {
      const { sources } = params as { sources: Source[] };
      this._options.setSources(sources);
      window.playwrightSourcesEchoForTest = sources;
    }

    if (method === 'setMode') {
      const { mode } = params as { mode: Mode };
      this._options.setMode(mode);
    }
  }
}
