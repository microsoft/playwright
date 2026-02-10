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

export class DevToolsTransport {
  private _ws: WebSocket;
  private _lastId = 0;
  private _pending = new Map<number, { resolve: (result: any) => void; reject: (error: Error) => void }>();

  onopen?: () => void;
  onevent?: (method: string, params: any) => void;
  onclose?: (reason?: string) => void;

  constructor(url: string) {
    this._ws = new WebSocket(url);
    this._ws.onopen = () => {
      if (this.onopen)
        this.onopen();
    };
    this._ws.onmessage = (event: MessageEvent) => {
      let msg: any;
      try {
        msg = JSON.parse(event.data);
      } catch {
        this._ws.close();
        return;
      }
      if (msg.id !== undefined) {
        const pending = this._pending.get(msg.id);
        if (pending) {
          this._pending.delete(msg.id);
          if (msg.error)
            pending.reject(new Error(msg.error));
          else
            pending.resolve(msg.result);
        }
      } else if (msg.method) {
        if (this.onevent)
          this.onevent(msg.method, msg.params);
      }
    };
    this._ws.onclose = (event: CloseEvent) => {
      for (const { reject } of this._pending.values())
        reject(new Error('Connection closed'));
      this._pending.clear();
      if (this.onclose)
        this.onclose(event.reason);
    };
    this._ws.onerror = () => {};
  }

  sendNoReply(method: string, params?: any) {
    this.send(method, params).catch(() => {});
  }

  send(method: string, params?: any): Promise<any> {
    const id = ++this._lastId;
    this._ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
    });
  }

  close() {
    this._ws.close();
  }
}
