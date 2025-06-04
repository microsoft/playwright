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

      if (ackId) {
        const callback = this._callbacks.get(ackId);
        this._callbacks.delete(ackId);
        this._resetRef();
        callback?.(result);
        return;
      }

      const handlerResult = await handler(method, params);
      if (id)
        this._port.postMessage({ ackId: id, result: handlerResult });
    });
    // Make sure to unref **after** adding a 'message' event listener.
    // https://nodejs.org/api/worker_threads.html#portref
    this._resetRef();
  }

  post(method: string, params: any) {
    this._port.postMessage({ method, params });
  }

  async send(method: string, params: any) {
    return await new Promise<any>(f => {
      const id = ++this._lastId;
      this._callbacks.set(id, f);
      this._resetRef();
      this._port.postMessage({ id, method, params });
    });
  }

  private _resetRef() {
    if (this._callbacks.size) {
      // When we are waiting for a response, ref the port to prevent this process from exiting.
      (this._port as any).ref();
    } else {
      // When we are not waiting for a response, unref the port to prevent this process
      // from hanging forever.
      (this._port as any).unref();
    }
  }
}
