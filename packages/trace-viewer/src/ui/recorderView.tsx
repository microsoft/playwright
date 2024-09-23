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

const searchParams = new URLSearchParams(window.location.search);
const guid = searchParams.get('ws');
const trace = searchParams.get('trace') + '.json';

export const RecorderView: React.FunctionComponent = () => {
  const [connection, setConnection] = React.useState<Connection | null>(null);
  const [sources, setSources] = React.useState<Source[]>([]);
  React.useEffect(() => {
    const wsURL = new URL(`../${guid}`, window.location.toString());
    wsURL.protocol = (window.location.protocol === 'https:' ? 'wss:' : 'ws:');
    const webSocket = new WebSocket(wsURL.toString());
    setConnection(new Connection(webSocket, { setSources }));
    return () => {
      webSocket.close();
    };
  }, []);

  React.useEffect(() => {
    if (!connection)
      return;
    connection.setMode('recording');
  }, [connection]);

  return <div className='vbox workbench-loader'>
    <TraceView
      traceLocation={trace}
      sources={sources} />
  </div>;
};

export const TraceView: React.FC<{
  traceLocation: string,
  sources: Source[],
}> = ({ traceLocation, sources }) => {
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
    if (!sources.length)
      return undefined;
    const fallbackLocation: SourceLocation = {
      file: '',
      line: 0,
      column: 0,
      source: {
        errors: [],
        content: sources[0].text
      }
    };
    return fallbackLocation;
  }, [sources]);

  return <Workbench
    key='workbench'
    model={model?.model}
    showSourcesFirst={true}
    fallbackLocation={fallbackLocation}
    isLive={true}
    hideTimeline={true}
  />;
};

async function loadSingleTraceFile(url: string): Promise<MultiTraceModel> {
  const params = new URLSearchParams();
  params.set('trace', url);
  const response = await fetch(`contexts?${params.toString()}`);
  const contextEntries = await response.json() as ContextEntry[];
  return new MultiTraceModel(contextEntries);
}

class Connection {
  private _lastId = 0;
  private _webSocket: WebSocket;
  private _callbacks = new Map<number, { resolve: (arg: any) => void, reject: (arg: Error) => void }>();
  private _options: { setSources: (sources: Source[]) => void; };

  constructor(webSocket: WebSocket, options: { setSources: (sources: Source[]) => void }) {
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
    this._sendMessage(method, params).catch(() => { });
  }

  private _dispatchEvent(method: string, params?: any) {
    if (method === 'setSources') {
      const { sources } = params as { sources: Source[] };
      this._options.setSources(sources);
      window.playwrightSourcesEchoForTest = sources;
    }
  }
}
