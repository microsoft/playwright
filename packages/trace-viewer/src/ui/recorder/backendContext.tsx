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

import type * as actionTypes from '@recorder/actions';
import type { Mode, Source } from '@recorder/recorderTypes';
import * as React from 'react';

export const BackendContext = React.createContext<Backend | undefined>(undefined);

export const BackendProvider: React.FunctionComponent<React.PropsWithChildren<{
  guid: string,
}>> = ({ guid, children }) => {
  const [connection, setConnection] = React.useState<Connection | undefined>(undefined);
  const [mode, setMode] = React.useState<Mode>('none');
  const [actions, setActions] = React.useState<{ actions: actionTypes.ActionInContext[], sources: Source[] }>({ actions: [], sources: [] });
  const callbacks = React.useRef({ setMode, setActions });

  React.useEffect(() => {
    const wsURL = new URL(`../${guid}`, window.location.toString());
    wsURL.protocol = (window.location.protocol === 'https:' ? 'wss:' : 'ws:');
    const webSocket = new WebSocket(wsURL.toString());
    setConnection(new Connection(webSocket, callbacks.current));
    return () => {
      webSocket.close();
    };
  }, [guid]);

  const backend = React.useMemo(() => {
    return connection ? { mode, actions: actions.actions, sources: actions.sources, connection } : undefined;
  }, [actions, mode, connection]);

  return <BackendContext.Provider value={backend}>
    {children}
  </BackendContext.Provider>;
};

export type Backend = {
  actions: actionTypes.ActionInContext[],
  sources: Source[],
  connection: Connection,
};

type ConnectionCallbacks = {
  setMode: (mode: Mode) => void;
  setActions: (data: { actions: actionTypes.ActionInContext[], sources: Source[] }) => void;
};

class Connection {
  private _lastId = 0;
  private _webSocket: WebSocket;
  private _callbacks = new Map<number, { resolve: (arg: any) => void, reject: (arg: Error) => void }>();
  private _options: ConnectionCallbacks;

  constructor(webSocket: WebSocket, options: ConnectionCallbacks) {
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
    if (method === 'setMode') {
      const { mode } = params as { mode: Mode };
      this._options.setMode(mode);
    }
    if (method === 'setActions') {
      const { actions, sources } = params as { actions: actionTypes.ActionInContext[], sources: Source[] };
      this._options.setActions({ actions: actions.filter(a => a.action.name !== 'openPage' && a.action.name !== 'closePage'), sources });
      (window as any).playwrightSourcesEchoForTest = sources;
    }
  }
}
