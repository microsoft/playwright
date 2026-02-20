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

import { Transport } from './transport';

import type { DevToolsChannel } from './devtoolsChannel';

export type DevToolsClientChannel = DevToolsChannel & {
  onopen?: () => void;
  onclose?: (reason?: string) => void;
  close(): void;
};

export class DevToolsClient {
  private _transport: Transport;
  private _listeners = new Map<string, Set<Function>>();

  onopen?: () => void;
  onclose?: (reason?: string) => void;

  private constructor(transport: Transport) {
    this._transport = transport;
    this._transport.onopen = () => {
      this.onopen?.();
    };
    this._transport.onevent = (method: string, params: any) => {
      this._fireEvent(method, params);
    };
    this._transport.onclose = (reason?: string) => {
      this.onclose?.(reason);
    };
  }

  static create(url: string): DevToolsClientChannel {
    const transport = new Transport(url);
    const client = new DevToolsClient(transport);
    return new Proxy(client, {
      get(target: DevToolsClient, prop: string | symbol, receiver: any): any {
        if (typeof prop === 'symbol' || prop in target)
          return Reflect.get(target, prop, receiver);
        // Prevent the proxy from being treated as a thenable.
        if (prop === 'then')
          return undefined;
        return (params?: any) => target._transport.send(prop, params);
      }
    }) as unknown as DevToolsClientChannel;
  }

  private _fireEvent(event: string, params: any) {
    const set = this._listeners.get(event);
    if (set) {
      for (const listener of set)
        listener(params);
    }
  }

  on(event: string, listener: Function): void {
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(listener);
  }

  off(event: string, listener: Function): void {
    this._listeners.get(event)?.delete(listener);
  }

  close() {
    this._transport.close();
  }
}
