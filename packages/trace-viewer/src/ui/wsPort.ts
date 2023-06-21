/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';

type ConnectOptions = {
  onEvent: (method: string, params?: any) => void;
  onClose: () => void;
};

type WebSocketMessageSender = (method: string, params?: any) => Promise<any>;

export function useWebSocket(): [(options: ConnectOptions) => Promise<WebSocketMessageSender>] {
  const lastIdRef = React.useRef(0);
  const wsRef = React.useRef<WebSocket>();
  const callbacksRef = React.useRef(new Map<number, { resolve: (arg: any) => void, reject: (arg: Error) => void }>());

  const sendMessage = React.useCallback(async (method: string, params?: any): Promise<any> => {
    if (!wsRef.current)
      return;
    const id = ++lastIdRef.current;
    const message = { id, method, params };
    wsRef.current.send(JSON.stringify(message));
    return new Promise((resolve, reject) => {
      callbacksRef.current.set(id, { resolve, reject });
    });
  }, []);

  const connectIfNeeded = React.useCallback(async (options: ConnectOptions): Promise<WebSocketMessageSender> => {
    if (wsRef.current)
      return sendMessage;
    const guid = new URLSearchParams(window.location.search).get('ws');
    const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:${window.location.port}/${guid}`);
    await new Promise(f => ws.addEventListener('open', f));
    ws.addEventListener('close', options.onClose);
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      const { id, result, error, method, params } = message;
      if (id) {
        const callback = callbacksRef.current.get(id);
        if (!callback)
          return;
        callbacksRef.current.delete(id);
        if (error)
          callback.reject(new Error(error));
        else
          callback.resolve(result);
      } else {
        options.onEvent(method, params);
      }
    });
    wsRef.current = ws;
    setInterval(() => sendMessage('ping').catch(() => { }), 30000);
    return sendMessage;
  }, [sendMessage]);

  return [
    connectIfNeeded,
  ];
}
