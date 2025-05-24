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

import { serializeAsCallArgument } from '@isomorphic/utilityScriptSerializers';

import type { SerializedValue } from '@isomorphic/utilityScriptSerializers';

export type BindingPayload = {
  name: string;
  seq: number;
  serializedArgs?: SerializedValue[],
};

type BindingData = {
  callbacks: Map<number, { resolve: (value: any) => void, reject: (error: Error) => void }>;
  lastSeq: number;
  handles: Map<number, any>;
  removed: boolean;
};

export class BindingsController {
  // eslint-disable-next-line no-restricted-globals
  private _global: typeof globalThis;
  private _globalBindingName: string;
  private _bindings = new Map<string, BindingData>();

  // eslint-disable-next-line no-restricted-globals
  constructor(global: typeof globalThis, globalBindingName: string) {
    this._global = global;
    this._globalBindingName = globalBindingName;
  }

  addBinding(bindingName: string, needsHandle: boolean) {
    const data: BindingData = {
      callbacks: new Map(),
      lastSeq: 0,
      handles: new Map(),
      removed: false,
    };
    this._bindings.set(bindingName, data);
    (this._global as any)[bindingName] = (...args: any[]) => {
      if (data.removed)
        throw new Error(`binding "${bindingName}" has been removed`);
      if (needsHandle && args.slice(1).some(arg => arg !== undefined))
        throw new Error(`exposeBindingHandle supports a single argument, ${args.length} received`);
      const seq = ++data.lastSeq;
      const promise = new Promise((resolve, reject) => data.callbacks.set(seq, { resolve, reject }));
      let payload: BindingPayload;
      if (needsHandle) {
        data.handles.set(seq, args[0]);
        payload = { name: bindingName, seq };
      } else {
        const serializedArgs = [];
        for (let i = 0; i < args.length; i++) {
          serializedArgs[i] = serializeAsCallArgument(args[i], v => {
            return { fallThrough: v };
          });
        }
        payload = { name: bindingName, seq, serializedArgs };
      }
      (this._global as any)[this._globalBindingName](JSON.stringify(payload));
      return promise;
    };
  }

  removeBinding(bindingName: string) {
    const data = this._bindings.get(bindingName);
    if (data)
      data.removed = true;
    this._bindings.delete(bindingName);
    delete (this._global as any)[bindingName];
  }

  takeBindingHandle(arg: { name: string, seq: number }) {
    const handles = this._bindings.get(arg.name)!.handles;
    const handle = handles.get(arg.seq);
    handles.delete(arg.seq);
    return handle;
  }

  deliverBindingResult(arg: { name: string, seq: number, result?: any, error?: any }) {
    const callbacks = this._bindings.get(arg.name)!.callbacks;
    if ('error' in arg)
      callbacks.get(arg.seq)!.reject(arg.error);
    else
      callbacks.get(arg.seq)!.resolve(arg.result);
    callbacks.delete(arg.seq);
  }
}
