/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export class PortTransport {
  private _lastId = 0;
  private _port: MessagePort;
  private _callbacks = new Map<number, (result: any) => void>();

  constructor(port: MessagePort, handler: (method: string, params: any) => Promise<any>) {
    this._port = port;
    port.addEventListener('message', async event => {
      const message = event.data;
      const { id, ackId, method, params, result } = message;
      if (id) {
        const result = await handler(method, params);
        this._port.postMessage({ ackId: id, result });
        return;
      }

      if (ackId) {
        const callback = this._callbacks.get(ackId);
        this._callbacks.delete(ackId);
        callback?.(result);
        return;
      }
    });
  }

  async send(method: string, params: any) {
    return await new Promise<any>(f => {
      const id = ++this._lastId;
      this._callbacks.set(id, f);
      this._port.postMessage({ id, method, params });
    });
  }
}
