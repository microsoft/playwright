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

let lastId = 0;
let _ws: WebSocket | undefined;
const callbacks = new Map<number, { resolve: (arg: any) => void, reject: (arg: Error) => void }>();
let retryCount = 0;
let pingInterval: NodeJS.Timeout | undefined;
const bufferedMessages: { method: string, params?: any }[] = [];

export async function connect({
  onEvent,
  onClose = () => {},
  maxRetries = 3,
}: {
  onEvent: (method: string, params?: any) => void;
  onClose?: () => void;
  maxRetries?: number;
}): Promise<(method: string, params?: any) => Promise<any>> {
  const guid = new URLSearchParams(window.location.search).get('ws');
  const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:${window.location.port}/${guid}`);
  ws.addEventListener('close', () => {
    _ws = undefined;
    if (retryCount < maxRetries) {
      retryCount++;
      clearInterval(pingInterval);
      setTimeout(() => connect({ onClose, onEvent, maxRetries }), 100 * retryCount);
    } else {
      retryCount = 0;
      onClose();
    }
  });
  await new Promise(f => ws.addEventListener('open', f));
  retryCount = 0;
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const { id, result, error, method, params } = message;
    if (id) {
      const callback = callbacks.get(id);
      if (!callback)
        return;
      callbacks.delete(id);
      if (error)
        callback.reject(new Error(error));
      else
        callback.resolve(result);
    } else {
      onEvent(method, params);
    }
  });
  _ws = ws;
  pingInterval = setInterval(() => sendMessage('ping').catch(() => {}), 30000);

  while (bufferedMessages.length)
    ws.send(JSON.stringify(bufferedMessages.shift()));

  return sendMessage;
}

const sendMessage = async (method: string, params?: any): Promise<any> => {
  const id = ++lastId;
  const message = { id, method, params };
  if (!_ws)
    bufferedMessages.push(message);
  else
    _ws.send(JSON.stringify(message));
  return new Promise((resolve, reject) => {
    callbacks.set(id, { resolve, reject });
  });
};
