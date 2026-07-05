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
  serializedArgs: SerializedValue[],
};

type BindingData = {
  callbacks: Map<number, { resolve: (value: any) => void, reject: (error: Error) => void }>;
  lastSeq: number;
  removed: boolean;
};

export class BindingsController {
  private _global: typeof globalThis;
  private _globalBindingName: string;
  private _bindings = new Map<string, BindingData>();

  constructor(global: typeof globalThis, globalBindingName: string) {
    this._global = global;
    this._globalBindingName = globalBindingName;
  }

  addBinding(bindingName: string) {
    const data: BindingData = {
      callbacks: new Map(),
      lastSeq: 0,
      removed: false,
    };
    this._bindings.set(bindingName, data);
    (this._global as any)[bindingName] = (...args: any[]) => {
      if (data.removed)
        throw new Error(`binding "${bindingName}" has been removed`);
      const seq = ++data.lastSeq;
      const promise = new Promise((resolve, reject) => data.callbacks.set(seq, { resolve, reject }));
      const serializedArgs = [];
      for (let i = 0; i < args.length; i++) {
        serializedArgs[i] = serializeAsCallArgument(args[i], v => {
          return { fallThrough: v };
        });
      }
      const payload: BindingPayload = { name: bindingName, seq, serializedArgs };
      (this._global as any)[this._globalBindingName](this._stringifyPayload(payload));
      return promise;
    };
  }

  private _stringifyPayload(payload: BindingPayload): string {
    // The page may define Array.prototype.toJSON/Object.prototype.toJSON (e.g. Prototype.js),
    // which would corrupt JSON.stringify(payload) into something other than an object with
    // a serializedArgs array. Temporarily remove them so our own payload serializes correctly.
    const arrayToJSON = (Array.prototype as any).toJSON;
    const objectToJSON = (Object.prototype as any).toJSON;
    try {
      delete (Array.prototype as any).toJSON;
      delete (Object.prototype as any).toJSON;
      return JSON.stringify(payload);
    } finally {
      if (arrayToJSON !== undefined)
        (Array.prototype as any).toJSON = arrayToJSON;
      if (objectToJSON !== undefined)
        (Object.prototype as any).toJSON = objectToJSON;
    }
  }

  removeBinding(bindingName: string) {
    const data = this._bindings.get(bindingName);
    if (data)
      data.removed = true;
    this._bindings.delete(bindingName);
    delete (this._global as any)[bindingName];
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
