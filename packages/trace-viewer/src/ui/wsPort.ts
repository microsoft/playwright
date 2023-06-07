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
let _ws: WebSocket;
const callbacks = new Map<number, { resolve: (arg: any) => void, reject: (arg: Error) => void }>();

export async function connect(options: { onEvent: (method: string, params?: any) => void, onClose: () => void }): Promise<(method: string, params?: any) => Promise<any>> {
  const guid = new URLSearchParams(window.location.search).get('ws');
  const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:${window.location.port}/${guid}`);
  await new Promise(f => ws.addEventListener('open', f));
  ws.addEventListener('close', options.onClose);
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
      options.onEvent(method, params);
    }
  });
  _ws = ws;
  setInterval(() => sendMessage('ping').catch(() => {}), 30000);
  return sendMessage;
}

const sendMessage = async (method: string, params?: any): Promise<any> => {
  const id = ++lastId;
  const message = { id, method, params };
  _ws.send(JSON.stringify(message));
  return new Promise((resolve, reject) => {
    callbacks.set(id, { resolve, reject });
  });
};
